
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ICONS } from '../constants';
import { TriangleAlert, Ghost, Activity, MessageSquare, DollarSign, Clock, User } from 'lucide-react';

interface MetricData {
  user_id: number;
  reply_time_avg: number;
  paid_messages_count: number;
  total_sold_messages_price_sum: number;
}

const OnlyMonster: React.FC = () => {
  const [metrics, setMetrics] = useState<MetricData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const TOKEN = "om_token_56b9c18f3db28e5700ea4d52a69a67bb6c7d699700cd7dc188b9150224a437d3";
  const CREATOR_ID = "49307";
  const BASE_URL = "https://api.onlymonster.ai"; // Assuming the base URL

  const fetchMetrics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${BASE_URL}/api/v0/users/metrics?creator_ids=${CREATOR_ID}`, {
        headers: {
          'Authorization': `Bearer ${TOKEN}`,
          'accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      // The API usually returns an array for multiple IDs
      const creatorData = Array.isArray(data) ? data.find(m => m.user_id === Number(CREATOR_ID)) : data;
      
      if (creatorData) {
        setMetrics(creatorData);
        setLastUpdate(new Date());
        setError(null);
      } else {
        throw new Error("Data not found for creator");
      }
    } catch (err) {
      console.error("OnlyMonster API Error:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch metrics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 15 * 60 * 1000); // 15 minutes
    return () => clearInterval(interval);
  }, []);

  const isReplyTimeHigh = metrics ? metrics.reply_time_avg > 90 : false;

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-outfit flex items-center gap-3">
            <Ghost className="text-indigo-400" /> OnlyMonster Integration
          </h1>
          <p className="text-slate-400 text-sm mt-1">Real-time metrics for Nola Lust (ID: {CREATOR_ID})</p>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdate && (
             <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
               <Clock size={12} /> Last updated: {lastUpdate.toLocaleTimeString()}
             </div>
          )}
          <button 
            onClick={fetchMetrics}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95 group"
          >
            <ICONS.RotateCcw size={14} className={loading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"} /> Refresh
          </button>
        </div>
      </header>

      {error && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-4"
        >
          <TriangleAlert className="text-rose-500 shrink-0" size={20} />
          <div>
            <p className="text-rose-500 font-bold text-sm">Connection Error</p>
            <p className="text-rose-300 text-xs mt-1">{error}. Please verify the API token and base URL.</p>
          </div>
        </motion.div>
      )}

      {isReplyTimeHigh && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="p-6 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-6 shadow-[0_0_50px_rgba(245,158,11,0.1)]"
        >
          <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center animate-pulse">
            <TriangleAlert className="text-amber-500" size={24} />
          </div>
          <div>
            <p className="text-amber-500 font-black text-lg uppercase tracking-tight">Warning: High Response Time</p>
            <p className="text-amber-200/70 text-sm">Average reply time is {metrics?.reply_time_avg}s, exceeding the 90s limit.</p>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* User ID */}
        <MetricCard 
          title="User ID" 
          value={metrics?.user_id || CREATOR_ID} 
          icon={<User size={18} />} 
          loading={loading}
          color="indigo"
        />
        
        {/* Reply Time */}
        <MetricCard 
          title="Avg Reply Time" 
          value={metrics ? `${metrics.reply_time_avg}s` : '--'} 
          icon={<Clock size={18} />} 
          loading={loading}
          color={isReplyTimeHigh ? "amber" : "emerald"}
          warning={isReplyTimeHigh}
        />

        {/* Paid Messages */}
        <MetricCard 
          title="Paid Messages" 
          value={metrics?.paid_messages_count || 0} 
          icon={<MessageSquare size={18} />} 
          loading={loading}
          color="sky"
        />

        {/* Total Earned */}
        <MetricCard 
          title="Total Sold Messages" 
          value={metrics ? `$${metrics.total_sold_messages_price_sum.toLocaleString()}` : '$0'} 
          icon={<DollarSign size={18} />} 
          loading={loading}
          color="emerald"
        />
      </div>

      <div className="glass-card p-8 rounded-3xl border-white/[0.05] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] -mr-32 -mt-32 rounded-full"></div>
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8 justify-between">
          <div className="space-y-4">
            <h3 className="text-xl font-bold text-white font-outfit">API Endpoint Configuration</h3>
            <div className="grid gap-2">
              <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase font-bold text-slate-500 w-24">Base URL:</span>
                <code className="text-xs text-indigo-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">{BASE_URL}</code>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase font-bold text-slate-500 w-24">Token:</span>
                <code className="text-xs text-indigo-400 bg-slate-900 px-2 py-1 rounded border border-slate-800">om_token_...{TOKEN.slice(-8)}</code>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-4">
             <div className="text-center p-4 bg-white/[0.02] rounded-2xl border border-white/[0.05]">
                <p className="text-[10px] uppercase tracking-widest text-slate-500 mb-1">Status</p>
                <div className="flex items-center gap-2 justify-center">
                   <div className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-500 animate-pulse' : error ? 'bg-rose-500' : 'bg-emerald-500'}`}></div>
                   <span className="text-sm font-bold text-white">{loading ? 'Live Polling' : error ? 'Disconnected' : 'Connected'}</span>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const MetricCard = ({ title, value, icon, loading, color, warning }: { 
  title: string; 
  value: string | number; 
  icon: React.ReactNode; 
  loading: boolean;
  color: string;
  warning?: boolean;
}) => {
  const colors: Record<string, string> = {
    indigo: 'from-indigo-500/[0.08] to-indigo-500/[0.02] border-indigo-500/20 text-indigo-400',
    emerald: 'from-emerald-500/[0.08] to-emerald-500/[0.02] border-emerald-500/20 text-emerald-400',
    amber: 'from-amber-400/[0.12] to-amber-600/[0.04] border-amber-500/30 text-amber-400',
    sky: 'from-sky-500/[0.08] to-sky-500/[0.02] border-sky-500/20 text-sky-400',
  };

  return (
    <motion.div 
      whileHover={{ scale: 1.02, y: -2 }}
      className={`relative group bg-gradient-to-b ${colors[color] || colors.indigo} p-6 rounded-3xl border backdrop-blur-xl transition-all duration-300 shadow-sm overflow-hidden ${warning ? 'ring-2 ring-amber-500/20 ring-offset-4 ring-offset-slate-950' : ''}`}
    >
      <div className="absolute inset-0 border border-white/[0.03] rounded-3xl pointer-events-none" />
      <div className="flex flex-col gap-4">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-300 ${colors[color]} bg-white/[0.03]`}>
          {icon}
        </div>
        <div>
          <p className="text-[10px] uppercase font-bold text-slate-500 tracking-[0.2em] mb-1.5 opacity-60">{title}</p>
          {loading ? (
            <div className="h-8 w-24 bg-white/5 animate-pulse rounded-lg"></div>
          ) : (
            <p className="text-2xl font-black text-white font-outfit tracking-tight">{value}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default OnlyMonster;
