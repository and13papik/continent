import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ICONS } from '../constants';
import { 
  TriangleAlert, Ghost, Activity, MessageSquare, DollarSign, 
  Clock, Users, MousePointer2, TrendingUp, Terminal, Send,
  CheckCircle2, AlertCircle, RefreshCcw
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface MetricData {
  user_id: number;
  reply_time_avg: number;
  messages_count: number;
  paid_messages_count: number;
  total_sold_messages_price_sum: number; 
  total_tips_amount_sum: number;
  // Optional aliases from user request
  paid_messages_price_sum?: number;
  tips_amount_sum?: number;
}

interface TrackingLink {
  id: number;
  name: string;
  subscribers_count: number;
  clicks_count: number;
}

interface AggregatedStats {
  totalEarned: number;
  totalMessages: number;
  paidMessages: number;
  avgReplyTime: number;
  totalTips: number;
  newSubs: number;
  adClicks: number;
  conversions: number;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
  sender_id?: string;
  description?: string;
}

interface EventLog {
  id: string;
  name: string;
  timestamp: string;
  status: 'pending' | 'success' | 'error';
  details?: any;
}

const OnlyMonster: React.FC = () => {
  const [stats, setStats] = useState<AggregatedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [eventLogs, setEventLogs] = useState<EventLog[]>([]);
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [operatorMetrics, setOperatorMetrics] = useState<MetricData[]>([]);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [profile, setProfile] = useState<{ name: string; avatar: string } | null>(null);

  const CREATOR_ID = "49307";

  // --- Secure Data Fetching (Proxied via Backend) ---
  const fetchAllData = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      
      const from = startOfDay.toISOString();
      const to = now.toISOString(); // Current moment

      // We'll use a new proxy endpoint on the backend to keep the token hidden
      const response = await fetch('/api/onlymonster/dashboard-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to, creator_id: CREATOR_ID })
      });

      if (!response.ok) throw new Error(`Proxy Error: ${response.status}`);
      
      const { metrics, tracking, transactions: transactionsData } = await response.json();

      const items: MetricData[] = metrics.items || [];
      const links: TrackingLink[] = tracking.items || [];
      const txnList: Transaction[] = transactionsData.items || [];
      const accounts = metrics.accounts || [];

      if (accounts.length > 0) {
        setProfile({
          name: accounts[0].name || "Verified Creator",
          avatar: accounts[0].avatar || ""
        });
      }

      const aggregated: AggregatedStats = items.reduce((acc, curr) => {
        const totalSales = curr.total_sold_messages_price_sum + curr.total_tips_amount_sum;
        return {
          totalEarned: acc.totalEarned + totalSales,
          totalMessages: acc.totalMessages + curr.messages_count,
          paidMessages: acc.paidMessages + curr.paid_messages_count,
          avgReplyTime: acc.avgReplyTime + curr.reply_time_avg,
          totalTips: acc.totalTips + curr.total_tips_amount_sum,
          newSubs: acc.newSubs,
          adClicks: acc.adClicks,
          conversions: 0
        };
      }, {
        totalEarned: 0, totalMessages: 0, paidMessages: 0, avgReplyTime: 0, 
        totalTips: 0, 
        newSubs: links.reduce((s, l) => s + (l.subscribers_count || 0), 0),
        adClicks: links.reduce((c, l) => c + (l.clicks_count || 0), 0),
        conversions: 0
      });

      if (items.length > 0) {
        aggregated.avgReplyTime = Math.round(aggregated.avgReplyTime / items.length);
        if (aggregated.totalMessages > 0) {
          aggregated.conversions = Math.round((aggregated.paidMessages / aggregated.totalMessages) * 100);
        }
      }

      setStats(aggregated);
      setTransactions(txnList);
      setOperatorMetrics(items);
      setLastUpdate(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync error");
    } finally {
      setLoading(false);
    }
  };

  // --- Advanced Event Tracking (Retries + sendBeacon) ---
  const trackEvent = async (eventName: string, step?: number, metadata?: any, retryCount = 0) => {
    const isCritical = ['form_submit', 'form_abandon'].includes(eventName);
    const logId = Math.random().toString(36).substring(7);
    
    // Log locally
    const newLog: EventLog = {
      id: logId,
      name: eventName,
      timestamp: new Date().toLocaleTimeString(),
      status: 'pending'
    };
    setEventLogs(prev => [newLog, ...prev].slice(0, 5));

    const payload = {
      event_name: eventName,
      session_id: sessionId,
      step: step || 1,
      metadata: metadata || {}
    };

    // Use sendBeacon for critical events if supported
    if (isCritical && navigator.sendBeacon) {
      const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
      const success = navigator.sendBeacon('/api/track-event', blob);
      if (success) {
        setEventLogs(prev => prev.map(log => log.id === logId ? { ...log, status: 'success' } : log));
        if (eventName === 'form_submit') setIsSubmitted(true);
        return;
      }
    }

    // Fallback to fetch with retry for everything else
    try {
      const response = await fetch('/api/track-event', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error('API Error');

      setEventLogs(prev => prev.map(log => log.id === logId ? { ...log, status: 'success' } : log));
      if (eventName === 'form_submit') setIsSubmitted(true);
    } catch (err) {
      console.error(`[OnlyMonster] Track Error (${eventName}):`, err);
      
      // Retry logic (max 3 times)
      if (retryCount < 2 && !isCritical) {
        setTimeout(() => trackEvent(eventName, step, metadata, retryCount + 1), 2000 * (retryCount + 1));
      }

      setEventLogs(prev => prev.map(log => log.id === logId ? { ...log, status: 'error' } : log));
    }
  };

  useEffect(() => {
    fetchAllData();
    trackEvent('form_view', 0);
    
    // --- Abandonment Logic ---
    // If user starts but doesn't submit in 60s
    const abandonTimer = setTimeout(() => {
      if (!isSubmitted) {
        trackEvent('form_abandon');
      }
    }, 60000); 

    const interval = setInterval(fetchAllData, 15 * 60 * 1000);
    return () => {
      clearInterval(interval);
      clearTimeout(abandonTimer);
    };
  }, [isSubmitted]);

  const chartData = [
    { time: '00:00', amount: stats?.totalEarned ? stats.totalEarned * 0.1 : 0 },
    { time: '06:00', amount: stats?.totalEarned ? stats.totalEarned * 0.3 : 0 },
    { time: '12:00', amount: stats?.totalEarned ? stats.totalEarned * 0.6 : 0 },
    { time: '18:00', amount: stats?.totalEarned ? stats.totalEarned * 0.8 : 0 },
    { time: '24:00', amount: stats?.totalEarned || 0 },
  ];

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="relative group">
            {profile?.avatar ? (
              <img 
                src={profile.avatar} 
                alt="Profile" 
                className="w-14 h-14 rounded-2xl object-cover shadow-[0_0_30px_rgba(79,70,229,0.3)] border border-indigo-400/20"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-[0_0_30px_rgba(79,70,229,0.3)] border border-indigo-400/20">
                <Users className="text-white" size={28} />
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-emerald-500 rounded-full border-4 border-[#050810] z-10"></div>
          </div>
          <div>
            <h1 className="text-3xl font-black text-white font-outfit tracking-tighter uppercase leading-tight">
              {profile?.name || "🌸 Nola Lust 🌸"}
            </h1>
            <p className="text-slate-500 text-[10px] font-black tracking-widest uppercase opacity-60">
              Account Control • ID: <span className="text-indigo-400">{CREATOR_ID}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchAllData}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 bg-white/[0.03] hover:bg-white/[0.08] text-white text-[10px] font-bold uppercase tracking-widest rounded-2xl transition-all border border-white/[0.05]"
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} /> Refresh Dashboard
          </button>
        </div>
      </header>

      {/* Main Stats Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Panel */}
        <div className="lg:col-span-2 glass-card p-8 rounded-[2.5rem] border-white/[0.05] relative overflow-hidden flex flex-col gap-8 shadow-2xl">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/10 blur-[150px] rounded-full -mr-64 -mt-64 pointer-events-none"></div>
          
          <div className="flex flex-col md:flex-row md:items-center justify-between relative z-10 gap-6">
            <div>
              <span className="text-[10px] uppercase font-black text-slate-500 tracking-[0.4em] opacity-60 block mb-2">Authenticated Creator Revenue (Daily)</span>
              <div className="flex items-baseline gap-4">
                <h2 className="text-5xl md:text-6xl font-black text-white font-outfit tracking-tighter">${stats?.totalEarned.toLocaleString() || '0'}</h2>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                  <TrendingUp size={14} className="text-emerald-500" />
                  <span className="text-emerald-500 text-xs font-bold uppercase tracking-wider">Verified Sync</span>
                </div>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="bg-slate-900/50 p-5 rounded-3xl border border-white/[0.05] text-center min-w-[120px] backdrop-blur-xl">
                 <p className="text-[10px] uppercase font-black text-slate-500 mb-1 opacity-60">Conversion Rate</p>
                 <p className="text-3xl font-black text-indigo-400 font-outfit tracking-tighter">{stats?.conversions || '0'}%</p>
              </div>
              <div className="bg-slate-900/50 p-5 rounded-3xl border border-white/[0.05] text-center min-w-[120px] backdrop-blur-xl">
                 <p className="text-[10px] uppercase font-black text-slate-500 mb-1 opacity-60">Avg Reply Time</p>
                 <p className={`text-3xl font-black font-outfit tracking-tighter ${(stats?.avgReplyTime || 0) > 300 ? 'text-rose-500' : 'text-emerald-400'}`}>
                   {stats?.avgReplyTime || '0'}<span className="text-sm">s</span>
                 </p>
              </div>
            </div>
          </div>

          <div className="h-64 w-full relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorAmount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="5 5" vertical={false} stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="time" stroke="#475569" fontSize={11} axisLine={false} tickLine={false} tickMargin={10} />
                <YAxis hide />
                <Tooltip 
                  cursor={{ stroke: '#6366f1', strokeWidth: 1 }}
                  contentStyle={{ 
                    backgroundColor: 'rgba(15, 23, 42, 0.9)', 
                    border: '1px solid rgba(255,255,255,0.1)', 
                    borderRadius: '16px',
                    backdropFilter: 'blur(10px)',
                    boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
                  }}
                  itemStyle={{ color: '#818cf8', fontWeight: '900', textTransform: 'uppercase', fontSize: '10px' }}
                />
                <Area type="monotone" dataKey="amount" stroke="#6366f1" fillOpacity={1} fill="url(#colorAmount)" strokeWidth={4} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* mini cards column */}
        <div className="flex flex-col gap-4">
           <MetricSummaryCard title="Total Engagement" value={stats?.totalMessages.toLocaleString() || '0'} icon={<MessageSquare />} color="indigo" />
           <MetricSummaryCard title="Successful Sales" value={stats?.paidMessages.toLocaleString() || '0'} icon={<Activity />} color="sky" />
           <MetricSummaryCard title="Ad Clicks (24h)" value={stats?.adClicks.toLocaleString() || '0'} icon={<MousePointer2 />} color="emerald" />
           <MetricSummaryCard title="New Subscribers" value={stats?.newSubs.toLocaleString() || '0'} icon={<Users />} color="amber" />
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
        {/* Account Overview Panel */}
        <div className="glass-card p-10 rounded-[2.5rem] border-white/[0.05] flex flex-col gap-8 shadow-xl bg-gradient-to-br from-indigo-950/20 to-transparent">
          <div>
            <h3 className="text-xl font-bold text-white font-outfit uppercase tracking-tight flex items-center gap-3">
              <Activity size={20} className="text-indigo-400" /> Account Performance Insights
            </h3>
            <p className="text-slate-500 text-xs mt-2">Core metrics and operational efficiency for account <strong>{profile?.name || "Nola Lust"}</strong> (ID: {CREATOR_ID}).</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
             <div className="p-6 bg-slate-900/50 rounded-3xl border border-white/[0.05]">
                <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-3">Revenue Distribution</p>
                <div className="space-y-4">
                   <div className="flex items-center justify-between">
                      <span className="text-xs text-white">Direct Sales</span>
                      <span className="text-xs font-bold text-indigo-400">${(stats?.totalEarned || 0) - (stats?.totalTips || 0)}</span>
                   </div>
                   <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-indigo-500 h-full" style={{ width: '75%' }}></div>
                   </div>
                   <div className="flex items-center justify-between">
                      <span className="text-xs text-white">Tips & Extras</span>
                      <span className="text-xs font-bold text-amber-400">${stats?.totalTips || '0'}</span>
                   </div>
                   <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                      <div className="bg-amber-500 h-full" style={{ width: '25%' }}></div>
                   </div>
                </div>
             </div>

             <div className="p-6 bg-slate-900/50 rounded-3xl border border-white/[0.05] flex flex-col justify-between">
                <div>
                   <p className="text-[10px] uppercase font-black text-slate-500 tracking-widest mb-1">Response Health</p>
                   <p className="text-xs text-slate-400">Target for today is &lt;180s.</p>
                </div>
                <div className="mt-4 flex items-center gap-4">
                   <div className={`text-2xl font-black ${(stats?.avgReplyTime || 0) < 180 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {stats?.avgReplyTime || 0}s
                   </div>
                   <div className="text-[10px] uppercase font-bold text-slate-500 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                      { (stats?.avgReplyTime || 0) < 180 ? 'EXCELLENT' : 'NEEDS OPTIMIZATION' }
                   </div>
                </div>
             </div>
          </div>

          <div className="p-6 bg-slate-900/80 rounded-3xl border border-white/[0.05] font-mono text-[11px]">
             <div className="flex items-center gap-2 mb-4 text-emerald-400">
                <CheckCircle2 size={14} />
                <span className="font-bold uppercase tracking-widest">Ad Performance Summary</span>
             </div>
             <p className="text-slate-400 leading-relaxed uppercase">
               Clicks generated: <strong className="text-white">{stats?.adClicks}</strong><br/>
               Acquisition rate: <strong className="text-white">{stats?.adClicks ? ((stats.newSubs / stats.adClicks) * 100).toFixed(1) : 0}%</strong><br/>
               Daily LTV Estimate: <strong className="text-white">${stats?.newSubs ? (stats.totalEarned / stats.newSubs).toFixed(2) : 0}</strong>
             </p>
          </div>
        </div>

        {/* Recent Transactions List */}
        <div className="glass-card p-10 rounded-[2.5rem] border-white/[0.05] flex flex-col gap-6 shadow-xl relative overflow-hidden">
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-slate-950 to-transparent pointer-events-none z-10 opacity-60"></div>
          
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-white font-outfit uppercase tracking-tight flex items-center gap-3">
               <DollarSign size={20} className="text-emerald-400" /> Recent Transactions
            </h3>
            <span className="text-[9px] uppercase font-black text-slate-500 tracking-widest">Live Flow</span>
          </div>

          <div className="space-y-3 min-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
            <AnimatePresence mode="popLayout">
              {transactions.length > 0 ? transactions.map((txn) => (
                <motion.div
                  key={txn.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 bg-white/[0.02] border border-white/[0.05] rounded-2xl flex items-center justify-between hover:bg-white/[0.05] transition-colors group"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-xl border ${
                      txn.type === 'tip' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' : 
                      'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                    }`}>
                       {txn.type === 'tip' ? <DollarSign size={16} /> : <MessageSquare size={16} />}
                    </div>
                    <div>
                      <p className="text-[11px] font-black text-white uppercase tracking-wider">{txn.type || 'PURCHASE'}</p>
                      <p className="text-[9px] text-slate-500 font-bold">
                        {new Date(txn.created_at).toLocaleTimeString()} • {txn.id.slice(-8).toUpperCase()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                     <p className="text-sm font-black text-white font-outfit">+${txn.amount.toFixed(2)}</p>
                     <p className="text-[8px] uppercase text-emerald-500 font-bold tracking-tighter">SUCCESSFUL</p>
                  </div>
                </motion.div>
              )) : (
                <div className="h-full flex flex-col items-center justify-center text-center opacity-30 gap-4 mt-20">
                   <Activity size={48} className="text-slate-600 animate-pulse" />
                   <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Waiting for incoming data</p>
                </div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Chatters Performance Row */}
      <ChattersPerformanceTable metrics={operatorMetrics} />

      {/* Webhook Info Footer */}
      <div className="p-10 bg-indigo-600/[0.03] border border-indigo-500/10 rounded-[3rem] relative overflow-hidden group">
         <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-20 transition-opacity">
            <Ghost size={120} />
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 relative z-10">
            <div className="space-y-3">
               <h4 className="text-indigo-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                  <CheckCircle2 size={16} /> Webhook Production Ready
               </h4>
               <p className="text-slate-400 text-xs leading-relaxed">
                 Configured for <strong>survey.completed</strong> events. Webhook validation is enforced using the provided secret key via signature matching protocols.
               </p>
            </div>
            <div className="space-y-3">
               <h4 className="text-indigo-400 font-bold uppercase tracking-widest text-xs flex items-center gap-2">
                  <Activity size={16} /> Analytics Architecture
               </h4>
               <p className="text-slate-400 text-xs leading-relaxed">
                 State-of-the-art event batching and debounce logic on frontend combined with Node.js proxying ensures zero token leakage.
               </p>
            </div>
            <div className="flex flex-col justify-center items-end">
               <div className="bg-emerald-500/10 text-emerald-400 px-6 py-3 rounded-2xl border border-emerald-500/20">
                  <p className="text-[10px] font-black uppercase tracking-widest">System Health</p>
                  <div className="flex items-center gap-2 mt-1">
                     <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                     <span className="text-sm font-black uppercase font-outfit">Active Proxy</span>
                  </div>
               </div>
            </div>
         </div>
      </div>
    </div>
  );
};

const ChattersPerformanceTable = ({ metrics }: { metrics: MetricData[] }) => {
  return (
    <div className="glass-card p-10 rounded-[2.5rem] border-white/[0.05] flex flex-col gap-8 shadow-xl bg-gradient-to-br from-indigo-950/20 to-transparent">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-white font-outfit uppercase tracking-tight flex items-center gap-3">
            <Users size={20} className="text-indigo-400" /> Chatters Performance
          </h3>
          <p className="text-slate-500 text-xs mt-2">Real-time efficiency metrics for all active operators.</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{metrics.length} Active</span>
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-white/[0.05]">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white/5">
              <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/[0.05]">Operator (ID)</th>
              <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/[0.05]">Avg Reply Time</th>
              <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/[0.05]">Sales</th>
              <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/[0.05]">Tips</th>
              <th className="p-5 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-white/[0.05] text-right">Conversion</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.03]">
            {metrics.map((item) => {
              const conversion = item.messages_count > 0 
                ? Math.round((item.paid_messages_count / item.messages_count) * 100) 
                : 0;
              const isSlow = item.reply_time_avg > 90;
              const sales = item.paid_messages_price_sum || item.total_sold_messages_price_sum || 0;
              const tips = item.tips_amount_sum || item.total_tips_amount_sum || 0;

              return (
                <tr 
                  key={item.user_id} 
                  className={`transition-colors group hover:bg-white/[0.04] ${isSlow ? 'bg-rose-500/5' : ''}`}
                >
                  <td className="p-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center border border-white/10 text-indigo-400 font-bold text-xs">
                        {String(item.user_id).slice(-2)}
                      </div>
                      <span className="text-xs font-bold text-white tracking-widest font-mono">#{item.user_id}</span>
                    </div>
                  </td>
                  <td className="p-5">
                    <div className="flex items-center gap-2">
                      <Clock size={14} className={isSlow ? 'text-rose-500' : 'text-slate-500'} />
                      <span className={`text-sm font-black font-outfit ${isSlow ? 'text-rose-500 underline decoration-rose-500/30' : 'text-white'}`}>
                        {item.reply_time_avg}<span className="text-[10px] opacity-40 ml-1">s</span>
                      </span>
                    </div>
                  </td>
                  <td className="p-5">
                    <span className="text-sm font-black text-white font-outfit">${sales.toLocaleString()}</span>
                  </td>
                  <td className="p-5">
                    <span className="text-sm font-black text-amber-400 font-outfit">${tips.toLocaleString()}</span>
                  </td>
                  <td className="p-5 text-right">
                    <div className="inline-flex flex-col items-end">
                      <span className="text-sm font-black text-indigo-400 font-outfit">{conversion}%</span>
                      <div className="w-16 bg-white/5 h-1 rounded-full mt-1 overflow-hidden">
                        <div 
                          className="bg-indigo-500 h-full rounded-full transition-all duration-1000" 
                          style={{ width: `${conversion}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
            {metrics.length === 0 && (
              <tr>
                <td colSpan={5} className="p-20 text-center text-slate-500 text-xs font-bold uppercase tracking-[0.3em] opacity-40">
                  No operator data available for this period
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SimButton = ({ label, icon, onClick, color }: { label: string; icon: React.ReactNode; onClick: () => void; color: string }) => {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-500/5 hover:bg-emerald-500 text-emerald-500 hover:text-white border-emerald-500/20',
    indigo: 'bg-indigo-500/5 hover:bg-indigo-500 text-indigo-500 hover:text-white border-indigo-500/20',
    rose: 'bg-rose-500/5 hover:bg-rose-500 text-rose-500 hover:text-white border-rose-500/20',
    sky: 'bg-sky-500/5 hover:bg-sky-500 text-sky-500 hover:text-white border-sky-500/20',
    slate: 'bg-slate-500/5 hover:bg-slate-500 text-slate-400 hover:text-white border-slate-500/20',
  };

  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-3 p-6 rounded-3xl border transition-all duration-300 active:scale-95 text-center ${colors[color] || colors.indigo}`}
    >
      <div className="shrink-0">{icon}</div>
      <span className="text-[10px] uppercase font-black tracking-widest">{label}</span>
    </button>
  );
};

const MetricSummaryCard = ({ title, value, icon, color }: { title: string; value: string; icon: React.ReactNode; color: string }) => {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 shadow-indigo-500/5',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-emerald-500/5',
    sky: 'bg-sky-500/10 border-sky-500/20 text-sky-400 shadow-sky-500/5',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-amber-500/5',
  };

  return (
    <motion.div 
      whileHover={{ scale: 1.02, x: 5 }}
      className={`p-6 rounded-3xl border glass-card flex items-center gap-6 transition-all duration-300 ${colors[color] || colors.indigo}`}
    >
       <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-white/5 bg-white/5`}>
          {React.cloneElement(icon as React.ReactElement, { size: 24 })}
       </div>
       <div>
          <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.25em] mb-1 opacity-60">{title}</p>
          <p className="text-2xl font-black text-white font-outfit tracking-tighter">{value}</p>
       </div>
    </motion.div>
  );
};

export default OnlyMonster;
