import React, { useState, useMemo, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
} from 'recharts';
import { AppState, IncomeRecord, OperationType, OperationRecord, Platform, OperatorWallet } from '../types';
import { ICONS, PLATFORM_NAMES, OPERATION_META } from '../constants';
import PeriodBadge from '../components/PeriodBadge';

// --- HELPER COMPONENTS ---

const StatsCard = ({ title, value, icon, color, highlighted }: { title: string, value: number, icon: React.ReactNode, color: string, highlighted?: boolean }) => (
  <div className={`glass-card p-6 rounded-[2.5rem] border transition-all duration-700 relative overflow-hidden group h-full flex flex-col ${highlighted ? 'border-indigo-500/40 bg-slate-900 shadow-[0_20px_40px_-10px_rgba(99,102,241,0.3)] ring-1 ring-white/10' : 'border-white/5 bg-slate-900/40 hover:bg-slate-900/60 hover:border-white/10 shadow-xl'}`}>
    <div className={`absolute -right-6 -top-6 w-32 h-32 blur-[60px] rounded-full opacity-0 group-hover:opacity-20 transition-all duration-700 ${color === 'indigo' ? 'bg-indigo-500' : 'bg-emerald-500'}`}></div>
    <div className="flex flex-col gap-6 relative z-10 flex-grow">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-700 group-hover:scale-110 group-hover:rotate-6 ${highlighted ? 'bg-indigo-600 text-white shadow-lg' : `bg-slate-950/60 border border-white/5 text-${color}-400 shadow-inner`}`}>
        {React.cloneElement(icon as React.ReactElement, { size: 24 })}
      </div>
      <div className="space-y-2">
        <div className="flex flex-col gap-0.5">
           <p className="text-[9px] font-black uppercase text-slate-500 tracking-[0.3em] leading-none mb-1 group-hover:text-indigo-400 transition-colors truncate">{title}</p>
        </div>
        <div className="flex items-baseline gap-1.5 overflow-hidden">
           <span className={`text-xs font-mono font-black ${highlighted ? 'text-indigo-400' : 'text-slate-600'}`}>$</span>
           <p className={`text-2xl font-black font-outfit tracking-tighter truncate ${highlighted ? 'text-white' : `text-slate-100 group-hover:text-white`}`}>
              {value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
           </p>
        </div>
      </div>
    </div>
  </div>
);

const PlatformPill = ({ label, gross, net, color, icon }: { label: string, gross: number, net: number, color: string, icon: React.ReactNode }) => (
  <div className="glass-card p-5 rounded-[2rem] border-white/5 bg-slate-900/40 hover:bg-slate-900/60 hover:border-white/10 transition-all border group relative overflow-hidden">
    <div className="flex items-center gap-3 mb-4 relative z-10">
       <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all duration-500 group-hover:scale-110 group-hover:bg-opacity-20 ${color === 'indigo' ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : color === 'sky' ? 'bg-sky-500/10 border-sky-500/30 text-sky-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
          {icon}
       </div>
       <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-300 transition-colors">{label}</span>
    </div>
    <div className="space-y-2 relative z-10">
       <div className="flex justify-between items-center px-0.5">
          <span className="text-[8px] font-black uppercase text-slate-600 tracking-widest">Gross</span>
          <span className="text-[10px] text-slate-400 font-mono font-black">${gross.toFixed(0)}</span>
       </div>
       <div className="flex justify-between items-center px-0.5">
          <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Net</span>
          <span className={`text-base font-black font-mono transition-colors ${color === 'indigo' ? 'text-white group-hover:text-indigo-400' : color === 'sky' ? 'text-white group-hover:text-sky-400' : 'text-white group-hover:text-emerald-400'}`}>
             ${net.toFixed(1)}
          </span>
       </div>
    </div>
  </div>
);

const DetailBox = ({ pill, gross, net, rate, color }: { pill: string, gross: number, net: number, rate: string, color: string }) => {
  const colorMap: any = {
    indigo: 'from-indigo-600/10 to-indigo-900/5 border-indigo-500/20 text-indigo-400',
    sky: 'from-sky-600/10 to-sky-900/5 border-sky-500/20 text-sky-400',
    emerald: 'from-emerald-600/10 to-emerald-900/5 border-emerald-500/20 text-emerald-400'
  };
  return (
    <div className={`p-5 rounded-2xl border bg-gradient-to-br transition-all duration-300 hover:bg-opacity-30 ${colorMap[color]}`}>
       <div className="flex justify-between items-start mb-4">
          <div className="flex flex-col">
             <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">{pill}</span>
             <div className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/5 w-fit">
                <span className="text-[9px] font-black font-mono text-white/80">{rate}</span>
             </div>
          </div>
       </div>
       <div className="grid grid-cols-2 gap-3">
          <div className="space-y-0.5">
             <span className="text-[7px] font-black uppercase tracking-[0.2em] text-slate-500">Gross</span>
             <p className="text-sm font-black font-mono text-slate-300">${gross.toFixed(0)}</p>
          </div>
          <div className="space-y-0.5 text-right">
             <span className="text-[7px] font-black uppercase tracking-[0.2em] text-slate-500">Net</span>
             <p className="text-lg font-black font-mono text-white">${net.toFixed(1)}</p>
          </div>
       </div>
    </div>
  );
};

const SummaryLine = ({ label, val, type }: { label: string, val: number, type: 'plus' | 'minus' }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0 hover:bg-white/[0.02] -mx-2 px-2 rounded-lg transition-colors group">
     <div className="flex items-center gap-2.5">
        <div className={`w-2 h-2 rounded-full ${type === 'plus' ? 'bg-emerald-500 shadow-lg' : 'bg-rose-500 shadow-lg'}`}></div>
        <span className="text-slate-400 font-bold text-[10px] uppercase tracking-wider group-hover:text-slate-200 transition-colors truncate max-w-[150px]">{label}</span>
     </div>
     <div className="flex items-baseline gap-1">
        <span className={`text-[10px] font-black ${type === 'plus' ? 'text-emerald-500' : 'text-rose-500'}`}>{type === 'plus' ? '+' : '-'}</span>
        <span className={`font-mono font-black text-sm ${type === 'plus' ? 'text-emerald-400' : 'text-rose-400'}`}>
          ${val.toFixed(1)}
        </span>
     </div>
  </div>
);

const RateField = ({ label, val, onChange, color }: { label: string, val: number, onChange: (v: number) => void, color: string }) => {
  const colorMap: any = { 
    indigo: 'focus:border-indigo-500 text-indigo-400 bg-indigo-500/5', 
    emerald: 'focus:border-emerald-500 text-emerald-400 bg-emerald-500/5', 
    amber: 'focus:border-amber-500 text-amber-500 bg-amber-500/5' 
  };
  return (
    <div className="space-y-1.5">
      <label className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em] ml-1">{label}</label>
      <div className="relative">
        <input 
          type="number" 
          className={`w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-lg font-mono outline-none transition-all ${colorMap[color] || ''}`} 
          value={val} 
          onChange={e => onChange(parseFloat(e.target.value) || 0)} 
        />
        {label.includes('Rate') && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-lg">%</span>}
      </div>
    </div>
  );
};

// --- MAIN COMPONENT ---

interface ReportsProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const Reports: React.FC<ReportsProps> = ({ state, updateState }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedOperator, setSelectedOperator] = useState('');
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  
  // Quick Operations
  const [showQuickOp, setShowQuickOp] = useState(false);
  const [qType, setQType] = useState<OperationType>('advance');
  const [qAmount, setQAmount] = useState('');
  const [qComment, setQComment] = useState('');
  const [qPlatform, setQPlatform] = useState<Platform | 'all'>('all');

  // Edit States
  const [editingIncome, setEditingIncome] = useState<IncomeRecord | null>(null);
  const [editingOperation, setEditingOperation] = useState<OperationRecord | null>(null);

  useEffect(() => {
    if (location.state && (location.state as any).operator) {
      setSelectedOperator((location.state as any).operator);
    }
  }, [location.state]);

  const activePeriod = state.accountingPeriods.find(p => p.id === state.selectedPeriodId);
  const currentOperators = activePeriod?.operators || state.operators;

  const report = useMemo(() => {
    if (!selectedOperator) return null;
    const incomes = state.incomeData.filter(r => r.operator === selectedOperator && r.periodId === state.selectedPeriodId);
    const ops = state.operationsData.filter(o => o.operator === selectedOperator && o.periodId === state.selectedPeriodId);

    const platformStats = {
      of: { gross: 0, net: 0 },
      pp: { gross: 0, net: 0 },
      cr: { gross: 0, net: 0 }
    };

    incomes.forEach(r => {
      platformStats.of.gross += r.onlyFans;
      platformStats.of.net += r.nettoOF;
      platformStats.pp.gross += r.paypal;
      platformStats.pp.net += r.nettoPP;
      platformStats.cr.gross += r.crypto;
      platformStats.cr.net += r.nettoCrypto;
    });

    const rawBrutto = platformStats.of.gross + platformStats.pp.gross + platformStats.cr.gross;
    const rawNetto = platformStats.of.net + platformStats.pp.net + platformStats.cr.net;
    
    const totalRefundAmount = ops.filter(o => o.type === 'refund').reduce((s, o) => s + o.amount, 0);
    const avgRate = rawBrutto > 0 ? rawNetto / rawBrutto : 0.20;
    const lostCommission = totalRefundAmount * avgRate;

    const totalBrutto = rawBrutto - totalRefundAmount;
    const totalNetto = rawNetto - lostCommission;

    const adjustmentGroups = {
      advance: ops.filter(o => o.type === 'advance').reduce((s,o) => s + o.amount, 0),
      salary: ops.filter(o => o.type === 'salary_payment').reduce((s,o) => s + o.amount, 0),
      bonus: ops.filter(o => o.type === 'bonus').reduce((s,o) => s + o.amount, 0),
      internship: ops.filter(o => o.type === 'internship').reduce((s,o) => s + o.amount, 0),
      penalty: ops.filter(o => o.type === 'penalty').reduce((s,o) => s + o.amount, 0),
      refund: totalRefundAmount,
    };

    const deductions = adjustmentGroups.advance + adjustmentGroups.salary + adjustmentGroups.penalty + adjustmentGroups.internship;
    const additions = adjustmentGroups.bonus;
    const finalBalance = totalNetto + additions - deductions;

    const activeModels = Array.from(new Set(incomes.map(i => i.model)));

    const dailyData: Record<string, { 
      date: string,
      totalGross: number,
      totalNet: number,
      models: Record<string, {
        gross: number, net: number, 
        ofG: number, ofN: number, ppG: number, ppN: number, crG: number, crN: number,
        ratesOF: Set<number>, ratesPP: Set<number>, ratesCR: Set<number> 
      }>
    }> = {};

    incomes.forEach(i => {
      const dateKey = i.date;
      if (!dailyData[dateKey]) dailyData[dateKey] = { date: dateKey, totalGross: 0, totalNet: 0, models: {} };
      const d = dailyData[dateKey];
      if (!d.models[i.model]) d.models[i.model] = { gross: 0, net: 0, ofG: 0, ofN: 0, ppG: 0, ppN: 0, crG: 0, crN: 0, ratesOF: new Set(), ratesPP: new Set(), ratesCR: new Set() };
      const m = d.models[i.model];
      
      d.totalGross += i.total;
      d.totalNet += (i.nettoOF + i.nettoPP + i.nettoCrypto);
      
      m.gross += i.total;
      m.net += (i.nettoOF + i.nettoPP + i.nettoCrypto);
      m.ofG += i.onlyFans; m.ofN += i.nettoOF;
      m.ppG += i.paypal; m.ppN += i.nettoPP;
      m.crG += i.crypto; m.crN += i.nettoCrypto;
      if (i.onlyFans > 0) m.ratesOF.add(i.percentOF);
      if (i.paypal > 0) m.ratesPP.add(i.percentPP);
      if (i.crypto > 0) m.ratesCR.add(i.percentCrypto);
    });

    const dailyHistory = Object.values(dailyData).map((d) => {
      const getRate = (rates: Set<number>) => rates.size > 1 ? 'MIX %' : rates.size === 1 ? `${Array.from(rates)[0]}%` : '—';
      const modelBreakdown = Object.entries(d.models).map(([name, m]) => ({
        name,
        gross: m.gross,
        net: m.net,
        ofR: getRate(m.ratesOF),
        ppR: getRate(m.ratesPP),
        crR: getRate(m.ratesCR),
        ofN: m.ofN,
        ppN: m.ppN,
        crN: m.crN,
        ofG: m.ofG,
        ppG: m.ppG,
        crG: m.crG
      }));
      return {
        date: d.date,
        totalGross: d.totalGross,
        totalNet: d.totalNet,
        modelBreakdown
      };
    }).sort((a, b) => a.date.localeCompare(b.date));

    const fullHistory = [
      ...incomes.map(i => ({ type: 'income' as const, date: i.date, id: i.id, label: `Earnings: ${i.model}`, amount: (i.nettoOF + i.nettoPP + i.nettoCrypto), raw: i })),
      ...ops.map(o => ({ type: 'op' as const, date: o.date, id: o.id, label: OPERATION_META[o.type].label, amount: o.amount, opType: o.type, raw: o }))
    ].sort((a, b) => b.date.localeCompare(a.date));

    const wallet = state.operatorWallets?.find(w => w.operator === selectedOperator);

    return { totalBrutto, totalNetto, finalBalance, adjustmentGroups, dailyHistory, fullHistory, platformStats, activeModels, wallet };
  }, [selectedOperator, state.incomeData, state.operationsData, state.selectedPeriodId, state.operatorWallets]);

  useEffect(() => {
    if (report?.dailyHistory.length) {
      const exists = report.dailyHistory.some(d => d.date === selectedDate);
      if (!selectedDate || !exists) {
        setSelectedDate(report.dailyHistory[report.dailyHistory.length - 1].date);
      }
    } else {
      setSelectedDate(null);
    }
  }, [report?.dailyHistory, selectedOperator, selectedDate]);

  const updateWallet = (address: string, method: 'usdt_trc20' | 'card') => {
    updateState(prev => {
      const wallets = [...(prev.operatorWallets || [])];
      const idx = wallets.findIndex(w => w.operator === selectedOperator);
      const newWallet: OperatorWallet = {
        id: `wallet-${selectedOperator}`,
        operator: selectedOperator,
        address,
        method,
        updatedAt: new Date().toISOString()
      };
      
      if (idx >= 0) wallets[idx] = newWallet;
      else wallets.push(newWallet);
      
      return { ...prev, operatorWallets: wallets };
    });
  };

  const addQuickOp = () => {
    if (!qAmount || parseFloat(qAmount) <= 0) return;
    const op: OperationRecord = {
      id: String(Date.now()), type: qType, operator: selectedOperator,
      amount: parseFloat(qAmount), comment: qComment, date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), 
      periodId: state.selectedPeriodId,
      platform: qPlatform === 'all' ? undefined : qPlatform
    };
    updateState(prev => ({ ...prev, operationsData: [op, ...prev.operationsData] }));
    setQAmount(''); setQComment(''); setShowQuickOp(false);
  };

  const updateInc = () => {
    if (!editingIncome) return;
    const i = editingIncome;
    const updated: IncomeRecord = {
      ...i, 
      total: i.onlyFans + i.paypal + i.crypto,
      nettoOF: i.onlyFans * (i.percentOF / 100), 
      nettoPP: i.paypal * (i.percentPP / 100), 
      nettoCrypto: i.crypto * (i.percentCrypto / 100),
      updatedAt: new Date().toISOString()
    };
    updateState(prev => ({ ...prev, incomeData: prev.incomeData.map(x => x.id === i.id ? updated : x) }));
    setEditingIncome(null);
  };

  const updateOp = () => {
    if (!editingOperation) return;
    const updated = { ...editingOperation, updatedAt: new Date().toISOString() };
    updateState(prev => ({ ...prev, operationsData: prev.operationsData.map(x => x.id === editingOperation.id ? updated : x) }));
    setEditingOperation(null);
  };

  const deleteRecord = (item: { type: string; id: string }) => {
     if(!confirm('Удалить запись безвозвратно?')) return;
     updateState(prev => ({
       ...prev, 
       deletedIds: [...prev.deletedIds, item.id],
       incomeData: item.type === 'income' ? prev.incomeData.filter(x => x.id !== item.id) : prev.incomeData, 
       operationsData: item.type === 'op' ? prev.operationsData.filter(x => x.id !== item.id) : prev.operationsData
     }));
  }

  return (
    <div className="flex flex-col lg:flex-row h-screen -m-6 overflow-hidden bg-black text-slate-200">
      {/* SIDEBAR CALENDAR / DAY LIST */}
      <aside className={`w-full lg:w-[320px] bg-slate-900/40 border-r border-white/5 flex flex-col transition-all duration-500 overflow-hidden ${!report ? 'lg:w-0 border-r-0' : ''}`}>
        <div className="p-8 border-b border-white/5 bg-slate-950/20">
          <h2 className="text-xl font-black font-outfit uppercase tracking-tighter text-white">Дневник</h2>
          <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Daily Records Buffer</p>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-3">
          {report?.dailyHistory.length === 0 && (
            <div className="text-center py-20 opacity-20">
              <ICONS.History size={48} className="mx-auto mb-4" />
              <p className="text-[10px] uppercase font-black tracking-widest">Нет данных</p>
            </div>
          )}
          {[...(report?.dailyHistory || [])].reverse().map((d) => {
            const isActive = selectedDate === d.date;
            return (
              <button
                key={d.date}
                onClick={() => setSelectedDate(d.date)}
                className={`w-full text-left p-5 rounded-2xl transition-all duration-300 group relative ${
                  isActive 
                    ? 'bg-indigo-600 shadow-xl shadow-indigo-600/20' 
                    : 'hover:bg-white/5 border border-transparent hover:border-white/5'
                }`}
              >
                <div className="flex flex-col gap-1">
                  <span className={`font-mono text-sm font-black ${isActive ? 'text-white' : 'text-slate-300'}`}>
                    {d.date.split('-').reverse().join('.')}
                  </span>
                  <div className="flex justify-between items-center mt-2">
                    <span className={`text-[8px] font-black uppercase tracking-widest ${isActive ? 'text-indigo-200' : 'text-slate-500'}`}>
                      ${d.totalNet.toFixed(1)}
                    </span>
                    <div className={`px-2 py-0.5 rounded-md text-[7px] font-black border ${isActive ? 'bg-white/20 border-white/20 text-white' : 'bg-slate-950/40 border-white/5 text-slate-500'}`}>
                      NET
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* MAIN WORKSPACE */}
      <main className="flex-1 flex flex-col overflow-hidden relative">
        {/* TOP BAR / NAVIGATION */}
        <header className="px-8 py-6 flex flex-wrap items-center justify-between gap-6 bg-slate-950/40 border-b border-white/5 backdrop-blur-xl z-50 shrink-0">
           <div className="flex items-center gap-4">
              <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-600/20">
                 <ICONS.Reports size={20} />
              </div>
              <div>
                 <h1 className="text-lg font-black font-outfit uppercase tracking-tight text-white leading-none mb-1">Аналитика Оператора</h1>
                 <div className="flex items-center gap-2">
                    <PeriodBadge state={state} />
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">{activePeriod?.label}</span>
                 </div>
              </div>
           </div>

           <div className="flex items-center gap-4">
              <div className="relative">
                <select 
                  className="appearance-none bg-slate-900 border border-white/5 rounded-xl px-6 py-3 pr-12 font-black text-[11px] text-white focus:border-indigo-500 transition-all cursor-pointer uppercase tracking-widest min-w-[240px] shadow-lg" 
                  value={selectedOperator} 
                  onChange={(e) => setSelectedOperator(e.target.value)}
                >
                  <option value="">Выберите сотрудника</option>
                  {currentOperators.map(op => <option key={op} value={op}>{op}</option>)}
                </select>
                <ICONS.Users size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
              </div>

              {selectedOperator && (
                <button 
                  onClick={() => setShowQuickOp(!showQuickOp)}
                  className={`h-11 px-6 rounded-xl font-black text-[10px] uppercase tracking-widest flex items-center gap-3 transition-all active:scale-95 shadow-lg ${showQuickOp ? 'bg-rose-500 text-white' : 'bg-indigo-600 hover:bg-indigo-500 text-white'}`}
                >
                  {showQuickOp ? <ICONS.Plus className="rotate-45" size={16} /> : <ICONS.Plus size={16} />}
                  {showQuickOp ? 'Отмена' : 'Коррекция'}
                </button>
              )}
           </div>
        </header>

        {/* SCROLLABLE WORKSPACE */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8 pb-32">
          {!selectedOperator && (
             <div className="h-full flex flex-col items-center justify-center opacity-40 py-20 border border-dashed border-white/5 rounded-[3rem]">
                <ICONS.Users size={64} className="mb-6 text-slate-700" />
                <h3 className="text-xl font-black font-outfit uppercase tracking-widest text-slate-500">Выберите оператора для начала</h3>
                <p className="text-xs font-medium text-slate-600 mt-2">Все финансовые потоки будут агрегированы мгновенно</p>
             </div>
          )}

          {report && (
            <motion.div 
              key={selectedOperator}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-8"
            >
               {/* QUICK OP DRAWER */}
               <AnimatePresence>
                 {showQuickOp && (
                   <motion.div 
                     initial={{ height: 0, opacity: 0 }}
                     animate={{ height: 'auto', opacity: 1 }}
                     exit={{ height: 0, opacity: 0 }}
                     className="overflow-hidden bg-slate-900 ring-1 ring-white/10 rounded-[2rem] shadow-2xl"
                   >
                      <div className="p-8 space-y-8">
                         <div className="flex flex-wrap gap-2">
                            {Object.entries(OPERATION_META).map(([k,m]) => (
                               <button 
                                 key={k} 
                                 onClick={() => setQType(k as any)}
                                 className={`px-4 py-2 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-2 ${qType === k ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg' : 'bg-slate-950 border-white/5 text-slate-500 hover:border-slate-700'}`}
                               >
                                  <m.icon size={14} />
                                  {m.label}
                               </button>
                            ))}
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <RateField label="Сумма ($)" val={parseFloat(qAmount) || 0} onChange={v => setQAmount(String(v))} color="indigo" />
                            <div className="space-y-1.5">
                               <label className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em] ml-1">Платформа</label>
                               <select className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-[13px] text-sm font-black text-white outline-none focus:border-indigo-500/50 transition-all" value={qPlatform} onChange={e => setQPlatform(e.target.value as any)}>
                                  <option value="all">Общий баланс</option>
                                  <option value="onlyFans">OnlyFans</option>
                                  <option value="paypal">PayPal</option>
                                  <option value="crypto">Crypto</option>
                               </select>
                            </div>
                            <div className="space-y-1.5">
                               <label className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.2em] ml-1">Комментарий</label>
                               <input type="text" className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3.5 text-sm text-white outline-none focus:border-indigo-500/50 transition-all" value={qComment} onChange={e => setQComment(e.target.value)} placeholder="Причина..." />
                            </div>
                         </div>
                         <div className="flex justify-end">
                            <button onClick={addQuickOp} className="px-8 py-3 bg-white text-black font-black rounded-xl text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all active:scale-95 shadow-xl">Создать корректировку</button>
                         </div>
                      </div>
                   </motion.div>
                 )}
               </AnimatePresence>

               {/* TOP STATS BENTO */}
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                  <div className="lg:col-span-1">
                    <StatsCard title="Выручка (Brutto)" value={report.totalBrutto} icon={<ICONS.Income />} color="indigo" />
                  </div>
                  <div className="lg:col-span-1">
                    <StatsCard title="Зарплата (Netto)" value={report.totalNetto} icon={<ICONS.Wallet />} color="emerald" highlighted />
                  </div>
                  <div className="lg:col-span-1">
                    <PlatformPill label="OnlyFans" gross={report.platformStats.of.gross} net={report.platformStats.of.net} color="indigo" icon={<span className="text-[9px] font-black">OF</span>} />
                  </div>
                  <div className="lg:col-span-1">
                    <PlatformPill label="PayPal" gross={report.platformStats.pp.gross} net={report.platformStats.pp.net} color="sky" icon={<span className="text-[9px] font-black">PP</span>} />
                  </div>
                  <div className="lg:col-span-1">
                    <PlatformPill label="Crypto" gross={report.platformStats.cr.gross} net={report.platformStats.cr.net} color="emerald" icon={<span className="text-[9px] font-black">CR</span>} />
                  </div>
               </div>

               {/* SECONDARY ROW: DAY DETAILS & FINAL BALANCE */}
               <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  {/* SELECTED DAY DETAILS */}
                  <div className="xl:col-span-2 glass-card rounded-[2.5rem] border-white/5 overflow-hidden flex flex-col h-[500px]">
                     <div className="px-8 py-6 border-b border-white/5 bg-white/[0.02] flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-indigo-400 border border-white/5">
                              <ICONS.History size={18} />
                           </div>
                           <div>
                              <h3 className="text-lg font-black font-outfit uppercase tracking-tight text-white mb-0.5">Суточный отчет</h3>
                              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{selectedDate?.split('-').reverse().join('.')} — Details</span>
                           </div>
                        </div>
                        <div className="px-4 py-2 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                           <span className="text-lg font-black font-mono text-emerald-400">${report.dailyHistory.find(d => d.date === selectedDate)?.totalNet.toFixed(1)}</span>
                        </div>
                     </div>
                     <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
                        <AnimatePresence mode="wait">
                           {selectedDate ? (
                             <motion.div 
                               key={selectedDate}
                               initial={{ opacity: 0, x: 20 }}
                               animate={{ opacity: 1, x: 0 }}
                               exit={{ opacity: 0, x: -20 }}
                               className="space-y-6"
                             >
                               {report.dailyHistory.find(d => d.date === selectedDate)?.modelBreakdown.map((m, idx) => (
                                 <div key={idx} className="space-y-4">
                                    <div className="flex items-center gap-4">
                                       <span className="text-sm font-black uppercase tracking-widest text-indigo-400 font-outfit px-4 py-1.5 bg-indigo-500/5 rounded-full border border-indigo-500/10">{m.name}</span>
                                       <div className="h-px flex-1 bg-white/[0.03]"></div>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                       <DetailBox pill="OnlyFans" gross={m.ofG} net={m.ofN} rate={m.ofR} color="indigo" />
                                       <DetailBox pill="PayPal" gross={m.ppG} net={m.ppN} rate={m.ppR} color="sky" />
                                       <DetailBox pill="Crypto" gross={m.crG} net={m.crN} rate={m.crR} color="emerald" />
                                    </div>
                                 </div>
                               ))}
                             </motion.div>
                           ) : (
                             <div className="h-full flex flex-col items-center justify-center opacity-20">
                                <ICONS.Empty size={48} className="mb-4" />
                                <p className="text-[10px] uppercase font-black tracking-widest">Выберите дату</p>
                             </div>
                           )}
                        </AnimatePresence>
                     </div>
                  </div>

                  {/* SETTLEMENT CARD (FINAL BALANCE) */}
                  <div className="xl:col-span-1 glass-card rounded-[2.5rem] border-white/5 bg-slate-900/40 p-8 flex flex-col items-stretch h-[500px]">
                     <div className="flex justify-between items-center mb-8">
                        <h3 className="text-xl font-black font-outfit uppercase tracking-tight text-white leading-none">Финальный чек</h3>
                        <ICONS.Salary className="text-indigo-500" size={24} />
                     </div>
                     <div className="flex-1 space-y-4 overflow-y-auto custom-scrollbar -mx-2 px-2">
                        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/5">
                           <span className="text-[9px] font-black uppercase tracking-widest text-slate-500 block mb-1">Сумма по выработке</span>
                           <div className="flex justify-between items-baseline">
                              <span className="font-bold text-slate-300">Net Profit</span>
                              <span className="font-mono font-black text-xl text-white">${report.totalNetto.toFixed(1)}</span>
                           </div>
                        </div>
                        <div className="space-y-1">
                           <SummaryLine label="Авансы / Салари" val={report.adjustmentGroups.advance + report.adjustmentGroups.salary} type="minus" />
                           <SummaryLine label="Штрафы / Списания" val={report.adjustmentGroups.penalty} type="minus" />
                           <SummaryLine label="Бонусы / Премии" val={report.adjustmentGroups.bonus} type="plus" />
                           <SummaryLine label="Обучение" val={report.adjustmentGroups.internship} type="minus" />
                        </div>
                        <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10 border-dashed text-center">
                           <span className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-400/60">Авто-коррекция возвратов: -${report.adjustmentGroups.refund.toFixed(0)}</span>
                        </div>
                     </div>
                     <div className="mt-8 pt-8 border-t-2 border-slate-800 border-dashed text-center relative">
                        <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-indigo-600 px-4 py-1 rounded-full text-[8px] font-black uppercase text-white shadow-lg">К выплате</div>
                        <div className="flex flex-col items-center">
                           <span className="text-5xl font-black font-mono text-white tracking-tighter">${report.finalBalance.toLocaleString(undefined, { minimumFractionDigits: 1 })}</span>
                           <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-2">{selectedOperator} Verified Wallet</span>
                        </div>
                     </div>
                  </div>
               </div>

               {/* WALLET & TRANSACTION HISTORY */}
               <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  {/* TRANSACTION LOG */}
                  <div className="glass-card rounded-[2.5rem] border-white/5 overflow-hidden flex flex-col h-[400px]">
                     <div className="px-8 py-5 border-b border-white/5 bg-slate-900/60 flex items-center justify-between shrink-0">
                        <h3 className="text-base font-black font-outfit uppercase tracking-tight text-white leading-none">Лог операций</h3>
                        <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Operator Audit</span>
                     </div>
                     <div className="flex-1 overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left text-xs border-separate border-spacing-0">
                           <tbody className="divide-y divide-white/[0.03]">
                              {report.fullHistory.map((item, idx) => (
                                 <tr key={item.id} className="hover:bg-white/[0.02] group transition-colors">
                                    <td className="px-8 py-4 font-mono font-black text-slate-500">{item.date.split('-').reverse().slice(0,2).join('.')}</td>
                                    <td className="px-8 py-4">
                                       <div className="flex items-center gap-3">
                                          <div className={`w-1.5 h-1.5 rounded-full ${item.type === 'income' ? 'bg-emerald-500' : 'bg-indigo-500'}`}></div>
                                          <span className="font-bold text-slate-200 uppercase truncate max-w-[200px]">{item.label}</span>
                                       </div>
                                    </td>
                                    <td className="px-8 py-4 font-mono font-black text-right">
                                       <span className={item.amount >= 0 && item.type === 'income' || (item as any).opType === 'bonus' ? 'text-emerald-400' : 'text-rose-400'}>
                                          {item.amount >= 0 ? '+' : ''}${item.amount.toFixed(1)}
                                       </span>
                                    </td>
                                    <td className="px-8 py-4 text-right">
                                       <button onClick={() => deleteRecord({type: item.type, id: item.id})} className="p-2 rounded-lg hover:bg-rose-500/20 text-slate-600 hover:text-rose-500 transition-all">
                                          <ICONS.Trash size={14} />
                                       </button>
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </div>

                  {/* WALLET & DETAILS */}
                  <div className="glass-card rounded-[2.5rem] border-white/5 p-8 flex flex-col gap-6 relative overflow-hidden">
                     <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-600/5 blur-3xl rounded-full"></div>
                     <div className="flex justify-between items-center relative z-10">
                        <h3 className="text-xl font-black font-outfit uppercase tracking-tight text-white leading-none">Реквизиты</h3>
                        <ICONS.Wallet className="text-indigo-500" size={24} />
                     </div>
                     <div className="space-y-6 flex-1 relative z-10">
                        <div className="flex p-1 bg-slate-950 rounded-xl border border-white/5">
                           <button onClick={() => updateWallet(report.wallet?.address || '', 'usdt_trc20')} className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${(!report.wallet || report.wallet.method === 'usdt_trc20') ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>USDT</button>
                           <button onClick={() => updateWallet(report.wallet?.address || '', 'card')} className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${report.wallet?.method === 'card' ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500'}`}>CARD</button>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Destination Address</label>
                           <div className="relative group">
                              <input 
                                type="text"
                                className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-4 text-sm font-mono text-white outline-none focus:border-indigo-500/40 transition-all pr-24"
                                placeholder={report.wallet?.method === 'card' ? 'XXXX XXXX XXXX XXXX' : 'T... (Network: TRC20)'}
                                value={report.wallet?.address || ''}
                                onChange={e => updateWallet(e.target.value, report.wallet?.method || 'usdt_trc20')}
                              />
                              {report.wallet?.address && (
                                <button 
                                  onClick={() => { navigator.clipboard.writeText(report.wallet!.address); }}
                                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/5 hover:bg-white/10 rounded-lg px-3 py-2 text-[8px] font-black text-slate-300 transition-all uppercase tracking-widest"
                                >
                                  COPY
                                </button>
                              )}
                           </div>
                        </div>
                     </div>
                     <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-center gap-3 relative z-10">
                        <ICONS.AlertTriangle className="text-amber-500 shrink-0" size={20} />
                        <p className="text-[8px] font-black uppercase text-amber-500/60 tracking-wider">Убедитесь, что реквизиты введены верно. Отмена транзакций в блокчейне/банковской сети невозможна.</p>
                     </div>
                  </div>
               </div>

               {/* PRODUCTIVITY DYNAMICS (CHART) AT THE BOTTOM */}
               <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card rounded-[3rem] border-white/5 shadow-2xl p-10 relative overflow-hidden group"
               >
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                     <div className="flex items-center gap-4">
                        <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                        <h2 className="text-2xl font-black font-outfit text-white tracking-tight uppercase">Динамика выработки</h2>
                     </div>
                     <div className="flex items-center gap-6 bg-slate-950/50 px-6 py-2.5 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-2">
                           <div className="w-2.5 h-2.5 rounded-full bg-indigo-500"></div>
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gross</span>
                        </div>
                        <div className="flex items-center gap-2">
                           <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-lg"></div>
                           <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Profit</span>
                        </div>
                     </div>
                  </div>
                  
                  <div className="h-[300px] w-full">
                     <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={report.dailyHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                           <defs>
                              <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                                 <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                                 <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                                 <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15}/>
                                 <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                              </linearGradient>
                           </defs>
                           <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" opacity={0.3} />
                           <XAxis 
                             dataKey="date" 
                             stroke="#475569" 
                             fontSize={9} 
                             fontWeight={900} 
                             tickFormatter={(v) => v.split('-').slice(1).reverse().join('/')}
                             axisLine={false}
                             tickLine={false}
                             dy={10}
                           />
                           <YAxis 
                             stroke="#475569" 
                             fontSize={9} 
                             fontWeight={900} 
                             axisLine={false} 
                             tickLine={false} 
                             tickFormatter={(v) => `$${v}`}
                           />
                           <Tooltip 
                             contentStyle={{ backgroundColor: '#020617', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '20px', padding: '12px' }}
                             itemStyle={{ color: '#fff', fontSize: '11px', fontWeight: 900 }}
                             labelStyle={{ color: '#6366f1', fontSize: '9px', marginBottom: '4px', fontWeight: 900, textTransform: 'uppercase' }}
                           />
                           <Area type="monotone" dataKey="totalGross" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorGross)" />
                           <Area type="monotone" dataKey="totalNet" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorNet)" />
                        </AreaChart>
                     </ResponsiveContainer>
                  </div>
               </motion.div>
            </motion.div>
          )}
        </div>

        {/* MODALS */}
        <AnimatePresence>
          {editingIncome && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-3xl"
            >
               <motion.div 
                 initial={{ scale: 0.9, opacity: 0, y: 30 }}
                 animate={{ scale: 1, opacity: 1, y: 0 }}
                 exit={{ scale: 0.9, opacity: 0, y: 30 }}
                 className="glass-card w-full max-w-2xl rounded-[3rem] p-12 border-indigo-500/40 shadow-2xl relative"
               >
                  <button onClick={() => setEditingIncome(null)} className="absolute top-10 right-10 text-slate-500 hover:text-white transition-all group">
                     <ICONS.Plus className="rotate-45 group-hover:scale-110 transition-all" size={32} />
                  </button>
                  <div className="mb-10">
                     <h2 className="text-3xl font-black text-white font-outfit uppercase tracking-tight">Редактирование дохода</h2>
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">{editingIncome.model} — {editingIncome.date}</p>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                     <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.2em] mb-4 bg-indigo-500/10 px-4 py-1 rounded-full w-fit">Грязные ($)</h4>
                        <RateField label="OnlyFans Gross" val={editingIncome.onlyFans} onChange={v => setEditingIncome({...editingIncome, onlyFans: v})} color="indigo" />
                        <RateField label="PayPal Gross" val={editingIncome.paypal} onChange={v => setEditingIncome({...editingIncome, paypal: v})} color="indigo" />
                        <RateField label="Crypto Gross" val={editingIncome.crypto} onChange={v => setEditingIncome({...editingIncome, crypto: v})} color="indigo" />
                     </div>
                     <div className="space-y-4">
                        <h4 className="text-[10px] font-black uppercase text-emerald-400 tracking-[0.2em] mb-4 bg-emerald-500/10 px-4 py-1 rounded-full w-fit">Ставки (%)</h4>
                        <RateField label="OF Rate" val={editingIncome.percentOF} onChange={v => setEditingIncome({...editingIncome, percentOF: v})} color="emerald" />
                        <RateField label="PP Rate" val={editingIncome.percentPP} onChange={v => setEditingIncome({...editingIncome, percentPP: v})} color="emerald" />
                        <RateField label="CR Rate" val={editingIncome.percentCrypto} onChange={v => setEditingIncome({...editingIncome, percentCrypto: v})} color="emerald" />
                     </div>
                  </div>
                  
                  <div className="mt-12 flex gap-4">
                     <button onClick={() => setEditingIncome(null)} className="flex-1 bg-slate-900 text-slate-500 font-black py-4 rounded-2xl hover:bg-slate-800 transition-all uppercase tracking-widest text-[11px]">Отмена</button>
                     <button onClick={updateInc} className="flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-95 uppercase tracking-widest text-[11px]">Сохранить</button>
                  </div>
               </motion.div>
            </motion.div>
          )}

          {editingOperation && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-3xl"
            >
               <motion.div 
                 initial={{ scale: 0.9, opacity: 0, y: 30 }}
                 animate={{ scale: 1, opacity: 1, y: 0 }}
                 exit={{ scale: 0.9, opacity: 0, y: 30 }}
                 className="glass-card w-full max-w-lg rounded-[3rem] p-12 border-amber-500/40 shadow-2xl relative"
               >
                  <button onClick={() => setEditingOperation(null)} className="absolute top-10 right-10 text-slate-500 hover:text-white transition-all group">
                     <ICONS.Plus className="rotate-45 group-hover:scale-110 transition-all" size={32} />
                  </button>
                  <div className="mb-10">
                     <h2 className="text-3xl font-black text-white font-outfit uppercase tracking-tight">Корректировка</h2>
                     <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">{selectedOperator} — Financial Control</p>
                  </div>

                  <div className="space-y-8">
                     <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                       {Object.entries(OPERATION_META).map(([k, m]) => (
                         <button 
                           key={k} 
                           onClick={() => setEditingOperation({...editingOperation, type: k as any})} 
                           className={`p-3 rounded-xl border text-[9px] font-black uppercase transition-all flex flex-col items-center gap-1.5 ${editingOperation.type === k ? 'bg-amber-500 border-amber-400 text-white shadow-lg' : 'bg-slate-900 border-white/5 text-slate-500'}`}
                         >
                            <m.icon size={18} />
                            {m.label}
                         </button>
                       ))}
                     </div>
                     <div className="space-y-6">
                        <RateField label="Сумма ($)" val={editingOperation.amount} onChange={v => setEditingOperation({...editingOperation, amount: v})} color="amber" />
                        <div className="space-y-1.5">
                           <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Детальное описание</label>
                           <input type="text" className="w-full bg-slate-950 border border-white/5 rounded-xl px-4 py-3.5 text-sm font-black text-white outline-none focus:border-amber-500/50 transition-all" value={editingOperation.comment} onChange={e => setEditingOperation({...editingOperation, comment: e.target.value})} placeholder="Причина..." />
                        </div>
                     </div>
                     <div className="flex gap-4 pt-4">
                        <button onClick={() => setEditingOperation(null)} className="flex-1 bg-slate-900 text-slate-500 font-black py-4 rounded-2xl hover:bg-slate-800 transition-all uppercase tracking-widest text-[11px]">Отмена</button>
                        <button onClick={updateOp} className="flex-[2] bg-amber-600 hover:bg-amber-500 text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-95 uppercase tracking-widest text-[11px]">Применить</button>
                     </div>
                  </div>
               </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default Reports;
