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
    <div className="space-y-8 animate-in fade-in duration-700 pb-32">
      {/* HEADER SECTION */}
      <motion.header 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 bg-slate-900/20 p-8 rounded-[3rem] border border-white/5 backdrop-blur-md"
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-5">
             <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-[2rem] flex items-center justify-center text-white border border-white/20 shadow-[0_20px_40px_-10px_rgba(99,102,241,0.4)]">
                <ICONS.Reports size={32} />
             </div>
             <div>
                <h1 className="text-4xl font-black font-outfit text-white tracking-tight leading-tight">Аналитика <span className="text-indigo-400">Profit</span></h1>
                <div className="flex items-center gap-3 mt-1.5">
                   <div className="px-3 py-1 bg-white/5 border border-white/10 rounded-full flex items-center gap-2">
                      <PeriodBadge state={state} />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{activePeriod?.label}</span>
                   </div>
                   <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
                   <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Enterprise Dashboard v2.0</span>
                </div>
             </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="relative group">
            <select 
              className="appearance-none bg-slate-950 border-2 border-slate-800/80 rounded-2xl px-8 py-4 pr-14 font-black text-[13px] text-white shadow-2xl focus:border-indigo-500 transition-all cursor-pointer hover:border-slate-700 uppercase tracking-widest min-w-[300px]" 
              value={selectedOperator} 
              onChange={(e) => setSelectedOperator(e.target.value)}
            >
              <option value="">Выберите сотрудника</option>
              {currentOperators.map(op => <option key={op} value={op}>{op}</option>)}
            </select>
            <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-indigo-400 transition-colors">
               <ICONS.Users size={20} />
            </div>
          </div>

          <AnimatePresence>
            {selectedOperator && (
              <motion.button 
                initial={{ opacity: 0, scale: 0.9, x: 20 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                onClick={() => setShowQuickOp(!showQuickOp)} 
                className={`h-[60px] px-8 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] flex items-center gap-4 transition-all active:scale-95 shadow-2xl ${showQuickOp ? 'bg-rose-500 text-white shadow-rose-500/30' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30 ring-1 ring-white/10'}`}
              >
                <div className={`transition-transform duration-500 ${showQuickOp ? 'rotate-45' : ''}`}>
                  <ICONS.Plus size={20} />
                </div>
                {showQuickOp ? 'Отмена' : 'Корректировка'}
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </motion.header>

      {/* QUICK OPERATION FORM */}
      <AnimatePresence>
        {showQuickOp && selectedOperator && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -20 }}
            className="glass-card p-1 border-indigo-500/30 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] rounded-[2.5rem] overflow-hidden"
          >
            <div className="p-8 bg-indigo-500/[0.02]">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
                  {Object.entries(OPERATION_META).map(([k,m]) => (
                    <button 
                      key={k} 
                      onClick={() => setQType(k as any)} 
                      className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all group ${qType === k ? 'bg-indigo-600 border-indigo-500 text-white shadow-2xl shadow-indigo-600/30' : 'bg-slate-950/50 border-slate-800 text-slate-500 hover:border-slate-700'}`}
                    >
                      <div className={`transition-transform group-hover:scale-110 ${qType === k ? 'text-white' : 'text-slate-400'}`}>
                        <m.icon size={22} />
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest leading-none mt-1">{m.label}</span>
                    </button>
                  ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Сумма Начисления</label>
                    <div className="relative">
                      <input type="number" placeholder="0.00" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white font-mono text-xl outline-none focus:border-indigo-500/50 transition-all pl-10" value={qAmount} onChange={e => setQAmount(e.target.value)} />
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xl">$</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">К какому счету?</label>
                    <select className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-[21px] text-white font-bold outline-none focus:border-indigo-500/50 transition-all cursor-pointer" value={qPlatform} onChange={e => setQPlatform(e.target.value as any)}>
                      <option value="all">Общий счет (Balance)</option>
                      <option value="onlyFans">OnlyFans</option>
                      <option value="paypal">PayPal</option>
                      <option value="crypto">Crypto</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Пояснение / Заметка</label>
                    <input type="text" placeholder="Введите причину..." className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white outline-none focus:border-indigo-500/50 transition-all" value={qComment} onChange={e => setQComment(e.target.value)} />
                  </div>
              </div>
              <div className="flex justify-end mt-8">
                <button onClick={addQuickOp} className="px-12 py-4 bg-indigo-600 hover:bg-indigo-500 text-white font-black rounded-2xl shadow-2xl shadow-indigo-600/30 transition-all active:scale-95 uppercase tracking-widest text-[11px]">Создать Операцию</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!selectedOperator && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center py-20 bg-slate-900/20 border border-dashed border-slate-800 rounded-[3rem]"
        >
           <div className="w-20 h-20 bg-slate-900 rounded-3xl flex items-center justify-center text-slate-800 mb-6 border border-slate-800/50">
              <ICONS.Users size={40} />
           </div>
           <h2 className="text-xl font-bold text-slate-600 font-outfit uppercase tracking-widest">Выберите сотрудника для анализа</h2>
           <p className="text-slate-700 text-sm mt-2">Все финансовые потоки будут загружены мгновенно</p>
        </motion.div>
      )}

      {report && (
        <motion.div 
          key={selectedOperator}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-6"
        >
          {/* STATS OVERVIEW */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <StatsCard title="Выручка (Грязные)" value={report.totalBrutto} icon={<ICONS.Income />} color="indigo" />
            <StatsCard title="Чистая ЗП (Netto)" value={report.totalNetto} icon={<ICONS.Wallet />} color="emerald" highlighted />
            
            <PlatformPill 
              label="OnlyFans" 
              gross={report.platformStats.of.gross} 
              net={report.platformStats.of.net} 
              color="indigo" 
              icon={<span className="text-[10px] font-black">OF</span>}
            />
            <PlatformPill 
              label="PayPal" 
              gross={report.platformStats.pp.gross} 
              net={report.platformStats.pp.net} 
              color="sky" 
              icon={<span className="text-[10px] font-black">PP</span>}
            />
            <PlatformPill 
              label="Crypto" 
              gross={report.platformStats.cr.gross} 
              net={report.platformStats.cr.net} 
              color="emerald" 
              icon={<span className="text-[10px] font-black">CR</span>}
            />
          </section>

          {/* MAIN CONTENT GRID */}
          <section className="grid grid-cols-1 xl:grid-cols-3 gap-8">
             <div className="xl:col-span-2 space-y-8">
                {/* CHART SECTION */}
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="glass-card rounded-[3rem] border-slate-800 shadow-[0_40px_80px_-15px_rgba(0,0,0,0.7)] p-10 relative overflow-hidden group"
                >
                   <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/5 blur-[100px] -z-10 group-hover:bg-indigo-500/10 transition-colors animate-pulse"></div>
                   <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
                      <div>
                        <div className="flex items-center gap-3 mb-1">
                           <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,1)]"></div>
                           <h2 className="text-2xl font-black font-outfit text-white tracking-tight uppercase">Динамика Выработки</h2>
                        </div>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-4">Анализ производительности по типам дохода</p>
                      </div>
                      <div className="flex items-center gap-6 bg-slate-950/50 px-6 py-3 rounded-2xl border border-white/5">
                         <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-indigo-500/20 border border-indigo-500/50"></div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gross</span>
                         </div>
                         <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.4)]"></div>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Net Profit</span>
                         </div>
                      </div>
                   </div>
                   
                   <div className="h-[320px] w-full">
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
                            <CartesianGrid strokeDasharray="6 6" vertical={false} stroke="#1e293b" opacity={0.3} />
                            <XAxis 
                              dataKey="date" 
                              stroke="#475569" 
                              fontSize={10} 
                              fontWeight={900} 
                              tickFormatter={(v) => v.split('-').slice(1).reverse().join('/')}
                              axisLine={false}
                              tickLine={false}
                              dy={15}
                            />
                            <YAxis 
                              stroke="#475569" 
                              fontSize={10} 
                              fontWeight={900} 
                              axisLine={false}
                              tickLine={false}
                              tickFormatter={(v) => `$${v}`}
                            />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: '#020617', 
                                border: '1px solid rgba(255,255,255,0.1)', 
                                borderRadius: '24px',
                                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.8)',
                                padding: '16px'
                              }}
                              itemStyle={{ color: '#fff', fontSize: '13px', fontWeight: 900 }}
                              labelStyle={{ color: '#6366f1', fontSize: '10px', marginBottom: '8px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '2px' }}
                              cursor={{ stroke: '#6366f1', strokeWidth: 2, strokeDasharray: '4 4' }}
                            />
                            <Area type="monotone" dataKey="totalGross" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorGross)" />
                            <Area type="monotone" dataKey="totalNet" stroke="#10b981" strokeWidth={4} fillOpacity={1} fill="url(#colorNet)" />
                         </AreaChart>
                      </ResponsiveContainer>
                   </div>
                </motion.div>

                {/* DAILY BREAKDOWN SECTION - PROFESSIONAL REDESIGN */}
                <div className="glass-card rounded-[3.5rem] overflow-hidden border-slate-800 shadow-[0_64px_128px_-24px_rgba(0,0,0,0.8)] flex flex-col md:flex-row h-[750px] border-t-white/10 relative">
                   {/* DAYS SIDEBAR (STICKY-ish) */}
                   <div className="w-full md:w-[380px] border-r border-slate-800/60 flex flex-col bg-slate-900/60 backdrop-blur-3xl shrink-0 relative overflow-hidden group/sidebar">
                      <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-indigo-500/5 to-transparent pointer-events-none"></div>
                      <div className="p-10 border-b border-white/[0.03] bg-slate-950/20 relative z-10">
                         <div className="flex items-center gap-3 mb-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                            <h2 className="font-black font-outfit text-base text-white tracking-[0.2em] uppercase">Дневник Выработки</h2>
                         </div>
                         <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none ml-5">Календарь инспекций v2</p>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-3 relative z-10">
                         {[...report.dailyHistory].reverse().map((d) => {
                           const isActive = selectedDate === d.date;
                           return (
                             <button
                               key={d.date}
                               onClick={() => setSelectedDate(d.date)}
                               className={`w-full text-left p-6 rounded-[2.5rem] transition-all duration-500 group relative overflow-hidden ${
                                 isActive 
                                   ? 'bg-indigo-600 shadow-[0_20px_40px_-5px_rgba(79,70,229,0.4)] ring-1 ring-white/30' 
                                   : 'hover:bg-white/[0.04] border border-transparent hover:border-white/5 active:scale-[0.98]'
                               }`}
                             >
                                {isActive && (
                                  <motion.div 
                                    layoutId="activeDayHighlight"
                                    className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent pointer-events-none"
                                  />
                                )}
                                
                                <div className="flex justify-between items-center mb-4 relative z-10">
                                   <div className="flex flex-col">
                                      <span className={`font-mono text-lg font-black tracking-tight leading-none ${isActive ? 'text-white' : 'text-slate-100'}`}>
                                         {d.date.split('-').reverse().join('.')}
                                      </span>
                                      <span className={`text-[10px] font-black uppercase tracking-[0.3em] mt-2 ${isActive ? 'text-indigo-200' : 'text-indigo-500/80'}`}>
                                         {new Date(d.date).toLocaleDateString('ru-RU', { weekday: 'long' })}
                                      </span>
                                   </div>
                                   <div className={`w-10 h-10 rounded-2xl flex items-center justify-center transition-all duration-700 ${isActive ? 'bg-white shadow-xl rotate-[360deg]' : 'bg-slate-800/40 opacity-40 group-hover:opacity-100'}`}>
                                      <ICONS.Reports size={18} className={isActive ? 'text-indigo-600' : 'text-slate-400'} />
                                   </div>
                                </div>

                                <div className="flex items-center gap-4 relative z-10">
                                   <div className="flex-1 px-4 py-2 bg-slate-950/40 rounded-xl border border-white/5">
                                      <span className={`block text-[8px] font-black uppercase tracking-widest ${isActive ? 'text-white/40' : 'text-slate-600'}`}>Total Net</span>
                                      <span className={`text-sm font-mono font-black ${isActive ? 'text-white' : 'text-emerald-400'}`}>${d.totalNet.toFixed(1)}</span>
                                   </div>
                                </div>
                             </button>
                           );
                         })}
                      </div>
                   </div>

                   {/* DAY DETAILS - THE WORKING CANVAS */}
                   <div className="flex-1 flex flex-col relative overflow-hidden bg-slate-950/80 backdrop-blur-xl">
                      <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] pointer-events-none"></div>
                      {selectedDate ? (
                        <div className="w-full h-full flex flex-col relative z-10">
                           {/* DETAIL HEADER */}
                           <div className="px-12 py-10 border-b border-white/[0.05] bg-slate-900/40 flex justify-between items-end shrink-0">
                              <div className="flex items-start gap-6">
                                 <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-[2rem] flex items-center justify-center text-white border border-white/20 shadow-2xl">
                                    <ICONS.Reports size={32} />
                                 </div>
                                 <div className="pt-1">
                                    <h3 className="font-black font-outfit text-3xl text-white tracking-tight uppercase leading-none mb-3">Суточный Рапорт</h3>
                                    <div className="flex items-center gap-3">
                                       <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10 uppercase text-[10px] font-black text-indigo-400 tracking-widest">
                                          {selectedDate.split('-').reverse().join('.')}
                                       </div>
                                       <div className="w-1.5 h-1.5 rounded-full bg-slate-700"></div>
                                       <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Operator: {selectedOperator}</span>
                                    </div>
                                 </div>
                              </div>
                              <div className="hidden lg:flex flex-col items-end">
                                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Общий итог смены</span>
                                 <div className="px-8 py-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20">
                                    <span className="text-3xl font-black font-mono text-emerald-400">${report.dailyHistory.find(d => d.date === selectedDate)?.totalNet.toFixed(1)}</span>
                                 </div>
                              </div>
                           </div>
                           
                           {/* DETAIL SCROLL AREA */}
                           <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
                              <AnimatePresence mode="wait">
                                 <motion.div 
                                   key={selectedDate}
                                   initial={{ opacity: 0, scale: 0.98, y: 10 }}
                                   animate={{ opacity: 1, scale: 1, y: 0 }}
                                   exit={{ opacity: 0, scale: 1.02, y: -10 }}
                                   transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                                   className="space-y-12"
                                 >
                                    {report.dailyHistory.find(d => d.date === selectedDate)?.modelBreakdown.map((m, mIdx) => (
                                      <div 
                                        key={mIdx}
                                        className="relative group/model"
                                      >
                                         <div className="flex items-center gap-6 mb-8">
                                            <div className="flex items-center gap-3 px-8 py-3 bg-indigo-600 rounded-3xl shadow-[0_15px_30px_-5px_rgba(79,70,229,0.5)] border border-white/20">
                                               <ICONS.Users size={16} className="text-white" />
                                               <span className="text-sm font-black text-white uppercase tracking-[0.2em] font-outfit">{m.name}</span>
                                            </div>
                                            <div className="h-px flex-1 bg-gradient-to-r from-indigo-500/40 to-transparent"></div>
                                         </div>
 
                                         <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                            <DetailBox pill="OnlyFans" gross={m.ofG} net={m.ofN} rate={m.ofR} color="indigo" />
                                            <DetailBox pill="PayPal" gross={m.ppG} net={m.ppN} rate={m.ppR} color="sky" />
                                            <DetailBox pill="Crypto" gross={m.crG} net={m.crN} rate={m.crR} color="emerald" />
                                         </div>
 
                                         <div className="mt-8 flex justify-end">
                                            <div className="px-8 py-4 bg-slate-900/50 backdrop-blur-3xl border border-white/5 rounded-[2rem] flex items-center gap-12 group-hover/model:border-indigo-500/30 transition-colors">
                                               <div className="flex flex-col">
                                                  <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Model Gross</span>
                                                  <span className="text-lg font-black font-mono text-slate-300">${m.gross.toFixed(0)}</span>
                                               </div>
                                               <div className="w-10 h-10 rounded-full border border-white/5 flex items-center justify-center font-black text-slate-700">Σ</div>
                                               <div className="flex flex-col items-end">
                                                  <span className="text-[9px] font-black text-emerald-500/60 uppercase tracking-widest mb-1">Total Model Net</span>
                                                  <span className="text-2xl font-black font-mono text-white">${m.net.toFixed(1)}</span>
                                               </div>
                                            </div>
                                         </div>
                                      </div>
                                    ))}
                                 </motion.div>
                              </AnimatePresence>
                           </div>
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center space-y-8 p-20 grayscale opacity-40">
                           <div className="relative">
                              <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20"></div>
                              <ICONS.Reports size={120} className="relative text-indigo-400 animate-pulse" />
                           </div>
                           <div className="text-center">
                              <h3 className="font-black uppercase tracking-[0.6em] text-white text-2xl mb-4">Аналитический Бокс</h3>
                              <p className="text-slate-500 text-sm font-medium leading-relaxed max-w-sm">Выберите рабочую дату в левой панели для декомпозиции финансовых потоков</p>
                           </div>
                        </div>
                      )}
                   </div>
                </div>
              </div>

             {/* SIDEBAR SECTION */}
             <div className="space-y-8">
                {/* FINAL BALANCE CARD */}
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="relative group h-full"
                >
                   <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/50 to-emerald-500/50 rounded-[3.1rem] blur-2xl opacity-0 group-hover:opacity-30 transition-opacity"></div>
                   <div className="glass-card p-10 rounded-[3rem] border-white/10 bg-slate-900 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] relative overflow-hidden flex flex-col h-full border-t-white/20">
                      
                      <div className="flex justify-between items-start mb-12">
                         <div className="flex flex-col">
                            <div className="flex items-center gap-3 mb-2">
                               <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,1)]"></div>
                               <h3 className="text-2xl font-black font-outfit text-white uppercase tracking-tight">Финальный чек</h3>
                            </div>
                            <span className="text-[10px] font-black tracking-[0.4em] uppercase text-slate-500 ml-5">Profit Settlement v2.0</span>
                         </div>
                         <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-indigo-400 border border-white/5 shadow-inner">
                            <ICONS.Salary size={28} />
                         </div>
                      </div>

                      <div className="space-y-8 flex-grow">
                         <div className="bg-white/5 p-6 rounded-[2rem] border border-white/5 relative group/item">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-3">Начислено по выработке</p>
                           <div className="flex justify-between items-baseline">
                              <span className="text-lg font-black text-white font-outfit">Net Profit Total</span>
                              <span className="text-3xl font-black font-mono text-white">${report.totalNetto.toFixed(1)}</span>
                           </div>
                           <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-12 bg-indigo-500 rounded-r-full opacity-0 group-hover/item:opacity-100 transition-opacity"></div>
                         </div>

                         <div className="space-y-4 px-2">
                            <SummaryLine label="Авансы & Салари" val={report.adjustmentGroups.advance + report.adjustmentGroups.salary} type="minus" />
                            <SummaryLine label="Штрафы & Пенальти" val={report.adjustmentGroups.penalty} type="minus" />
                            <SummaryLine label="Бонусы & Премии" val={report.adjustmentGroups.bonus} type="plus" />
                            <SummaryLine label="Обучение / Стаж" val={report.adjustmentGroups.internship} type="minus" />
                         </div>

                         <div className="p-5 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 border-dashed">
                            <p className="text-[9px] text-indigo-300 font-black uppercase tracking-widest text-center leading-relaxed">
                              Авто-коррекция возвратов: -${report.adjustmentGroups.refund.toFixed(0)}
                            </p>
                         </div>
                      </div>

                      <div className="mt-12 pt-10 border-t-2 border-slate-800 border-dashed relative">
                         <div className="absolute -top-[13px] left-1/2 -translate-x-1/2 flex justify-center">
                            <div className="px-6 py-1.5 bg-indigo-600 text-white rounded-full text-[10px] font-black uppercase tracking-[0.3em] shadow-[0_10px_20px_rgba(79,70,229,0.4)]">К выплате</div>
                         </div>
                         <div className="flex flex-col items-center">
                            <div className="relative mb-4">
                               <div className="absolute inset-0 bg-indigo-500 blur-3xl opacity-20"></div>
                               <span className="text-6xl font-black font-mono text-white tracking-tighter drop-shadow-[0_20px_40px_rgba(0,0,0,1)] selection:bg-indigo-500">
                                  ${report.finalBalance.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                               </span>
                            </div>
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.5em]">Verified Settlement</span>
                         </div>
                      </div>
                   </div>
                </motion.div>

                {/* WALLET SECTION */}
                <div className="glass-card p-10 rounded-[3rem] border-slate-800 bg-slate-900/30 shadow-xl space-y-6 relative border-t-white/5">
                   <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <h3 className="text-xl font-black font-outfit text-white uppercase tracking-tight leading-none mb-2">Реквизиты</h3>
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Payment Endpoint v2.1</span>
                      </div>
                      <ICONS.Lock className="text-slate-700" size={18} />
                   </div>
                   
                   <div className="space-y-6">
                      <div className="flex p-1.5 bg-slate-950/80 rounded-2xl border border-slate-800/50 backdrop-blur-xl">
                         <button 
                           onClick={() => updateWallet(report.wallet?.address || '', 'usdt_trc20')}
                           className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${(!report.wallet || report.wallet.method === 'usdt_trc20') ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 font-extrabold' : 'text-slate-500 hover:text-slate-300'}`}
                         >
                           USDT
                         </button>
                         <button 
                           onClick={() => updateWallet(report.wallet?.address || '', 'card')}
                           className={`flex-1 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all duration-300 ${report.wallet?.method === 'card' ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30 font-extrabold' : 'text-slate-500 hover:text-slate-300'}`}
                         >
                           CARD
                         </button>
                      </div>
                      
                      <div className="space-y-2 relative">
                         <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1 opacity-60">Address Destination</label>
                         <div className="relative group/input">
                            <div className="absolute inset-x-0 bottom-0 h-0.5 bg-indigo-500 scale-x-0 group-focus-within/input:scale-x-100 transition-transform duration-500 z-20"></div>
                            <input 
                               type="text" 
                               className="w-full bg-slate-950/80 border border-white/5 rounded-2xl px-6 py-6 text-sm text-white font-mono outline-none focus:bg-slate-950 transition-all pr-20 placeholder:opacity-20 placeholder:text-slate-500"
                               placeholder={report.wallet?.method === 'card' ? 'XXXX XXXX XXXX XXXX' : 'T... (Network: TRC20)'}
                               value={report.wallet?.address || ''}
                               onChange={e => updateWallet(e.target.value, report.wallet?.method || 'usdt_trc20')}
                            />
                            {report.wallet?.address && (
                              <button 
                                onClick={() => { 
                                  navigator.clipboard.writeText(report.wallet!.address); 
                                  const btn = document.getElementById('copy-wallet-btn-v2');
                                  if(btn) btn.innerHTML = 'DONE';
                                  setTimeout(() => { if(btn) btn.innerHTML = 'COPY'; }, 2000);
                                }}
                                className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/5 hover:bg-indigo-600 hover:text-white border border-white/10 rounded-xl px-4 py-2 text-[8px] font-black text-slate-400 transition-all uppercase tracking-widest active:scale-95"
                                id="copy-wallet-btn-v2"
                              >
                                COPY
                              </button>
                            )}
                         </div>
                      </div>
                   </div>
                </div>
             </div>
          </section>

          {/* FULL HISTORY SECTION */}
          <section className="glass-card rounded-[4rem] overflow-hidden border-slate-800 shadow-[0_60px_120px_-30px_rgba(0,0,0,1)] border-t-white/10 relative bg-slate-950/60">
             <div className="p-10 border-b border-white/[0.03] bg-slate-900/60 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
                <div className="absolute left-0 bottom-0 top-0 w-2 bg-gradient-to-b from-indigo-500 to-indigo-600 shadow-[0_0_20px_rgba(99,102,241,0.5)]"></div>
                <div>
                   <div className="flex items-center gap-3">
                      <ICONS.Reports className="text-indigo-400" size={24} />
                      <h2 className="font-black font-outfit text-2xl text-white tracking-tight uppercase">Аудит всех операций</h2>
                   </div>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-3 ml-1">Timeline activity log v2.0</p>
                </div>
                <div className="flex items-center gap-4 bg-slate-950/80 px-6 py-4 rounded-2xl border border-white/5">
                   <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50"></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Income</span>
                   </div>
                   <div className="w-px h-6 bg-white/5"></div>
                   <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-indigo-500/20 border border-indigo-500/50"></div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">System Operation</span>
                   </div>
                </div>
             </div>
             <div className="overflow-x-auto max-h-[700px] custom-scrollbar bg-slate-950/40">
                <table className="w-full text-left text-sm whitespace-nowrap border-separate border-spacing-0">
                   <thead>
                      <tr className="bg-slate-900/80 text-slate-500 font-black text-[10px] uppercase tracking-[0.3em] border-b border-white/5 sticky top-0 z-20 backdrop-blur-xl">
                         <th className="px-12 py-8">Хронология</th>
                         <th className="px-12 py-8">Детали события</th>
                         <th className="px-12 py-8 text-right">Финансовый итог ($)</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-white/[0.03]">
                      {report.fullHistory.map((item, idx) => (
                         <motion.tr 
                            key={item.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.03 }}
                            className="hover:bg-white/[0.04] group transition-all relative"
                         >
                            <td className="px-12 py-8 relative">
                               <div className="flex flex-col">
                                  <span className="font-mono text-white text-base font-black tracking-tight">{item.date.split('-').reverse().join('.')}</span>
                                  <span className="text-[9px] font-black uppercase text-indigo-500/60 tracking-widest mt-1.5 flex items-center gap-1.5">
                                     <div className="w-1 h-1 rounded-full bg-indigo-500"></div>
                                     Log Entry #{item.id.slice(-6)}
                                  </span>
                               </div>
                            </td>
                            <td className="px-12 py-8">
                               <div className="flex items-center gap-6">
                                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 ${item.type === 'income' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-lg shadow-emerald-900/20' : 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 shadow-lg shadow-indigo-900/20'}`}>
                                     {item.type === 'income' ? <ICONS.Income size={20} /> : <ICONS.Reports size={20} />}
                                  </div>
                                  <div className="flex flex-col">
                                     <span className="font-black text-white text-lg tracking-tight group-hover:text-indigo-400 transition-colors uppercase leading-none mb-2">{item.label}</span>
                                     {item.type === 'op' && (item.raw as OperationRecord).comment && (
                                        <div className="flex items-center gap-2">
                                           <div className="w-1 h-3 bg-slate-800 rounded-full"></div>
                                           <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest line-clamp-1">{(item.raw as OperationRecord).comment}</span>
                                        </div>
                                     )}
                                  </div>
                               </div>
                            </td>
                            <td className="px-12 py-8 text-right">
                               <div className="flex items-center justify-end gap-10">
                                  <div className={`flex flex-col items-end leading-none ${['income', 'bonus', 'internship'].includes((item as any).opType) || item.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                     <div className="flex items-baseline gap-1">
                                        <span className="text-sm opacity-60 font-mono font-black">{['income', 'bonus', 'internship'].includes((item as any).opType) || item.type === 'income' ? '+' : '-'}</span>
                                        <span className="text-3xl font-black font-mono tracking-tighter shadow-sm">
                                           {item.amount.toFixed(2)}
                                        </span>
                                     </div>
                                     <div className="flex items-center gap-1.5 mt-2 bg-slate-950/60 px-3 py-1 rounded-full border border-white/5">
                                        <div className={`w-1 h-1 rounded-full ${item.type === 'income' ? 'bg-emerald-500' : 'bg-indigo-500'}`}></div>
                                        <span className="text-[8px] font-black uppercase text-slate-500 tracking-widest">Process Success</span>
                                     </div>
                                  </div>
                                  <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border border-white/5 rounded-2xl shadow-2xl scale-0 group-hover:scale-100 transition-all origin-right">
                                     <button onClick={() => item.type === 'income' ? setEditingIncome(item.raw as any) : setEditingOperation(item.raw as any)} className="text-slate-400 hover:text-white p-2.5 rounded-xl transition-all hover:bg-white/5 active:scale-90" title="Edit"><ICONS.Edit size={18}/></button>
                                     <div className="w-px h-8 bg-white/5 mx-1"></div>
                                     <button onClick={() => deleteRecord({type: item.type, id: item.id})} className="text-slate-400 hover:text-rose-500 p-2.5 rounded-xl transition-all hover:bg-rose-500/5 active:scale-90" title="Delete"><ICONS.Trash size={18}/></button>
                                  </div>
                               </div>
                            </td>
                         </motion.tr>
                      ))}
                      {report.fullHistory.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-10 py-32 text-center">
                             <div className="flex flex-col items-center opacity-20 grayscale">
                                <ICONS.Empty size={64} className="mb-6" />
                                <span className="text-xs font-black text-white uppercase tracking-[0.6em]">No operations detected in local buffer</span>
                             </div>
                          </td>
                        </tr>
                      )}
                   </tbody>
                </table>
             </div>
          </section>
        </motion.div>
      )}

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
               className="glass-card w-full max-w-2xl rounded-[3rem] p-12 border-indigo-500/40 shadow-2xl relative"
             >
                <button onClick={() => setEditingIncome(null)} className="absolute top-10 right-10 text-slate-500 hover:text-white transition-all group">
                   <ICONS.Plus className="rotate-45 group-hover:scale-110 transition-transform" size={32} />
                </button>
                <div className="mb-10">
                   <h2 className="text-3xl font-black text-white font-outfit uppercase tracking-tight">Редактирование дохода</h2>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">{editingIncome.model} — {editingIncome.date}</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                   <div className="space-y-6">
                      <h3 className="text-[10px] font-black uppercase text-indigo-400 tracking-[0.2em] mb-4 bg-indigo-500/10 px-4 py-1 rounded-full w-fit">Грязные ($)</h3>
                      <RateField label="OnlyFans Gross" val={editingIncome.onlyFans} onChange={v => setEditingIncome({...editingIncome, onlyFans: v})} color="indigo" />
                      <RateField label="PayPal Gross" val={editingIncome.paypal} onChange={v => setEditingIncome({...editingIncome, paypal: v})} color="indigo" />
                      <RateField label="Crypto Gross" val={editingIncome.crypto} onChange={v => setEditingIncome({...editingIncome, crypto: v})} color="indigo" />
                   </div>
                   <div className="space-y-6">
                      <h3 className="text-[10px] font-black uppercase text-emerald-400 tracking-[0.2em] mb-4 bg-emerald-500/10 px-4 py-1 rounded-full w-fit">Ставки (%)</h3>
                      <RateField label="OF Rate" val={editingIncome.percentOF} onChange={v => setEditingIncome({...editingIncome, percentOF: v})} color="emerald" />
                      <RateField label="PP Rate" val={editingIncome.percentPP} onChange={v => setEditingIncome({...editingIncome, percentPP: v})} color="emerald" />
                      <RateField label="CR Rate" val={editingIncome.percentCrypto} onChange={v => setEditingIncome({...editingIncome, percentCrypto: v})} color="emerald" />
                   </div>
                </div>
                
                <div className="mt-12 flex gap-4">
                   <button onClick={() => setEditingIncome(null)} className="flex-1 bg-slate-900 text-slate-500 font-black py-4 rounded-2xl hover:bg-slate-800 transition-all uppercase tracking-widest text-[11px]">Отмена</button>
                   <button onClick={updateInc} className="flex-[2] bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl shadow-2xl shadow-indigo-600/20 transition-all active:scale-95 uppercase tracking-widest text-[11px]">Сохранить изменения</button>
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
               className="glass-card w-full max-w-lg rounded-[3rem] p-12 border-amber-500/40 shadow-2xl relative"
             >
                <button onClick={() => setEditingOperation(null)} className="absolute top-10 right-10 text-slate-500 hover:text-white transition-all group">
                   <ICONS.Plus className="rotate-45 group-hover:scale-110 transition-transform" size={32} />
                </button>
                <div className="mb-10">
                   <h2 className="text-3xl font-black text-white font-outfit uppercase tracking-tight">Редактировать Операцию</h2>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">{selectedOperator} — Control Panel</p>
                </div>

                <div className="space-y-8">
                   <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                     {Object.entries(OPERATION_META).map(([k, m]) => (
                       <button 
                         key={k} 
                         onClick={() => setEditingOperation({...editingOperation, type: k as any})} 
                         className={`p-4 rounded-2xl border text-[9px] font-black uppercase transition-all flex flex-col items-center gap-2 group ${editingOperation.type === k ? 'bg-amber-500 border-amber-400 text-white shadow-xl shadow-amber-500/20' : 'bg-slate-900 border-slate-800 text-slate-500'}`}
                       >
                          <div className={`transition-transform group-hover:scale-110 ${editingOperation.type === k ? 'text-white' : 'text-slate-400'}`}>
                            <m.icon size={22} />
                          </div>
                          {m.label}
                       </button>
                     ))}
                   </div>
                   <div className="space-y-6">
                      <RateField label="Сумма корректировки ($)" val={editingOperation.amount} onChange={v => setEditingOperation({...editingOperation, amount: v})} color="amber" />
                      <div className="space-y-2">
                         <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">Детальное описание</label>
                         <input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-4 text-white font-bold outline-none focus:border-amber-500/50 transition-all" value={editingOperation.comment} onChange={e => setEditingOperation({...editingOperation, comment: e.target.value})} placeholder="Причина правки..." />
                      </div>
                   </div>
                   <div className="flex gap-4 pt-4">
                      <button onClick={() => setEditingOperation(null)} className="flex-1 bg-slate-900 text-slate-500 font-black py-4 rounded-2xl hover:bg-slate-800 transition-all uppercase tracking-widest text-[11px]">Отмена</button>
                      <button onClick={updateOp} className="flex-[2] bg-amber-600 hover:bg-amber-500 text-white font-black py-4 rounded-2xl shadow-xl shadow-amber-600/20 transition-all active:scale-95 uppercase tracking-widest text-[11px]">Применить</button>
                   </div>
                </div>
             </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const StatsCard = ({ title, value, icon, color, highlighted }: { title: string, value: number, icon: React.ReactNode, color: string, highlighted?: boolean }) => (
  <div className={`glass-card p-10 rounded-[3.5rem] border transition-all duration-700 relative overflow-hidden group h-full flex flex-col ${highlighted ? 'border-indigo-500/40 bg-slate-900 shadow-[0_40px_80px_-20px_rgba(99,102,241,0.3)] ring-1 ring-white/10' : 'border-white/5 bg-slate-900/40 hover:bg-slate-900/60 hover:border-white/10 shadow-2xl'}`}>
    <div className={`absolute -right-10 -top-10 w-48 h-48 blur-[80px] rounded-full opacity-0 group-hover:opacity-20 transition-all duration-700 ${color === 'indigo' ? 'bg-indigo-500' : 'bg-emerald-500'}`}></div>
    <div className="flex flex-col gap-10 relative z-10 flex-grow">
      <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center transition-all duration-700 group-hover:scale-110 group-hover:rotate-6 ${highlighted ? 'bg-indigo-600 text-white shadow-[0_20px_40px_-10px_rgba(79,70,229,0.5)]' : `bg-slate-950/60 border border-white/5 text-${color}-400 shadow-inner`}`}>
        {React.cloneElement(icon as React.ReactElement, { size: 28 })}
      </div>
      <div className="space-y-4">
        <div className="flex flex-col gap-1">
           <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.4em] leading-none mb-1 group-hover:text-indigo-400/80 transition-colors">{title}</p>
           <div className="h-0.5 w-6 bg-slate-800 rounded-full group-hover:w-12 group-hover:bg-indigo-500/50 transition-all"></div>
        </div>
        <div className="flex items-baseline gap-2">
           <span className={`text-base font-mono font-black ${highlighted ? 'text-indigo-400' : 'text-slate-600'}`}>$</span>
           <p className={`text-4xl font-black font-outfit tracking-tighter ${highlighted ? 'text-white' : `text-slate-100 group-hover:text-white`}`}>
              {value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
           </p>
        </div>
      </div>
    </div>
  </div>
);

const PlatformPill = ({ label, gross, net, color, icon }: { label: string, gross: number, net: number, color: string, icon: React.ReactNode }) => (
  <div className="glass-card p-7 rounded-[2.5rem] border-white/5 bg-slate-900/40 hover:bg-slate-900/60 hover:border-white/10 transition-all border group relative overflow-hidden">
    <div className="flex items-center gap-4 mb-6 relative z-10">
       <div className={`w-10 h-10 rounded-xl flex items-center justify-center border transition-all duration-500 group-hover:scale-110 group-hover:bg-opacity-20 ${color === 'indigo' ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : color === 'sky' ? 'bg-sky-500/10 border-sky-500/30 text-sky-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
          {icon}
       </div>
       <span className="text-[11px] font-black uppercase tracking-widest text-slate-500 group-hover:text-slate-300 transition-colors">{label}</span>
    </div>
    <div className="space-y-3 relative z-10">
       <div className="flex justify-between items-center px-1">
          <span className="text-[9px] font-black uppercase text-slate-600 tracking-widest">Gross</span>
          <span className="text-xs text-slate-400 font-mono font-black">${gross.toFixed(0)}</span>
       </div>
       <div className="h-px w-full bg-white/[0.03]"></div>
       <div className="flex justify-between items-center px-1">
          <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Hand</span>
          <span className={`text-xl font-black font-mono transition-colors ${color === 'indigo' ? 'text-white group-hover:text-indigo-400' : color === 'sky' ? 'text-white group-hover:text-sky-400' : 'text-white group-hover:text-emerald-400'}`}>
             ${net.toFixed(1)}
          </span>
       </div>
    </div>
  </div>
);

const DetailBox = ({ pill, gross, net, rate, color }: { pill: string, gross: number, net: number, rate: string, color: string }) => {
  const colorMap: any = {
    indigo: 'from-indigo-600/20 to-indigo-900/10 border-indigo-500/20 text-indigo-400 shadow-indigo-600/10',
    sky: 'from-sky-600/20 to-sky-900/10 border-sky-500/20 text-sky-400 shadow-sky-600/10',
    emerald: 'from-emerald-600/20 to-emerald-900/10 border-emerald-500/20 text-emerald-400 shadow-emerald-600/10'
  };
  return (
    <div className={`p-6 rounded-3xl border bg-gradient-to-br shadow-2xl transition-all duration-500 hover:scale-[1.02] hover:bg-opacity-30 ${colorMap[color]}`}>
       <div className="flex justify-between items-center mb-5">
          <div className="flex flex-col">
             <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60 mb-1">{pill}</span>
             <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${color === 'indigo' ? 'bg-indigo-500' : color === 'sky' ? 'bg-sky-500' : 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]'}`}></div>
                <span className="text-[8px] font-black uppercase tracking-widest text-slate-500">Platform Analytics</span>
             </div>
          </div>
          <div className="px-3 py-1.5 rounded-xl bg-white/10 border border-white/10 shadow-lg">
             <span className="text-[11px] font-black font-mono text-white">{rate}</span>
          </div>
       </div>
       
       <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
             <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">Gross Vol.</span>
             <div className="flex items-baseline gap-1">
                <span className="text-[10px] font-mono text-slate-600">$</span>
                <span className="text-lg font-black font-mono text-slate-200">${gross.toFixed(0)}</span>
             </div>
          </div>
          <div className="space-y-1 text-right">
             <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-500">Net Profit</span>
             <div className="flex items-baseline gap-1 justify-end">
                <span className="text-[10px] font-mono text-slate-600">$</span>
                <span className="text-2xl font-black font-mono text-white tracking-tight">${net.toFixed(1)}</span>
             </div>
          </div>
       </div>
       
       <div className="mt-4 pt-4 border-t border-white/5">
          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
             <motion.div 
               initial={{ width: 0 }}
               animate={{ width: gross > 0 ? `${(net / gross) * 100}%` : '0%' }}
               className={`h-full ${color === 'indigo' ? 'bg-indigo-500' : color === 'sky' ? 'bg-sky-500' : 'bg-emerald-500'}`}
             />
          </div>
       </div>
    </div>
  );
};

const DailyPill = ({ pill, rate, val, color }: { pill: string, rate: string, val: number, color: string }) => {
  const cMap: any = { 
    indigo: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/10 group-hover:bg-indigo-500/20 group-hover:border-indigo-500/30', 
    sky: 'text-sky-400 bg-sky-500/10 border-sky-500/10 group-hover:bg-sky-500/20 group-hover:border-sky-500/30', 
    emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/10 group-hover:bg-emerald-500/20 group-hover:border-emerald-500/30' 
  };
  return (
    <div className={`flex flex-col items-center px-2 py-2 rounded-xl border transition-all duration-300 backdrop-blur-md ${cMap[color] || ''}`}>
       <div className="flex items-center gap-1 opacity-50 mb-1">
          <span className="text-[7px] font-black uppercase tracking-widest">{pill}</span>
          <div className="w-1 h-1 rounded-full bg-current opacity-40"></div>
          <span className="text-[7px] font-black uppercase leading-tight font-mono">{rate}</span>
       </div>
       <span className="font-mono text-[11px] font-black drop-shadow-sm">${val.toFixed(1)}</span>
    </div>
  );
};

const SummaryLine = ({ label, val, type }: { label: string, val: number, type: 'plus' | 'minus' }) => (
  <div className="flex items-center justify-between group/line py-1">
     <div className="flex items-center gap-3">
        <div className={`w-3 h-3 rounded-full border-2 border-slate-950 transition-all group-hover/line:scale-125 ${type === 'plus' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.5)]'}`}></div>
        <span className="text-slate-400 font-black text-[11px] uppercase tracking-[0.15em] group-hover:text-white transition-colors">{label}</span>
     </div>
     <div className="flex items-baseline gap-1">
        <span className={`text-xs font-mono font-black opacity-40 ${type === 'plus' ? 'text-emerald-400' : 'text-rose-400'}`}>{type === 'plus' ? '+' : '-'}</span>
        <span className={`font-mono font-black text-lg ${type === 'plus' ? 'text-emerald-400' : 'text-rose-400'}`}>
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
    <div className="space-y-2">
      <label className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] ml-1">{label}</label>
      <div className="relative">
        <input 
          type="number" 
          className={`w-full border border-slate-800 rounded-2xl px-5 py-4 text-xl font-mono outline-none transition-all ${colorMap[color] || ''}`} 
          value={val} 
          onChange={e => onChange(parseFloat(e.target.value) || 0)} 
        />
        {label.includes('Rate') && <span className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xl">%</span>}
      </div>
    </div>
  );
};

export default Reports;
