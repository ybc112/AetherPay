#!/bin/bash

################################################################################
# AetherOracle V3 → V2 Rollback Script
#
# This script rolls back the EigenDA migration and restores V2 service
################################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${1:-}"

log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

log_error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR:${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING:${NC} $1"
}

if [ -z "$BACKUP_DIR" ]; then
    log_error "Usage: ./rollback-migration.sh <backup_directory>"
    log_error "Example: ./rollback-migration.sh ./backups/20240315_120000"
    exit 1
fi

if [ ! -d "$BACKUP_DIR" ]; then
    log_error "Backup directory not found: $BACKUP_DIR"
    exit 1
fi

log "════════════════════════════════════════════════════════════════"
log "  Rolling back to V2 from backup: $BACKUP_DIR"
log "════════════════════════════════════════════════════════════════"
log ""

# Stop V3 service
log "🛑 Stopping V3 service..."
pm2 stop aether-oracle-v3 2>/dev/null || true
pm2 delete aether-oracle-v3 2>/dev/null || true
log "✅ V3 service stopped"

# Stop EigenDA Proxy
log "🛑 Stopping EigenDA Proxy..."
cd "$SCRIPT_DIR/eigenda-proxy"
docker-compose down 2>/dev/null || true
log "✅ EigenDA Proxy stopped"

# Restore .env file
log "📝 Restoring V2 configuration..."
if [ -f "$BACKUP_DIR/.env.backup" ]; then
    cp "$BACKUP_DIR/.env.backup" "$SCRIPT_DIR/oracle/.env"
    log "✅ V2 configuration restored"
else
    log_error ".env backup not found in $BACKUP_DIR"
    exit 1
fi

# Restore SQLite database
log "💾 Restoring V2 database..."
if [ -f "$BACKUP_DIR/oracle.db.backup" ]; then
    cp "$BACKUP_DIR/oracle.db.backup" "$SCRIPT_DIR/oracle/oracle.db"
    log "✅ V2 database restored"
else
    log_warn "Database backup not found, using existing database"
fi

# Restart V2 service
log "🚀 Starting V2 service..."
cd "$SCRIPT_DIR/oracle"
pm2 start server.js --name aether-oracle

# Wait for service to be ready
log "⏳ Waiting for V2 service to be ready..."
sleep 5

max_attempts=30
attempt=0
while [ $attempt -lt $max_attempts ]; do
    if curl -s http://localhost:3000/health > /dev/null 2>&1; then
        log "✅ V2 service is healthy"
        break
    fi
    attempt=$((attempt + 1))
    sleep 2
done

if [ $attempt -eq $max_attempts ]; then
    log_error "V2 service failed to start"
    exit 1
fi

log ""
log "════════════════════════════════════════════════════════════════"
log "  ✅ Rollback completed successfully!"
log "════════════════════════════════════════════════════════════════"
log ""
log "📝 Rollback Summary:"
log "  - V2 service restored and running on port 3000"
log "  - Configuration restored from: $BACKUP_DIR"
log "  - V3 service and EigenDA Proxy stopped"
log ""
log "📊 Check service status:"
log "  - pm2 logs aether-oracle"
log "  - curl http://localhost:3000/health"
log ""
