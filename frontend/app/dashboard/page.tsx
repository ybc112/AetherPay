'use client';

import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { CONTRACTS, PAYMENT_GATEWAY_ABI } from '@/lib/contracts';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { optimismSepolia } from 'wagmi/chains';

export default function Dashboard() {
  const { address, isConnected } = useAccount();
  const [businessName, setBusinessName] = useState('');
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  
  // Write contract with enhanced error handling
  const { 
    writeContract, 
    isPending: isWritePending,
    data: hash,
    error: writeError,
    isSuccess: isWriteSuccess
  } = useWriteContract();

  // Wait for transaction confirmation
  const { 
    isLoading: isConfirming,
    isSuccess: isConfirmed,
    error: confirmError
  } = useWaitForTransactionReceipt({
    hash,
  });

  // Check if merchant is registered
  const { data: merchantInfo, refetch: refetchMerchantInfo } = useReadContract({
    address: CONTRACTS.PAYMENT_GATEWAY_V2 as `0x${string}`,
    abi: PAYMENT_GATEWAY_ABI,
    functionName: 'getMerchantInfo',
    args: [address as `0x${string}`],
  });

  const isRegistered = merchantInfo && (merchantInfo as any)[5]; // isActive field

  // Handle successful registration
  useEffect(() => {
    if (isConfirmed) {
      alert('✅ Registration successful! Refreshing dashboard...');
      setTimeout(() => {
        refetchMerchantInfo();
        window.location.reload();
      }, 2000);
    }
  }, [isConfirmed, refetchMerchantInfo]);

  // Handle write errors
  useEffect(() => {
    if (writeError) {
      console.error('Write error:', writeError);
      alert(`❌ Transaction failed: ${writeError.message}`);
    }
  }, [writeError]);

  // Handle confirmation errors
  useEffect(() => {
    if (confirmError) {
      console.error('Confirmation error:', confirmError);
      alert(`❌ Transaction confirmation failed: ${confirmError.message}`);
    }
  }, [confirmError]);

  const handleRegister = async () => {
    // Validate input
    if (!businessName.trim()) {
      alert('⚠️ Please enter your business name');
      return;
    }

    // Check network
    if (chainId !== optimismSepolia.id) {
      alert('⚠️ Please switch to Optimism Sepolia network');
      try {
        switchChain({ chainId: optimismSepolia.id });
      } catch (error) {
        console.error('Network switch failed:', error);
      }
      return;
    }

    // Debug info
    console.log('🔍 Registration Debug Info:', {
      businessName,
      address,
      chainId,
      contractAddress: CONTRACTS.PAYMENT_GATEWAY_V2,
      expectedChainId: optimismSepolia.id,
    });

    try {
      writeContract({
        address: CONTRACTS.PAYMENT_GATEWAY_V2 as `0x${string}`,
        abi: PAYMENT_GATEWAY_ABI,
        functionName: 'registerMerchant',
        args: [businessName],
      });
    } catch (error) {
      console.error('❌ Registration error:', error);
      alert(`❌ Registration failed: ${(error as Error).message}`);
    }
  };

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-blue-50">
        {/* Header */}
        <div className="border-b border-slate-200 bg-white/80 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
                <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <span className="text-xl font-bold text-slate-900">AetherPay</span>
              </Link>
              <ConnectButton />
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="container mx-auto px-4 py-16">
          <div className="max-w-6xl mx-auto">
            {/* Hero Section */}
            <div className="text-center mb-12">
              <div className="inline-block mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl flex items-center justify-center shadow-xl">
                  <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
              </div>
              <h1 className="text-5xl font-bold text-slate-900 mb-4">Merchant Dashboard</h1>
              <p className="text-xl text-slate-600 max-w-2xl mx-auto mb-8">
                Connect your wallet to access AetherPay's cross-border payment platform
              </p>
              <div className="flex justify-center">
                <ConnectButton />
              </div>
            </div>

            {/* Benefits Grid */}
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200 hover:shadow-xl transition-shadow">
                <div className="w-14 h-14 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">0.6%</h3>
                <p className="text-slate-600 font-medium mb-2">Ultra-Low Fees</p>
                <p className="text-sm text-slate-500">Save 80% compared to traditional payment processors (3%+)</p>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200 hover:shadow-xl transition-shadow">
                <div className="w-14 h-14 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">T+0</h3>
                <p className="text-slate-600 font-medium mb-2">Instant Settlement</p>
                <p className="text-sm text-slate-500">Receive funds immediately on Optimism Layer 2</p>
              </div>

              <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200 hover:shadow-xl transition-shadow">
                <div className="w-14 h-14 bg-purple-100 rounded-xl flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-slate-900 mb-2">97.4%</h3>
                <p className="text-slate-600 font-medium mb-2">AI-Powered Rates</p>
                <p className="text-sm text-slate-500">LightGBM model with multi-oracle consensus</p>
              </div>
            </div>

            {/* Features */}
            <div className="grid lg:grid-cols-2 gap-8 mb-12">
              {/* Left - What You Get */}
              <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
                <h2 className="text-2xl font-bold text-slate-900 mb-6">What You Get</h2>
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">Payment Order Management</h3>
                      <p className="text-sm text-slate-600">Create and track payment orders with real-time status updates</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">Multi-Currency Support</h3>
                      <p className="text-sm text-slate-600">Accept USDC, USDT, ETH and automatically convert</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">Instant Withdrawals</h3>
                      <p className="text-sm text-slate-600">Transfer settled funds to your wallet anytime</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-rose-600" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                      </svg>
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 mb-1">Auto Public Goods Donation</h3>
                      <p className="text-sm text-slate-600">5% of fees automatically support Ethereum ecosystem</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right - How It Works */}
              <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-lg p-8 text-white">
                <h2 className="text-2xl font-bold mb-6">How It Works</h2>
                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-emerald-500 rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                      1
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Connect Wallet</h3>
                      <p className="text-sm text-slate-300">Connect your Web3 wallet (MetaMask, WalletConnect, etc.)</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                      2
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Register as Merchant</h3>
                      <p className="text-sm text-slate-300">Quick registration with just your business name</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-purple-500 rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                      3
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Create Payment Orders</h3>
                      <p className="text-sm text-slate-300">Generate payment links for your customers</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center flex-shrink-0 font-bold">
                      4
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Receive Payments</h3>
                      <p className="text-sm text-slate-300">Customers pay, AI optimizes exchange, you get settled instantly</p>
                    </div>
                  </div>
                </div>

                <div className="mt-8 pt-6 border-t border-slate-700">
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    <span>Secured by Optimism Layer 2 + Multi-Oracle Consensus</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom CTA */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl shadow-xl p-8 text-white text-center">
              <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
              <p className="text-emerald-100 mb-6 max-w-2xl mx-auto">
                Join hundreds of merchants saving on cross-border payment fees while supporting Ethereum public goods
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <ConnectButton />
                <Link
                  href="/public-goods"
                  className="px-8 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white font-semibold rounded-lg transition-colors inline-flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                  See Our Impact
                </Link>
              </div>
            </div>

            {/* Tech Stack */}
            <div className="mt-12 text-center">
              <div className="text-sm text-slate-500 uppercase tracking-wider font-semibold mb-4">Powered By</div>
              <div className="flex flex-wrap justify-center gap-3">
                <span className="px-4 py-2 bg-white rounded-lg text-slate-700 font-medium text-sm shadow-sm border border-slate-200">
                  Optimism L2
                </span>
                <span className="px-4 py-2 bg-white rounded-lg text-slate-700 font-medium text-sm shadow-sm border border-slate-200">
                  LightGBM AI
                </span>
                <span className="px-4 py-2 bg-white rounded-lg text-slate-700 font-medium text-sm shadow-sm border border-slate-200">
                  Multi-Oracle Consensus
                </span>
                <span className="px-4 py-2 bg-white rounded-lg text-slate-700 font-medium text-sm shadow-sm border border-slate-200">
                  Smart FX Router
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isRegistered) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-slate-100 py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          {/* Header */}
          <div className="flex justify-between items-center mb-12">
            <Link href="/" className="text-slate-600 hover:text-slate-900 flex items-center gap-2 font-medium">
              ← Back to Home
            </Link>
            <ConnectButton />
          </div>

          <div className="grid lg:grid-cols-5 gap-8">
            {/* Left: Form - 2 columns */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
                <div className="mb-8">
                  <div className="inline-block bg-emerald-600 text-white px-3 py-1 rounded-md text-xs font-semibold mb-4 uppercase tracking-wider">
                    Merchant Registration
                  </div>
                  <h1 className="text-3xl font-bold mb-3 text-slate-900">
                    Start Accepting Payments
                  </h1>
                  <p className="text-slate-600 leading-relaxed">
                    Register your business to access our AI-powered cross-border payment infrastructure
                  </p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-2">
                      Business Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                      placeholder="Your Business Name"
                      className="w-full px-4 py-3 border border-slate-300 rounded-lg 
                        focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 
                        transition-all bg-white 
                        text-slate-900 font-medium
                        placeholder:text-slate-400"
                    />
                    <p className="text-xs text-slate-500 mt-1.5">
                      This will be visible to your customers during checkout
                    </p>
                  </div>

                  {/* Network Warning */}
                  {chainId !== optimismSepolia.id && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                      <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      <div>
                        <p className="text-sm font-semibold text-amber-800">Wrong Network</p>
                        <p className="text-xs text-amber-700 mt-1">Please switch to Optimism Sepolia</p>
                      </div>
                    </div>
                  )}

                  {/* Transaction Hash Display */}
                  {hash && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-blue-800 mb-1">Transaction Submitted</p>
                      <p className="text-xs font-mono text-blue-600 break-all">
                        {hash.slice(0, 10)}...{hash.slice(-8)}
                      </p>
                    </div>
                  )}

                  <button
                    onClick={handleRegister}
                    disabled={isWritePending || isConfirming || !businessName.trim() || chainId !== optimismSepolia.id}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 
                      disabled:bg-slate-400 disabled:cursor-not-allowed
                      text-white font-semibold py-3.5 rounded-lg 
                      transition-all shadow-md hover:shadow-lg disabled:shadow-none"
                  >
                    {isWritePending ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        📝 Submitting Transaction...
                      </span>
                    ) : isConfirming ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        ⏳ Confirming on Chain...
                      </span>
                    ) : chainId !== optimismSepolia.id ? (
                      '⚠️ Switch to Optimism Sepolia'
                    ) : (
                      '🚀 Register Merchant Account'
                    )}
                  </button>

                  <div className="pt-4 border-t border-slate-200">
                    <p className="text-xs text-slate-500 text-center">
                      Connected Wallet: <span className="font-mono font-medium text-slate-700">{address?.slice(0, 8)}...{address?.slice(-6)}</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right: Features - 3 columns */}
            <div className="lg:col-span-3 space-y-6">
              {/* Key Benefits */}
              <div className="bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
                <h2 className="text-xl font-bold text-slate-900 mb-6">Platform Advantages</h2>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="p-4 border border-slate-200 rounded-lg hover:border-emerald-500 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-1">Ultra-Low Fees</h3>
                        <p className="text-sm text-slate-600">0.6% platform fee vs 3% traditional processors</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border border-slate-200 rounded-lg hover:border-emerald-500 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-1">Instant Settlement</h3>
                        <p className="text-sm text-slate-600">T+0 settlement on Layer 2 infrastructure</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border border-slate-200 rounded-lg hover:border-emerald-500 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-1">Auto Currency Conversion</h3>
                        <p className="text-sm text-slate-600">AI-powered exchange rate optimization</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-4 border border-slate-200 rounded-lg hover:border-emerald-500 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center flex-shrink-0">
                        <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 mb-1">Public Goods Support</h3>
                        <p className="text-sm text-slate-600">5% of fees fund Ethereum ecosystem</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Technical Specs */}
              <div className="grid md:grid-cols-2 gap-6">
                {/* Supported Assets */}
                <div className="bg-slate-900 rounded-2xl shadow-lg p-6 text-white">
                  <h3 className="text-base font-bold mb-4">Supported Assets</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-slate-700">
                      <span className="font-medium">USDC</span>
                      <span className="text-sm text-slate-400">USD Coin</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-700">
                      <span className="font-medium">USDT</span>
                      <span className="text-sm text-slate-400">Tether USD</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-slate-700">
                      <span className="font-medium">ETH</span>
                      <span className="text-sm text-slate-400">Ethereum</span>
                    </div>
                    <div className="flex items-center justify-between py-2">
                      <span className="font-medium">More</span>
                      <span className="text-sm text-slate-400">Coming Soon</span>
                    </div>
                  </div>
                </div>

                {/* Platform Metrics */}
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
                  <h3 className="text-base font-bold text-slate-900 mb-4">Platform Metrics</h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Platform Fee</span>
                      <span className="text-2xl font-bold text-emerald-600">0.6%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Settlement Time</span>
                      <span className="text-2xl font-bold text-amber-600">T+0</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">AI Accuracy</span>
                      <span className="text-2xl font-bold text-blue-600">97.4%</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">Public Goods</span>
                      <span className="text-2xl font-bold text-rose-600">5%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Technology Stack */}
          <div className="mt-12 bg-white rounded-2xl shadow-lg p-8 border border-slate-200">
            <div className="text-center mb-6">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Powered By</h3>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="font-bold text-slate-900 mb-1">Optimism</div>
                <div className="text-xs text-slate-500">Layer 2 Network</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-slate-900 mb-1">LightGBM</div>
                <div className="text-xs text-slate-500">AI Model</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-slate-900 mb-1">Multi-Oracle</div>
                <div className="text-xs text-slate-500">Price Consensus</div>
              </div>
              <div className="text-center">
                <div className="font-bold text-slate-900 mb-1">ERC-4337</div>
                <div className="text-xs text-slate-500">Account Abstraction</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Registered merchant dashboard
  const info = merchantInfo as any;
  const totalVolume = info[2] ? Number(info[2]) / 1e6 : 0;
  const pendingBalance = info[3] ? Number(info[3]) / 1e6 : 0;
  const totalOrders = Number(info[1]?.toString() || '0');
  const feeRate = info[4] ? Number(info[4]) / 100 : 0.6; // basis points to percentage

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8 gap-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h1 className="text-3xl font-bold text-slate-900">Merchant Dashboard</h1>
                <p className="text-slate-600 font-medium">{info[0]}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full font-semibold">
                ✓ Active
              </span>
              <span className="text-slate-500">
                Fee Rate: <span className="font-semibold text-slate-700">{feeRate}%</span>
              </span>
            </div>
          </div>
          <ConnectButton />
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Total Orders */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="text-xs px-2 py-1 bg-blue-50 text-blue-600 rounded-full font-semibold">
                All time
              </span>
            </div>
            <div className="text-sm text-slate-600 mb-1 font-medium">Total Orders</div>
            <div className="text-3xl font-bold text-slate-900 mb-1">{totalOrders}</div>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-emerald-600 font-semibold">+0%</span>
              <span className="text-slate-500">vs last month</span>
            </div>
          </div>

          {/* Total Volume */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <span className="text-xs px-2 py-1 bg-purple-50 text-purple-600 rounded-full font-semibold">
                USD
              </span>
            </div>
            <div className="text-sm text-slate-600 mb-1 font-medium">Total Volume</div>
            <div className="text-3xl font-bold text-slate-900 mb-1">${totalVolume.toFixed(2)}</div>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-emerald-600 font-semibold">+0%</span>
              <span className="text-slate-500">vs last month</span>
            </div>
          </div>

          {/* Pending Balance */}
          <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl shadow-lg p-6 text-white hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                </svg>
              </div>
              <span className="text-xs px-2 py-1 bg-white/20 backdrop-blur-sm rounded-full font-semibold">
                Available
              </span>
            </div>
            <div className="text-sm text-emerald-100 mb-1 font-medium">Pending Balance</div>
            <div className="text-3xl font-bold mb-1">${pendingBalance.toFixed(2)}</div>
            <Link 
              href="/dashboard/withdraw"
              className="inline-flex items-center gap-1 text-sm font-semibold text-white hover:text-emerald-100 transition-colors mt-2"
            >
              Withdraw funds
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Avg Order Value */}
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200 hover:shadow-xl transition-shadow">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="text-xs px-2 py-1 bg-amber-50 text-amber-600 rounded-full font-semibold">
                Avg
              </span>
            </div>
            <div className="text-sm text-slate-600 mb-1 font-medium">Avg Order Value</div>
            <div className="text-3xl font-bold text-slate-900 mb-1">
              ${totalOrders > 0 ? (totalVolume / totalOrders).toFixed(2) : '0.00'}
            </div>
            <div className="flex items-center gap-1 text-sm">
              <span className="text-slate-500">Per transaction</span>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Left Column - Quick Actions + Recent Activity */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Actions */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-slate-900">Quick Actions</h2>
                <span className="text-xs text-slate-500">Essential merchant tools</span>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
          <Link
            href="/dashboard/create-order"
                  className="group bg-white rounded-xl shadow-md p-6 border border-slate-200 hover:border-emerald-500 hover:shadow-xl transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </div>
                    <svg className="w-5 h-5 text-slate-400 group-hover:text-emerald-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">Create Order</h3>
                  <p className="text-sm text-slate-600">Generate new payment order for customers</p>
          </Link>

          <Link
            href="/dashboard/orders"
                  className="group bg-white rounded-xl shadow-md p-6 border border-slate-200 hover:border-blue-500 hover:shadow-xl transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                    </div>
                    <svg className="w-5 h-5 text-slate-400 group-hover:text-blue-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">Order Management</h3>
                  <p className="text-sm text-slate-600">Track and manage all payment orders</p>
          </Link>

          <Link
            href="/dashboard/withdraw"
                  className="group bg-white rounded-xl shadow-md p-6 border border-slate-200 hover:border-purple-500 hover:shadow-xl transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
                      <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <svg className="w-5 h-5 text-slate-400 group-hover:text-purple-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">Withdraw Funds</h3>
                  <p className="text-sm text-slate-600">Transfer settled balance to wallet</p>
          </Link>

                <Link
                  href="/public-goods"
                  className="group bg-gradient-to-br from-rose-50 to-pink-50 rounded-xl shadow-md p-6 border-2 border-rose-200 hover:border-rose-300 hover:shadow-xl transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-12 h-12 bg-gradient-to-br from-rose-400 to-pink-500 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
                      <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </div>
                    <svg className="w-5 h-5 text-rose-400 group-hover:text-rose-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">Public Goods</h3>
                  <p className="text-sm text-rose-700 font-medium">5% fees support Ethereum ecosystem</p>
                </Link>
              </div>
            </div>

            {/* Performance Overview */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-bold text-slate-900">Performance Overview</h2>
                <div className="flex items-center gap-2">
                  <select className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 text-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option>Last 30 days</option>
                    <option>Last 7 days</option>
                    <option>Last 90 days</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-900 mb-1">{totalOrders}</div>
                  <div className="text-xs text-slate-600 uppercase tracking-wide">Orders</div>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-emerald-600 mb-1">${totalVolume.toFixed(0)}</div>
                  <div className="text-xs text-slate-600 uppercase tracking-wide">Revenue</div>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-blue-600 mb-1">{totalOrders > 0 ? '100%' : '0%'}</div>
                  <div className="text-xs text-slate-600 uppercase tracking-wide">Success Rate</div>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-purple-600 mb-1">${totalOrders > 0 ? (totalVolume / totalOrders).toFixed(2) : '0'}</div>
                  <div className="text-xs text-slate-600 uppercase tracking-wide">Avg Value</div>
                </div>
              </div>

              {/* Chart Placeholder */}
              <div className="mt-6 h-48 bg-slate-50 rounded-lg flex items-center justify-center border-2 border-dashed border-slate-200">
                <div className="text-center text-slate-400">
                  <svg className="w-12 h-12 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <p className="text-sm font-medium">Revenue chart coming soon</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Platform Info + Account Details */}
          <div className="space-y-6">
            {/* Platform Benefits */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Platform Benefits</h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900 mb-1">Ultra-Low Fees</div>
                    <div className="text-sm text-slate-600">Only {feeRate}% vs 3% traditional processors</div>
                    <div className="text-xs text-emerald-600 font-medium mt-1">Save 80% on transaction costs</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900 mb-1">Instant Settlement</div>
                    <div className="text-sm text-slate-600">T+0 settlement on Optimism L2</div>
                    <div className="text-xs text-blue-600 font-medium mt-1">No waiting periods</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900 mb-1">AI-Powered Rates</div>
                    <div className="text-sm text-slate-600">97.4% prediction accuracy</div>
                    <div className="text-xs text-purple-600 font-medium mt-1">LightGBM + Multi-Oracle</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-rose-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900 mb-1">Auto Donations</div>
                    <div className="text-sm text-slate-600">5% of fees support public goods</div>
                    <div className="text-xs text-rose-600 font-medium mt-1">Build Ethereum ecosystem</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Details */}
            <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-xl shadow-lg p-6 text-white">
              <h2 className="text-lg font-bold mb-4">Account Details</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-slate-700">
                  <span className="text-sm text-slate-300">Business Name</span>
                  <span className="text-sm font-medium">{info[0]}</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-700">
                  <span className="text-sm text-slate-300">Fee Rate</span>
                  <span className="text-sm font-medium text-emerald-400">{feeRate}%</span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-700">
                  <span className="text-sm text-slate-300">Status</span>
                  <span className="text-sm font-medium text-emerald-400">Active</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-300">Wallet</span>
                  <span className="text-xs font-mono text-slate-400">{address?.slice(0, 6)}...{address?.slice(-4)}</span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-slate-700">
                <div className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-3">Security</div>
                <div className="flex items-center gap-2 text-sm text-slate-300">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <span>Secured by Optimism L2</span>
                </div>
              </div>
            </div>

            {/* Tech Stack */}
            <div className="bg-white rounded-xl shadow-lg p-6 border border-slate-200">
              <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-4 text-center">Powered By</div>
              <div className="grid grid-cols-2 gap-2">
                <div className="px-3 py-2 bg-slate-50 rounded-lg text-center">
                  <div className="text-sm font-bold text-slate-900">Optimism</div>
                  <div className="text-xs text-slate-500">Layer 2</div>
                </div>
                <div className="px-3 py-2 bg-slate-50 rounded-lg text-center">
                  <div className="text-sm font-bold text-slate-900">LightGBM</div>
                  <div className="text-xs text-slate-500">AI Model</div>
                </div>
                <div className="px-3 py-2 bg-slate-50 rounded-lg text-center">
                  <div className="text-sm font-bold text-slate-900">Multi-Oracle</div>
                  <div className="text-xs text-slate-500">Consensus</div>
                </div>
                <div className="px-3 py-2 bg-slate-50 rounded-lg text-center">
                  <div className="text-sm font-bold text-slate-900">FXRouter</div>
                  <div className="text-xs text-slate-500">Smart Routing</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Banner */}
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 rounded-2xl shadow-xl p-8 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div>
              <h3 className="text-2xl font-bold mb-2">Need help getting started?</h3>
              <p className="text-emerald-100">Check out our integration guide and API documentation</p>
            </div>
            <div className="flex gap-3">
              <button className="px-6 py-3 bg-white text-emerald-600 rounded-lg font-semibold hover:bg-emerald-50 transition-colors shadow-lg">
                View Docs
              </button>
              <button className="px-6 py-3 bg-emerald-700 text-white rounded-lg font-semibold hover:bg-emerald-800 transition-colors">
                Contact Support
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}