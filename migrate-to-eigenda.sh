#!/bin/bash

################################################################################
# AetherOracle V2 → V3 (EigenDA) Migration Script
#
# This script automates the complete migration process from AetherOracleV2
# to AetherOracleV3_EigenDA with zero downtime and data preservation.
#
# Migration Strategy:
# 1. Backup existing V2 data and configuration
# 2. Deploy new V3_EigenDA contract
# 3. Migrate oracle nodes to new contract
# 4. Switch oracle service to EigenDA-enabled version
# 5. Verify migration success
# 6. Optional: Keep V2 running in parallel during transition
################################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/backups/$(date +%Y%m%d_%H%M%S)"
LOG_FILE="$SCRIPT_DIR/migration.log"
PARALLEL_MODE=${PARALLEL_MODE:-true}  # Run V2 and V3 in parallel during transition

# Contract addresses (will be updated during deployment)
V2_CONTRACT=""
V3_CONTRACT=""

################################################################################
# Logging Functions
################################################################################

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1" | tee -a "$LOG_FILE"
}

log_warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1" | tee -a "$LOG_FILE"
}

log_info() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO:${NC} $1" | tee -a "$LOG_FILE"
}

################################################################################
# Pre-Migration Checks
################################################################################

check_prerequisites() {
    log "🔍 Checking prerequisites..."

    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker first."
        exit 1
    fi

    # Check if Node.js is installed
    if ! command -v node &> /dev/null; then
        log_error "Node.js is not installed. Please install Node.js first."
        exit 1
    fi

    # Check if npx is available
    if ! command -v npx &> /dev/null; then
        log_error "npx is not available. Please install npm first."
        exit 1
    fi

    # Check if .env file exists
    if [ ! -f "$SCRIPT_DIR/oracle/.env" ]; then
        log_error ".env file not found in oracle/. Please create it first."
        exit 1
    fi

    # Check if V2 contract address is set
    source "$SCRIPT_DIR/oracle/.env"
    if [ -z "${ORACLE_CONTRACT_ADDRESS:-}" ]; then
        log_error "ORACLE_CONTRACT_ADDRESS not set in .env file."
        exit 1
    fi

    V2_CONTRACT="$ORACLE_CONTRACT_ADDRESS"
    log "✅ V2 Contract Address: $V2_CONTRACT"

    # Check disk space (need at least 5GB for Docker images and data)
    available_space=$(df -BG "$SCRIPT_DIR" | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "$available_space" -lt 5 ]; then
        log_error "Insufficient disk space. Need at least 5GB free."
        exit 1
    fi

    log "✅ All prerequisites met"
}

################################################################################
# Backup Functions
################################################################################

backup_v2_data() {
    log "💾 Backing up V2 data and configuration..."

    # Create backup directory
    mkdir -p "$BACKUP_DIR"

    # Backup SQLite database
    if [ -f "$SCRIPT_DIR/oracle/oracle.db" ]; then
        cp "$SCRIPT_DIR/oracle/oracle.db" "$BACKUP_DIR/oracle.db.backup"
        log "✅ SQLite database backed up"
    else
        log_warn "SQLite database not found, skipping backup"
    fi

    # Backup .env file
    cp "$SCRIPT_DIR/oracle/.env" "$BACKUP_DIR/.env.backup"
    log "✅ Environment configuration backed up"

    # Backup contract addresses
    echo "V2_CONTRACT=$V2_CONTRACT" > "$BACKUP_DIR/contract_addresses.txt"
    log "✅ Contract addresses backed up"

    # Export current oracle node status from V2 contract
    log_info "Exporting oracle node status from V2 contract..."
    cd "$SCRIPT_DIR/oracle"
    node -e "
        const { ethers } = require('ethers');
        const fs = require('fs');

        async function exportOracleStatus() {
            const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
            const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
            const oracleABI = JSON.parse(fs.readFileSync('../artifacts/contracts/AetherOracleV2.sol/AetherOracleV2.json', 'utf8')).abi;
            const contract = new ethers.Contract('$V2_CONTRACT', oracleABI, wallet);

            try {
                const isAuthorized = await contract.authorizedOracles(wallet.address);
                const reputation = await contract.oracleReputations(wallet.address);

                const status = {
                    address: wallet.address,
                    isAuthorized: isAuthorized,
                    reputation: reputation.toString(),
                    timestamp: new Date().toISOString()
                };

                fs.writeFileSync('$BACKUP_DIR/oracle_status.json', JSON.stringify(status, null, 2));
                console.log('✅ Oracle status exported');
            } catch (error) {
                console.error('❌ Failed to export oracle status:', error.message);
            }
        }

        exportOracleStatus();
    " || log_warn "Failed to export oracle status (non-critical)"

    log "✅ V2 data backup completed: $BACKUP_DIR"
}

################################################################################
# EigenDA Setup
################################################################################

start_eigenda_proxy() {
    log "🚀 Starting EigenDA Proxy..."

    cd "$SCRIPT_DIR/eigenda-proxy"

    # Stop existing proxy if running
    docker-compose down 2>/dev/null || true

    # Start EigenDA Proxy
    docker-compose up -d

    # Wait for proxy to be ready
    log_info "Waiting for EigenDA Proxy to be ready..."
    max_attempts=30
    attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:4242/health > /dev/null 2>&1; then
            log "✅ EigenDA Proxy is ready"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
    done

    log_error "EigenDA Proxy failed to start after ${max_attempts} attempts"
    exit 1
}

################################################################################
# Contract Deployment
################################################################################

deploy_v3_contract() {
    log "📝 Deploying AetherOracleV3_EigenDA contract..."

    cd "$SCRIPT_DIR"

    # Compile contracts
    log_info "Compiling contracts..."
    npx hardhat compile

    # Deploy contract
    log_info "Deploying AetherOracleV3_EigenDA..."
    deployment_output=$(npx hardhat run scripts/deploy-eigenda.js --network optimismSepolia)

    # Extract contract address from deployment output
    V3_CONTRACT=$(echo "$deployment_output" | grep "AetherOracleV3_EigenDA deployed to:" | awk '{print $NF}')

    if [ -z "$V3_CONTRACT" ]; then
        log_error "Failed to extract V3 contract address from deployment output"
        exit 1
    fi

    log "✅ V3 Contract deployed at: $V3_CONTRACT"

    # Save contract address to backup
    echo "V3_CONTRACT=$V3_CONTRACT" >> "$BACKUP_DIR/contract_addresses.txt"

    # Update addresses.json
    if [ -f "addresses.json" ]; then
        # Backup existing addresses.json
        cp addresses.json "$BACKUP_DIR/addresses.json.backup"

        # Add V3 contract address
        node -e "
            const fs = require('fs');
            const addresses = JSON.parse(fs.readFileSync('addresses.json', 'utf8'));
            addresses.AetherOracleV3_EigenDA = '$V3_CONTRACT';
            addresses.AetherOracleV2_Legacy = '$V2_CONTRACT';
            fs.writeFileSync('addresses.json', JSON.stringify(addresses, null, 2));
            console.log('✅ addresses.json updated');
        "
    fi
}

################################################################################
# Oracle Node Migration
################################################################################

migrate_oracle_node() {
    log "🔄 Migrating oracle node to V3 contract..."

    cd "$SCRIPT_DIR/oracle"

    # Update .env file
    log_info "Updating .env configuration..."

    # Backup current .env
    cp .env "$BACKUP_DIR/.env.current"

    # Update ORACLE_CONTRACT_ADDRESS
    sed -i.bak "s|ORACLE_CONTRACT_ADDRESS=.*|ORACLE_CONTRACT_ADDRESS=$V3_CONTRACT|g" .env

    # Add EIGENDA_PROXY_URL if not exists
    if ! grep -q "EIGENDA_PROXY_URL" .env; then
        echo "" >> .env
        echo "# EigenDA Configuration" >> .env
        echo "EIGENDA_PROXY_URL=http://localhost:4242" >> .env
    fi

    # Add USE_EIGENDA flag
    if ! grep -q "USE_EIGENDA" .env; then
        echo "USE_EIGENDA=true" >> .env
    else
        sed -i.bak "s|USE_EIGENDA=.*|USE_EIGENDA=true|g" .env
    fi

    log "✅ Environment configuration updated"

    # Register oracle node on V3 contract
    log_info "Registering oracle node on V3 contract..."

    node -e "
        const { ethers } = require('ethers');
        const fs = require('fs');

        async function registerOracle() {
            const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
            const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
            const oracleABI = JSON.parse(fs.readFileSync('../artifacts/contracts/AetherOracleV3_EigenDA.sol/AetherOracleV3_EigenDA.json', 'utf8')).abi;
            const contract = new ethers.Contract('$V3_CONTRACT', oracleABI, wallet);

            try {
                // Check if already registered
                const isAuthorized = await contract.authorizedOracles(wallet.address);
                if (isAuthorized) {
                    console.log('✅ Oracle already registered on V3 contract');
                    return;
                }

                // Register oracle (assuming contract owner is calling this)
                const tx = await contract.addOracle(wallet.address);
                await tx.wait();
                console.log('✅ Oracle registered on V3 contract');
            } catch (error) {
                console.error('❌ Failed to register oracle:', error.message);
                process.exit(1);
            }
        }

        registerOracle();
    "

    log "✅ Oracle node migration completed"
}

################################################################################
# Service Migration
################################################################################

switch_oracle_service() {
    log "🔄 Switching oracle service to EigenDA version..."

    cd "$SCRIPT_DIR/oracle"

    if [ "$PARALLEL_MODE" = true ]; then
        log_info "Starting parallel mode: V2 and V3 services will run simultaneously"

        # Keep V2 service running, start V3 service on different port
        # Update V3 service to use port 3001 instead of 3000
        sed -i.bak "s|PORT=3000|PORT=3001|g" .env.v3 2>/dev/null || echo "PORT=3001" > .env.v3

        # Start V3 service
        pm2 start oracle-eigenda.ts --name aether-oracle-v3 --interpreter ts-node -- --env .env.v3

        log "✅ V3 service started on port 3001 (parallel with V2 on port 3000)"
        log_warn "Both V2 and V3 services are running. Monitor for 24h before stopping V2."

    else
        log_info "Starting single mode: Stopping V2 and starting V3"

        # Stop V2 service
        pm2 stop aether-oracle 2>/dev/null || true
        pm2 delete aether-oracle 2>/dev/null || true

        # Start V3 service
        pm2 start oracle-eigenda.ts --name aether-oracle-v3 --interpreter ts-node

        log "✅ V3 service started (V2 stopped)"
    fi

    # Wait for service to be healthy
    log_info "Waiting for oracle service to be healthy..."
    sleep 5

    max_attempts=30
    attempt=0
    while [ $attempt -lt $max_attempts ]; do
        if curl -s http://localhost:3001/health > /dev/null 2>&1 || curl -s http://localhost:3000/health > /dev/null 2>&1; then
            log "✅ Oracle service is healthy"
            return 0
        fi
        attempt=$((attempt + 1))
        sleep 2
    done

    log_error "Oracle service failed to start"
    exit 1
}

################################################################################
# Verification
################################################################################

verify_migration() {
    log "🔍 Verifying migration..."

    # Check EigenDA Proxy
    log_info "Checking EigenDA Proxy..."
    if ! curl -s http://localhost:4242/health > /dev/null 2>&1; then
        log_error "EigenDA Proxy health check failed"
        return 1
    fi
    log "✅ EigenDA Proxy is healthy"

    # Check Oracle Service
    log_info "Checking Oracle Service..."
    if ! curl -s http://localhost:3001/health > /dev/null 2>&1 && ! curl -s http://localhost:3000/health > /dev/null 2>&1; then
        log_error "Oracle Service health check failed"
        return 1
    fi
    log "✅ Oracle Service is healthy"

    # Check contract on-chain
    log_info "Checking V3 contract on-chain..."
    cd "$SCRIPT_DIR/oracle"
    node -e "
        const { ethers } = require('ethers');
        const fs = require('fs');

        async function verifyContract() {
            const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
            const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
            const oracleABI = JSON.parse(fs.readFileSync('../artifacts/contracts/AetherOracleV3_EigenDA.sol/AetherOracleV3_EigenDA.json', 'utf8')).abi;
            const contract = new ethers.Contract('$V3_CONTRACT', oracleABI, wallet);

            try {
                const isAuthorized = await contract.authorizedOracles(wallet.address);
                const oracleCount = await contract.getOracleCount();
                console.log('✅ Contract verification passed');
                console.log('  - Oracle authorized:', isAuthorized);
                console.log('  - Total oracles:', oracleCount.toString());
            } catch (error) {
                console.error('❌ Contract verification failed:', error.message);
                process.exit(1);
            }
        }

        verifyContract();
    " || {
        log_error "V3 contract verification failed"
        return 1
    }

    log "✅ Migration verification completed successfully"
}

################################################################################
# Rollback Function
################################################################################

rollback_migration() {
    log_error "🔄 Rolling back migration..."

    # Stop V3 service
    pm2 stop aether-oracle-v3 2>/dev/null || true
    pm2 delete aether-oracle-v3 2>/dev/null || true

    # Restore V2 configuration
    if [ -f "$BACKUP_DIR/.env.backup" ]; then
        cp "$BACKUP_DIR/.env.backup" "$SCRIPT_DIR/oracle/.env"
        log "✅ Restored V2 configuration"
    fi

    # Restart V2 service
    cd "$SCRIPT_DIR/oracle"
    pm2 start server.js --name aether-oracle

    log "✅ Rollback completed - V2 service restored"
}

################################################################################
# Main Migration Flow
################################################################################

main() {
    log "════════════════════════════════════════════════════════════════"
    log "  AetherOracle V2 → V3 (EigenDA) Migration"
    log "════════════════════════════════════════════════════════════════"
    log ""

    # Step 1: Pre-migration checks
    check_prerequisites

    # Step 2: Backup V2 data
    backup_v2_data

    # Step 3: Start EigenDA Proxy
    start_eigenda_proxy

    # Step 4: Deploy V3 contract
    deploy_v3_contract

    # Step 5: Migrate oracle node
    migrate_oracle_node

    # Step 6: Switch oracle service
    switch_oracle_service

    # Step 7: Verify migration
    if ! verify_migration; then
        log_error "Migration verification failed!"
        log_warn "You can manually rollback by running: ./rollback-migration.sh"
        exit 1
    fi

    log ""
    log "════════════════════════════════════════════════════════════════"
    log "  ✅ Migration completed successfully!"
    log "════════════════════════════════════════════════════════════════"
    log ""
    log "📝 Migration Summary:"
    log "  - V2 Contract: $V2_CONTRACT"
    log "  - V3 Contract: $V3_CONTRACT"
    log "  - Backup Location: $BACKUP_DIR"
    log "  - Log File: $LOG_FILE"
    log ""

    if [ "$PARALLEL_MODE" = true ]; then
        log "⚠️  PARALLEL MODE ACTIVE:"
        log "  - V2 service running on port 3000"
        log "  - V3 service running on port 3001"
        log "  - Monitor both services for 24h before stopping V2"
        log "  - To stop V2: pm2 stop aether-oracle"
        log ""
    fi

    log "📊 Next Steps:"
    log "  1. Monitor oracle service: pm2 logs aether-oracle-v3"
    log "  2. Check EigenDA Proxy: curl http://localhost:4242/health"
    log "  3. View metrics: http://localhost:3001/metrics (or 3000 if V2)"
    log "  4. Test rate submission: npm run test:oracle"
    log ""
    log "🔄 To rollback migration: ./rollback-migration.sh $BACKUP_DIR"
    log ""
}

# Handle errors
trap 'log_error "Migration failed at line $LINENO. Check $LOG_FILE for details."' ERR

# Run migration
main "$@"
