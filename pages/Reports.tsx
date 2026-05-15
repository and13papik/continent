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
        className="flex flex-col lg:flex-row lg:items-center justify-between gap-6"
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
             <div className="w-12 h-12 bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-400 border border-indigo-500/20 shadow-xl shadow-indigo-500/5">
                <ICONS.Reports size={24} />
             </div>
             <div>
                <h1 className="text-3xl font-black font-outfit text-white tracking-tight">Аналитика Оператора</h1>
                <div className="flex items-center gap-2 mt-0.5">
                   <PeriodBadge state={state} />
                   <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">{activePeriod?.label}</span>
                </div>
             </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <select 
              className="appearance-none bg-slate-900 border border-slate-800 rounded-2xl px-6 py-3.5 pr-12 font-bold text-white shadow-xl outline-none min-w-[260px] focus:border-indigo-500/50 transition-all cursor-pointer" 
              value={selectedOperator} 
              onChange={(e) => setSelectedOperator(e.target.value)}
            >
              <option value="">Выберите сотрудника</option>
              {currentOperators.map(op => <option key={op} value={op}>{op}</option>)}
            </select>
            <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
               <ICONS.Users size={18} />
            </div>
          </div>

          <AnimatePresence>
            {selectedOperator && (
              <motion.button 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setShowQuickOp(!showQuickOp)} 
                className={`h-[52px] px-6 rounded-2xl font-black text-[11px] uppercase tracking-widest flex items-center gap-3 transition-all active:scale-95 shadow-xl ${showQuickOp ? 'bg-rose-500 text-white shadow-rose-500/20' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/20'}`}
              >
                <div className={`transition-transform duration-300 ${showQuickOp ? 'rotate-45' : ''}`}>
                  <ICONS.Plus size={18} />
                </div>
                {showQuickOp ? 'Закрыть' : 'Корректировка'}
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
                  className="glass-card rounded-[2.5rem] border-slate-800 shadow-2xl p-8"
                >
                   <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                      <div>
                        <h2 className="text-xl font-black font-outfit text-white tracking-tight uppercase">Динамика Выработки</h2>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">График Gross vs Net за период</p>
                      </div>
                      <div className="flex gap-4">
                         <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 opacity-30"></div>
                            <span className="text-[10px] font-black text-slate-500 uppercase">Gross</span>
                         </div>
                         <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]"></div>
                            <span className="text-[10px] font-black text-slate-500 uppercase">Net</span>
                         </div>
                      </div>
                   </div>
                   
                   <div className="h-[280px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                         <AreaChart data={report.dailyHistory} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                            <defs>
                               <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                               </linearGradient>
                               <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.1}/>
                                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                               </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" opacity={0.5} />
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
                              contentStyle={{ 
                                backgroundColor: '#0f172a', 
                                border: '1px solid #334155', 
                                borderRadius: '16px',
                                boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
                              }}
                              itemStyle={{ color: '#fff', fontSize: '12px', fontWeight: 900 }}
                              labelStyle={{ color: '#64748b', fontSize: '10px', marginBottom: '4px', fontWeight: 900 }}
                            />
                            <Area type="monotone" dataKey="totalGross" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorGross)" />
                            <Area type="monotone" dataKey="totalNet" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorNet)" />
                         </AreaChart>
                      </ResponsiveContainer>
                   </div>
                </motion.div>

                {/* DAILY BREAKDOWN SECTION - REDESIGNED */}
                <div className="glass-card rounded-[2.5rem] overflow-hidden border-slate-800 shadow-2xl flex flex-col md:flex-row h-[600px]">
                   {/* DAYS SIDEBAR */}
                   <div className="w-full md:w-80 border-r border-slate-800 flex flex-col bg-slate-900/40">
                      <div className="p-6 border-b border-slate-800">
                         <h2 className="font-black font-outfit text-sm text-white tracking-tight uppercase">Дневник Выработки</h2>
                         <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Выберите день для деталей</p>
                      </div>
                      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                         {[...report.dailyHistory].reverse().map((d) => {
                           const isActive = selectedDate === d.date;
                           return (
                             <button
                               key={d.date}
                               onClick={() => setSelectedDate(d.date)}
                               className={`w-full text-left p-4 rounded-2xl transition-all duration-300 group ${isActive ? 'bg-indigo-600 shadow-xl shadow-indigo-600/20' : 'hover:bg-white/[0.03]'}`}
                             >
                                <div className="flex justify-between items-start mb-1">
                                   <div className="flex flex-col">
                                      <span className={`font-mono text-[13px] font-black ${isActive ? 'text-white' : 'text-slate-200'}`}>
                                         {d.date.split('-').reverse().join('.')}
                                      </span>
                                      <span className={`text-[8px] font-black uppercase tracking-widest ${isActive ? 'text-white/60' : 'text-slate-500'}`}>
                                         {new Date(d.date).toLocaleDateString('ru-RU', { weekday: 'short' })}
                                      </span>
                                   </div>
                                   <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-transform group-hover:scale-110 ${isActive ? 'bg-white/20' : 'bg-slate-800 opacity-50'}`}>
                                      <ICONS.Reports size={14} className={isActive ? 'text-white' : 'text-slate-400'} />
                                   </div>
                                </div>
                                <div className="flex gap-4 mt-2">
                                   <div className="flex flex-col">
                                      <span className={`text-[7px] font-black uppercase tracking-[0.2em] ${isActive ? 'text-white/40' : 'text-slate-600'}`}>Грязными</span>
                                      <span className={`text-[11px] font-mono font-black ${isActive ? 'text-white' : 'text-slate-400'}`}>${d.totalGross.toFixed(0)}</span>
                                   </div>
                                   <div className="flex flex-col">
                                      <span className={`text-[7px] font-black uppercase tracking-[0.2em] ${isActive ? 'text-white/40' : 'text-emerald-500/50'}`}>На руки</span>
                                      <span className={`text-[11px] font-mono font-black ${isActive ? 'text-white' : 'text-emerald-400'}`}>${d.totalNet.toFixed(1)}</span>
                                   </div>
                                </div>
                             </button>
                           );
                         })}
                      </div>
                   </div>

                   {/* DAY DETAILS */}
                   <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden bg-slate-950/20">
                      {selectedDate ? (
                        <div className="w-full h-full flex flex-col">
                           <div className="p-8 border-b border-slate-800 bg-slate-900/20 flex justify-between items-center sm:hidden md:flex">
                              <div>
                                 <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></span>
                                    <h3 className="font-black font-outfit text-xl text-white tracking-tight uppercase">Отчет за {selectedDate.split('-').reverse().join('.')}</h3>
                                 </div>
                                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Детальная разбивка по моделям и платформам</p>
                              </div>
                              <div className="flex gap-2">
                                 {report.activeModels.map(m => <span key={m} className="bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md text-[8px] font-black tracking-widest border border-white/5 uppercase opacity-60">{m}</span>)}
                              </div>
                           </div>
                           
                           <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
                              {report.dailyHistory.find(d => d.date === selectedDate)?.modelBreakdown.map((m, mIdx) => (
                                <motion.div 
                                  key={mIdx}
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: mIdx * 0.1 }}
                                  className="glass-card p-6 rounded-3xl border-slate-800 bg-white/[0.01] hover:bg-white/[0.02] transition-colors group"
                                >
                                   <div className="flex justify-between items-center mb-6">
                                      <div className="flex items-center gap-3">
                                         <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black text-lg shadow-xl shadow-indigo-600/20">
                                            {m.name.charAt(0)}
                                         </div>
                                         <div className="flex flex-col">
                                            <span className="text-white font-black text-lg uppercase tracking-tight leading-none">{m.name}</span>
                                            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Profit Distribution</span>
                                         </div>
                                      </div>
                                      <div className="flex flex-col items-end">
                                         <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Model Day Gross</span>
                                         <span className="text-2xl font-black font-mono text-white tracking-tighter leading-none">${m.gross.toFixed(0)}</span>
                                      </div>
                                   </div>
                                   
                                   <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                      <DetailBox pill="OnlyFans" gross={m.ofG} net={m.ofN} rate={m.ofR} color="indigo" />
                                      <DetailBox pill="PayPal" gross={m.ppG} net={m.ppN} rate={m.ppR} color="sky" />
                                      <DetailBox pill="Crypto" gross={m.crG} net={m.crN} rate={m.crR} color="emerald" />
                                   </div>

                                   <div className="mt-6 pt-6 border-t border-white/[0.05] flex justify-between items-center">
                                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Итог по модели:</span>
                                      <div className="flex flex-col items-end">
                                         <span className="text-xl font-black font-mono text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.3)]">${m.net.toFixed(1)}</span>
                                      </div>
                                   </div>
                                </motion.div>
                              ))}
                           </div>
                        </div>
                      ) : (
                        <div className="text-center opacity-30 select-none pointer-events-none">
                           <ICONS.Reports size={64} className="mx-auto mb-4 text-slate-700" />
                           <h3 className="font-black uppercase tracking-[0.3em] text-slate-500">Выберите дату</h3>
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
                   <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 via-transparent to-emerald-500/10 blur-[100px] -z-10 group-hover:opacity-100 opacity-60 transition-opacity animate-pulse"></div>
                   <div className="glass-card p-10 rounded-[3rem] border-white/5 bg-slate-900/40 shadow-2xl relative overflow-hidden flex flex-col h-full border-t-white/10">
                      
                      <div className="flex justify-between items-center mb-10">
                         <div className="flex flex-col">
                            <h3 className="text-2xl font-black font-outfit text-white leading-none">Финальный чек</h3>
                            <span className="text-[9px] font-black tracking-[0.3em] uppercase text-slate-500 mt-2">Staff Settlement v1.4</span>
                         </div>
                         <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center text-slate-400 border border-white/5">
                            <ICONS.Salary size={24} />
                         </div>
                      </div>

                      <div className="space-y-6 flex-grow">
                         <div className="flex items-center gap-4 group/item">
                           <div className="w-1 h-8 bg-emerald-500/30 rounded-full transition-all group-hover/item:h-12 group-hover/item:bg-emerald-500"></div>
                           <div className="flex-1">
                              <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Базовое Начисление</p>
                              <div className="flex justify-between items-end">
                                 <span className="text-sm font-black text-white uppercase tracking-tight">Чистая ЗП (Net)</span>
                                 <span className="text-xl font-black font-mono text-white">${report.totalNetto.toFixed(1)}</span>
                              </div>
                           </div>
                         </div>

                         <div className="space-y-4 pt-4 border-t border-white/[0.03]">
                            <SummaryLine label="Авансы & Выплаты" val={report.adjustmentGroups.advance + report.adjustmentGroups.salary} type="minus" />
                            <SummaryLine label="Штрафы / Нарушения" val={report.adjustmentGroups.penalty} type="minus" />
                            <SummaryLine label="Бонусы & Премии" val={report.adjustmentGroups.bonus} type="plus" />
                            <SummaryLine label="Стажировка" val={report.adjustmentGroups.internship} type="minus" />
                         </div>

                         <div className="mt-4 p-4 rounded-2xl bg-white/[0.02] border border-white/5 border-dashed">
                            <p className="text-[8px] text-slate-500 font-bold uppercase tracking-widest text-center leading-relaxed">
                              *Система автоматически учла возвраты (${report.adjustmentGroups.refund.toFixed(0)}) как списание с выручки по среднему курсу комиссии
                            </p>
                         </div>
                      </div>

                      <div className="mt-12 pt-8 border-t-2 border-indigo-500/20 border-dashed relative">
                         <div className="absolute -top-1 left-0 right-0 flex justify-center">
                            <div className="px-3 py-1 bg-indigo-500 text-white rounded-full text-[8px] font-black uppercase tracking-widest transform -translate-y-1/2 shadow-xl shadow-indigo-500/30">Total Balance</div>
                         </div>
                         <div className="flex flex-col items-center">
                            <span className="text-[10px] font-black text-indigo-400/50 uppercase tracking-[0.4em] mb-2">К выплате на руки</span>
                            <div className="relative group/val">
                               <div className="absolute inset-x-0 bottom-1 h-3 bg-indigo-500/20 blur-xl opacity-0 group-hover/val:opacity-100 transition-opacity"></div>
                               <span className="text-5xl font-black font-mono text-indigo-400 tracking-tighter drop-shadow-2xl relative">
                                  ${report.finalBalance.toLocaleString(undefined, { minimumFractionDigits: 1 })}
                               </span>
                            </div>
                         </div>
                      </div>
                   </div>
                </motion.div>

                {/* WALLET SECTION */}
                <div className="glass-card p-10 rounded-[3rem] border-slate-800 bg-slate-900/30 shadow-xl space-y-6 relative border-t-white/5">
                   <div className="flex justify-between items-center">
                      <div className="flex flex-col">
                        <h3 className="text-lg font-black font-outfit text-white uppercase tracking-tight leading-none">Реквизиты</h3>
                        <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest mt-1">Payment Endpoint</span>
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
                         <div className="relative group">
                            <input 
                               type="text" 
                               className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-6 py-5 text-sm text-white font-mono outline-none focus:border-indigo-500/50 transition-all pr-14 placeholder:opacity-20"
                               placeholder={report.wallet?.method === 'card' ? 'XXXX XXXX XXXX XXXX' : 'T... (Network: TRC20)'}
                               value={report.wallet?.address || ''}
                               onChange={e => updateWallet(e.target.value, report.wallet?.method || 'usdt_trc20')}
                            />
                            {report.wallet?.address && (
                              <button 
                                onClick={() => { 
                                  navigator.clipboard.writeText(report.wallet!.address); 
                                  const btn = document.getElementById('copy-wallet-btn');
                                  if(btn) btn.innerHTML = 'COPIED';
                                  setTimeout(() => { if(btn) btn.innerHTML = 'COPY'; }, 2000);
                                }}
                                className="absolute right-4 top-1/2 -translate-y-1/2 bg-slate-900 border border-slate-800 rounded-lg p-2 text-[8px] font-black text-slate-500 hover:text-indigo-400 hover:border-indigo-500/50 transition-colors uppercase tracking-widest"
                                id="copy-wallet-btn"
                              >
                                COPY
                              </button>
                            )}
                         </div>
                         {report.wallet?.updatedAt && (
                           <div className="text-[7px] text-slate-700 font-bold uppercase tracking-widest text-right mt-2 flex items-center justify-end gap-1 opacity-50">
                             <div className="w-1 h-1 rounded-full bg-slate-700"></div>
                             Last Updated: {new Date(report.wallet.updatedAt).toLocaleDateString()}
                           </div>
                         )}
                      </div>
                   </div>
                </div>
             </div>
          </section>

          {/* FULL HISTORY SECTION */}
          <section className="glass-card rounded-[2.5rem] overflow-hidden border-slate-800 shadow-2xl">
             <div className="p-8 border-b border-slate-800 bg-slate-900/40 flex justify-between items-center relative overflow-hidden">
                <div className="absolute left-0 bottom-0 top-0 w-1 bg-indigo-500"></div>
                <div>
                   <h2 className="font-black font-outfit text-xl text-white tracking-tight uppercase">Лента всех операций</h2>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Полный аудит активности за период</p>
                </div>
                <div className="flex items-center gap-4">
                   <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                      <span className="text-[9px] font-black text-slate-600 uppercase">Income</span>
                   </div>
                   <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                      <span className="text-[9px] font-black text-slate-600 uppercase">System OP</span>
                   </div>
                </div>
             </div>
             <div className="overflow-x-auto max-h-[600px] custom-scrollbar">
                <table className="w-full text-left text-sm whitespace-nowrap border-separate border-spacing-0">
                   <thead>
                      <tr className="bg-slate-900/50 text-slate-500 font-black text-[9px] uppercase tracking-[0.2em] border-b border-slate-800 sticky top-0 z-10">
                         <th className="px-10 py-6">Timeline</th>
                         <th className="px-10 py-6">Event Details</th>
                         <th className="px-10 py-6 text-right">Value Entry ($)</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-white/[0.03]">
                      {report.fullHistory.map((item, idx) => (
                         <motion.tr 
                            key={item.id}
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.02 }}
                            className="hover:bg-white/[0.02] group transition-all"
                         >
                            <td className="px-10 py-5">
                               <div className="flex flex-col">
                                  <span className="font-mono text-slate-500 text-[11px] font-black">{item.date.split('-').reverse().join('.')}</span>
                                  <span className="text-[9px] font-black uppercase text-slate-700 tracking-tighter">Verified</span>
                               </div>
                            </td>
                            <td className="px-10 py-5">
                               <div className="flex items-center gap-4">
                                  <div className={`w-3 h-3 rounded-full shrink-0 ${item.type === 'income' ? 'bg-emerald-500/40 shadow-[0_0_12px_rgba(16,185,129,0.3)]' : 'bg-indigo-500/40 shadow-[0_0_12px_rgba(99,102,241,0.3)]'}`}></div>
                                  <div className="flex flex-col">
                                     <span className="font-black text-white text-[15px] tracking-tight group-hover:text-indigo-400 transition-colors uppercase">{item.label}</span>
                                     {item.type === 'op' && (item.raw as OperationRecord).comment && (
                                        <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest line-clamp-1">{(item.raw as OperationRecord).comment}</span>
                                     )}
                                  </div>
                               </div>
                            </td>
                            <td className="px-10 py-5 text-right">
                               <div className="flex items-center justify-end gap-8">
                                  <div className={`flex flex-col items-end leading-none ${['income', 'bonus', 'internship'].includes((item as any).opType) || item.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                     <span className="text-xl font-black font-mono tracking-tighter">
                                        {['income', 'bonus', 'internship'].includes((item as any).opType) || item.type === 'income' ? '+' : '-'}{item.amount.toFixed(2)}
                                     </span>
                                     <span className="text-[8px] font-black uppercase opacity-40 mt-1">Processed</span>
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0 px-2 bg-slate-900 border border-slate-800 rounded-xl py-1 shadow-2xl">
                                     <button onClick={() => item.type === 'income' ? setEditingIncome(item.raw as any) : setEditingOperation(item.raw as any)} className="text-slate-500 hover:text-indigo-400 p-2 rounded-lg transition-all active:scale-90" title="Edit"><ICONS.Edit size={16}/></button>
                                     <div className="w-px h-6 bg-slate-800 mx-1"></div>
                                     <button onClick={() => deleteRecord({type: item.type, id: item.id})} className="text-slate-500 hover:text-rose-500 p-2 rounded-lg transition-all active:scale-90" title="Delete"><ICONS.Trash size={16}/></button>
                                  </div>
                               </div>
                            </td>
                         </motion.tr>
                      ))}
                      {report.fullHistory.length === 0 && (
                        <tr>
                          <td colSpan={3} className="px-10 py-20 text-center">
                             <span className="text-[10px] font-black text-slate-700 uppercase tracking-[0.5em]">No operations recorded for this period</span>
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
  <div className={`glass-card p-8 rounded-[2.5rem] border transition-all duration-300 relative overflow-hidden group ${highlighted ? 'border-indigo-500/40 bg-indigo-500/10 shadow-2xl shadow-indigo-500/10' : 'border-white/5 hover:border-slate-700'}`}>
    <div className={`absolute -right-4 -bottom-4 w-16 h-16 blur-2xl rounded-full opacity-20 transition-transform duration-700 group-hover:scale-150 ${color === 'indigo' ? 'bg-indigo-500' : 'bg-emerald-500'}`}></div>
    <div className="flex flex-col gap-4 relative z-10">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-transform group-hover:scale-110 ${highlighted ? 'bg-indigo-500 text-white' : `bg-${color}-500/10 text-${color}-400`}`}>
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] leading-none mb-2">{title}</p>
        <p className={`text-2xl font-black font-outfit tracking-tight ${highlighted ? 'text-white' : `text-${color}-400`}`}>${value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</p>
      </div>
    </div>
  </div>
);

const PlatformPill = ({ label, gross, net, color, icon }: { label: string, gross: number, net: number, color: string, icon: React.ReactNode }) => (
  <div className="glass-card p-6 rounded-[2rem] border-white/5 bg-white/[0.01] hover:bg-white/[0.03] transition-all border group">
    <div className="flex items-center gap-3 mb-4">
       <div className={`w-8 h-8 rounded-lg flex items-center justify-center border transition-all duration-300 group-hover:scale-110 ${color === 'indigo' ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-400' : color === 'sky' ? 'bg-sky-500/10 border-sky-500/30 text-sky-400' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'}`}>
          {icon}
       </div>
       <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{label}</span>
    </div>
    <div className="flex flex-col group/val">
       <div className="flex items-center gap-1.5 opacity-60">
          <span className="text-[8px] font-black uppercase text-slate-600">B:</span>
          <span className="text-xs text-slate-400 font-mono font-black">${gross.toFixed(1)}</span>
       </div>
       <div className="flex items-center gap-1.5 mt-1">
          <span className="text-[10px] font-black uppercase text-slate-500">H:</span>
          <span className={`text-lg font-black font-mono transition-colors drop-shadow-sm ${color === 'indigo' ? 'text-white group-hover:text-indigo-400' : color === 'sky' ? 'text-white group-hover:text-sky-400' : 'text-white group-hover:text-emerald-400'}`}>${net.toFixed(1)}</span>
       </div>
    </div>
  </div>
);

const DetailBox = ({ pill, gross, net, rate, color }: { pill: string, gross: number, net: number, rate: string, color: string }) => {
  const colorMap: any = {
    indigo: 'from-indigo-500/20 to-indigo-500/5 border-indigo-500/20 text-indigo-400',
    sky: 'from-sky-500/20 to-sky-500/5 border-sky-500/20 text-sky-400',
    emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/20 text-emerald-400'
  };
  return (
    <div className={`p-4 rounded-2xl border bg-gradient-to-br ${colorMap[color]}`}>
       <div className="flex justify-between items-center mb-3">
          <span className="text-[9px] font-black uppercase tracking-widest opacity-60">{pill}</span>
          <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded-lg bg-white/5 border border-white/5">{rate}</span>
       </div>
       <div className="flex flex-col">
          <div className="flex items-center gap-1 opacity-50">
             <span className="text-[8px] font-bold uppercase tracking-widest text-slate-400">B:</span>
             <span className="text-xs font-mono font-bold text-slate-300">${gross.toFixed(0)}</span>
          </div>
          <div className="flex items-center gap-1">
             <span className="text-[10px] font-black uppercase tracking-widest text-slate-200">H:</span>
             <span className="text-lg font-black font-mono text-white">${net.toFixed(1)}</span>
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
  <div className="flex items-center justify-between group/line">
     <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full transition-all group-hover/line:scale-150 ${type === 'plus' ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
        <span className="text-slate-500 font-black text-[10px] uppercase tracking-wider">{label}</span>
     </div>
     <span className={`font-mono font-black text-[15px] ${type === 'plus' ? 'text-emerald-400' : 'text-rose-400'}`}>
       {type === 'plus' ? '+' : '-'}${val.toFixed(1)}
     </span>
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
