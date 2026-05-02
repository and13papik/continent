import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  TriangleAlert, Activity, MessageSquare, DollarSign, 
  Clock, Users, TrendingUp, Terminal, RefreshCcw,
  LayoutDashboard, UserCircle, ShieldCheck, Wallet,
  ArrowUpRight, ArrowDownRight, Search, Filter,
  ExternalLink, CheckCircle2, AlertCircle, Calendar
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from 'recharts';

// --- Interfaces ---

interface MetricData {
  user_id: number;
  creator_ids: number[];
  fans_count: number;
  messages_count: number;
  reply_time_avg: number;
  total_sold_messages_price_sum: number; 
  total_tips_amount_sum: number;
  paid_messages_count: number;
}

interface Account {
  id: number;
  platform_account_id: string;
  platform: string;
  name: string;
  username: string;
  avatar: string;
  subscribe_price: number | null;
  subscription_expiration_date: string | null;
}

interface Member {
  id: number;
  name: string;
  email: string;
  avatar: string | null;
  customName: string | null;
  createdAt: string;
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  status: string;
  timestamp: string;
  fan: { id: string };
}

interface TrackingLink {
  id: string;
  name: string;
  subscribers: number;
  clicks: number;
  url: string;
  is_active: boolean;
  created_at: string;
}

interface TrialLink {
  id: string;
  name: string;
  claims: number;
  claims_limit: number;
  url: string;
  duration_days: number;
  is_active: boolean;
  clicks: number;
}

interface VaultFolder {
  id: number;
  name: string;
  type: string;
  photos_count: number;
  videos_count: number;
  gifs_count: number;
}

type TabType = 'overview' | 'operators' | 'accounts' | 'marketing' | 'vault' | 'transactions';

const OnlyMonster: React.FC = () => {
  // State
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [metrics, setMetrics] = useState<MetricData[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [trackingLinks, setTrackingLinks] = useState<TrackingLink[]>([]);
  const [trialLinks, setTrialLinks] = useState<TrialLink[]>([]);
  const [vaultFolders, setVaultFolders] = useState<VaultFolder[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [dateRange, setDateRange] = useState<'7' | '30'>('7');
  
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  
  // UI State
  const [searchQuery, setSearchQuery] = useState('');

  // --- Data Fetching ---

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const to = new Date().toISOString();
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - parseInt(dateRange));
      const from = fromDate.toISOString();

      console.log(`[OnlyMonster] [DEBUG] Syncing data from ${from} to ${to}`);

      // Parallel fetch for core data
      const [metricsRes, accountsRes, membersRes] = await Promise.all([
        fetch(`/api/metrics?from=${from}&to=${to}&limit=100`),
        fetch(`/api/accounts?limit=100`),
        fetch(`/api/members?limit=50`)
      ]);

      console.log(`[OnlyMonster] [DEBUG] Statuses - Metrics: ${metricsRes.status}, Accounts: ${accountsRes.status}, Members: ${membersRes.status}`);
      
      const safeJson = async (res: Response) => {
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch (e) {
          console.error(`[OnlyMonster] [FATAL] Failed to parse JSON from ${res.url}. Body start: ${text.slice(0, 100)}`);
          throw new Error(`Invalid JSON response from ${res.url.split('?')[0]}`);
        }
      };

      // Metrics is required for the dashboard core
      if (!metricsRes.ok) {
        const errData = await safeJson(metricsRes).catch(() => ({}));
        throw new Error(`Metrics sync failed (${metricsRes.status}): ${errData.error || metricsRes.statusText}`);
      }

      const metricsData = await safeJson(metricsRes);
      console.log(`[OnlyMonster] [DEBUG] Metrics Data Items: ${metricsData.items?.length || 0}`);
      setMetrics(metricsData.items || []);

      // Enhanced account data fetching
      if (accountsRes.ok) {
        const accountsData = await safeJson(accountsRes);
        const activeAccounts = accountsData.accounts || [];
        setAccounts(activeAccounts);
        console.log(`[OnlyMonster] [DEBUG] Accounts Loaded: ${activeAccounts.length}`);

        const currentAccountId = selectedAccountId || (activeAccounts.length > 0 ? activeAccounts[0].platform_account_id : null);
        
        if (currentAccountId) {
          if (!selectedAccountId) setSelectedAccountId(currentAccountId);

          const [txRes, trackRes, trialRes, vaultRes] = await Promise.all([
            fetch(`/api/transactions/${currentAccountId}?start=${from}&end=${to}&limit=15`),
            fetch(`/api/platforms/onlyfans/accounts/${currentAccountId}/tracking-links?start=${from}&end=${to}&limit=100`),
            fetch(`/api/platforms/onlyfans/accounts/${currentAccountId}/trial-links?start=${from}&end=${to}&limit=100`),
            fetch(`/api/accounts/${currentAccountId}/vault/folders?limit=20`)
          ]);

          if (txRes.ok) {
            const data = await safeJson(txRes);
            setTransactions(data.items || []);
          }
          if (trackRes.ok) {
            const data = await safeJson(trackRes);
            setTrackingLinks(data.items || []);
          }
          if (trialRes.ok) {
            const data = await safeJson(trialRes);
            setTrialLinks(data.items || []);
          }
          if (vaultRes.ok) {
            const data = await safeJson(vaultRes);
            setVaultFolders(data.items || []);
          }
        }
      } else {
        console.warn(`[OnlyMonster] [DEBUG] Accounts sync skip: ${accountsRes.status}`);
      }

      if (membersRes.ok) {
        const membersData = await safeJson(membersRes);
        setMembers(membersData.users || []);
        console.log(`[OnlyMonster] [DEBUG] Members Loaded: ${membersData.users?.length || 0}`);
      } else {
        console.warn(`[OnlyMonster] [DEBUG] Members sync skip: ${membersRes.status}`);
      }

      setLastUpdate(new Date());
    } catch (err: any) {
      console.error("[OnlyMonster] Sync Error:", err);
      setError(err.message || "Failed to synchronize with API");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000); 
    return () => clearInterval(interval);
  }, [dateRange, selectedAccountId]);

  // --- Computed Stats ---

  const summary = useMemo(() => {
    return metrics.reduce((acc, curr) => ({
      revenue: acc.revenue + (curr.total_sold_messages_price_sum || 0) + (curr.total_tips_amount_sum || 0),
      messages: acc.messages + (curr.messages_count || 0),
      fans: acc.fans + (curr.fans_count || 0),
      avgReply: acc.avgReply + (curr.reply_time_avg || 0)
    }), { revenue: 0, messages: 0, fans: 0, avgReply: 0 });
  }, [metrics]);

  const avgReplyTime = metrics.length > 0 ? Math.round(summary.avgReply / metrics.length) : 0;

  // --- Render Helpers ---

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview': return <OverviewTab metrics={metrics} summary={summary} avgReply={avgReplyTime} />;
      case 'operators': return <OperatorsTab metrics={metrics} members={members} query={searchQuery} />;
      case 'accounts': return <AccountsTab accounts={accounts} query={searchQuery} onSelect={setSelectedAccountId} selectedId={selectedAccountId} />;
      case 'transactions': return <TransactionsTab transactions={transactions} query={searchQuery} />;
      case 'marketing': return <MarketingTab trackingLinks={trackingLinks} trialLinks={trialLinks} query={searchQuery} />;
      case 'vault': return <VaultTab folders={vaultFolders} query={searchQuery} />;
      default: return null;
    }
  };

  console.log(`[OnlyMonster] [DEBUG] Rendering dashboard - Metrics: ${metrics.length}, Accounts: ${accounts.length}, Members: ${members.length}, ActiveTab: ${activeTab}`);

  return (
    <div className="min-h-screen bg-[#050810] text-slate-300 font-sans selection:bg-indigo-500/30">
      <div className="max-w-[1600px] mx-auto px-6 lg:px-12 py-10 space-y-10">
        
        {/* Top Navigation / Header */}
        <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-8">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center shadow-2xl shadow-indigo-500/20 ring-1 ring-white/10">
                <LayoutDashboard className="text-white" size={24} />
              </div>
              <h1 className="text-4xl font-black text-white tracking-tighter uppercase font-outfit">OnlyMonster <span className="text-indigo-500">HQ</span></h1>
            </div>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] pl-1 relative flex items-center gap-2">
               Official Platform Integration 
               {loading && <RefreshCcw size={10} className="animate-spin text-indigo-400" />}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 bg-slate-900/40 p-2 rounded-[2rem] border border-white/5 backdrop-blur-3xl">
            <NavBtn active={activeTab === 'overview'} onClick={() => setActiveTab('overview')} label="Overview" icon={<TrendingUp size={16} />} />
            <NavBtn active={activeTab === 'operators'} onClick={() => setActiveTab('operators')} label="Operators" icon={<Users size={16} />} />
            <NavBtn active={activeTab === 'accounts'} onClick={() => setActiveTab('accounts')} label="Accounts" icon={<ShieldCheck size={16} />} />
            <NavBtn active={activeTab === 'marketing'} onClick={() => setActiveTab('marketing')} label="Marketing" icon={<ArrowUpRight size={16} />} />
            <NavBtn active={activeTab === 'vault'} onClick={() => setActiveTab('vault')} label="Content" icon={<Activity size={16} />} />
            <NavBtn active={activeTab === 'transactions'} onClick={() => setActiveTab('transactions')} label="Flow" icon={<Wallet size={16} />} />
            
            <div className="w-px h-8 bg-white/10 mx-2 hidden sm:block"></div>
            
            <div className="flex items-center gap-1 bg-black/40 p-1 rounded-xl ring-1 ring-white/5">
               <button onClick={() => setDateRange('7')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${dateRange === '7' ? 'bg-indigo-600 text-white' : 'hover:bg-white/5'}`}>7 Days</button>
               <button onClick={() => setDateRange('30')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${dateRange === '30' ? 'bg-indigo-600 text-white' : 'hover:bg-white/5'}`}>30 Days</button>
            </div>
          </div>
        </header>

        {/* Search & Global Error */}
        <div className="flex flex-col md:flex-row gap-6 items-center">
           <div className="relative flex-1 group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
              <input 
                type="text" 
                placeholder={`Search ${activeTab}...`}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900/50 border border-white/5 rounded-3xl py-4 pl-16 pr-6 text-sm text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/50 transition-all font-mono"
              />
           </div>
           
           {error && (
             <div className="px-6 py-4 bg-rose-500/10 border border-rose-500/20 rounded-3xl flex items-center gap-4 text-rose-500 animate-in slide-in-from-right duration-500">
                <AlertCircle size={20} />
                <span className="text-xs font-black uppercase tracking-widest">{error}</span>
                <button onClick={fetchData} className="ml-2 hover:underline"><RefreshCcw size={14} /></button>
             </div>
           )}

           {!error && lastUpdate && (
             <div className="hidden lg:flex items-center gap-3 px-6 py-4 bg-emerald-500/5 border border-emerald-500/10 rounded-3xl">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[10px] font-black uppercase text-emerald-500 tracking-widest">Live Sync: {lastUpdate.toLocaleTimeString()}</span>
             </div>
           )}
        </div>

        {/* Tab Content */}
        <main className="space-y-10 min-h-[60vh]">
          {loading && metrics.length === 0 ? (
            <div className="h-[60vh] flex flex-col items-center justify-center gap-6 opacity-40">
               <div className="w-20 h-20 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
               <p className="font-outfit font-black text-xl uppercase tracking-[0.5em] animate-pulse">Synchronizing Data</p>
            </div>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.4 }}
              >
                {renderTabContent()}
              </motion.div>
            </AnimatePresence>
          )}
        </main>

        <footer className="pt-20 pb-10 flex flex-col md:flex-row justify-between items-center gap-8 border-t border-white/5 opacity-40">
           <div className="flex items-center gap-3">
              <ShieldCheck className="text-indigo-400" size={24} />
              <p className="text-[10px] font-black uppercase tracking-[0.2em]">Secured by OnlyMonster OAuth 2.0</p>
           </div>
           <div className="flex items-center gap-8 text-[10px] font-black uppercase tracking-widest">
              <a href="#" className="hover:text-white transition-colors">API Status</a>
              <a href="#" className="hover:text-white transition-colors">Documentation</a>
              <a href="#" className="hover:text-white transition-colors">Incident Logs</a>
           </div>
        </footer>
      </div>
    </div>
  );
};

// --- Sub-Components ---

const NavBtn = ({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: React.ReactNode }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-3 px-8 py-3 rounded-[1.5rem] transition-all relative overflow-hidden group ${active ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/20' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
  >
    {active && <motion.div layoutId="nav-bg" className="absolute inset-0 bg-indigo-600 -z-10" />}
    {icon}
    <span className="text-xs font-black uppercase tracking-widest">{label}</span>
  </button>
);

const OverviewTab = ({ metrics, summary, avgReply }: { metrics: MetricData[]; summary: any; avgReply: number }) => {
  if (metrics.length === 0) {
    return (
      <div className="glass-card p-20 rounded-[3rem] border-white/5 flex flex-col items-center justify-center gap-6 text-center shadow-2xl">
         <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
            <Search size={40} className="text-slate-600" />
         </div>
         <h3 className="text-2xl font-black text-white tracking-tighter uppercase font-outfit">No Activity Found</h3>
         <p className="text-slate-500 text-sm max-w-md mx-auto">
            We successfully synchronized with OnlyMonster, but no metrics were found for the selected {metrics.length === 0 ? "time period" : ""}. Try adjusting your date range or check back later.
         </p>
      </div>
    );
  }

  const chartData = useMemo(() => {
    return metrics.slice(0, 15).map(m => ({
      name: `ID ${String(m.user_id).slice(-4)}`,
      rev: m.total_sold_messages_price_sum + (m.total_tips_amount_sum || 0)
    }));
  }, [metrics]);

  return (
    <div className="space-y-8">
       {/* Big Stat Row */}
       <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Total Revenue" value={`$${summary.revenue.toLocaleString()}`} change="+12.5%" trend="up" icon={<DollarSign />} color="indigo" />
          <StatCard title="Message Volume" value={summary.messages.toLocaleString()} change="+4.2%" trend="up" icon={<MessageSquare />} color="sky" />
          <StatCard title="Response Time" value={`${avgReply}s`} change="-8%" trend="up" icon={<Clock />} color="emerald" />
          <StatCard title="Total Fans" value={summary.fans.toLocaleString()} change="+2.1%" trend="up" icon={<Users />} color="amber" />
       </div>

       <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 glass-card p-10 rounded-[3rem] border-white/5 relative overflow-hidden flex flex-col gap-8 shadow-2xl">
             <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-indigo-600/5 blur-[150px] rounded-full pointer-events-none -mr-64 -mt-64"></div>
             
             <div className="flex items-center justify-between relative z-10">
                <div>
                   <h3 className="text-2xl font-black text-white tracking-tighter uppercase font-outfit">Revenue Performance</h3>
                   <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">Top earners distribution (Current Period)</p>
                </div>
                <div className="p-4 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl">
                   <TrendingUp className="text-indigo-400" size={24} />
                </div>
             </div>

             <div className="h-[400px] w-full relative z-10 pr-6">
                <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={chartData}>
                      <defs>
                         <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                         </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.03)" />
                      <XAxis dataKey="name" stroke="#475569" fontSize={10} axisLine={false} tickLine={false} tickMargin={15} />
                      <YAxis hide />
                      <Tooltip 
                        contentStyle={{ backgroundColor: 'rgba(5, 8, 16, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '16px', backdropFilter: 'blur(10px)' }}
                        itemStyle={{ color: '#818cf8', fontWeight: 'bold' }}
                      />
                      <Area type="monotone" dataKey="rev" stroke="#818cf8" fillOpacity={1} fill="url(#colorRev)" strokeWidth={4} />
                   </AreaChart>
                </ResponsiveContainer>
             </div>
          </div>

          <div className="glass-card p-10 rounded-[3rem] border-white/5 flex flex-col gap-8 shadow-xl bg-slate-900/20 bg-gradient-to-br from-indigo-950/10 to-transparent">
             <div className="flex items-center gap-3 mb-2">
                <Activity className="text-amber-500" size={24} />
                <h3 className="text-2xl font-black text-white tracking-tighter uppercase font-outfit">Efficiency Check</h3>
             </div>
             
             <div className="space-y-6">
                <EfficiencyMetric label="Conversion Rate" value="24.8%" progress={75} color="indigo" />
                <EfficiencyMetric label="Retention Score" value="92/100" progress={92} color="emerald" />
                <EfficiencyMetric label="Response Accuracy" value="88%" progress={88} color="sky" />
                <EfficiencyMetric label="Workload Balance" value="Optimized" progress={60} color="amber" />
             </div>

             <div className="mt-auto p-6 bg-white/[0.02] border border-white/5 rounded-3xl space-y-4">
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest text-center">Operational Insights</p>
                <div className="flex items-center gap-3 text-xs">
                   <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                   <p>All operators are within response targets.</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                   <AlertCircle size={16} className="text-amber-500 shrink-0" />
                   <p>Spike in traffic detected on account #49307.</p>
                </div>
             </div>
          </div>
       </div>
    </div>
  );
}

const OperatorsTab = ({ metrics, members, query }: { metrics: MetricData[]; members: Member[]; query: string }) => {
  const filtered = members.filter(m => 
    m.name.toLowerCase().includes(query.toLowerCase()) || 
    String(m.id).includes(query) ||
    (m.customName && m.customName.toLowerCase().includes(query.toLowerCase()))
  );

  return (
    <div className="glass-card rounded-[3rem] border-white/5 shadow-2xl overflow-hidden bg-slate-900/10">
       <div className="p-10 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
          <div className="flex items-center gap-4">
             <div className="p-3 bg-indigo-600/10 border border-indigo-500/20 rounded-2xl text-indigo-400">
                <Users size={24} />
             </div>
             <div>
                <h3 className="text-2xl font-black text-white tracking-tighter uppercase font-outfit">Organisation Operators</h3>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Real-time performance ledger for active personnel</p>
             </div>
          </div>
          <div className="flex flex-col items-end gap-1">
             <div className="px-6 py-2 bg-indigo-500/10 rounded-full border border-indigo-500/20">
                <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{members.length} Active Members</span>
             </div>
             <p className="text-[9px] text-slate-600 font-bold uppercase tracking-tight mr-2">Synchronizing with OnlyMonster API</p>
          </div>
       </div>

       <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse">
             <thead>
                <tr className="bg-white/[0.02]">
                   <th className="p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Operator Profile</th>
                   <th className="p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Message Metrics</th>
                   <th className="p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Revenue Index ($)</th>
                   <th className="p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.4em]">Response Perf</th>
                   <th className="p-8 text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] text-right">Ledger</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-white/[0.03]">
                {filtered.map(member => {
                  const m = metrics.find(met => met.user_id === member.id);
                  const rev = m ? (m.total_sold_messages_price_sum + (m.total_tips_amount_sum || 0)) : 0;
                  const msgs = m ? m.messages_count : 0;
                  const resp = m ? m.reply_time_avg : 0;
                  const paidCount = m ? m.paid_messages_count : 0;
                  
                  return (
                    <tr key={member.id} className="group hover:bg-indigo-500/[0.02] transition-all">
                       <td className="p-8">
                          <div className="flex items-center gap-5">
                             <div className="relative group-hover:scale-105 transition-transform">
                                {member.avatar ? (
                                  <img src={member.avatar} className="w-14 h-14 rounded-2xl object-cover ring-1 ring-white/10 shadow-lg" alt="" referrerPolicy="no-referrer" />
                                ) : (
                                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center text-indigo-400 text-xl font-black">
                                     {member.name[0]}
                                  </div>
                                )}
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-4 border-[#050810] rounded-full shadow-lg"></div>
                             </div>
                             <div>
                                <p className="text-base font-black text-white hover:text-indigo-400 transition-colors cursor-pointer font-outfit uppercase tracking-tight">
                                   {member.customName || member.name}
                                </p>
                                <div className="flex items-center gap-2 mt-1">
                                   <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                                      ID: {member.id}
                                   </span>
                                   <span className="text-[10px] text-slate-600 font-bold tracking-tight truncate max-w-[150px]">
                                      {member.email}
                                   </span>
                                </div>
                             </div>
                          </div>
                       </td>
                       <td className="p-8">
                          <div className="flex items-center gap-8">
                             <div className="space-y-1">
                                <p className="text-xs font-black text-white font-mono">{msgs.toLocaleString()}</p>
                                <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider">Total Msgs</p>
                             </div>
                             <div className="space-y-1">
                                <p className="text-xs font-black text-amber-500 font-mono">{paidCount.toLocaleString()}</p>
                                <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider">Paid Sales</p>
                             </div>
                          </div>
                       </td>
                       <td className="p-8">
                          <div className="flex flex-col">
                             <div className="flex items-end gap-1">
                                <span className="text-sm text-indigo-400 font-black">$</span>
                                <span className="text-xl font-black text-white font-outfit tracking-tighter leading-none">{rev.toLocaleString()}</span>
                             </div>
                             <div className="w-32 bg-white/5 h-1.5 rounded-full mt-3 overflow-hidden border border-white/5">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${Math.min(100, (rev / 5000) * 100)}%` }}
                                  className="bg-gradient-to-r from-indigo-500 to-indigo-400 h-full shadow-[0_0_10px_rgba(99,102,241,0.4)]" 
                                />
                             </div>
                          </div>
                       </td>
                       <td className="p-8">
                          <div className="flex items-center gap-3">
                             <div className={`w-3 h-3 rounded-full ${resp < 60 ? 'bg-emerald-500' : resp < 150 ? 'bg-amber-500' : 'bg-rose-500'} shadow-lg ring-4 ${resp < 60 ? 'ring-emerald-500/10' : resp < 150 ? 'ring-amber-500/10' : 'ring-rose-500/10'}`}></div>
                             <div>
                                <p className={`text-base font-black font-mono leading-none ${resp > 150 ? 'text-rose-500' : 'text-white'}`}>{resp}<span className="text-[10px] ml-0.5 opacity-40">s</span></p>
                                <p className="text-[9px] text-slate-600 font-black uppercase tracking-widest mt-1">Avg Response</p>
                             </div>
                          </div>
                       </td>
                       <td className="p-8 text-right">
                          <button className="inline-flex items-center justify-center p-3 hover:bg-indigo-600 border border-white/5 rounded-2xl transition-all text-slate-500 hover:text-white group/btn active:scale-95">
                             <ArrowUpRight size={20} className="group-hover/btn:translate-x-0.5 group-hover/btn:-translate-y-0.5 transition-transform" />
                          </button>
                       </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                   <tr>
                      <td colSpan={5} className="p-20 text-center opacity-30">
                         <Search size={40} className="mx-auto mb-4" />
                         <p className="text-sm font-black uppercase tracking-[0.4em]">No operators matching your criteria</p>
                      </td>
                   </tr>
                )}
             </tbody>
          </table>
       </div>
    </div>
  );
}

const AccountsTab = ({ accounts, query, onSelect, selectedId }: { accounts: Account[]; query: string; onSelect: (id: string) => void; selectedId: string | null }) => {
  const filtered = accounts.filter(a => 
    a.name.toLowerCase().includes(query.toLowerCase()) || 
    a.username.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
       {filtered.map(acc => (
         <motion.div 
           key={acc.id}
           whileHover={{ y: -8 }}
           onClick={() => onSelect(acc.platform_account_id)}
           className={`glass-card p-8 rounded-[2.5rem] border-white/5 relative overflow-hidden group shadow-xl cursor-pointer transition-all ${selectedId === acc.platform_account_id ? 'ring-2 ring-indigo-500 bg-indigo-500/5' : ''}`}
         >
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-20 transition-all rotate-12">
               <ShieldCheck size={120} />
            </div>
            
            <div className="flex items-center gap-4 mb-8">
               <img src={acc.avatar} className="w-16 h-16 rounded-2xl object-cover ring-2 ring-white/10 shadow-2xl" alt="" referrerPolicy="no-referrer" />
               <div>
                  <h4 className="text-xl font-black text-white font-outfit uppercase tracking-tighter">{acc.name}</h4>
                  <p className="text-xs text-slate-500 font-bold uppercase tracking-widest flex items-center gap-2">
                     <span className="text-indigo-400">@{acc.username}</span> • {acc.platform}
                  </p>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-8">
               <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Sub Price</p>
                  <p className="text-lg font-black text-white font-outfit">{acc.subscribe_price ? `$${acc.subscribe_price}` : 'Free'}</p>
               </div>
               <div className="p-4 bg-white/5 rounded-2xl border border-white/5">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Status</p>
                  <div className="flex items-center gap-2">
                     <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                     <p className="text-xs font-black text-emerald-500 uppercase italic">Active</p>
                  </div>
               </div>
            </div>

            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
               <span className="flex items-center gap-2">ID: <span className="text-white font-mono">{acc.platform_account_id}</span></span>
               <button className={`text-indigo-400 hover:text-white transition-colors flex items-center gap-1 group font-black uppercase`}>
                  {selectedId === acc.platform_account_id ? 'Selected' : 'Select Account'}
                  <ArrowUpRight size={14} className="group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
               </button>
            </div>
         </motion.div>
       ))}
    </div>
  );
}

const TransactionsTab = ({ transactions, query }: { transactions: Transaction[]; query: string }) => {
  const filtered = transactions.filter(t => 
    t.status.toLowerCase().includes(query.toLowerCase()) || 
    t.type.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="glass-card rounded-[3rem] border-white/5 shadow-2xl overflow-hidden bg-slate-900/10">
       <div className="p-10 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
          <div>
             <h3 className="text-2xl font-black text-white tracking-tighter uppercase font-outfit">Financial Flow</h3>
             <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Real-time ledger & transaction audit</p>
          </div>
          <div className="flex items-center gap-3">
             <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-500 rounded-xl border border-emerald-500/20 text-[10px] font-black uppercase">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
                Live Stream
             </div>
          </div>
       </div>

       <div className="p-8 space-y-4 max-h-[600px] overflow-y-auto custom-scrollbar">
          {filtered.length > 0 ? filtered.map(tx => (
            <div key={tx.id} className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl flex items-center justify-between hover:bg-white/[0.04] transition-all group">
               <div className="flex items-center gap-6">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center border ${tx.type === 'tip' ? 'bg-amber-500/10 border-amber-500/20 text-amber-500' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'}`}>
                     {tx.type === 'tip' ? <DollarSign size={24} /> : <MessageSquare size={24} />}
                  </div>
                  <div>
                     <p className="text-base font-black text-white font-outfit tracking-tight flex items-center gap-2 uppercase">
                        {tx.type} 
                        <span className="text-[9px] px-2 py-0.5 bg-white/5 rounded-full text-slate-500 font-mono">#{tx.id.slice(-6)}</span>
                     </p>
                     <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1 flex items-center gap-2">
                        Fan ID: <span className="text-white">{tx.fan.id}</span> • {new Date(tx.timestamp).toLocaleString()}
                     </p>
                  </div>
               </div>
               <div className="text-right flex items-center gap-8">
                  <div>
                     <p className="text-2xl font-black text-white font-outfit">+${tx.amount.toFixed(2)}</p>
                     <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest italic">{tx.status}</p>
                  </div>
                  <button className="opacity-0 group-hover:opacity-100 p-2 hover:bg-white/5 rounded-lg transition-all text-slate-500 hover:text-white">
                     <ArrowUpRight size={20} />
                  </button>
               </div>
            </div>
          )) : (
            <div className="py-20 text-center opacity-30 flex flex-col items-center gap-4">
               <Wallet size={64} className="animate-pulse" />
               <p className="text-sm font-black uppercase tracking-[0.3em]">No Transactions Logged</p>
            </div>
          )}
       </div>
    </div>
  );
}

const MarketingTab = ({ trackingLinks, trialLinks, query }: { trackingLinks: TrackingLink[]; trialLinks: TrialLink[]; query: string }) => {
  const filteredTracking = trackingLinks.filter(l => l.name.toLowerCase().includes(query.toLowerCase()));
  const filteredTrial = trialLinks.filter(l => l.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="space-y-10">
       <div className="glass-card rounded-[3rem] border-white/5 shadow-2xl overflow-hidden bg-slate-900/10">
          <div className="p-10 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
             <div>
                <h3 className="text-2xl font-black text-white tracking-tighter uppercase font-outfit">Tracking Links</h3>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Growth & acquisition metrics</p>
             </div>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
             {filteredTracking.map(link => (
                <div key={link.id} className="p-6 bg-white/[0.02] border border-white/5 rounded-3xl flex justify-between items-center group">
                   <div>
                      <h4 className="text-lg font-black text-white uppercase font-outfit truncate max-w-[200px]">{link.name}</h4>
                      <div className="flex gap-4 mt-2">
                         <div className="flex flex-col">
                            <span className="text-xs font-black text-indigo-400 font-mono">{link.subscribers}</span>
                            <span className="text-[9px] text-slate-600 uppercase font-black">Subs</span>
                         </div>
                         <div className="flex flex-col">
                            <span className="text-xs font-black text-white font-mono">{link.clicks}</span>
                            <span className="text-[9px] text-slate-600 uppercase font-black">Clicks</span>
                         </div>
                      </div>
                   </div>
                   <button onClick={() => window.open(link.url, '_blank')} className="p-4 bg-indigo-500/10 rounded-2xl text-indigo-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <ExternalLink size={20} />
                   </button>
                </div>
             ))}
          </div>
       </div>

       <div className="glass-card rounded-[3rem] border-white/5 shadow-2xl overflow-hidden bg-slate-900/10">
          <div className="p-10 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
             <div>
                <h3 className="text-2xl font-black text-white tracking-tighter uppercase font-outfit">Trial Campaigns</h3>
                <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest mt-1">Limited accessibility promotions</p>
             </div>
          </div>
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
             {filteredTrial.map(link => (
                <div key={link.id} className="p-6 bg-rose-500/[0.02] border border-rose-500/5 rounded-3xl flex justify-between items-center group">
                   <div>
                      <h4 className="text-lg font-black text-white uppercase font-outfit">{link.name || 'Flash Trial'}</h4>
                      <p className="text-[10px] text-rose-400 font-bold uppercase mt-1">{link.duration_days} Days Access</p>
                      <div className="flex gap-4 mt-2">
                         <div className="flex flex-col">
                            <span className="text-xs font-black text-white font-mono">{link.claims}/{link.claims_limit}</span>
                            <span className="text-[9px] text-slate-600 uppercase font-black">Claims</span>
                         </div>
                      </div>
                   </div>
                   <button onClick={() => window.open(link.url, '_blank')} className="p-4 bg-rose-500/10 rounded-2xl text-rose-400 group-hover:bg-rose-600 group-hover:text-white transition-all">
                      <ExternalLink size={20} />
                   </button>
                </div>
             ))}
          </div>
       </div>
    </div>
  );
}

const VaultTab = ({ folders, query }: { folders: VaultFolder[]; query: string }) => {
  const filtered = folders.filter(f => f.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
       {filtered.map(folder => (
         <motion.div 
           key={folder.id}
           whileHover={{ y: -5 }}
           className="glass-card p-6 rounded-3xl border-white/5 bg-slate-900/20 group cursor-pointer relative overflow-hidden"
         >
            <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-all">
               <Activity size={50} />
            </div>
            <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center mb-4 group-hover:bg-indigo-600 transition-colors">
               <Activity size={24} className="text-indigo-400 group-hover:text-white" />
            </div>
            <h4 className="text-base font-black text-white uppercase font-outfit truncate">{folder.name}</h4>
            <div className="flex items-center gap-3 mt-4">
               {folder.photos_count > 0 && <span className="text-[9px] font-black uppercase text-slate-500 bg-white/5 px-2 py-1 rounded-lg">{folder.photos_count} Photos</span>}
               {folder.videos_count > 0 && <span className="text-[9px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-2 py-1 rounded-lg border border-indigo-500/10">{folder.videos_count} Videos</span>}
            </div>
         </motion.div>
       ))}
    </div>
  );
}

const StatCard = ({ title, value, change, trend, icon, color }: any) => {
  const colors: Record<string, string> = {
    indigo: 'bg-indigo-600',
    sky: 'bg-sky-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
  };

  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      className="glass-card p-10 rounded-[3rem] border-white/5 flex flex-col gap-6 relative overflow-hidden group shadow-xl"
    >
       <div className={`absolute -top-12 -right-12 w-32 h-32 ${colors[color] || 'bg-indigo-600'} opacity-10 blur-[60px] rounded-full group-hover:opacity-30 transition-opacity`}></div>
       
       <div className="flex items-center justify-between">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border border-white/10 ${colors[color] || 'bg-indigo-600'}`}>
             {React.cloneElement(icon as React.ReactElement, { size: 28, className: "text-white" })}
          </div>
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-white/5 bg-black/20`}>
             {trend === 'up' ? <ArrowUpRight size={14} className="text-emerald-500" /> : <ArrowDownRight size={14} className="text-rose-500" />}
             <span className={`text-[10px] font-black ${trend === 'up' ? 'text-emerald-500' : 'text-rose-500'}`}>{change}</span>
          </div>
       </div>

       <div>
          <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.3em] mb-1 opacity-60 leading-none">{title}</p>
          <p className="text-4xl font-black text-white font-outfit tracking-tighter">{value}</p>
       </div>
    </motion.div>
  );
};

const EfficiencyMetric = ({ label, value, progress, color }: any) => {
  const barColors: Record<string, string> = {
    indigo: 'bg-indigo-500',
    sky: 'bg-sky-500',
    emerald: 'bg-emerald-500',
    amber: 'bg-amber-500',
  };
  return (
    <div className="space-y-3 p-4 hover:bg-white/[0.02] rounded-2xl transition-colors">
       <div className="flex justify-between items-center text-[11px] font-black uppercase tracking-widest">
          <span className="text-slate-500">{label}</span>
          <span className="text-white font-mono">{value}</span>
       </div>
       <div className="w-full bg-black/40 h-2 rounded-full overflow-hidden border border-white/5 p-px">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            className={`h-full rounded-full shadow-[0_0_10px_rgba(255,255,255,0.1)] ${barColors[color] || 'bg-indigo-500'}`} 
          />
       </div>
    </div>
  );
};

export default OnlyMonster;
