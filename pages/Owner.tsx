
import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppState, OwnerManualExpense, OwnerManualIncome, OwnerAdvance, Platform, OperationRecord } from '../types';
import { ICONS } from '../constants';
import PeriodBadge from '../components/PeriodBadge';

interface OwnerProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const Owner: React.FC<OwnerProps> = ({ state, updateState }) => {
  const CATEGORIES = useMemo(() => ({
    traffic: { label: 'Трафик', icon: ICONS.ChevronRight, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    infra: { label: 'Инфраструктура', icon: ICONS.Settings, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
    items: { label: 'Покупки', icon: ICONS.Gift, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
    commission: { label: 'Комиссия', icon: ICONS.Income, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
    bonus: { label: 'Бонусы', icon: ICONS.Bonus, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    other: { label: 'Прочее', icon: ICONS.Reports, color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' }
  }), []);

  const [expenseCategory, setExpenseCategory] = useState<keyof typeof CATEGORIES>('traffic');
  const [expensePlatform] = useState<Platform>('onlyFans');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseComment, setExpenseComment] = useState('');
  const [expenseFilter, setExpenseFilter] = useState<keyof typeof CATEGORIES | 'all'>('all');
  const [expenseSearch, setExpenseSearch] = useState('');

  const [incomeAmount, setIncomeAmount] = useState('');
  const [incomePlatform, setIncomePlatform] = useState<Platform | 'all'>('all');
  const [incomeComment, setIncomeComment] = useState('');

  const [advanceOwner, setAdvanceOwner] = useState<'Andrey' | 'Anton'>('Andrey');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceComment, setAdvanceComment] = useState('');

  const [adminPaidInputs, setAdminPaidInputs] = useState<Record<string, string>>({});

  const activePeriodId = state.selectedPeriodId;
  const activePeriod = state.accountingPeriods.find(p => p.id === activePeriodId)!;
  const currentModels = activePeriod.models || state.models;
  const currentAdmins = activePeriod.admins || state.admins;
  const currentRates = activePeriod.modelRates || state.modelRates;

  const stats = useMemo(() => {
    const incomes = state.incomeData.filter(r => r.periodId === activePeriodId);
    const manualIncomes = (state.ownerManualIncomes || []).filter(i => i.periodId === activePeriodId);
    const ops = state.operationsData.filter(o => o.periodId === activePeriodId);
    const modelBonuses = (state.modelBonuses || []).filter(b => b.periodId === activePeriodId);
    
    const rawPlatformGross = incomes.reduce((sum, r) => sum + r.total, 0);
    const manualGross = manualIncomes.reduce((sum, i) => sum + i.amount, 0);
    const totalRefundAmount = ops.filter(o => o.type === 'refund').reduce((s, o) => s + o.amount, 0);

    const grossTotal = (rawPlatformGross + manualGross) - totalRefundAmount;

    // 1. ОПЕРАТОРЫ (STAFF)
    const rawStaffNet = incomes.reduce((sum, r) => sum + (r.nettoOF + r.nettoPP + r.nettoCrypto), 0);
    const avgOpRate = rawPlatformGross > 0 ? rawStaffNet / rawPlatformGross : 0.20;
    
    const staffAccrued = (rawStaffNet - (totalRefundAmount * avgOpRate)) + ops.reduce((sum, o) => {
      if (!o.model && !currentAdmins.some(a => a.name === o.operator)) {
        if (o.type === 'bonus') return sum + o.amount;
        if (['penalty', 'internship'].includes(o.type)) return sum - o.amount;
      }
      return sum;
    }, 0);

    const staffPaid = ops.reduce((sum, o) => {
      if (!o.model && !currentAdmins.some(a => a.name === o.operator)) {
        if (['advance', 'salary_payment'].includes(o.type)) return sum + o.amount;
      }
      return sum;
    }, 0);

    // 2. МОДЕЛИ
    const modelSummary = currentModels.reduce((acc, model) => {
      const records = incomes.filter(r => r.model === model);
      const mOF = records.reduce((s, r) => s + r.onlyFans, 0) * (currentRates.of / 100);
      const mPP = records.reduce((s, r) => s + r.paypal, 0) * (currentRates.pp / 100);
      const mCR = records.reduce((s, r) => s + r.crypto, 0) * (currentRates.cr / 100);
      const mRefunds = ops.filter(o => o.type === 'refund' && o.model === model).reduce((s,o) => s + o.amount, 0);
      const mAdvances = ops.filter(o => o.type === 'advance' && o.model === model).reduce((s,o) => s + o.amount, 0);
      const mSalaries = ops.filter(o => o.type === 'salary_payment' && o.model === model).reduce((s,o) => s + o.amount, 0);
      const mBonuses = modelBonuses.filter(b => b.model === model).reduce((s,b) => s+b.amount, 0);
      const mAvgRate = records.length > 0 ? (mOF + mPP + mCR) / records.reduce((s,r) => s+r.total, 1) : (currentRates.of / 100);
      
      const accrued = (mOF + mPP + mCR + mBonuses) - (mRefunds * mAvgRate);
      acc.accrued += accrued;
      acc.paid += (mAdvances + mSalaries);
      return acc;
    }, { accrued: 0, paid: 0 });

    // 3. АДМИНЫ
    const adminDetails = currentAdmins.map(admin => {
      const accrued = grossTotal * (admin.rate / 100);
      const paid = ops.filter(o => o.operator === admin.name && !o.model && ['salary_payment', 'advance'].includes(o.type)).reduce((s, o) => s + o.amount, 0);
      return { ...admin, accrued, paid, remainder: accrued - paid };
    });

    const totalAdminAccrued = adminDetails.reduce((s, a) => s + a.accrued, 0);
    const totalAdminPaid = adminDetails.reduce((s, a) => s + a.paid, 0);

    const currentExpenses = (state.ownerExpenses || []).filter(e => e.periodId === activePeriodId);
    const bizExpenses = currentExpenses.reduce((s,e) => s + e.amount, 0);
    
    // Чистая прибыль
    const netProfitTotal = grossTotal - (staffAccrued + modelSummary.accrued + totalAdminAccrued + bizExpenses);
    const sharePerOwner = netProfitTotal / 2;

    const totalPaidGlobal = staffPaid + modelSummary.paid + totalAdminPaid;
    const totalRemainderGlobal = (staffAccrued - staffPaid) + (modelSummary.accrued - modelSummary.paid) + (totalAdminAccrued - totalAdminPaid);

    return { 
      grossTotal, rawPlatformGross, manualGross, totalRefundAmount,
      netProfitTotal, sharePerOwner,
      staffAccrued, staffPaid, staffRemainder: staffAccrued - staffPaid,
      modelAccrued: modelSummary.accrued, modelPaid: modelSummary.paid, modelRemainder: modelSummary.accrued - modelSummary.paid,
      adminAccrued: totalAdminAccrued, adminPaid: totalAdminPaid, adminRemainder: totalAdminAccrued - totalAdminPaid,
      adminDetails,
      totalPaidGlobal, totalRemainderGlobal,
      bizExpenses,
      currentExpenses,
      currentManualIncomes: (state.ownerManualIncomes || []).filter(i => i.periodId === activePeriodId),
      currentOwnerAdvances: (state.ownerAdvances || []).filter(a => a.periodId === activePeriodId),
      andrey: { totalShare: sharePerOwner, advances: (state.ownerAdvances || []).filter(a => a.periodId === activePeriodId && a.ownerName === 'Andrey').reduce((s, a) => s + a.amount, 0) },
      anton: { totalShare: sharePerOwner, advances: (state.ownerAdvances || []).filter(a => a.periodId === activePeriodId && a.ownerName === 'Anton').reduce((s, a) => s + a.amount, 0) },
    };
  }, [state, activePeriodId, currentModels, currentAdmins, currentRates]);

  const addAdminPayment = (adminName: string) => {
    const val = parseFloat(adminPaidInputs[adminName]) || 0;
    if (val <= 0) return;
    const newOp: OperationRecord = {
      id: `admin-pay-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      type: 'salary_payment', operator: adminName, amount: val, comment: 'Выплата админу',
      date: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), periodId: activePeriodId
    };
    updateState(prev => ({ ...prev, operationsData: [newOp, ...prev.operationsData] }));
    setAdminPaidInputs(prev => ({ ...prev, [adminName]: '' }));
  };

  const addBusinessExpense = () => {
    const amt = parseFloat(expenseAmount);
    if (isNaN(amt) || amt <= 0) return;
    const expense: OwnerManualExpense = {
      id: `exp-${Date.now()}`, periodId: activePeriodId, category: expenseCategory, platform: 'crypto', amount: amt, comment: expenseComment,
      date: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    updateState(prev => ({ ...prev, ownerExpenses: [expense, ...(prev.ownerExpenses || [])] }));
    setExpenseAmount(''); setExpenseComment('');
  };

  const addExtraIncome = () => {
    const amt = parseFloat(incomeAmount);
    if (isNaN(amt) || amt <= 0) return;
    const income: OwnerManualIncome = {
      id: `inc-${Date.now()}`, periodId: activePeriodId, platform: incomePlatform, amount: amt, comment: incomeComment,
      date: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    updateState(prev => ({ ...prev, ownerManualIncomes: [income, ...(prev.ownerManualIncomes || [])] }));
    setIncomeAmount(''); setIncomeComment('');
  };

  const addOwnerAdvance = () => {
    const amt = parseFloat(advanceAmount);
    if (isNaN(amt) || amt <= 0) return;
    const advance: OwnerAdvance = {
      id: `adv-${Date.now()}`, periodId: activePeriodId, ownerName: advanceOwner, platform: 'crypto', amount: amt, comment: advanceComment,
      date: new Date().toISOString().split('T')[0], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
    };
    updateState(prev => ({ ...prev, ownerAdvances: [advance, ...(prev.ownerAdvances || [])] }));
    setAdvanceAmount(''); setAdvanceComment('');
  };

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  } as const;

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" } }
  } as const;

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      variants={containerVariants}
      className="space-y-12 pb-24"
    >
      {/* HEADER SECTION - REFINED HIERARCHY */}
      <motion.header variants={itemVariants} className="flex flex-col md:flex-row md:items-end justify-between gap-8 pt-4">
        <div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-inner">
               <ICONS.Owner size={20} />
            </div>
            <div className="flex flex-col">
               <span className="text-[10px] font-black uppercase tracking-[0.4em] text-amber-500/60 leading-none">Management Core</span>
               <div className="h-px w-8 bg-amber-500/30 mt-1.5"></div>
            </div>
          </div>
          <div className="flex items-center gap-5">
            <h1 className="text-5xl font-black font-outfit text-white tracking-tight">Финансы</h1>
            <PeriodBadge state={state} />
          </div>
        </div>
        
        <div className="flex gap-4">
           {/* Quick Stats Summary */}
           <div className="flex flex-col items-end">
              <span className="text-[9px] font-black uppercase text-rose-500 tracking-widest">Операционные Расходы</span>
              <span className="text-2xl font-black text-rose-400 font-mono leading-none mt-1">${stats.bizExpenses.toLocaleString()}</span>
           </div>
        </div>
      </motion.header>

      {/* PRIMARY BENTO GRID - WOW EFFECT METRICS */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
         <motion.div variants={itemVariants} className="lg:col-span-8 glass-card p-10 rounded-[3rem] border-emerald-500/20 bg-gradient-to-br from-emerald-500/[0.04] to-transparent relative overflow-hidden group">
            <div className="absolute top-0 right-0 -mr-16 -mt-16 w-96 h-96 bg-emerald-500/5 blur-[100px] rounded-full group-hover:bg-emerald-500/10 transition-all duration-1000"></div>
            
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
               <div>
                  <div className="flex items-center gap-2 mb-4">
                     <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                     <p className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-500/70">Чистая Выручка Периода</p>
                  </div>
                  <h2 className="text-7xl font-black font-outfit text-white tracking-tighter leading-none mb-6">
                     ${stats.netProfitTotal.toLocaleString(undefined, { minimumFractionDigits: 0 })}
                  </h2>
                  <p className="text-xs text-slate-400 font-bold uppercase tracking-[0.2em] leading-relaxed max-w-xs">
                     Финальный баланс партнерства после всех обязательств и выплат
                  </p>
               </div>

               <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                     <div className="p-6 rounded-[2.5rem] bg-amber-500/[0.03] border border-amber-500/10 group/item transition-all hover:bg-amber-500/[0.05]">
                        <div className="flex items-center gap-2 mb-3">
                           <div className="w-1.5 h-1.5 rounded-full bg-amber-500"></div>
                           <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest">Andrey</span>
                        </div>
                        <p className="text-3xl font-black font-mono text-white tracking-tighter">${(stats.andrey.totalShare - stats.andrey.advances).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        <p className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter mt-1">Остаток: -${stats.andrey.advances.toLocaleString()}</p>
                     </div>
                     <div className="p-6 rounded-[2.5rem] bg-indigo-500/[0.03] border border-indigo-500/10 group/item transition-all hover:bg-indigo-500/[0.05]">
                        <div className="flex items-center gap-2 mb-3">
                           <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                           <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Anton</span>
                        </div>
                        <p className="text-3xl font-black font-mono text-white tracking-tighter">${(stats.anton.totalShare - stats.anton.advances).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                        <p className="text-[8px] font-bold text-slate-600 uppercase tracking-tighter mt-1">Остаток: -${stats.anton.advances.toLocaleString()}</p>
                     </div>
                  </div>
               </div>
            </div>
         </motion.div>

         <motion.div variants={itemVariants} className="lg:col-span-4 flex flex-col gap-6">
            <div className="flex-1 glass-card p-8 rounded-[3rem] border-rose-500/20 bg-rose-500/[0.02] flex flex-col justify-center relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-32 h-32 bg-rose-500/5 blur-3xl group-hover:bg-rose-500/10 transition-all duration-700"></div>
               <div className="relative z-10">
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500 mb-2">Общий вал (OF/PP)</p>
                  <p className="text-4xl font-black font-outfit text-white tracking-tighter">${stats.grossTotal.toLocaleString()}</p>
               </div>
            </div>
            <div className="flex-1 glass-card p-8 rounded-[3rem] border-slate-800 bg-slate-900/10 flex flex-col justify-center group">
               <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500 mb-2">Операционные траты</p>
               <p className="text-4xl font-black font-outfit text-rose-400 tracking-tighter">-${stats.bizExpenses.toLocaleString()}</p>
            </div>
         </motion.div>
      </section>

      {/* PAYROLL INFRASTRUCTURE AUDIT - SYSTEM OVERSIGHT */}
      <motion.section variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="glass-card p-8 rounded-[2.5rem] border-indigo-500/10 bg-indigo-500/[0.02] relative overflow-hidden group">
            <div className="flex items-center gap-3 mb-6">
               <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                  <ICONS.Owner size={18} />
               </div>
               <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">ЗП Админов</h3>
               </div>
            </div>
            <PayrollTracker label="Заработано" accrued={stats.adminAccrued} paid={stats.adminPaid} color="indigo" />
         </div>

         <div className="glass-card p-8 rounded-[2.5rem] border-emerald-500/10 bg-emerald-500/[0.02] relative overflow-hidden group">
            <div className="flex items-center gap-3 mb-6">
               <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <ICONS.Income size={18} />
               </div>
               <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">ЗП Моделей</h3>
               </div>
            </div>
            <PayrollTracker label="Заработано" accrued={stats.modelAccrued} paid={stats.modelPaid} color="emerald" />
         </div>

         <div className="glass-card p-8 rounded-[2.5rem] border-sky-500/10 bg-sky-500/[0.02] relative overflow-hidden group">
            <div className="flex items-center gap-3 mb-6">
               <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400">
                  <ICONS.Users size={18} />
               </div>
               <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">ЗП Операторов</h3>
               </div>
            </div>
            <PayrollTracker label="Заработано" accrued={stats.staffAccrued} paid={stats.staffPaid} color="sky" />
         </div>
      </motion.section>

      {/* OPERATIONS WORKSPACE - THE HEART OF THE PAGE */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
         
         {/* LEFT COLUMN: MAIN WORKFLOW (EXPENSES & HISTORY) */}
         <div className="lg:col-span-8 space-y-8">
            <InputCard 
               title="Бизнес Расходы" 
               icon={<ICONS.Penalty size={28} />} 
               color="rose"
               history={stats.currentExpenses}
               onRemove={(id: string) => updateState(p => ({...p, deletedIds: [...p.deletedIds, id], ownerExpenses: (p.ownerExpenses || []).filter(e => e.id !== id)}))}
               isExpenses
               categories={CATEGORIES}
               stats={stats}
               fullWidth
            >
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-1">
                     <InputGroup label="Категория">
                        <select className="modern-input font-bold h-16 text-lg" value={expenseCategory} onChange={e => setExpenseCategory(e.target.value as any)}>
                           {Object.entries(CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                     </InputGroup>
                  </div>
                  <div className="md:col-span-1">
                     <InputGroup label="Сумма ($)">
                        <input type="number" className="modern-input font-mono h-16 text-2xl font-black" placeholder="0" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} />
                     </InputGroup>
                  </div>
                  <div className="md:col-span-1 flex flex-col justify-end">
                     <button onClick={addBusinessExpense} className="h-16 w-full rounded-[1.5rem] bg-rose-600 hover:bg-rose-500 text-white font-black uppercase tracking-widest text-xs shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2 group/btn">
                        <span>Зафиксировать</span>
                        <ICONS.Plus size={18} className="group-hover/btn:rotate-90 transition-transform" />
                     </button>
                  </div>
                  <div className="md:col-span-3">
                     <InputGroup label="Заметка / Комментарий">
                        <input type="text" className="modern-input h-14" placeholder="На что именно потрачено?.." value={expenseComment} onChange={e => setExpenseComment(e.target.value)} />
                     </InputGroup>
                  </div>
               </div>
            </InputCard>

            {/* MANAGEMENT STRIP: ADMIN PAYROLL */}
            <motion.div variants={itemVariants} className="glass-card p-8 rounded-[3.5rem] border-indigo-500/10 bg-[#08090c] shadow-2xl relative overflow-hidden group">
               <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[80px] rounded-full group-hover:bg-indigo-500/10 transition-all duration-1000"></div>
               
               <div className="flex items-center justify-between mb-8 relative z-10">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-lg">
                        <ICONS.Owner size={22} />
                     </div>
                     <div>
                        <h3 className="text-2xl font-black font-outfit text-white tracking-tight uppercase">Control Hub</h3>
                        <p className="text-[9px] font-black tracking-[0.3em] text-slate-500 uppercase mt-1">Ведомость Админов</p>
                     </div>
                  </div>
                  <div className="flex flex-col items-end">
                     <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-1">System Remainder</span>
                     <span className="text-2xl font-black text-indigo-400 font-mono tracking-tighter">${stats.adminRemainder.toLocaleString()}</span>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative z-10">
                  {stats.adminDetails.map(admin => (
                     <div key={admin.id} className="p-6 rounded-[2.5rem] bg-indigo-500/[0.02] border border-white/5 hover:border-indigo-500/20 transition-all group/admin shadow-xl">
                        <div className="flex justify-between items-center mb-4">
                           <div className="flex items-center gap-2">
                              <div className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]"></div>
                              <span className="text-sm font-black text-white">{admin.name}</span>
                           </div>
                           <span className="text-[10px] font-black text-indigo-500/80 bg-indigo-500/10 px-2 py-0.5 rounded-lg">{admin.rate}%</span>
                        </div>
                        
                        <div className="flex items-end justify-between mb-4">
                           <div className="flex flex-col">
                              <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest">К выплате</span>
                              <span className="text-xl font-black text-white font-mono tracking-tighter">${admin.remainder.toFixed(0)}</span>
                           </div>
                        </div>

                        <div className="flex gap-2 p-1 bg-black/40 rounded-2xl border border-white/5 focus-within:border-indigo-500/50 transition-all">
                           <input 
                              type="number" 
                              className="flex-1 bg-transparent px-3 py-2 text-xs text-white font-mono outline-none placeholder:text-slate-700 w-full" 
                              placeholder="0.00"
                              value={adminPaidInputs[admin.name] || ''}
                              onChange={e => setAdminPaidInputs(prev => ({...prev, [admin.name]: e.target.value}))}
                           />
                           <button onClick={() => addAdminPayment(admin.name)} className="w-10 h-10 rounded-xl bg-indigo-600 hover:bg-indigo-50 text-white hover:text-indigo-600 transition-all flex items-center justify-center shadow-lg shadow-indigo-600/20">
                              <ICONS.Plus size={16} />
                           </button>
                        </div>
                     </div>
                  ))}
               </div>
            </motion.div>
         </div>

          {/* RIGHT COLUMN: SECONDARY ACTIONS (INCOME & ADVANCES) */}
          <div className="lg:col-span-4 space-y-8">
             <InputCard 
                title="Внести доход" 
                icon={<ICONS.Income size={28} />} 
                color="emerald"
                history={stats.currentManualIncomes}
                onRemove={(id: string) => updateState(p => ({...p, deletedIds: [...p.deletedIds, id], ownerManualIncomes: p.ownerManualIncomes?.filter(i => i.id !== id)}))}
             >
                <div className="space-y-6">
                   <div className="bg-black/20 p-6 rounded-[2rem] border border-white/5 shadow-inner">
                      <InputGroup label="Сумма получения ($)">
                         <div className="relative">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-emerald-500/50 font-mono">$</span>
                            <input type="number" className="modern-input font-mono pl-12 text-3xl font-black h-20 bg-transparent border-none shadow-none focus:ring-0" placeholder="0.00" value={incomeAmount} onChange={e => setIncomeAmount(e.target.value)} />
                         </div>
                      </InputGroup>
                   </div>

                   <InputGroup label="Кошелек / Назначение">
                      <div className="grid grid-cols-1 gap-2">
                         <select className="modern-input font-bold text-sm h-14 bg-black/40" value={incomePlatform} onChange={e => setIncomePlatform(e.target.value as any)}>
                            <option value="all">Общий счет / Master Card</option>
                            <option value="onlyFans">OnlyFans Global</option>
                            <option value="paypal">PayPal Merchant</option>
                            <option value="crypto">Crypto Wallet (USDT)</option>
                         </select>
                      </div>
                   </InputGroup>

                   <InputGroup label="Комментарий">
                      <input type="text" className="modern-input h-14 bg-black/40" placeholder="Источник дохода..." value={incomeComment} onChange={e => setIncomeComment(e.target.value)} />
                   </InputGroup>

                   <button onClick={addExtraIncome} className="btn-primary h-16 bg-emerald-600 hover:bg-emerald-500 text-white font-black shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                      <span>Зафиксировать Доход</span>
                      <ICONS.Plus size={18} className="ml-2" />
                   </button>
                </div>
             </InputCard>

             <InputCard 
                title="Личный Аванс" 
                icon={<ICONS.Salary size={28} />} 
                color="amber"
                history={stats.currentOwnerAdvances}
                onRemove={(id: string) => updateState(p => ({...p, deletedIds: [...p.deletedIds, id], ownerAdvances: (p.ownerAdvances || []).filter(a => a.id !== id)}))}
                isOwner
             >
                <div className="space-y-6">
                   <div className="flex p-1.5 bg-black/40 rounded-[1.5rem] border border-white/5">
                       <button onClick={() => setAdvanceOwner('Andrey')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-500 ${advanceOwner === 'Andrey' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/40' : 'text-slate-600 hover:text-slate-400'}`}>Andrey</button>
                       <button onClick={() => setAdvanceOwner('Anton')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-500 ${advanceOwner === 'Anton' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40' : 'text-slate-600 hover:text-slate-400'}`}>Anton</button>
                   </div>

                   <div className="bg-black/20 p-6 rounded-[2rem] border border-white/5 shadow-inner">
                      <InputGroup label="Сумма Аванса ($)">
                         <div className="relative">
                            <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-black text-amber-500/50 font-mono">$</span>
                            <input type="number" className="modern-input font-mono pl-12 text-3xl font-black h-20 bg-transparent border-none shadow-none focus:ring-0" placeholder="0" value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)} />
                         </div>
                      </InputGroup>
                   </div>
                   
                   <InputGroup label="Цель выплаты">
                      <input type="text" className="modern-input h-14 bg-black/40" placeholder="На личные расходы..." value={advanceComment} onChange={e => setAdvanceComment(e.target.value)} />
                   </InputGroup>

                   <button onClick={addOwnerAdvance} className="btn-primary h-16 bg-amber-600 hover:bg-amber-500 text-white font-black shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                      <span>Выдать Аванс</span>
                      <ICONS.ChevronRight size={18} className="ml-2" />
                   </button>
                </div>
             </InputCard>
          </div>
      </section>
    </motion.div>
  );
};

// --- SUBCOMPONENTS ---

const PayrollTracker = ({ label, accrued, paid, color }: any) => {
   const progress = Math.min(100, (paid / (accrued || 1)) * 100);
   const colorMap: any = {
      indigo: 'bg-indigo-500 border-indigo-500/20 text-indigo-400',
      emerald: 'bg-emerald-500 border-emerald-500/20 text-emerald-400',
      sky: 'bg-sky-500 border-sky-500/20 text-sky-400'
   };

   return (
      <div className="space-y-3 group">
         <div className="flex justify-between items-end">
            <div className="space-y-1">
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none">{label}</p>
               <h4 className="text-xl font-black text-white font-mono tracking-tighter">${accrued.toLocaleString(undefined, { maximumFractionDigits: 0 })}</h4>
            </div>
            <div className="text-right">
               <p className={`text-[8px] font-black uppercase tracking-[0.2em] mb-1 leading-none ${colorMap[color].split(' ')[2]}`}>Выплаты: {progress.toFixed(0)}%</p>
               <p className="text-[11px] font-bold text-slate-400 font-mono tracking-tighter">Ост: ${(accrued - paid).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
         </div>
         <div className="w-full h-1.5 bg-slate-900 border border-white/5 rounded-full overflow-hidden">
            <motion.div 
               initial={{ width: 0 }}
               animate={{ width: `${progress}%` }}
               transition={{ duration: 1, ease: "circOut" }}
               className={`h-full ${colorMap[color].split(' ')[0]} shadow-[0_0_10px_rgba(0,0,0,0.5)]`}
            />
         </div>
      </div>
   );
};

const InputCard = ({ title, icon, color, children, history, onRemove, titleStyle, isExpenses, categories, stats, isOwner, fullWidth }: any) => {
   const [isOpen, setIsOpen] = useState(fullWidth || false);
   const colorTheme: any = {
      emerald: {
         border: 'border-emerald-500/20',
         bg: 'bg-emerald-500/[0.02]',
         text: 'text-emerald-500',
         glow: 'bg-emerald-500/10',
         btn: 'bg-emerald-600 hover:bg-emerald-500',
         iconBg: 'bg-emerald-500/10',
         shadow: 'shadow-emerald-500/5'
      },
      rose: {
         border: 'border-rose-500/30',
         bg: 'bg-rose-500/[0.03]',
         text: 'text-rose-500',
         glow: 'bg-rose-500/10',
         btn: 'bg-rose-600 hover:bg-rose-500',
         iconBg: 'bg-rose-500/10',
         shadow: 'shadow-rose-500/10'
      },
      amber: {
         border: 'border-amber-500/20',
         bg: 'bg-amber-500/[0.02]',
         text: 'text-amber-500',
         glow: 'bg-amber-500/10',
         btn: 'bg-amber-600 hover:bg-amber-500',
         iconBg: 'bg-amber-500/10',
         shadow: 'shadow-amber-500/5'
      }
   };

   const theme = colorTheme[color];

   return (
      <div className={`glass-card p-10 rounded-[3.5rem] border ${theme.border} ${theme.bg} flex flex-col ${theme.shadow} relative overflow-hidden transition-all duration-700 group/card`}>
         <div className={`absolute top-0 right-0 w-80 h-80 ${theme.glow} blur-[120px] rounded-full -mr-40 -mt-40 transition-all duration-1000 group-hover/card:scale-110`}></div>
         
         <div className="flex justify-between items-start mb-10 relative z-10">
            <div className="flex items-center gap-5">
               <div className={`w-16 h-16 rounded-[1.75rem] flex items-center justify-center border ${theme.border} ${theme.iconBg} ${theme.text} shadow-xl backdrop-blur-md`}>
                  {icon}
               </div>
               <div>
                  <h2 className="text-3xl font-black font-outfit text-white tracking-tight leading-none">{title}</h2>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mt-2 opacity-60">{title}</p>
               </div>
            </div>
            {isExpenses && (
               <div className="flex flex-col items-end">
                  <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest mb-1">Expenses Net</span>
                  <span className="text-2xl font-black text-rose-400 font-mono tracking-tighter">-${stats.bizExpenses.toLocaleString()}</span>
               </div>
            )}
         </div>

         <div className="relative z-10">
            {children}
         </div>

         {/* History Toggle */}
         <div className="mt-10 pt-10 border-t border-white/5 relative z-10">
            <button 
               onClick={() => setIsOpen(!isOpen)}
               className="w-full flex items-center justify-between group/hist overflow-hidden"
            >
               <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-500 group-hover/hist:text-white transition-all duration-300">Operational Log</span>
                  <div className={`h-px w-10 ${theme.bg.replace('/[0.0', '/[0.1')} bg-slate-800 group-hover/hist:w-32 transition-all duration-700`}></div>
               </div>
               <div className={`transition-all duration-500 ${isOpen ? 'rotate-180 text-white' : 'text-slate-600'}`}>
                  <ICONS.ChevronDown size={20} />
               </div>
            </button>

            <AnimatePresence>
               {isOpen && (
                  <motion.div 
                     initial={{ height: 0, opacity: 0 }}
                     animate={{ height: 'auto', opacity: 1 }}
                     exit={{ height: 0, opacity: 0 }}
                     transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                     className="overflow-hidden"
                  >
                     <div className={`py-6 space-y-4 overflow-y-auto pr-3 custom-scrollbar ${fullWidth ? 'max-h-[600px]' : 'max-h-[350px]'}`}>
                        <div className={`grid gap-4 ${fullWidth ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                           {history.length === 0 ? (
                              <div className={`text-center py-16 flex flex-col items-center gap-4 ${fullWidth ? 'col-span-2' : ''}`}>
                                 <div className="w-12 h-12 rounded-full border border-white/5 flex items-center justify-center text-slate-800">
                                    <ICONS.History size={20} />
                                 </div>
                                 <p className="text-[10px] font-black uppercase tracking-[0.5em] text-slate-800">Data integrity clear. No logs.</p>
                              </div>
                           ) : (
                              history.map((item: any) => {
                                 const cat = isExpenses ? (categories?.[item.category] || categories?.other) : null;
                                 return (
                                    <motion.div 
                                       initial={{ x: -20, opacity: 0 }}
                                       animate={{ x: 0, opacity: 1 }}
                                       key={item.id} 
                                       className="bg-black/40 p-6 rounded-[2rem] border border-white/5 flex items-center justify-between group/item hover:border-white/10 transition-all hover:bg-black/60 shadow-xl"
                                    >
                                       <div className="flex items-center gap-4">
                                          <div className={`w-12 h-12 rounded-[1.25rem] flex items-center justify-center text-[12px] ${isExpenses ? cat?.color : (isOwner ? 'text-amber-400' : 'text-emerald-400')} bg-slate-900/50 border border-white/5 font-black shadow-inner backdrop-blur-sm`}>
                                             {isExpenses ? (cat?.icon ? <cat.icon size={16}/> : cat?.label?.[0]) : (isOwner ? item.ownerName?.[0] : <ICONS.Income size={16}/>)}
                                          </div>
                                          <div>
                                             <p className="text-sm font-black text-white uppercase tracking-tight leading-none mb-1">{isExpenses ? cat?.label : (isOwner ? item.ownerName : 'Общий доход')}</p>
                                             <p className="text-[9px] text-slate-500 font-bold font-mono truncate max-w-[180px] uppercase tracking-tighter">{item.comment || 'System manual entry'}</p>
                                          </div>
                                       </div>
                                       <div className="flex flex-col items-end">
                                          <div className="flex items-center gap-2">
                                             <p className={`text-lg font-black font-mono tracking-tighter ${isExpenses ? 'text-rose-400' : 'text-emerald-400'}`}>
                                                {isExpenses ? '-' : '+'}${item.amount.toLocaleString()}
                                             </p>
                                          </div>
                                          <div className="flex items-center gap-3 mt-1">
                                             <span className="text-[8px] text-slate-700 font-black uppercase tracking-widest">{item.date}</span>
                                             <button 
                                                onClick={() => { if(confirm('Удалить запись безвозвратно?')) onRemove(item.id); }}
                                                className="opacity-0 group-hover/item:opacity-100 transition-all p-2 hover:bg-rose-500/20 rounded-xl text-slate-600 hover:text-rose-500 -mr-2"
                                             >
                                                <ICONS.Trash size={14} />
                                             </button>
                                          </div>
                                       </div>
                                    </motion.div>
                                 )
                              })
                           )}
                        </div>
                     </div>
                  </motion.div>
               )}
            </AnimatePresence>
         </div>
      </div>
   );
};

const InputGroup = ({ label, children }: any) => (
   <div className="space-y-2">
      <label className="text-[9px] font-black text-slate-600 uppercase tracking-widest ml-1">{label}</label>
      {children}
   </div>
);

export default Owner;
