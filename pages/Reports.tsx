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

const MetricCard = ({ title, value, subValue, icon, color, highlighted, label, variant = 'primary' }: { title: string, value: number, subValue?: number, icon: React.ReactNode, color: string, highlighted?: boolean, label?: string, variant?: 'primary' | 'platform' }) => {
  const colorMap: any = {
    indigo: 'from-indigo-600/20 to-indigo-900/40 border-indigo-500/30 text-indigo-400',
    emerald: 'from-emerald-600/20 to-emerald-950/40 border-emerald-500/30 text-emerald-400',
    sky: 'from-sky-600/20 to-sky-950/40 border-sky-500/30 text-sky-400',
    amber: 'from-amber-600/20 to-amber-950/40 border-amber-500/30 text-amber-400'
  };

  const isPlatform = variant === 'platform';

  return (
    <div className={`rounded-[1.4rem] border bg-gradient-to-br transition-all duration-500 hover:scale-[1.02] active:scale-[0.98] group relative overflow-hidden flex flex-col justify-between h-full ${
      isPlatform ? 'p-3' : 'p-4'
    } ${
      highlighted 
        ? 'bg-slate-900 border-indigo-500/50 shadow-[0_15px_35px_-10px_rgba(79,70,229,0.3)] ring-1 ring-white/10' 
        : `bg-slate-900/40 border-white/5 hover:border-white/10 ${colorMap[color] || ''}`
    }`}>
      {/* Decorative Glow */}
      <div className={`absolute -right-4 -top-4 w-20 h-20 blur-3xl opacity-0 group-hover:opacity-30 transition-all duration-700 ${
        color === 'indigo' ? 'bg-indigo-500' : color === 'sky' ? 'bg-sky-500' : 'bg-emerald-500'
      }`} />

      <div className={`flex justify-between items-start relative z-10 ${isPlatform ? 'mb-1' : 'mb-3'}`}>
        <div className={`${isPlatform ? 'w-7 h-7' : 'w-9 h-9'} rounded-xl flex items-center justify-center transition-all duration-500 group-hover:scale-110 group-hover:rotate-6 ${
          highlighted ? 'bg-white text-indigo-600 shadow-lg shadow-white/10' : 'bg-white/5 border border-white/10 text-white/80 group-hover:text-white'
        }`}>
          {React.cloneElement(icon as React.ReactElement, { size: isPlatform ? 14 : 18 })}
        </div>
        {!isPlatform && (
          <div className="flex flex-col items-end">
             <span className="text-[7px] font-black uppercase tracking-[0.25em] text-slate-500 mb-0.5 leading-none transition-colors group-hover:text-white/40">{label || 'Total'}</span>
             <div className={`h-1 w-4 rounded-full ${color === 'indigo' ? 'bg-indigo-500' : color === 'sky' ? 'bg-sky-500' : 'bg-emerald-500'}`} />
          </div>
        )}
      </div>

      <div className="relative z-10">
        <h4 className={`${isPlatform ? 'text-[7.5px]' : 'text-[9px]'} font-black uppercase text-slate-500 tracking-wider mb-1 transition-colors truncate`}>{title}</h4>
        
        <div className="flex items-baseline gap-0.5">
          <span className={`${isPlatform ? 'text-[8px]' : 'text-[10px]'} font-black font-mono transition-colors ${highlighted ? 'text-indigo-300' : 'text-slate-600'}`}>$</span>
          <p className={`${isPlatform ? 'text-base' : 'text-xl'} font-black font-mono tracking-tighter transition-all truncate ${highlighted ? 'text-white' : 'text-white group-hover:translate-x-1'}`}>
            {value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
        </div>

        {subValue !== undefined && (
          <div className={`${isPlatform ? 'mt-1 pt-1' : 'mt-2 pt-2'} border-t border-white/5 flex items-center justify-between`}>
             <span className={`${isPlatform ? 'text-[6px]' : 'text-[7px]'} font-black uppercase text-slate-600 shrink-0`}>Netto</span>
             <span className={`${isPlatform ? 'text-[9px]' : 'text-[10px]'} font-black font-mono ${color === 'indigo' ? 'text-indigo-300' : color === 'sky' ? 'text-sky-300' : 'text-emerald-400'}`}>
                ${subValue.toFixed(1)}
             </span>
          </div>
        )}
      </div>
    </div>
  );
};


const DetailBox = ({ pill, gross, net, rate, color }: { pill: string, gross: number, net: number, rate: string, color: string }) => {
  const colorMap: any = {
    indigo: 'from-indigo-600/10 to-indigo-950/40 border-indigo-500/20 text-indigo-400',
    sky: 'from-sky-600/10 to-sky-950/40 border-sky-500/20 text-sky-400',
    emerald: 'from-emerald-600/10 to-emerald-950/40 border-emerald-500/20 text-emerald-400'
  };
  return (
    <div className={`p-3 rounded-xl border bg-gradient-to-br transition-all duration-500 hover:bg-opacity-40 group/detail relative overflow-hidden ${colorMap[color]}`}>
       <div className="flex justify-between items-start mb-2 relative z-10">
          <div className="flex flex-col">
             <span className="text-[7px] font-black uppercase tracking-[0.2em] opacity-50 mb-0.5 leading-none">{pill}</span>
             <span className="text-[8px] font-black font-mono text-white/70">{rate}</span>
          </div>
          <div className={`w-1 h-1 rounded-full ${color === 'indigo' ? 'bg-indigo-500' : color === 'sky' ? 'bg-sky-500' : 'bg-emerald-500'} shadow-lg`}></div>
       </div>
       <div className="flex items-end justify-between relative z-10 gap-2">
          <div className="flex flex-col min-w-0">
             <span className="text-[6px] font-black uppercase text-slate-500 mb-0.5">Gross</span>
             <p className="text-[10px] font-black font-mono text-slate-400 tracking-tighter truncate">${gross.toFixed(0)}</p>
          </div>
          <div className="flex flex-col text-right shrink-0">
             <span className="text-[6px] font-black uppercase text-slate-500 mb-0.5">Net</span>
             <p className="text-sm font-black font-mono text-white tracking-tighter">${net.toFixed(1)}</p>
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
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-4">
          {report?.dailyHistory.length === 0 && (
            <div className="text-center py-20 opacity-20">
              <ICONS.History size={48} className="mx-auto mb-4" />
              <p className="text-[10px] uppercase font-black tracking-widest">Нет данных</p>
            </div>
          )}
          {[...(report?.dailyHistory || [])].reverse().map((d, idx) => {
            const isActive = selectedDate === d.date;
            const dateObj = new Date(d.date);
            const weekday = dateObj.toLocaleDateString('ru-RU', { weekday: 'short' });
            const dayNum = d.date.split('-')[2];
            const monthName = dateObj.toLocaleDateString('ru-RU', { month: 'short' }).replace('.', '');
            
            // Performance Tiers
            const progress = Math.min((d.totalGross / 1000) * 100, 100);
            const isElite = d.totalGross >= 800;
            const isPro = d.totalGross >= 400 && d.totalGross < 800;
            const isSolid = d.totalGross > 0 && d.totalGross < 400;

            return (
              <motion.button
                key={d.date}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04, type: 'spring', damping: 15 }}
                onClick={() => setSelectedDate(d.date)}
                className={`w-full text-left p-0 rounded-[2.2rem] transition-all duration-500 group relative flex items-stretch border overflow-hidden ${
                  isActive 
                    ? 'bg-slate-900 border-indigo-500/60 shadow-[0_25px_60px_-15px_rgba(79,70,229,0.5)] ring-1 ring-white/10' 
                    : 'bg-slate-950/40 border-white/5 hover:border-white/15 hover:bg-slate-900/60'
                }`}
              >
                {/* Lateral Status Bar */}
                <div className={`w-1.5 shrink-0 transition-all duration-700 ${
                  isActive ? 'bg-indigo-500 shadow-[0_0_20px_#6366f1]' : isElite ? 'bg-amber-400' : isPro ? 'bg-emerald-400' : 'bg-slate-800'
                }`} />

                <div className="flex-1 p-3 flex items-center gap-3 relative min-w-0">
                  {/* Compact Premium Date Block */}
                  <div className={`relative w-12 h-12 shrink-0 rounded-2xl flex flex-col items-center justify-center border transition-all duration-700 overflow-hidden ${
                    isActive 
                      ? 'bg-gradient-to-br from-indigo-500 to-indigo-700 border-white/20 shadow-lg scale-105' 
                      : 'bg-slate-900/60 border-white/5 group-hover:border-white/10'
                  }`}>
                    <span className={`text-[7px] font-black uppercase leading-none mb-0.5 tracking-tighter ${isActive ? 'text-indigo-100' : 'text-slate-500'}`}>{weekday}</span>
                    <span className={`text-lg font-black font-outfit leading-none ${isActive ? 'text-white' : 'text-slate-200'}`}>{dayNum}</span>
                    
                    {isActive && (
                      <motion.div 
                        animate={{ x: ['-100%', '100%'] }} 
                        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -rotate-45"
                      />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-center mb-1.5">
                       <div className="flex items-baseline gap-0.5 min-w-0">
                          <span className={`text-[9px] font-black font-mono shrink-0 ${isActive ? 'text-indigo-300' : 'text-slate-600'}`}>$</span>
                          <span className={`text-[1.35rem] font-black font-mono tracking-tighter truncate ${isActive ? 'text-white' : 'text-slate-50'}`}>
                             {d.totalGross.toFixed(0)}
                          </span>
                       </div>
                       
                       <div className="flex flex-col items-end shrink-0 ml-2">
                          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-lg border ${
                            isActive ? 'bg-white/10 border-white/10' : 'bg-slate-950/60 border-white/5'
                          }`}>
                             <span className={`text-[9px] font-black font-mono ${isActive ? 'text-white' : 'text-emerald-500'}`}>
                                {d.totalNet.toFixed(1)}
                             </span>
                          </div>
                       </div>
                    </div>

                    {/* Minimal Progress */}
                    <div className="flex items-center gap-2">
                       <div className={`h-1 flex-1 rounded-full overflow-hidden ${isActive ? 'bg-indigo-950' : 'bg-slate-800/40'}`}>
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            className={`h-full ${
                              isActive ? 'bg-white' : isElite ? 'bg-amber-400' : isPro ? 'bg-emerald-400' : 'bg-indigo-500'
                            }`}
                          />
                       </div>
                       {isElite && <div className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />}
                    </div>
                  </div>
                </div>
              </motion.button>
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

               {/* TOP STATS BENTO: Hierarchical Grid */}
               <div className="grid grid-cols-12 gap-3">
                  <div className="col-span-12 md:col-span-6 lg:col-span-3 h-full">
                    <MetricCard 
                      title="Зарплата (Чистыми)" 
                      label="Final Balance"
                      value={report.finalBalance} 
                      icon={<ICONS.Wallet />} 
                      color="emerald" 
                      highlighted 
                    />
                  </div>
                  <div className="col-span-12 md:col-span-6 lg:col-span-3 h-full">
                    <MetricCard 
                      title="Общий вал (Грязными)" 
                      label="Total Gross"
                      value={report.totalBrutto} 
                      icon={<ICONS.Income />} 
                      color="indigo" 
                    />
                  </div>
                  
                  {/* Platform Compact Trio */}
                  <div className="col-span-12 lg:col-span-6 grid grid-cols-3 gap-2">
                    <MetricCard 
                      title="OnlyFans (OF)" 
                      value={report.platformStats.of.gross} 
                      subValue={report.platformStats.of.net}
                      icon={<div className="font-black text-[10px]">OF</div>} 
                      color="sky" 
                      variant="platform"
                    />
                    <MetricCard 
                      title="PayPal (PP)" 
                      value={report.platformStats.pp.gross} 
                      subValue={report.platformStats.pp.net}
                      icon={<div className="font-black text-[10px]">PP</div>} 
                      color="indigo" 
                      variant="platform"
                    />
                    <MetricCard 
                      title="Crypto (CR)" 
                      value={report.platformStats.cr.gross} 
                      subValue={report.platformStats.cr.net}
                      icon={<div className="font-black text-[10px]">CR</div>} 
                      color="emerald" 
                      variant="platform"
                    />
                  </div>
               </div>

               {/* SECONDARY ROW: DAY DETAILS & FINAL BALANCE */}
               <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  {/* ... day details remains similar ... */}
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
                     <div className="flex-1 overflow-y-auto p-6 custom-scrollbar space-y-6">
                        <AnimatePresence mode="wait">
                           {selectedDate ? (
                             <motion.div 
                               key={selectedDate}
                               initial={{ opacity: 0, y: 10 }}
                               animate={{ opacity: 1, y: 0 }}
                               exit={{ opacity: 0, y: -10 }}
                               className="space-y-4"
                             >
                               {report.dailyHistory.find(d => d.date === selectedDate)?.modelBreakdown.map((m, idx) => (
                                 <div key={idx} className="bg-slate-900/40 rounded-2xl border border-white/5 p-4 space-y-3 group/model transition-all hover:bg-slate-900/60">
                                    <div className="flex items-center justify-between">
                                       <div className="flex items-center gap-3">
                                          <div className="w-1.5 h-4 bg-indigo-500 rounded-full" />
                                          <span className="text-xs font-black uppercase tracking-widest text-white font-outfit">{m.name}</span>
                                       </div>
                                       <div className="flex items-center gap-4">
                                          <div className="flex flex-col items-end">
                                             <span className="text-[6px] font-black uppercase text-slate-500">Model Day Net</span>
                                             <span className="text-xs font-black font-mono text-emerald-400">${m.net.toFixed(1)}</span>
                                          </div>
                                       </div>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                       <DetailBox pill="OF" gross={m.ofG} net={m.ofN} rate={m.ofR} color="indigo" />
                                       <DetailBox pill="PP" gross={m.ppG} net={m.ppN} rate={m.ppR} color="sky" />
                                       <DetailBox pill="CR" gross={m.crG} net={m.crN} rate={m.crR} color="emerald" />
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

                  {/* SETTLEMENT CARD (FINAL BALANCE): WAW REDESIGN */}
                  <div className="xl:col-span-1 border border-white/5 bg-slate-950 rounded-[2.5rem] overflow-hidden flex flex-col h-[500px] relative shadow-2xl">
                     {/* Premium Background Accent */}
                     <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-indigo-950/30 to-transparent" />
                     
                     <div className="px-6 py-5 border-b border-white/5 bg-slate-900/40 flex justify-between items-center relative z-10">
                        <div className="flex flex-col">
                           <h3 className="text-base font-black font-outfit uppercase tracking-tight text-white leading-none">Финальный чек</h3>
                           <span className="text-[7px] font-black text-slate-500 uppercase tracking-[0.2em] mt-1">Official Settlement</span>
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-indigo-400">
                           <ICONS.Salary size={16} />
                        </div>
                     </div>

                     <div className="flex-1 p-5 space-y-4 overflow-hidden relative z-10 flex flex-col justify-center">
                        {/* Earnings Section */}
                        <div className="relative p-4 rounded-[1.25rem] bg-indigo-600/5 border border-indigo-500/10 group hover:bg-indigo-600/10 transition-all">
                           <span className="text-[7px] font-black uppercase tracking-[0.25em] text-indigo-400 mb-1.5 block">Выработано за период</span>
                           <div className="flex justify-between items-baseline">
                              <span className="text-slate-400 text-[10px] font-bold">Чистая прибыль</span>
                              <span className="font-mono font-black text-xl text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">${report.totalNetto.toFixed(1)}</span>
                           </div>
                        </div>

                        {/* Adjustments Section */}
                        <div className="space-y-1.5">
                           <SummaryLine label="Авансы / Салари" val={report.adjustmentGroups.advance + report.adjustmentGroups.salary} type="minus" />
                           <SummaryLine label="Штрафы / Списания" val={report.adjustmentGroups.penalty} type="minus" />
                           <SummaryLine label="Бонусы / Премии" val={report.adjustmentGroups.bonus} type="plus" />
                           <SummaryLine label="Обучение / Офис" val={report.adjustmentGroups.internship} type="minus" />
                        </div>

                        {/* Refund Auto-Adjustment */}
                        {report.adjustmentGroups.refund > 0 && (
                          <div className="p-2.5 rounded-xl bg-rose-500/5 border border-rose-500/10 border-dashed flex justify-between items-center">
                             <div className="flex items-center gap-1.5">
                                <div className="w-1 h-1 rounded-full bg-rose-500 animate-pulse" />
                                <span className="text-[7px] font-black uppercase tracking-widest text-rose-400/80">Возвраты (комиссия)</span>
                             </div>
                             <span className="font-mono font-black text-[9px] text-rose-400">-${(report.adjustmentGroups.refund * 0.2).toFixed(1)}</span>
                          </div>
                        )}
                     </div>

                     <div className="p-6 bg-slate-900/60 border-t border-white/5 relative z-10 mt-auto">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-indigo-600 px-4 py-1 rounded-full text-[8px] font-black uppercase text-white shadow-xl ring-2 ring-slate-900">К выплате</div>
                        
                        <div className="flex flex-col items-center mt-2">
                           <span className="text-4xl font-black font-mono text-white tracking-tighter drop-shadow-[0_8px_16px_rgba(79,70,229,0.4)]">
                              ${report.finalBalance.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                           </span>
                           <div className="flex items-center gap-1.5 mt-2.5 p-0.5 px-2 rounded-full bg-white/5 border border-white/5">
                              <div className="w-1 h-1 rounded-full bg-emerald-500" />
                              <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Verified by Continental</span>
                           </div>
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
                     <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                        <div className="space-y-3">
                           {report.fullHistory.length === 0 ? (
                             <div className="text-center py-20 opacity-20 flex flex-col items-center">
                                <ICONS.Empty size={40} className="mx-auto mb-4" />
                                <p className="text-[10px] font-black uppercase tracking-[0.2em]">История пуста</p>
                             </div>
                           ) : report.fullHistory.map((item, idx) => (
                             <motion.div 
                                key={item.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: idx * 0.03 }}
                                className="group flex items-center gap-4 p-3.5 rounded-2xl border border-white/5 bg-white/[0.01] hover:bg-indigo-600/[0.03] hover:border-indigo-500/30 transition-all relative overflow-hidden"
                             >
                                <div className="absolute top-0 left-0 w-1 h-full bg-slate-800 transition-all group-hover:bg-indigo-500" />
                                <div className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all ${
                                  item.type === 'income' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]' : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.1)]'
                                }`}>
                                   {item.type === 'income' ? <ICONS.Income size={14} /> : <ICONS.Chart size={14} />}
                                </div>
                                <div className="flex-1 min-w-0">
                                   <div className="flex justify-between items-baseline mb-0.5">
                                      <h5 className="text-[10px] font-black text-slate-200 uppercase truncate group-hover:text-white transition-colors">{item.label}</h5>
                                      <span className={`text-xs font-black font-mono ${item.amount >= 0 && item.type === 'income' || (item as any).opType === 'bonus' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                         {item.amount >= 0 ? '+' : ''}${Math.abs(item.amount).toFixed(1)}
                                      </span>
                                   </div>
                                   <div className="flex items-center gap-2">
                                      <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">{item.date.split('-').reverse().join('.')}</span>
                                      <div className="w-0.5 h-0.5 rounded-full bg-slate-700" />
                                      <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Internal Audit</span>
                                   </div>
                                </div>
                                <button 
                                  onClick={() => deleteRecord({type: item.type, id: item.id})}
                                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-700 hover:text-white hover:bg-rose-500 transition-all opacity-0 group-hover:opacity-100"
                                >
                                   <ICONS.Trash size={12} />
                                </button>
                             </motion.div>
                           ))}
                        </div>
                     </div>
                  </div>

                  {/* WALLET & DETAILS: WAW REDESIGN */}
                  <div className="glass-card rounded-[2.5rem] border-white/5 p-8 flex flex-col gap-6 relative overflow-hidden h-[400px]">
                     <div className="absolute right-0 top-0 w-32 h-32 bg-indigo-500/10 blur-3xl rounded-full"></div>
                     <div className="flex justify-between items-center relative z-10">
                        <div className="flex flex-col">
                           <h3 className="text-xl font-black font-outfit uppercase tracking-tight text-white leading-none">Реквизиты</h3>
                           <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Payment Endpoint Settings</span>
                        </div>
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                           <ICONS.Wallet size={20} />
                        </div>
                     </div>

                     <div className="space-y-5 flex-1 relative z-10">
                        <div className="flex p-1.5 bg-slate-950 rounded-2xl border border-white/5 relative items-stretch">
                           <button 
                             onClick={() => updateWallet(report.wallet?.address || '', 'usdt_trc20')} 
                             className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all relative z-10 ${(!report.wallet || report.wallet.method === 'usdt_trc20') ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                           >
                             {(!report.wallet || report.wallet.method === 'usdt_trc20') && (
                               <motion.div layoutId="wallet-bg" className="absolute inset-0 bg-indigo-600 rounded-xl shadow-[0_10px_20px_-5px_rgba(79,70,229,0.5)] -z-10" />
                             )}
                             USDT
                           </button>
                           <button 
                             onClick={() => updateWallet(report.wallet?.address || '', 'card')} 
                             className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all relative z-10 ${report.wallet?.method === 'card' ? 'text-white' : 'text-slate-500 hover:text-slate-300'}`}
                           >
                             {report.wallet?.method === 'card' && (
                               <motion.div layoutId="wallet-bg" className="absolute inset-0 bg-indigo-600 rounded-xl shadow-[0_10px_20px_-5px_rgba(79,70,229,0.5)] -z-10" />
                             )}
                             CARD
                           </button>
                        </div>

                        <div className="space-y-2">
                           <div className="flex items-center justify-between mb-1">
                              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Destination Address</label>
                              <div className={`px-2 py-0.5 rounded text-[7px] font-black uppercase tracking-[0.2em] ${report.wallet?.method === 'card' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                 {report.wallet?.method === 'card' ? 'BANK NETWORK' : 'TRC20 NETWORK'}
                              </div>
                           </div>
                           <div className="relative group">
                              <input 
                                type="text"
                                className="w-full bg-slate-950/80 border border-white/5 rounded-2xl px-5 py-4 text-sm font-mono text-white outline-none focus:border-indigo-500/50 focus:ring-4 focus:ring-indigo-500/10 transition-all pr-24 placeholder:text-slate-800"
                                placeholder={report.wallet?.method === 'card' ? 'XXXX XXXX XXXX XXXX' : 'T... (Network: TRC20)'}
                                value={report.wallet?.address || ''}
                                onChange={e => updateWallet(e.target.value, report.wallet?.method || 'usdt_trc20')}
                              />
                              {report.wallet?.address && (
                                <button 
                                  onClick={() => { navigator.clipboard.writeText(report.wallet!.address); }}
                                  className="absolute right-2.5 top-1/2 -translate-y-1/2 bg-white/5 hover:bg-indigo-500 hover:text-white rounded-xl px-4 py-2 text-[8px] font-black text-slate-400 transition-all uppercase tracking-[0.2em] border border-white/5"
                                >
                                  COPY
                                </button>
                              )}
                           </div>
                        </div>
                     </div>

                     <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/10 flex items-start gap-3 relative z-10">
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                           <ICONS.AlertTriangle size={16} />
                        </div>
                        <div className="flex-1">
                           <span className="text-[8px] font-black uppercase text-amber-500 tracking-widest block mb-1">Critical Security Check</span>
                           <p className="text-[7.5px] font-bold text-amber-500/60 leading-relaxed uppercase tracking-wider">Убедитесь, что реквизиты введены верно. Отмена транзакций в блокчейне/банковской сети невозможна.</p>
                        </div>
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
