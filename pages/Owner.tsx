
import React, { useState, useMemo } from 'react';
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
    items: { label: 'Покупки (белье/игрушки)', icon: ICONS.Gift, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
    commission: { label: 'Комиссия', icon: ICONS.Income, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
    bonus: { label: 'Бонусы', icon: ICONS.Bonus, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    other: { label: 'Прочее', icon: ICONS.Reports, color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' }
  }), []);

  const [expenseCategory, setExpenseCategory] = useState<keyof typeof CATEGORIES>('traffic');
  const [expensePlatform, setExpensePlatform] = useState<Platform>('onlyFans');
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

  const [isIncomeModalOpen, setIsIncomeModalOpen] = useState(false);
  const [isAdvanceModalOpen, setIsAdvanceModalOpen] = useState(false);

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
      if (o.operator && !currentAdmins.some(a => a.name === o.operator)) {
        if (o.type === 'bonus') return sum + o.amount;
        if (['penalty', 'internship'].includes(o.type)) return sum - o.amount;
      }
      return sum;
    }, 0);

    const staffPaid = ops.reduce((sum, o) => {
      if (o.operator && !currentAdmins.some(a => a.name === o.operator)) {
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
      const paid = ops.filter(o => o.operator === admin.name && ['salary_payment', 'advance'].includes(o.type)).reduce((s, o) => s + o.amount, 0);
      return { ...admin, accrued, paid, remainder: accrued - paid };
    });

    const totalAdminAccrued = adminDetails.reduce((s, a) => s + a.accrued, 0);
    const totalAdminPaid = adminDetails.reduce((s, a) => s + a.paid, 0);

    const currentExpenses = state.ownerExpenses.filter(e => e.periodId === activePeriodId);
    const bizExpenses = currentExpenses.reduce((s,e) => s + e.amount, 0);
    
    const trafficTotal = currentExpenses.filter(e => e.category === 'traffic').reduce((s, e) => s + e.amount, 0);
    const commissionTotal = currentExpenses.filter(e => e.category === 'commission').reduce((s, e) => s + e.amount, 0);
    
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
      trafficTotal,
      commissionTotal,
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
      type: 'salary_payment',
      operator: adminName,
      amount: val,
      comment: 'Выплата админу',
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      periodId: activePeriodId
    };

    updateState(prev => ({ ...prev, operationsData: [newOp, ...prev.operationsData] }));
    setAdminPaidInputs(prev => ({ ...prev, [adminName]: '' }));
  };

  const addBusinessExpense = () => {
    const amt = parseFloat(expenseAmount);
    if (isNaN(amt) || amt <= 0) return;
    const expense: OwnerManualExpense = {
      id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      periodId: activePeriodId,
      category: expenseCategory,
      platform: expensePlatform,
      amount: amt,
      comment: expenseComment,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    updateState(prev => ({ ...prev, ownerExpenses: [expense, ...(prev.ownerExpenses || [])] }));
    setExpenseAmount('');
    setExpenseComment('');
  };

  const addExtraIncome = () => {
    const amt = parseFloat(incomeAmount);
    if (isNaN(amt) || amt <= 0) return;
    const income: OwnerManualIncome = {
      id: `own-inc-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      periodId: activePeriodId,
      platform: incomePlatform,
      amount: amt,
      comment: incomeComment,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    updateState(prev => ({ ...prev, ownerManualIncomes: [income, ...(prev.ownerManualIncomes || [])] }));
    setIncomeAmount('');
    setIncomeComment('');
    setIsIncomeModalOpen(false);
  };

  const addOwnerAdvance = () => {
    const amt = parseFloat(advanceAmount);
    if (isNaN(amt) || amt <= 0) return;
    const advance: OwnerAdvance = {
      id: `own-adv-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      periodId: activePeriodId,
      ownerName: advanceOwner,
      platform: 'crypto',
      amount: amt,
      comment: advanceComment,
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    updateState(prev => ({ ...prev, ownerAdvances: [advance, ...(prev.ownerAdvances || [])] }));
    setAdvanceAmount('');
    setAdvanceComment('');
    setIsAdvanceModalOpen(false);
  };

  const totalPayrollAccrued = stats.adminAccrued + stats.modelAccrued + stats.staffAccrued;
  const adminPct = totalPayrollAccrued > 0 ? (stats.adminAccrued / totalPayrollAccrued) * 100 : 0;
  const modelPct = totalPayrollAccrued > 0 ? (stats.modelAccrued / totalPayrollAccrued) * 100 : 0;
  const staffPct = totalPayrollAccrued > 0 ? (stats.staffAccrued / totalPayrollAccrued) * 100 : 0;

  const formatUsd = (num: number) => {
    const rounded = Math.round(num);
    const formatted = Math.abs(rounded).toLocaleString('ru-RU');
    return rounded < 0 ? `−$${formatted}` : `$${formatted}`;
  };

  const totalProfit = stats.netProfitTotal || (stats.sharePerOwner * 2);
  const totalAdvances = stats.andrey.advances + stats.anton.advances;
  const totalAvailable = totalProfit - totalAdvances;
  const andreyAvailable = stats.sharePerOwner - stats.andrey.advances;
  const antonAvailable = stats.sharePerOwner - stats.anton.advances;

  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20 select-none">
      {/* GLOWING AMBIENT WATERMARKS IN BACKGROUND */}
      <div className="absolute top-10 left-1/3 w-96 h-96 bg-indigo-500/[0.02] rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/2 right-10 w-96 h-96 bg-amber-500/[0.02] rounded-full blur-[120px] pointer-events-none" />

      {/* EQUILIBRIUM EQUITY BOARD - COMPACT OWNER FINANCE DASHBOARD */}
      <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-b from-[#0B0F19] via-[#0D1322] to-[#070A12] border border-slate-800/80 p-5 md:p-6 shadow-2xl backdrop-blur-2xl">
         {/* Ambient Background Glows */}
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[250px] bg-emerald-500/[0.02] rounded-full blur-[120px] pointer-events-none" />
         <div className="absolute -top-20 -left-20 w-72 h-72 bg-amber-500/[0.03] rounded-full blur-[100px] pointer-events-none" />
         <div className="absolute -bottom-20 -right-20 w-72 h-72 bg-sky-500/[0.03] rounded-full blur-[100px] pointer-events-none" />

         {/* TOP HEADER ROW: Section Title + Subtext + Action Buttons */}
         <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500/20 via-amber-400/10 to-amber-500/5 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]">
                  <ICONS.Owner size={16} className="text-amber-400" />
               </div>
               <div>
                  <div className="flex items-center gap-2.5">
                     <h2 className="text-xs sm:text-sm font-black font-outfit text-white uppercase tracking-wider">
                        Распределение владельцев
                     </h2>
                     <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                        Синхронизирован с БД
                     </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium">Финансовый результат владельцев Continental</p>
               </div>
            </div>

            {/* Notice if Month hasn't started yet */}
            {stats.grossTotal === 0 && totalProfit === 0 && (
               <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  <span>Месяц ещё не начат</span>
               </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center gap-2 self-end sm:self-auto">
               <button 
                  onClick={() => setIsIncomeModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/25 hover:border-emerald-500/40 text-[10px] sm:text-[11px] font-bold uppercase font-mono tracking-wider transition-all active:scale-95 flex items-center gap-1.5 shadow-md shadow-emerald-500/[0.03]"
               >
                  <ICONS.Plus size={12} />
                  Внести доход
               </button>
               <button 
                  onClick={() => setIsAdvanceModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/25 hover:border-amber-500/40 text-[10px] sm:text-[11px] font-bold uppercase font-mono tracking-wider transition-all active:scale-95 flex items-center gap-1.5 shadow-md shadow-amber-500/[0.03]"
               >
                  <ICONS.Plus size={12} />
                  Внести аванс
               </button>
            </div>
         </div>

         {/* MAIN AREA: TWO EQUAL OWNER CARDS STRICTLY SIDE BY SIDE ON DESKTOP */}
         <div className="relative z-10 my-4">
            {/* Small notice banner on mobile if grossTotal === 0 */}
            {stats.grossTotal === 0 && totalProfit === 0 && (
               <div className="sm:hidden mb-3 p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center text-[10px] text-amber-300 font-mono">
                  Месяц ещё не начат — внесите первый доход
               </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
               {/* ANDREY CARD (Warm Amber Accent) */}
               <div className="group relative p-5 rounded-2xl bg-gradient-to-br from-amber-500/[0.05] via-slate-900/70 to-slate-950/90 border border-amber-500/20 hover:border-amber-500/40 hover:shadow-[0_0_25px_rgba(245,158,11,0.12)] transition-all duration-300 flex flex-col justify-between backdrop-blur-md min-h-[190px] lg:min-h-[205px]">
                  {/* Subtle internal warm glow */}
                  <div className="absolute top-0 right-0 w-40 h-40 bg-amber-500/[0.04] rounded-full blur-2xl pointer-events-none group-hover:bg-amber-500/[0.07] transition-all" />

                  {/* Header: Avatar, Name, Badge, Sub-label */}
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 to-amber-600 text-slate-950 flex items-center justify-center font-black text-xs shadow-md font-outfit">
                           А
                        </div>
                        <div>
                           <div className="flex items-center gap-2">
                              <h3 className="text-xs sm:text-sm font-black font-outfit text-white tracking-wider uppercase">АНДРЕЙ</h3>
                              <span className="px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-300 text-[9px] font-bold font-mono border border-amber-500/25">50%</span>
                           </div>
                           <span className="text-[10px] text-amber-400/80 font-medium">Ваша прибыль за месяц</span>
                        </div>
                     </div>
                  </div>

                  {/* PERSONAL PAYOUT AMOUNT */}
                  <div className="my-2">
                     <span className="text-[9px] font-extrabold font-mono uppercase tracking-[0.15em] text-slate-400 block mb-0.5">
                        К ВЫПЛАТЕ
                     </span>
                     <div className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono text-white tracking-tight drop-shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                        {formatUsd(andreyAvailable)}
                     </div>
                  </div>

                  {/* BREAKDOWN ROWS */}
                  <div className="pt-2.5 border-t border-amber-500/10 flex items-center justify-between text-[11px] font-mono">
                     <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Доля прибыли:</span>
                        <span className="text-slate-200 font-bold">{formatUsd(stats.sharePerOwner)}</span>
                     </div>
                     <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Авансы:</span>
                        <span className={stats.andrey.advances > 0 ? "text-rose-400 font-bold" : "text-slate-500"}>
                           {stats.andrey.advances > 0 ? formatUsd(-stats.andrey.advances) : '—'}
                        </span>
                     </div>
                  </div>
               </div>

               {/* ANTON CARD (Cool Sky-Blue Accent) */}
               <div className="group relative p-5 rounded-2xl bg-gradient-to-br from-sky-500/[0.05] via-slate-900/70 to-slate-950/90 border border-sky-500/20 hover:border-sky-500/40 hover:shadow-[0_0_25px_rgba(56,189,248,0.12)] transition-all duration-300 flex flex-col justify-between backdrop-blur-md min-h-[190px] lg:min-h-[205px]">
                  {/* Subtle internal cool glow */}
                  <div className="absolute top-0 right-0 w-40 h-40 bg-sky-500/[0.04] rounded-full blur-2xl pointer-events-none group-hover:bg-sky-500/[0.07] transition-all" />

                  {/* Header: Avatar, Name, Badge, Sub-label */}
                  <div className="flex items-center justify-between">
                     <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sky-400 to-indigo-600 text-white flex items-center justify-center font-black text-xs shadow-md font-outfit">
                           А
                        </div>
                        <div>
                           <div className="flex items-center gap-2">
                              <h3 className="text-xs sm:text-sm font-black font-outfit text-white tracking-wider uppercase">АНТОН</h3>
                              <span className="px-1.5 py-0.5 rounded-md bg-sky-500/15 text-sky-300 text-[9px] font-bold font-mono border border-sky-500/25">50%</span>
                           </div>
                           <span className="text-[10px] text-sky-400/80 font-medium">Прибыль за месяц</span>
                        </div>
                     </div>
                  </div>

                  {/* PERSONAL PAYOUT AMOUNT */}
                  <div className="my-2">
                     <span className="text-[9px] font-extrabold font-mono uppercase tracking-[0.15em] text-slate-400 block mb-0.5">
                        К ВЫПЛАТЕ
                     </span>
                     <div className="text-3xl sm:text-4xl lg:text-5xl font-black font-mono text-white tracking-tight drop-shadow-[0_0_15px_rgba(56,189,248,0.2)]">
                        {formatUsd(antonAvailable)}
                     </div>
                  </div>

                  {/* BREAKDOWN ROWS */}
                  <div className="pt-2.5 border-t border-sky-500/10 flex items-center justify-between text-[11px] font-mono">
                     <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Доля прибыли:</span>
                        <span className="text-slate-200 font-bold">{formatUsd(stats.sharePerOwner)}</span>
                     </div>
                     <div className="flex items-center gap-1.5">
                        <span className="text-slate-400">Авансы:</span>
                        <span className={stats.anton.advances > 0 ? "text-rose-400 font-bold" : "text-slate-500"}>
                           {stats.anton.advances > 0 ? formatUsd(-stats.anton.advances) : '—'}
                        </span>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* BOTTOM COMPACT SECONDARY GENERAL STATS ROW */}
         <div className="relative z-10 pt-3 border-t border-white/[0.06] flex items-center justify-between flex-wrap gap-2 text-[11px] font-mono">
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap w-full justify-between sm:justify-start">
               <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-medium text-slate-400">Общий доход</span>
                  <span className="text-xs font-bold text-slate-200">{formatUsd(stats.grossTotal)}</span>
               </div>
               <span className="text-slate-700 hidden sm:inline">•</span>
               <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-medium text-slate-400">Общая прибыль</span>
                  <span className="text-xs font-bold text-emerald-400">{formatUsd(totalProfit)}</span>
               </div>
               <span className="text-slate-700 hidden sm:inline">•</span>
               <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-medium text-slate-400">Авансы</span>
                  <span className={totalAdvances > 0 ? "text-xs font-bold text-rose-400" : "text-xs font-bold text-slate-400"}>
                     {totalAdvances > 0 ? formatUsd(-totalAdvances) : '—'}
                  </span>
               </div>
               <span className="text-slate-700 hidden sm:inline">•</span>
               <div className="flex items-center gap-1.5 bg-white/[0.02] px-2.5 py-0.5 rounded-lg border border-white/[0.05]">
                  <span className="text-[10px] uppercase font-medium text-slate-400">Остаток</span>
                  <span className="text-xs font-black text-emerald-300">{formatUsd(totalAvailable)}</span>
               </div>
            </div>
         </div>
      </div>

      {/* GLOBAL PAYROLL & ADMINISTRATOR HUB - ОРГПОЛИТИКА И ВЫПЛАТЫ */}
      <section className="glass-card rounded-[2.5rem] border border-white/5 shadow-2xl bg-gradient-to-b from-slate-950 via-slate-950/90 to-slate-900/50 relative overflow-hidden backdrop-blur-2xl">
         <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/[0.02] rounded-full blur-3xl pointer-events-none" />
         
         <div className="p-5 sm:p-6 flex flex-col lg:flex-row gap-6">
            {/* Global Payroll (Компактная сводка) */}
            <div className="lg:w-[35%] flex flex-col justify-between gap-5 border-b lg:border-b-0 lg:border-r border-white/[0.04] pb-5 lg:pb-0 lg:pr-6">
               <div>
                  <div className="flex items-center gap-2.5 mb-4">
                     <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
                        <ICONS.Salary size={15} />
                     </div>
                     <div>
                        <h2 className="text-base font-black font-outfit text-white uppercase tracking-tight">ВЫПЛАТЫ КОМАНДЫ</h2>
                     </div>
                  </div>

                  {/* Сводные KPI карты платежей */}
                  <div className="grid grid-cols-2 gap-2.5 mb-4">
                     <div className="p-3 rounded-xl bg-slate-950/45 border border-white/[0.03] flex flex-col justify-between">
                        <span className="text-[7.5px] font-bold text-slate-500 uppercase tracking-widest block">Выплачено всего</span>
                        <p className="text-base font-black text-white font-mono mt-0.5">${stats.totalPaidGlobal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                     </div>

                     <div className="p-3 rounded-xl bg-indigo-500/[0.02] border border-indigo-500/15 flex flex-col justify-between">
                        <span className="text-[7.5px] font-bold text-indigo-400 uppercase tracking-widest block flex items-center gap-1">
                           <span className="w-1 h-1 rounded-full bg-indigo-400 animate-pulse"></span>
                           Остаток долга
                        </span>
                        <p className="text-base font-black text-indigo-400 font-mono mt-0.5">${stats.totalRemainderGlobal.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                     </div>
                  </div>

                  {/* Ссылки на категории начислений */}
                  <div className="space-y-2">
                     <PayrollCategoryRow title="Администраторы" accrued={stats.adminAccrued} paid={stats.adminPaid} color="indigo" />
                     <PayrollCategoryRow title="Модели" accrued={stats.modelAccrued} paid={stats.modelPaid} color="emerald" />
                     <PayrollCategoryRow title="Операторы" accrued={stats.staffAccrued} paid={stats.staffPaid} color="sky" />
                  </div>
               </div>

               {/* Прогресс-бар пропорции */}
               {totalPayrollAccrued > 0 && (
                  <div className="mt-2 pt-3 border-t border-white/[0.03]">
                     <div className="flex justify-between items-center text-[7.5px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">
                        <span>Пропорция расходов</span>
                        <span>${totalPayrollAccrued.toLocaleString(undefined, { maximumFractionDigits: 0 })} всего</span>
                     </div>
                     <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden flex p-[1px] border border-white/5 shadow-inner">
                        <div className="h-full bg-gradient-to-r from-indigo-600 to-indigo-500 rounded-l-full" style={{ width: `${adminPct}%` }} title={`Админы: ${adminPct.toFixed(0)}%`} />
                        <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-500" style={{ width: `${modelPct}%` }} title={`Модели: ${modelPct.toFixed(0)}%`} />
                        <div className="h-full bg-gradient-to-r from-sky-600 to-sky-500 rounded-r-full" style={{ width: `${staffPct}%` }} title={`Операторы: ${staffPct.toFixed(0)}%`} />
                     </div>
                  </div>
               )}
            </div>

            {/* Ведомость Админов (подключена напрямую) */}
            <div className="lg:w-[65%] flex flex-col justify-between pl-0 lg:pl-2">
               <div>
                  <div className="flex items-center gap-2.5 mb-4">
                     <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <ICONS.Users size={14} />
                     </div>
                     <div>
                        <h3 className="text-base font-black font-outfit text-white uppercase tracking-tight">Ведомость Админов</h3>
                     </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                     {stats.adminDetails.map(admin => (
                        <div 
                           key={admin.id} 
                           className="relative group p-3.5 rounded-2xl bg-slate-950/45 border border-white/[0.04] hover:border-indigo-500/30 transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-lg backdrop-blur-sm"
                        >
                           {/* Micro background gradient glow on hover */}
                           <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/[0.01] group-hover:bg-indigo-500/[0.03] rounded-full blur-xl pointer-events-none transition-colors duration-500" />
                           
                           {/* Header row: ID/Name & Rate */}
                           <div className="flex items-center justify-between gap-2 mb-2.5 z-10">
                              <div className="flex items-center gap-2 min-w-0">
                                 <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500/15 to-violet-500/5 border border-indigo-500/15 flex items-center justify-center text-indigo-400 font-extrabold text-[9px] tracking-wide font-mono shadow-inner shrink-0 leading-none">
                                    {admin.name.slice(0, 2).toUpperCase()}
                                 </div>
                                 <div className="min-w-0">
                                    <div className="font-extrabold text-xs text-white tracking-tight truncate">{admin.name}</div>
                                    <div className="text-[7.5px] font-bold text-slate-500 uppercase font-mono mt-0.5">Ставка: <span className="text-indigo-400">{admin.rate}%</span></div>
                                 </div>
                              </div>

                              {/* Small status pill */}
                              {admin.remainder > 0 ? (
                                 <span className="text-[6.5px] font-black font-mono uppercase bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded-md border border-indigo-500/20 animate-pulse shrink-0">
                                    долг
                                 </span>
                              ) : (
                                 <span className="text-[6.5px] font-black font-mono uppercase bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded-md border border-emerald-500/10 shrink-0">
                                    Full
                                 </span>
                              )}
                           </div>

                           {/* Micro Bento metrics table */}
                           <div className="grid grid-cols-3 gap-0.5 bg-slate-950/70 border border-white/[0.03] p-1.5 rounded-xl text-[9px] font-mono mb-2.5 z-10">
                              <div className="text-center">
                                 <span className="block text-[6.5px] font-bold text-slate-600 uppercase tracking-wider mb-0.5">Начислено</span>
                                 <span className="font-bold text-slate-200">${admin.accrued.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                              </div>
                              <div className="text-center border-x border-white/[0.03]">
                                 <span className="block text-[6.5px] font-bold text-slate-600 uppercase tracking-wider mb-0.5">Выплачено</span>
                                 <span className="font-bold text-emerald-400">${admin.paid.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                              </div>
                              <div className="text-center">
                                 <span className="block text-[6.5px] font-bold text-slate-600 uppercase tracking-wider mb-0.5">Остаток</span>
                                 <span className={`font-black ${admin.remainder > 0 ? 'text-indigo-400 animate-pulse' : 'text-slate-500'}`}>
                                    ${admin.remainder.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                 </span>
                              </div>
                           </div>

                           {/* Interactive payment input bottom drawer */}
                           <div className="flex items-center gap-1.5 w-full z-10">
                              <div className="relative flex-1">
                                 <span className="absolute left-2 top-1/2 -translate-y-1/2 font-mono text-[8.5px] text-slate-600 pointer-events-none select-none">$</span>
                                 <input 
                                    type="number" 
                                    className="w-full bg-slate-950/85 border border-white/5 rounded-lg pl-4.5 pr-1.5 py-1 text-[9.5px] text-white font-mono outline-none focus:border-indigo-500/40 placeholder-slate-600 transition-all duration-300 hover:border-white/10" 
                                    placeholder="Сумма"
                                    value={adminPaidInputs[admin.name] || ''}
                                    onChange={e => setAdminPaidInputs(prev => ({...prev, [admin.name]: e.target.value}))}
                                    onKeyDown={e => e.key === 'Enter' && addAdminPayment(admin.name)}
                                 />
                              </div>
                              <button 
                                 onClick={() => addAdminPayment(admin.name)} 
                                 className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg h-[22px] w-[22px] transition-all active:scale-95 shadow-md shadow-indigo-600/10 flex items-center justify-center shrink-0 border border-indigo-500/30"
                                 title="Внести выплату"
                              >
                                 <ICONS.Plus size={9}/>
                              </button>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            </div>
         </div>
      </section>

      {/* ФОРМЫ ВВОДОВ С ВАУ ЭФФЕКТОМ - ОПЕРАЦИОННЫЙ ПУЛЬТ */}
      <div className="flex flex-col gap-6">
            <section className="glass-card rounded-[2.5rem] border border-white/5 shadow-2xl bg-gradient-to-b from-slate-950 via-slate-950/95 to-slate-900/60 relative overflow-hidden backdrop-blur-2xl">
               {/* Ambient glowing fields */}
               <div className="absolute top-0 right-0 w-96 h-96 bg-rose-500/[0.015] rounded-full blur-[100px] pointer-events-none" />
               <div className="absolute bottom-0 left-0 w-96 h-96 bg-violet-500/[0.01] rounded-full blur-[100px] pointer-events-none" />
               
               {/* Шапка Бизнес расходов */}
               <div className="p-5 sm:p-6 border-b border-white/[0.04] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shadow-md">
                        <ICONS.Penalty size={18} />
                     </div>
                     <div>
                        <h2 className="text-xl font-black font-outfit text-white uppercase tracking-tight">РАСХОДЫ</h2>
                     </div>
                  </div>
                  
                  {/* Общий итог компании */}
                  <div className="bg-rose-500/[3%] border border-rose-500/15 px-4 py-2.5 rounded-xl shadow-inner shrink-0 text-center font-mono hover:scale-[1.02] transition-transform duration-300">
                     <span className="text-[7.5px] font-bold text-rose-400 uppercase tracking-widest block mb-0.5">Всего расходов периода</span>
                     <span className="text-xl font-extrabold text-white">${stats.bizExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
               </div>

               <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 relative z-10">
                  {/* ЛЕВАЯ ЧАСТЬ: ИНТЕРАКТИВНЫЙ ВВОД РАСХОДА */}
                  <div className="space-y-5">
                     <div>
                        <span className="text-[9px] font-mono font-bold uppercase tracking-widest text-slate-500 block mb-2.5">1. Выберите категорию:</span>
                        <div className="grid grid-cols-2 gap-2">
                           {Object.entries(CATEGORIES).map(([k, v]) => {
                              const isSelected = expenseCategory === k;
                              const Icon = v.icon;
                              const amt = stats.currentExpenses.filter(e => e.category === k).reduce((s, e) => s + e.amount, 0);
                              return (
                                 <button
                                    key={k}
                                    type="button"
                                    onClick={() => setExpenseCategory(k as any)}
                                    className={`p-2.5 rounded-xl border text-left flex flex-col justify-between transition-all duration-300 min-h-[68px] ${
                                       isSelected 
                                          ? `${v.bg} ${v.border} ${v.color} shadow-lg ring-1 ring-white/10 scale-[1.01] translate-y-[-1px]` 
                                          : 'bg-slate-950/45 border-white/[0.03] text-slate-500 hover:text-white hover:bg-slate-900/40 font-bold'
                                    }`}
                                 >
                                    <div className="flex items-center justify-between w-full">
                                       <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isSelected ? 'bg-white/15' : 'bg-slate-950/80'} ${v.color}`}>
                                          <Icon size={12} />
                                       </div>
                                       {amt > 0 && (
                                          <span className="text-[8.5px] font-mono font-black opacity-80">
                                             ${amt.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                          </span>
                                       )}
                                    </div>
                                    <span className="text-[9.5px] font-extrabold uppercase tracking-wider truncate mt-2">{v.label}</span>
                                 </button>
                              );
                           })}
                        </div>
                     </div>

                     {/* Поля ввода суммы и заметки */}
                     <div className="space-y-3.5 pt-0.5">
                        <div className="relative">
                           <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-500 select-none">$</span>
                           <input 
                              type="number" 
                              className="w-full bg-slate-950/75 border border-white/5 rounded-xl pl-7 pr-3 py-3 text-xs text-white font-mono outline-none focus:border-rose-500/40 placeholder-slate-600 transition-all duration-300" 
                              placeholder="Сумма расхода" 
                              value={expenseAmount} 
                              onChange={e => setExpenseAmount(e.target.value)} 
                           />
                        </div>

                        <div className="relative">
                           <input 
                              type="text" 
                              className="w-full bg-slate-950/75 border border-white/5 rounded-xl px-3.5 py-3 text-xs text-white outline-none focus:border-rose-500/40 placeholder-slate-600 transition-all duration-300" 
                              placeholder="Детализированное описание..." 
                              value={expenseComment} 
                              onChange={e => setExpenseComment(e.target.value)} 
                           />
                        </div>

                        <button 
                           onClick={addBusinessExpense} 
                           className="w-full bg-gradient-to-r from-rose-500 via-pink-500 to-amber-500 hover:opacity-95 text-white font-black py-3 rounded-xl shadow-lg shadow-rose-600/10 active:scale-98 transition-all duration-300 uppercase tracking-wider text-[10px] font-mono flex items-center justify-center gap-1.5"
                        >
                           <ICONS.Plus size={11} />
                           Провести транзакцию расхода
                        </button>
                     </div>
                  </div>

                  {/* ПРАВАЯ ЧАСТЬ: ИСТОРИЯ, ПОИСК И КАТЕГОРИИ (С ВЕЛИКОЛЕПНЫМИ ПРОГРЕСС-БАРАМИ & ЛОГОМ ДАННЫХ) */}
                  <div className="flex flex-col justify-between gap-5 border-t md:border-t-0 md:border-l border-white/[0.04] pt-5 md:pt-0 md:pl-6">
                     <div>
                        {/* Поиск и фильтрация */}
                        <div className="space-y-2.5 mb-4">
                           <div className="relative">
                              <ICONS.Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                              <input 
                                 type="text" 
                                 placeholder="Поиск по расходам..." 
                                 className="bg-slate-950/70 border border-white/5 rounded-lg pl-8.5 pr-3 py-1.5 text-[10px] text-white outline-none focus:border-rose-500/40 w-full placeholder-slate-600 transition-colors"
                                 value={expenseSearch}
                                 onChange={e => setExpenseSearch(e.target.value)}
                              />
                           </div>

                           <div className="flex flex-wrap gap-1">
                              <button 
                                 onClick={() => setExpenseFilter('all')}
                                 className={`px-2 py-0.5 rounded-md text-[8.5px] font-bold uppercase tracking-wider transition-all border ${expenseFilter === 'all' ? 'bg-white text-black border-white shadow-md' : 'bg-slate-950 text-slate-500 border-white/5 hover:border-white/10'}`}
                              >
                                 Все
                              </button>
                              {Object.entries(CATEGORIES).map(([k, v]) => {
                                 const isChosen = expenseFilter === k;
                                 return (
                                    <button 
                                       key={k}
                                       onClick={() => setExpenseFilter(k as any)}
                                       className={`px-2 py-0.5 rounded-md text-[8.5px] font-bold uppercase tracking-wider transition-all border ${isChosen ? `${v.bg} ${v.color} ${v.border}` : 'bg-slate-950 text-slate-500 border-white/5 hover:border-white/10'}`}
                                    >
                                       {v.label}
                                    </button>
                                 );
                              })}
                           </div>
                        </div>

                        {/* Bento KPI расходов по категориям с визуальным заполнением */}
                        <div className="space-y-2">
                           <span className="text-[8.5px] font-mono font-bold uppercase tracking-widest text-slate-500 block">Метрики категорий (Доля расхода):</span>
                           <div className="space-y-2 max-h-[140px] overflow-y-auto pr-1 scrollbar-hide bg-slate-950/30 p-2.5 rounded-xl border border-white/[0.02]">
                              {Object.entries(CATEGORIES).map(([k, v]) => {
                                 const total = stats.currentExpenses.filter(e => e.category === k).reduce((s, e) => s + e.amount, 0);
                                 const pct = stats.bizExpenses > 0 ? (total / stats.bizExpenses) * 100 : 0;
                                 return (
                                    <div key={k} className="space-y-1">
                                       <div className="flex items-center justify-between text-[9px] font-mono font-bold">
                                          <div className="flex items-center gap-1.5 min-w-0">
                                             <span className={`w-1.5 h-1.5 rounded-full ${v.color.replace('text-', 'bg-')}`} />
                                             <span className="text-slate-300 uppercase truncate">{v.label}</span>
                                          </div>
                                          <div className="flex items-center gap-1.5 shrink-0">
                                             <span className="text-slate-500">({pct.toFixed(0)}%)</span>
                                             <span className="text-white font-extrabold">${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                          </div>
                                       </div>
                                       {/* Progress Line */}
                                       <div className="w-full h-1 bg-slate-950 rounded-full overflow-hidden p-[0.5px]">
                                          <div 
                                             className={`h-full rounded-full ${v.color.replace('text-', 'bg-')}`} 
                                             style={{ width: `${pct}%` }} 
                                          />
                                       </div>
                                    </div>
                                 );
                              })}
                           </div>
                        </div>
                     </div>

                     {/* Список истории расходов в реальном времени */}
                     <div className="border-t border-white/[0.04] pt-3.5">
                        <HistoryList 
                           items={stats.currentExpenses.filter(e => {
                              const matchesFilter = expenseFilter === 'all' || e.category === expenseFilter;
                              const matchesSearch = !expenseSearch || 
                                 e.comment?.toLowerCase().includes(expenseSearch.toLowerCase()) ||
                                 (CATEGORIES[e.category as keyof typeof CATEGORIES] as any)?.label.toLowerCase().includes(expenseSearch.toLowerCase());
                              return matchesFilter && matchesSearch;
                           })} 
                           onRemove={(id: string) => updateState(p => ({...p, deletedIds: [...p.deletedIds, id], ownerExpenses: p.ownerExpenses.filter(e => e.id !== id)}))} 
                           title="Лента операций расходов" 
                           isExpenses 
                           categories={CATEGORIES}
                        />
                     </div>
                  </div>
               </div>
            </section>

            {/* 1. ВНЕСТИ ДОХОД MODAL */}
            {isIncomeModalOpen && (
               <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  {/* Backdrop */}
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setIsIncomeModalOpen(false)} />
                  
                  {/* Modal Body */}
                  <div className="relative w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border border-white/10 p-6 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/[0.05] rounded-full blur-2xl pointer-events-none" />
                     
                     <div className="flex items-center justify-between mb-5">
                        <h3 className="text-lg font-black font-outfit text-white flex items-center gap-2.5">
                           <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                              <ICONS.Income size={14} />
                           </div>
                           <div>
                              <span className="block text-sm font-extrabold font-outfit text-white">Внести доход</span>
                              <span className="block text-[8px] font-mono text-slate-500 font-bold uppercase tracking-wider">Дополнительное сальдо периода</span>
                           </div>
                        </h3>
                        <button 
                           onClick={() => setIsIncomeModalOpen(false)}
                           className="text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-1.5 rounded-lg transition-colors"
                        >
                           <ICONS.Close size={14} />
                        </button>
                     </div>

                     <div className="space-y-4">
                        <div className="relative">
                           <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-500 pointer-events-none">$</span>
                           <input 
                              type="number" 
                              className="w-full bg-slate-950/60 border border-white/5 rounded-xl pl-7 pr-3 py-2 text-xs text-white font-mono outline-none focus:border-emerald-500/40 transition-colors placeholder-slate-600" 
                              placeholder="Сумма дохода" 
                              value={incomeAmount} 
                              onChange={e => setIncomeAmount(e.target.value)} 
                           />
                        </div>
                        <select 
                           className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-3 py-2 text-xs text-white font-bold outline-none focus:border-emerald-500/40" 
                           value={incomePlatform} 
                           onChange={e => setIncomePlatform(e.target.value as any)}
                        >
                           <option value="all">Общий счет</option>
                           <option value="onlyFans">OnlyFans</option>
                           <option value="paypal">PayPal</option>
                           <option value="crypto">Crypto</option>
                        </select>
                        <input 
                           type="text" 
                           className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-emerald-500/40 transition-colors placeholder-slate-600" 
                           placeholder="Комментарий к транзакции..." 
                           value={incomeComment} 
                           onChange={e => setIncomeComment(e.target.value)} 
                        />
                        <button 
                           onClick={addExtraIncome} 
                           className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-black py-2.5 rounded-xl text-xs uppercase shadow-md shadow-emerald-600/10 transition-all active:scale-98 font-mono"
                        >
                           Провести Доход
                        </button>
                     </div>

                     <div className="mt-5 pt-4 border-t border-white/[0.03] max-h-[160px] overflow-y-auto scrollbar-hide pr-1">
                        <HistoryList items={stats.currentManualIncomes} onRemove={(id: string) => updateState(p => ({...p, deletedIds: [...p.deletedIds, id], ownerManualIncomes: p.ownerManualIncomes?.filter(i => i.id !== id)}))} title="История доходов" />
                     </div>
                  </div>
               </div>
            )}

            {/* 2. ВНЕСТИ АВАНС MODAL */}
            {isAdvanceModalOpen && (
               <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                  {/* Backdrop */}
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setIsAdvanceModalOpen(false)} />
                  
                  {/* Modal Body */}
                  <div className="relative w-full max-w-md bg-gradient-to-b from-slate-900 to-slate-950 border border-white/10 p-6 rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/[0.05] rounded-full blur-2xl pointer-events-none" />
                     
                     <div className="flex items-center justify-between mb-5">
                        <h3 className="text-lg font-black font-outfit text-white flex items-center gap-2.5">
                           <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                              <ICONS.Salary size={14} />
                           </div>
                           <div>
                              <span className="block text-sm font-extrabold font-outfit text-white">Внести аванс Owner</span>
                              <span className="block text-[8px] font-mono text-slate-500 font-bold uppercase tracking-wider">Предварительные дивиденды</span>
                           </div>
                        </h3>
                        <button 
                           onClick={() => setIsAdvanceModalOpen(false)}
                           className="text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 p-1.5 rounded-lg transition-colors"
                        >
                           <ICONS.Close size={14} />
                        </button>
                     </div>

                     <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-2">
                           <button 
                              onClick={() => setAdvanceOwner('Andrey')} 
                              className={`py-2 rounded-xl border text-xs font-black font-mono transition-all ${
                                 advanceOwner === 'Andrey' 
                                    ? 'bg-amber-500/20 border-amber-500 text-amber-400 shadow-md ring-1 ring-amber-500/10' 
                                    : 'bg-slate-950 border-white/5 text-slate-500 hover:text-white'
                              }`}
                           >
                              Андрей
                           </button>
                           <button 
                              onClick={() => setAdvanceOwner('Anton')} 
                              className={`py-2 rounded-xl border text-xs font-black font-mono transition-all ${
                                 advanceOwner === 'Anton' 
                                    ? 'bg-indigo-500/20 border-indigo-500 text-indigo-400 shadow-md ring-1 ring-indigo-500/10' 
                                    : 'bg-slate-950 border-white/5 text-slate-500 hover:text-white'
                              }`}
                           >
                              Антон
                           </button>
                        </div>
                        
                        <div className="relative">
                           <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-500 pointer-events-none">$</span>
                           <input 
                              type="number" 
                              className="w-full bg-slate-950/60 border border-white/5 rounded-xl pl-7 pr-3 py-2 text-xs text-white font-mono outline-none focus:border-amber-500/40 transition-colors placeholder-slate-600" 
                              placeholder="Сумма выплаты" 
                              value={advanceAmount} 
                              onChange={e => setAdvanceAmount(e.target.value)} 
                           />
                        </div>
                        <input 
                           type="text" 
                           className="w-full bg-slate-950/60 border border-white/5 rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-amber-500/40 transition-colors placeholder-slate-600" 
                           placeholder="Обоснование / заметка..." 
                           value={advanceComment} 
                           onChange={e => setAdvanceComment(e.target.value)} 
                        />
                        <button 
                           onClick={addOwnerAdvance} 
                           className="w-full bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-slate-950 font-black py-2.5 rounded-xl text-xs uppercase shadow-md shadow-amber-600/10 transition-all active:scale-98 font-mono"
                        >
                           Зафиксировать Аванс
                        </button>
                     </div>

                     <div className="mt-5 pt-4 border-t border-white/[0.03] max-h-[160px] overflow-y-auto scrollbar-hide pr-1">
                        <HistoryList items={stats.currentOwnerAdvances} onRemove={(id: string) => updateState(p => ({...p, deletedIds: [...p.deletedIds, id], ownerAdvances: p.ownerAdvances.filter(a => a.id !== id)}))} title="История авансов" isOwner />
                     </div>
                  </div>
               </div>
            )}
         </div>
    </div>
  );
};

const PayrollCategoryRow = ({ title, accrued, paid, color }: any) => {
   const remaining = accrued - paid;
   const progress = accrued > 0 ? (paid / accrued) * 100 : 0;
   
   const colors = {
      indigo: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/10 hover:border-indigo-500/30',
      emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/10 hover:border-emerald-500/30',
      sky: 'bg-sky-500/10 text-sky-400 border-sky-500/10 hover:border-sky-500/30'
   }[color as 'indigo' | 'emerald' | 'sky'] || '';

   const barColors = {
      indigo: 'bg-indigo-500',
      emerald: 'bg-emerald-500',
      sky: 'bg-sky-500'
   }[color as 'indigo' | 'emerald' | 'sky'] || 'bg-slate-500';

   return (
      <div className="bg-slate-950/40 border border-white/[0.03] hover:border-white/10 rounded-2xl p-3.5 transition-all duration-300 shadow-sm relative group overflow-hidden">
         <div className="absolute top-0 right-0 w-16 h-16 bg-white/[0.01] rounded-full blur-xl pointer-events-none" />
         <div className="flex justify-between items-center mb-1 relative z-10">
            <div className="flex items-center gap-2">
               <span className={`w-2 h-2 rounded-full ${barColors}`} />
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</span>
            </div>
            <span className="text-xs font-mono font-bold text-white">
               ${accrued.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </span>
         </div>
         
         <div className="flex justify-between items-center text-[9px] text-slate-500 font-bold mb-2 uppercase font-mono relative z-10">
            <span>Выплачено: <strong className="text-slate-300 font-bold">${paid.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></span>
            <span>Невыплачено: <strong className="text-rose-400/80 font-black">${remaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></span>
         </div>
         
         <div className="w-full h-1 bg-slate-900/60 rounded-full overflow-hidden border border-white/[0.03] relative z-10">
            <div className={`h-full ${barColors} rounded-full transition-all duration-500`} style={{ width: `${Math.min(100, progress)}%` }} />
         </div>
      </div>
   );
};

const HistoryList = ({ items, onRemove, title, isOwner, isExpenses, categories }: any) => (
   <div className="mt-4 space-y-3 max-h-[350px] overflow-y-auto pr-1 scrollbar-hide">
      <h3 className="text-[9px] font-black uppercase text-slate-500 tracking-widest border-b border-white/5 pb-2.5 flex justify-between font-mono">
         <span>{title}</span>
         <span className="text-[8px] text-slate-600">Элементов: {items.length}</span>
      </h3>
      {items.length === 0 ? (
         <div className="text-center py-8 bg-slate-950/20 rounded-2xl border border-white/[0.02]">
            <p className="text-[11px] text-slate-600 font-bold italic">Записи не найдены</p>
         </div>
      ) : (
         items.map((item: any) => {
            const cat = isExpenses ? (categories?.[item.category] || categories?.other) : null;
            const Icon = isExpenses ? cat?.icon : (isOwner ? ICONS.Owner : ICONS.Income);
            
            return (
               <div key={item.id} className="group relative bg-slate-950/60 hover:bg-slate-900/60 border border-white/[0.03] hover:border-white/10 rounded-2xl overflow-hidden transition-all duration-300">
                  {isExpenses && <div className={`absolute left-0 top-0 bottom-0 w-1 ${cat?.color.replace('text-', 'bg-')}`}></div>}
                  <div className="p-3.5 flex items-center gap-4">
                     <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${isExpenses ? (cat?.bg || '') : 'bg-emerald-500/5'} ${isExpenses ? (cat?.color || '') : 'text-emerald-400'} border ${isExpenses ? (cat?.border || '') : 'border-emerald-500/10'} shrink-0 shadow-inner`}>
                        {Icon && <Icon size={15} />}
                     </div>

                     <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                           <p className="text-xs font-black text-white uppercase tracking-tight truncate">
                              {isExpenses ? cat?.label : (isOwner ? (item.ownerName === 'Andrey' ? 'Андрей' : 'Антон') : 'Доп. Доход')}
                           </p>
                           <p className={`text-xs font-mono font-black ${isExpenses ? 'text-rose-400' : 'text-emerald-400'}`}>
                              {isExpenses ? '-' : '+'}${item.amount.toLocaleString()}
                           </p>
                        </div>
                        <div className="flex justify-between items-center mt-1">
                           <p className="text-xs text-slate-400 italic truncate pr-4 font-medium">{item.comment || '—'}</p>
                           <p className="text-[8px] font-bold text-slate-600 font-mono shrink-0 uppercase tracking-tighter">{item.date}</p>
                        </div>
                     </div>

                     <button 
                        onClick={() => { if(confirm('Вы действительно хотите удалить эту запись?')) onRemove(item.id); }} 
                        className="opacity-0 group-hover:opacity-100 p-1.5 bg-rose-500/10 hover:bg-rose-500/30 text-rose-400/90 rounded-lg transition-all absolute -right-2 top-1/2 -translate-y-1/2 group-hover:right-3.5"
                     >
                        <ICONS.Trash size={12}/>
                     </button>
                  </div>
                  
                  {item.platform && item.platform !== 'all' && (
                     <div className="px-4 pb-2 -mt-1 flex justify-end">
                        <span className="text-[7px] font-mono font-black uppercase tracking-widest text-slate-600 border border-white/5 px-1.5 rounded-sm">
                           {item.platform}
                        </span>
                     </div>
                  )}
               </div>
            );
         })
      )}
   </div>
);

export default Owner;
