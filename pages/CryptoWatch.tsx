
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppState, CryptoWallet } from '../types';
import { ICONS } from '../constants';

interface CryptoWatchProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const NETWORKS = ['TRC20', 'BEP20', 'ERC20', 'BTC', 'ETH'] as const;
const COINS = ['USDT', 'ETH', 'USDC', 'BTC'] as const;

const CryptoWatch: React.FC<CryptoWatchProps> = ({ state, updateState }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [newWallet, setNewWallet] = useState<{
    label: string;
    address: string;
    network: typeof NETWORKS[number];
    coin: typeof COINS[number];
  }>({
    label: '',
    address: '',
    network: 'TRC20',
    coin: 'USDT'
  });

  const wallets = state.cryptoWallets || [];

  // Register wallets for server-side monitoring
  React.useEffect(() => {
    if (wallets.length > 0) {
      fetch('/api/crypto/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallets })
      }).catch(err => console.error('Failed to sync crypto monitoring:', err));
    }
  }, [wallets]);

  const handleAdd = () => {
    if (!newWallet.label || !newWallet.address) return;

    const wallet: CryptoWallet = {
      id: String(Date.now()),
      ...newWallet,
      createdAt: new Date().toISOString()
    };

    updateState(prev => ({
      ...prev,
      cryptoWallets: [...(prev.cryptoWallets || []), wallet]
    }));

    setNewWallet({
      label: '',
      address: '',
      network: 'TRC20',
      coin: 'USDT'
    });
    setIsAdding(false);
  };

  const removeWallet = (id: string) => {
    updateState(prev => ({
      ...prev,
      cryptoWallets: (prev.cryptoWallets || []).filter(w => w.id !== id),
      deletedIds: [...(prev.deletedIds || []), id]
    }));
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tighter uppercase font-outfit">
            Crypto Watch
          </h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1">
            Blockchain Monitoring & Telegram Notifications
          </p>
        </div>
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 px-6 py-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-black uppercase text-xs tracking-widest transition-all shadow-lg shadow-indigo-600/20 active:scale-95"
        >
          <ICONS.Plus size={16} />
          Add Wallet
        </button>
      </div>

      {/* Telegram Bot Card */}
      <div className="glass-card p-6 rounded-[2rem] border-sky-500/20 bg-sky-500/5 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10">
          <ICONS.Send size={80} />
        </div>
        <div className="relative flex items-start gap-4">
          <div className="w-12 h-12 bg-sky-500/20 rounded-2xl flex items-center justify-center text-sky-400">
            <ICONS.Send size={24} />
          </div>
          <div>
            <h3 className="text-lg font-black text-white uppercase font-outfit">Telegram Bot Integration</h3>
            <p className="text-slate-400 text-xs mt-1 max-w-lg">
              Bot <span className="text-sky-400 font-mono">@CryptoContinental_bot</span> is active. 
              Notifications are sent to group <span className="text-sky-400 font-mono">-1003748692600</span>.
            </p>
            <div className="flex items-center gap-2 mt-4">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Bot Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Wallet List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {wallets.map(wallet => (
            <motion.div
              key={wallet.id}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass-card p-6 rounded-[2rem] border-white/5 bg-slate-900/40 relative group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center">
                  {wallet.coin === 'BTC' ? (
                    <span className="text-orange-400 font-bold text-xl">₿</span>
                  ) : wallet.coin === 'ETH' ? (
                    <span className="text-sky-400 font-bold text-xl">Ξ</span>
                  ) : (
                    <span className="text-emerald-400 font-bold text-xl">$</span>
                  )}
                </div>
                <button
                  onClick={() => removeWallet(wallet.id)}
                  className="p-2 text-slate-600 hover:text-rose-500 hover:bg-rose-500/10 rounded-xl transition-all"
                >
                  <ICONS.Trash size={16} />
                </button>
              </div>

              <div>
                <h4 className="text-lg font-black text-white uppercase font-outfit truncate pr-8">
                  {wallet.label}
                </h4>
                <div className="flex gap-2 mt-1">
                  <span className="text-[9px] font-black px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded-md border border-indigo-500/10 uppercase italic">
                    {wallet.network}
                  </span>
                  <span className="text-[9px] font-black px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md border border-emerald-500/10 uppercase">
                    {wallet.coin}
                  </span>
                </div>
                
                <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/5">
                  <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Address</p>
                  <p className="text-xs font-mono text-slate-300 break-all select-all">
                    {wallet.address}
                  </p>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
                <div className="flex items-center gap-2">
                  <ICONS.Activity size={14} className="text-indigo-400" />
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider italic">
                    Monitoring...
                  </span>
                </div>
                <div className="text-[9px] font-bold text-slate-600 uppercase">
                  Added {new Date(wallet.createdAt).toLocaleDateString()}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {wallets.length === 0 && !isAdding && (
          <div className="col-span-full py-20 flex flex-col items-center justify-center opacity-20 italic">
            <ICONS.Wallet size={48} className="mb-4" />
            <p className="font-black uppercase tracking-[0.3em]">No wallets tracked</p>
          </div>
        )}
      </div>

      {/* Add Modal Overlay */}
      <AnimatePresence>
        {isAdding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md glass-card p-8 rounded-[3rem] border-white/10 bg-slate-900 shadow-2xl relative"
            >
              <button 
                onClick={() => setIsAdding(false)}
                className="absolute top-6 right-6 p-2 text-slate-500 hover:text-white transition-colors"
              >
                <ICONS.Close size={24} />
              </button>

              <h2 className="text-2xl font-black text-white tracking-tighter uppercase font-outfit mb-8">
                Add Crypto Wallet
              </h2>

              <div className="space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                    Wallet Label (e.g. Main Deposit)
                  </label>
                  <input
                    type="text"
                    value={newWallet.label}
                    onChange={e => setNewWallet(prev => ({ ...prev, label: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold placeholder:text-slate-700"
                    placeholder="Enter label..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                      Coin
                    </label>
                    <select
                      value={newWallet.coin}
                      onChange={e => setNewWallet(prev => ({ ...prev, coin: e.target.value as any }))}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold appearance-none cursor-pointer"
                    >
                      {COINS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                      Network
                    </label>
                    <select
                      value={newWallet.network}
                      onChange={e => setNewWallet(prev => ({ ...prev, network: e.target.value as any }))}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold appearance-none cursor-pointer"
                    >
                      {NETWORKS.map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2 block">
                    Wallet Address
                  </label>
                  <textarea
                    value={newWallet.address}
                    onChange={e => setNewWallet(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-mono text-sm h-32 resize-none placeholder:text-slate-700"
                    placeholder="Paste address here..."
                  />
                </div>

                <button
                  onClick={handleAdd}
                  disabled={!newWallet.label || !newWallet.address}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black py-5 rounded-2xl transition-all shadow-xl shadow-indigo-600/20 active:scale-95 text-xs uppercase tracking-[0.2em] mt-4"
                >
                  Start Monitoring
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CryptoWatch;
