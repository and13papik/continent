
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
  const [expandedAdminInputs, setExpandedAdminInputs] = useState<Record<string, boolean>>({});
  const [paymentSuccessAdmin, setPaymentSuccessAdmin] = useState<string | null>(null);
  const [quickExpenseSuccess, setQuickExpenseSuccess] = useState(false);

  const toggleAdminInput = (adminName: string) => {
    setExpandedAdminInputs(prev => ({ ...prev, [adminName]: !prev[adminName] }));
  };

  const handleQuickExpenseSubmit = () => {
    const amt = parseFloat(expenseAmount);
    if (isNaN(amt) || amt <= 0) return;
    addBusinessExpense();
    setQuickExpenseSuccess(true);
    setTimeout(() => {
      setQuickExpenseSuccess(false);
    }, 1500);
  };

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
      if (o.operator && o.operator !== 'SYSTEM' && !o.model && !currentAdmins.some(a => a.name === o.operator)) {
        if (o.type === 'bonus') return sum + o.amount;
        if (['penalty', 'internship'].includes(o.type)) return sum - o.amount;
      }
      return sum;
    }, 0);

    const staffPaid = ops.reduce((sum, o) => {
      if (o.operator && o.operator !== 'SYSTEM' && !o.model && !currentAdmins.some(a => a.name === o.operator)) {
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

    const staffRemainder = Math.max(0, staffAccrued - staffPaid);
    const modelRemainder = Math.max(0, modelSummary.accrued - modelSummary.paid);
    const adminRemainder = Math.max(0, totalAdminAccrued - totalAdminPaid);

    const totalPaidGlobal = staffPaid + modelSummary.paid + totalAdminPaid;
    const totalRemainderGlobal = staffRemainder + modelRemainder + adminRemainder;

    return { 
      grossTotal, rawPlatformGross, manualGross, totalRefundAmount,
      netProfitTotal, sharePerOwner,
      staffAccrued, staffPaid, staffRemainder,
      modelAccrued: modelSummary.accrued, modelPaid: modelSummary.paid, modelRemainder,
      adminAccrued: totalAdminAccrued, adminPaid: totalAdminPaid, adminRemainder,
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
    setExpandedAdminInputs(prev => ({ ...prev, [adminName]: false }));

    setPaymentSuccessAdmin(adminName);
    setTimeout(() => {
      setPaymentSuccessAdmin(null);
    }, 450);
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

  const prevPeriodStats = useMemo(() => {
    const sorted = [...state.accountingPeriods].sort((a,b) => (a.startAt || a.id).localeCompare(b.startAt || b.id));
    const idx = sorted.findIndex(p => p.id === activePeriodId);
    if (idx <= 0) return null;
    const prevPeriodId = sorted[idx - 1].id;
    
    const incomes = state.incomeData.filter(r => r.periodId === prevPeriodId);
    if (incomes.length === 0) return null;
    const manualIncomes = (state.ownerManualIncomes || []).filter(i => i.periodId === prevPeriodId);
    const ops = state.operationsData.filter(o => o.periodId === prevPeriodId);
    const rawPlatformGross = incomes.reduce((sum, r) => sum + r.total, 0);
    const manualGross = manualIncomes.reduce((sum, i) => sum + i.amount, 0);
    const totalRefundAmount = ops.filter(o => o.type === 'refund').reduce((s, o) => s + o.amount, 0);
    const grossTotal = (rawPlatformGross + manualGross) - totalRefundAmount;

    const rawStaffNet = incomes.reduce((sum, r) => sum + (r.nettoOF + r.nettoPP + r.nettoCrypto), 0);
    const avgOpRate = rawPlatformGross > 0 ? rawStaffNet / rawPlatformGross : 0.20;
    const staffAccrued = (rawStaffNet - (totalRefundAmount * avgOpRate)) + ops.reduce((sum, o) => {
      if (o.operator) {
        if (o.type === 'bonus') return sum + o.amount;
        if (['penalty', 'internship'].includes(o.type)) return sum - o.amount;
      }
      return sum;
    }, 0);

    const prevPeriodObj = sorted[idx - 1];
    const prevModels = prevPeriodObj.models || state.models;
    const prevRates = prevPeriodObj.modelRates || state.modelRates;
    const prevAdmins = prevPeriodObj.admins || state.admins;
    const prevBonuses = (state.modelBonuses || []).filter(b => b.periodId === prevPeriodId);

    const modelSummary = prevModels.reduce((acc, model) => {
      const records = incomes.filter(r => r.model === model);
      const mOF = records.reduce((s, r) => s + r.onlyFans, 0) * (prevRates.of / 100);
      const mPP = records.reduce((s, r) => s + r.paypal, 0) * (prevRates.pp / 100);
      const mCR = records.reduce((s, r) => s + r.crypto, 0) * (prevRates.cr / 100);
      const mRefunds = ops.filter(o => o.type === 'refund' && o.model === model).reduce((s,o) => s + o.amount, 0);
      const mBonuses = prevBonuses.filter(b => b.model === model).reduce((s,b) => s+b.amount, 0);
      const mAvgRate = records.length > 0 ? (mOF + mPP + mCR) / records.reduce((s,r) => s+r.total, 1) : (prevRates.of / 100);
      const accrued = (mOF + mPP + mCR + mBonuses) - (mRefunds * mAvgRate);
      acc.accrued += accrued;
      return acc;
    }, { accrued: 0 });

    const totalAdminAccrued = prevAdmins.reduce((s, a) => s + grossTotal * (a.rate / 100), 0);
    const bizExpenses = state.ownerExpenses.filter(e => e.periodId === prevPeriodId).reduce((s,e) => s + e.amount, 0);
    const netProfitTotal = grossTotal - (staffAccrued + modelSummary.accrued + totalAdminAccrued + bizExpenses);
    const sharePerOwner = netProfitTotal / 2;
    const andreyAdv = (state.ownerAdvances || []).filter(a => a.periodId === prevPeriodId && a.ownerName === 'Andrey').reduce((s, a) => s + a.amount, 0);
    const antonAdv = (state.ownerAdvances || []).filter(a => a.periodId === prevPeriodId && a.ownerName === 'Anton').reduce((s, a) => s + a.amount, 0);

    return {
      andreyAvailable: sharePerOwner - andreyAdv,
      antonAvailable: sharePerOwner - antonAdv,
    };
  }, [state, activePeriodId]);

  const andreyTrend = useMemo(() => {
    if (!prevPeriodStats || prevPeriodStats.andreyAvailable <= 0) return null;
    const diff = andreyAvailable - prevPeriodStats.andreyAvailable;
    const pct = (diff / prevPeriodStats.andreyAvailable) * 100;
    return { pct, isUp: pct >= 0 };
  }, [andreyAvailable, prevPeriodStats]);

  const antonTrend = useMemo(() => {
    if (!prevPeriodStats || prevPeriodStats.antonAvailable <= 0) return null;
    const diff = antonAvailable - prevPeriodStats.antonAvailable;
    const pct = (diff / prevPeriodStats.antonAvailable) * 100;
    return { pct, isUp: pct >= 0 };
  }, [antonAvailable, prevPeriodStats]);

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

         {/* TOP HEADER ROW: OWNERS Title + Indicator + Action Buttons */}
         <div className="relative z-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-white/[0.06]">
            <div className="flex items-center gap-3">
               <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500/20 via-amber-400/10 to-amber-500/5 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.15)]">
                  <ICONS.Owner size={16} className="text-amber-400" />
               </div>
               <div className="flex items-center gap-2.5">
                  <h2 className="text-sm font-black font-outfit text-white uppercase tracking-wider">
                     ВЛАДЕЛЬЦЫ
                  </h2>
                  <span className="inline-flex items-center justify-center p-1 rounded-full bg-emerald-500/10 border border-emerald-500/20" title="Синхронизировано с БД">
                     <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.8)]"></span>
                  </span>
               </div>
            </div>

            {/* Notice if Month hasn't started yet */}
            {stats.grossTotal === 0 && totalProfit === 0 && (
               <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[10px] text-amber-300 font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                  <span>Ожидается первый доход</span>
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
                  Ожидается первый доход
               </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-5">
               {/* ANDREY CARD (Warm Amber Accent) */}
               <div className="group relative p-5 rounded-2xl bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-amber-500/[0.06] via-slate-900/80 to-slate-950/95 hover:from-amber-500/[0.09] border border-amber-500/20 hover:border-amber-500/40 hover:shadow-[0_0_25px_rgba(245,158,11,0.12)] transition-all duration-300 flex flex-col justify-between backdrop-blur-md min-h-[190px] lg:min-h-[205px]">
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
                     <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] font-extrabold font-mono uppercase tracking-[0.15em] text-slate-400 block mb-0.5">
                           К ВЫПЛАТЕ
                        </span>
                        {andreyTrend && (
                           <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold font-mono border ${andreyTrend.isUp ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                              {andreyTrend.isUp ? '↑' : '↓'} {Math.abs(andreyTrend.pct).toFixed(1).replace('.', ',')}% к прошлому месяцу
                           </span>
                        )}
                     </div>
                     <div className="text-4xl sm:text-5xl lg:text-6xl font-black font-mono text-white tracking-tight drop-shadow-[0_0_18px_rgba(245,158,11,0.25)] whitespace-nowrap overflow-hidden text-ellipsis">
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
                           {stats.andrey.advances > 0 ? formatUsd(stats.andrey.advances) : '—'}
                        </span>
                     </div>
                  </div>
               </div>

               {/* ANTON CARD (Cool Sky-Blue Accent) */}
               <div className="group relative p-5 rounded-2xl bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-sky-500/[0.06] via-slate-900/80 to-slate-950/95 hover:from-sky-500/[0.09] border border-sky-500/20 hover:border-sky-500/40 hover:shadow-[0_0_25px_rgba(56,189,248,0.12)] transition-all duration-300 flex flex-col justify-between backdrop-blur-md min-h-[190px] lg:min-h-[205px]">
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
                     <div className="flex items-center justify-between gap-2">
                        <span className="text-[9px] font-extrabold font-mono uppercase tracking-[0.15em] text-slate-400 block mb-0.5">
                           К ВЫПЛАТЕ
                        </span>
                        {antonTrend && (
                           <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold font-mono border ${antonTrend.isUp ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'}`}>
                              {antonTrend.isUp ? '↑' : '↓'} {Math.abs(antonTrend.pct).toFixed(1).replace('.', ',')}% к прошлому месяцу
                           </span>
                        )}
                     </div>
                     <div className="text-4xl sm:text-5xl lg:text-6xl font-black font-mono text-white tracking-tight drop-shadow-[0_0_18px_rgba(56,189,248,0.25)] whitespace-nowrap overflow-hidden text-ellipsis">
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
                           {stats.anton.advances > 0 ? formatUsd(stats.anton.advances) : '—'}
                        </span>
                     </div>
                  </div>
               </div>
            </div>
         </div>

         {/* BOTTOM COMPACT SECONDARY GENERAL STATS ROW */}
         <div className="relative z-10 pt-3 border-t border-white/[0.08] flex items-center justify-between flex-wrap gap-2 text-[11px] font-mono">
            <div className="flex items-center gap-3 sm:gap-5 flex-wrap w-full justify-between sm:justify-start">
               <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-semibold text-slate-400">Общий доход</span>
                  <span className="text-xs font-bold text-slate-100">{formatUsd(stats.grossTotal)}</span>
               </div>
               <span className="text-slate-700 hidden sm:inline">•</span>
               <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-semibold text-slate-400">Общая прибыль</span>
                  <span className="text-xs font-bold text-emerald-400">{formatUsd(totalProfit)}</span>
               </div>
               <span className="text-slate-700 hidden sm:inline">•</span>
               <div className="flex items-center gap-1.5">
                  <span className="text-[10px] uppercase font-semibold text-slate-400">Авансы</span>
                  <span className={totalAdvances > 0 ? "text-xs font-bold text-rose-400" : "text-xs font-bold text-slate-400"}>
                     {totalAdvances > 0 ? formatUsd(totalAdvances) : '—'}
                  </span>
               </div>
               <span className="text-slate-700 hidden sm:inline">•</span>
               <div className="flex items-center gap-1.5 bg-white/[0.04] px-2.5 py-1 rounded-lg border border-white/10">
                  <span className="text-[10px] uppercase font-bold text-slate-300">Остаток</span>
                  <span className="text-xs font-black text-emerald-300">{formatUsd(totalAvailable)}</span>
               </div>
            </div>
         </div>
      </div>

      {/* GLOBAL PAYROLL & ADMINISTRATOR HUB - РАВНОВЕСНАЯ ВЕДОМОСТЬ КОМАНДЫ */}
      <section className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-b from-[#0B0F19] via-[#0D1322] to-[#070A12] border border-slate-800/80 p-4 sm:p-5 shadow-2xl backdrop-blur-2xl">
         {/* Subtle Ambient Background Glows */}
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[300px] bg-indigo-500/[0.03] rounded-full blur-[140px] pointer-events-none" />
         <div className="absolute -top-20 -right-20 w-80 h-80 bg-violet-500/[0.03] rounded-full blur-[120px] pointer-events-none" />

         <div className="relative z-10 flex flex-col lg:flex-row gap-5 lg:gap-6 items-stretch">
            {/* LEFT COLUMN: ВЫПЛАТЫ КОМАНДЫ (~38-40% width) */}
            <div className="lg:w-[39%] xl:w-[38%] flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-white/[0.06] pb-5 lg:pb-0 lg:pr-6 xl:pr-7">
               <div>
                  {/* Header */}
                  <div className="flex items-center gap-2.5 mb-3">
                     <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-inner">
                        <ICONS.Salary size={15} />
                     </div>
                     <h2 className="text-xs sm:text-sm font-black font-outfit text-white uppercase tracking-wider">
                        ВЫПЛАТЫ КОМАНДЫ
                     </h2>
                  </div>

                  {/* Unified Top Summary Panel */}
                  <div className="relative p-3.5 sm:p-4 rounded-2xl bg-gradient-to-br from-indigo-500/[0.06] via-slate-950/80 to-slate-950/95 border border-indigo-500/20 shadow-lg mb-3 backdrop-blur-md overflow-hidden group">
                     <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/[0.08] rounded-full blur-2xl pointer-events-none group-hover:bg-indigo-500/[0.12] transition-all" />
                     
                     <div className="flex items-center justify-between gap-3 relative z-10">
                        <div>
                           <span className="text-[9px] font-extrabold font-mono uppercase tracking-widest text-indigo-300/90 flex items-center gap-1.5 mb-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_8px_rgba(129,140,248,0.8)]"></span>
                              Осталось выплатить
                           </span>
                           <div className="text-2xl sm:text-3xl font-black font-mono text-white tracking-tight drop-shadow-[0_0_12px_rgba(129,140,248,0.25)]">
                              ${stats.totalRemainderGlobal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                           </div>
                        </div>

                        <div className="text-right border-l border-white/10 pl-4 py-0.5">
                           <span className="text-[9px] font-extrabold font-mono uppercase tracking-widest text-slate-400 block mb-1">
                              Выплачено
                           </span>
                           <div className="text-base sm:text-lg font-bold font-mono text-emerald-400">
                              ${stats.totalPaidGlobal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* 3 Compact Category Rows */}
                  <div className="space-y-2">
                     <PayrollCategoryRow 
                        title="Администраторы" 
                        accrued={stats.adminAccrued} 
                        paid={stats.adminPaid} 
                        iconBg="bg-indigo-500"
                        borderColor="border-indigo-500/20"
                        hoverBorder="hover:border-indigo-500/40 hover:bg-indigo-500/[0.03]"
                        progressGradient="bg-gradient-to-r from-indigo-500 to-violet-400"
                     />
                     <PayrollCategoryRow 
                        title="Модели" 
                        accrued={stats.modelAccrued} 
                        paid={stats.modelPaid} 
                        iconBg="bg-emerald-400"
                        borderColor="border-emerald-500/20"
                        hoverBorder="hover:border-emerald-500/40 hover:bg-emerald-500/[0.03]"
                        progressGradient="bg-gradient-to-r from-emerald-500 to-teal-400"
                     />
                     <PayrollCategoryRow 
                        title="Операторы" 
                        accrued={stats.staffAccrued} 
                        paid={stats.staffPaid} 
                        iconBg="bg-sky-400"
                        borderColor="border-sky-500/20"
                        hoverBorder="hover:border-sky-500/40 hover:bg-sky-500/[0.03]"
                        progressGradient="bg-gradient-to-r from-sky-500 to-blue-400"
                     />
                  </div>
               </div>

               {/* Bottom Segmented Bar: РАСПРЕДЕЛЕНИЕ ОБЯЗАТЕЛЬСТВ */}
               {totalPayrollAccrued > 0 && (
                  <div className="pt-2.5 mt-3 border-t border-white/[0.06]">
                     <div className="flex justify-between items-center text-[9px] font-extrabold font-mono text-slate-400 uppercase tracking-wider mb-1.5">
                        <span>Распределение обязательств</span>
                        <span className="text-slate-300">${totalPayrollAccrued.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                     </div>
                     
                     <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden flex p-[1px] border border-white/10 shadow-inner mb-2">
                        <div className="h-full bg-indigo-500 rounded-l-full transition-all duration-500" style={{ width: `${adminPct}%` }} title={`Админы: $${stats.adminAccrued.toLocaleString()} (${adminPct.toFixed(0)}%)`} />
                        <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${modelPct}%` }} title={`Модели: $${stats.modelAccrued.toLocaleString()} (${modelPct.toFixed(0)}%)`} />
                        <div className="h-full bg-sky-500 rounded-r-full transition-all duration-500" style={{ width: `${staffPct}%` }} title={`Операторы: $${stats.staffAccrued.toLocaleString()} (${staffPct.toFixed(0)}%)`} />
                     </div>

                     {/* Legend below bar */}
                     <div className="flex items-center justify-between text-[8.5px] font-mono text-slate-400">
                        <div className="flex items-center gap-1">
                           <span className="w-1.5 h-1.5 rounded-full bg-indigo-400"></span>
                           <span>Админы: <strong className="text-white">${stats.adminAccrued.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> ({adminPct.toFixed(0)}%)</span>
                        </div>
                        <div className="flex items-center gap-1">
                           <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                           <span>Модели: <strong className="text-white">${stats.modelAccrued.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> ({modelPct.toFixed(0)}%)</span>
                        </div>
                        <div className="flex items-center gap-1">
                           <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                           <span>Оп: <strong className="text-white">${stats.staffAccrued.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong> ({staffPct.toFixed(0)}%)</span>
                        </div>
                     </div>
                  </div>
               )}
            </div>

            {/* RIGHT COLUMN: ВЕДОМОСТЬ АДМИНОВ (~60-62% width) */}
            <div className="lg:w-[61%] xl:w-[62%] flex flex-col justify-between pl-0 lg:pl-2">
               <div>
                  {/* Header */}
                  <div className="flex items-center gap-2.5 mb-3">
                     <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                        <ICONS.Users size={14} />
                     </div>
                     <h3 className="text-xs sm:text-sm font-black font-outfit text-white uppercase tracking-wider">
                        ВЕДОМОСТЬ АДМИНОВ
                     </h3>
                  </div>

                  {/* Admin Cards Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mb-2">
                     {stats.adminDetails.map(admin => {
                        const isExpanded = !!expandedAdminInputs[admin.name];
                        const isSuccess = paymentSuccessAdmin === admin.name;
                        const displayRemaining = Math.max(0, admin.remainder);
   const totalRequired = Math.max(admin.accrued, admin.paid);
   const repaymentProgress = totalRequired > 0 ? Math.min((admin.paid / totalRequired) * 100, 100) : 0;

                        return (
                           <div 
                              key={admin.id}
                              className={`relative group p-3.5 rounded-2xl bg-[radial-gradient(ellipse_at_top_left,_var(--tw-gradient-stops))] from-indigo-500/[0.04] via-slate-900/85 to-slate-950/95 border transition-all duration-300 flex flex-col justify-between overflow-hidden shadow-lg backdrop-blur-md ${
                                 isSuccess 
                                    ? 'border-emerald-500/60 shadow-[0_0_20px_rgba(52,211,153,0.3)] bg-emerald-500/[0.08]' 
                                    : 'border-indigo-500/15 hover:border-indigo-500/40 hover:bg-indigo-500/[0.06] hover:shadow-[0_0_20px_rgba(99,102,241,0.15)]'
                              }`}
                           >
                              {/* Subtle Background Glow */}
                              <div className="absolute top-0 right-0 w-28 h-28 bg-indigo-500/[0.03] group-hover:bg-indigo-500/[0.07] rounded-full blur-xl pointer-events-none transition-all" />

                              {/* Top Row: Avatar + Admin Name + Rate + Status Badge */}
                              <div className="flex items-center justify-between gap-2 z-10 mb-1.5">
                                 <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/20 to-violet-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-300 font-black text-xs font-outfit shadow-md shrink-0">
                                       {admin.name.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                       <div className="flex items-center gap-1.5">
                                          <h4 className="font-extrabold text-xs text-white tracking-tight truncate">{admin.name}</h4>
                                          <span className="px-1.5 py-0.2 rounded bg-indigo-500/15 text-indigo-300 text-[8.5px] font-bold font-mono border border-indigo-500/20">
                                             {admin.rate}%
                                          </span>
                                       </div>
                                       <span className="text-[9px] text-slate-400 font-medium">Ставка от дохода</span>
                                    </div>
                                 </div>

                                 {displayRemaining > 0 ? (
                                    <span className="text-[7.5px] font-bold font-mono uppercase bg-indigo-500/10 text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-500/25 shrink-0">
                                       ДОЛГ
                                    </span>
                                 ) : admin.accrued === 0 ? (
                                    <span className="text-[7.5px] font-bold font-mono uppercase bg-slate-800/80 text-slate-400 px-2 py-0.5 rounded-md border border-slate-700/50 shrink-0">
                                       НЕТ НАЧИСЛЕНИЙ
                                    </span>
                                 ) : (
                                    <span className="text-[7.5px] font-bold font-mono uppercase bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-md border border-emerald-500/25 shrink-0">
                                       ОПЛАЧЕНО
                                    </span>
                                 )}
                              </div>

                              {/* Center Metrics Grid: Начислено | Выплачено | Осталось (Main metric) */}
                              <div className="my-2 p-2 rounded-xl bg-slate-950/70 border border-white/[0.04] grid grid-cols-3 gap-1 z-10 font-mono text-center">
                                 <div className="flex flex-col items-center justify-center">
                                    <span className="text-[7.5px] font-extrabold uppercase text-slate-400 tracking-wider mb-0.5">Начислено</span>
                                    <span className="text-xs font-bold text-slate-200">
                                       ${admin.accrued.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </span>
                                 </div>
                                 <div className="flex flex-col items-center justify-center border-x border-white/[0.06] px-1">
                                    <span className="text-[7.5px] font-extrabold uppercase text-slate-400 tracking-wider mb-0.5">Выплачено</span>
                                    <span className="text-xs font-bold text-emerald-400">
                                       ${admin.paid.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </span>
                                 </div>
                                 <div className="flex flex-col items-center justify-center">
                                    <span className="text-[7.5px] font-extrabold uppercase text-indigo-300 tracking-wider mb-0.5">Осталось</span>
                                    <span className="text-base sm:text-lg font-black text-indigo-200 drop-shadow-[0_0_10px_rgba(165,180,252,0.4)]">
                                       ${displayRemaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                    </span>
                                 </div>
                              </div>

                              {/* Repayment Progress Bar (only if accrued > 0) */}
                              {admin.accrued > 0 && (
                                 <div className="mb-2 z-10">
                                    <div className="flex justify-between items-center text-[8.5px] font-mono text-slate-400 mb-1">
                                       <span>Выплачено</span>
                                       <span className="font-bold text-emerald-400">{repaymentProgress.toFixed(0)}%</span>
                                    </div>
                                    <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                                       <div className="h-full bg-gradient-to-r from-emerald-500 to-indigo-500 rounded-full transition-all duration-500" style={{ width: `${Math.min(100, repaymentProgress)}%` }} />
                                    </div>
                                 </div>
                              )}

                              {/* Action area: Button "ВНЕСТИ ВЫПЛАТУ" or expanded input */}
                              <div className="z-10 mt-auto pt-1">
                                 {!isExpanded ? (
                                    <button
                                       disabled={displayRemaining === 0}
                                       onClick={() => toggleAdminInput(admin.name)}
                                       className={`w-full py-1.5 px-3 rounded-xl text-[10px] font-bold font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                                          displayRemaining === 0 
                                             ? 'bg-slate-900/50 text-slate-600 border border-slate-800/80 cursor-not-allowed opacity-40'
                                             : 'bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-200 border border-indigo-500/35 hover:border-indigo-500/50 hover:shadow-[0_0_12px_rgba(99,102,241,0.2)] active:scale-95'
                                       }`}
                                    >
                                       <ICONS.Plus size={11} />
                                       Внести выплату
                                    </button>
                                 ) : (
                                    <div className="flex items-center gap-1.5 animate-in fade-in zoom-in-95 duration-200">
                                       <div className="relative flex-1">
                                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] text-slate-400 pointer-events-none select-none">$</span>
                                          <input 
                                             type="number" 
                                             autoFocus
                                             className="w-full bg-slate-950 border border-indigo-500/40 rounded-xl pl-5 pr-2 py-1 text-[11px] text-white font-mono outline-none focus:ring-1 focus:ring-indigo-400 placeholder-slate-500" 
                                             placeholder="Сумма"
                                             value={adminPaidInputs[admin.name] || ''}
                                             onChange={e => setAdminPaidInputs(prev => ({...prev, [admin.name]: e.target.value}))}
                                             onKeyDown={e => e.key === 'Enter' && addAdminPayment(admin.name)}
                                          />
                                       </div>
                                       <button 
                                          onClick={() => addAdminPayment(admin.name)} 
                                          className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl h-[28px] px-2.5 transition-all active:scale-95 shadow-md flex items-center justify-center shrink-0 text-[11px] font-mono"
                                          title="Подтвердить выплату"
                                       >
                                          ✓
                                       </button>
                                       <button 
                                          onClick={() => toggleAdminInput(admin.name)} 
                                          className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl h-[28px] w-[28px] transition-all active:scale-95 flex items-center justify-center shrink-0 text-xs font-bold"
                                          title="Отмена"
                                       >
                                          ✕
                                       </button>
                                    </div>
                                 )}
                              </div>
                           </div>
                        );
                     })}
                  </div>
               </div>

               {/* БЫСТРЫЙ РАСХОД (Quick Expense Block) */}
               {(() => {
                  const categoryTint = {
                     traffic: 'bg-amber-500/[0.03] border-amber-500/20 hover:border-amber-500/35',
                     infra: 'bg-sky-500/[0.03] border-sky-500/20 hover:border-sky-500/35',
                     items: 'bg-rose-500/[0.03] border-rose-500/20 hover:border-rose-500/35',
                     commission: 'bg-indigo-500/[0.03] border-indigo-500/20 hover:border-indigo-500/35',
                     bonus: 'bg-emerald-500/[0.03] border-emerald-500/20 hover:border-emerald-500/35',
                     other: 'bg-slate-500/[0.03] border-slate-500/20 hover:border-slate-500/35',
                  }[expenseCategory] || 'bg-slate-950/60 border-white/[0.08]';

                  return (
                     <div className={`p-3 sm:p-3.5 rounded-2xl border transition-all duration-300 relative overflow-hidden backdrop-blur-md mt-2 ${categoryTint}`}>
                        {/* Upper row: Title + Metric */}
                        <div className="flex items-center justify-between gap-2 mb-2.5">
                           <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                                 <ICONS.Wallet size={13} />
                              </div>
                              <div>
                                 <div className="flex items-center gap-2">
                                    <h4 className="text-xs font-black font-outfit text-white uppercase tracking-wider">
                                       БЫСТРЫЙ РАСХОД
                                    </h4>
                                    {quickExpenseSuccess && (
                                       <span className="text-[8.5px] font-mono font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-1.5 py-0.2 rounded-md animate-in fade-in zoom-in-90 duration-200">
                                          ✓ Добавлено
                                       </span>
                                    )}
                                 </div>
                                 <span className="text-[9px] font-medium text-slate-400">Добавить операционный расход</span>
                              </div>
                           </div>

                           <div className="text-right font-mono">
                              <span className="text-[9px] text-slate-400 uppercase mr-1">Расходы периода:</span>
                              <span className="text-xs font-extrabold text-white">
                                 ${stats.bizExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                              </span>
                           </div>
                        </div>

                        {/* Form in 2 compact rows */}
                        <div className="space-y-2">
                           {/* Row 1: Category Selector + Amount Input */}
                           <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                              {/* Horizontal Segmented Category Selector */}
                              <div className="flex-1 flex items-center gap-1 overflow-x-auto p-1 rounded-xl bg-slate-950/90 border border-white/[0.06] no-scrollbar">
                                 {Object.entries(CATEGORIES).map(([key, cat]) => (
                                    <button
                                       key={key}
                                       type="button"
                                       onClick={() => setExpenseCategory(key as any)}
                                       className={`px-2 py-1 rounded-lg text-[9.5px] font-mono font-bold whitespace-nowrap transition-all ${
                                          expenseCategory === key 
                                             ? `${cat.bg} ${cat.color} ${cat.border} border shadow-sm` 
                                             : 'text-slate-400 hover:text-slate-200'
                                       }`}
                                    >
                                       {key === 'items' ? 'Покупки' : cat.label}
                                    </button>
                                 ))}
                              </div>

                              {/* Amount Input */}
                              <div className="w-full sm:w-32 relative shrink-0">
                                 <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-xs text-slate-400">$</span>
                                 <input
                                    type="number"
                                    placeholder="Сумма"
                                    value={expenseAmount}
                                    onChange={(e) => setExpenseAmount(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && handleQuickExpenseSubmit()}
                                    className="w-full bg-slate-950/90 border border-white/10 rounded-xl pl-6 pr-2 py-1.5 text-xs font-mono font-bold text-white outline-none focus:border-indigo-500/50 placeholder-slate-500"
                                 />
                              </div>
                           </div>

                           {/* Row 2: Description + Submit Button */}
                           <div className="flex items-center gap-2">
                              <input
                                 type="text"
                                 placeholder="Описание / комментарий (необязательно)"
                                 value={expenseComment}
                                 onChange={(e) => setExpenseComment(e.target.value)}
                                 onKeyDown={(e) => e.key === 'Enter' && handleQuickExpenseSubmit()}
                                 className="flex-1 bg-slate-950/90 border border-white/10 rounded-xl px-3 py-1.5 text-xs font-mono text-slate-200 outline-none focus:border-indigo-500/50 placeholder-slate-500"
                              />
                              <button
                                 type="button"
                                 onClick={handleQuickExpenseSubmit}
                                 disabled={!expenseAmount || parseFloat(expenseAmount) <= 0}
                                 className={`px-3.5 py-1.5 rounded-xl font-mono text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shrink-0 ${
                                    !expenseAmount || parseFloat(expenseAmount) <= 0
                                       ? 'bg-slate-900/60 text-slate-600 border border-slate-800/80 cursor-not-allowed opacity-40'
                                       : 'bg-indigo-600 hover:bg-indigo-500 text-white border border-indigo-500/30 shadow-md shadow-indigo-600/20 active:scale-95'
                                 }`}
                              >
                                 <ICONS.Plus size={12} />
                                 Добавить расход
                              </button>
                           </div>
                        </div>
                     </div>
                  );
               })()}
            </div>
         </div>
      </section>

      {/* РАСХОДЫ: АНАЛИТИКА И ИСТОРИЯ ОПЕРАЦИЙ */}
      <div className="flex flex-col gap-6">
            <section className="glass-card rounded-[2.5rem] border border-white/5 shadow-2xl bg-gradient-to-b from-slate-950 via-slate-950/95 to-slate-900/60 relative overflow-hidden backdrop-blur-2xl">
               {/* Ambient glowing fields */}
               <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/[0.02] rounded-full blur-[100px] pointer-events-none" />
               <div className="absolute bottom-0 left-0 w-96 h-96 bg-violet-500/[0.015] rounded-full blur-[100px] pointer-events-none" />
               
               {/* Шапка Бизнес расходов */}
               <div className="p-5 sm:p-6 border-b border-white/[0.04] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative z-10">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shadow-md">
                        <ICONS.Wallet size={18} />
                     </div>
                     <div>
                        <h2 className="text-xl font-black font-outfit text-white uppercase tracking-tight">РАСХОДЫ</h2>
                        <p className="text-[10px] font-medium text-slate-400 mt-0.5">Аналитика и операции за выбранный период</p>
                     </div>
                  </div>
                  
                  {/* Общий итог компании */}
                  <div className="bg-indigo-500/[4%] border border-indigo-500/15 px-4 py-2 rounded-xl text-right font-mono hover:border-indigo-500/30 transition-all duration-300">
                     <span className="text-[8px] font-bold text-indigo-300 uppercase tracking-wider block mb-0.5">Всего расходов периода</span>
                     <span className="text-xl font-extrabold text-white">${stats.bizExpenses.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                  </div>
               </div>

               <div className="p-5 sm:p-6 space-y-6 relative z-10">
                  {/* Верхняя аналитическая строка */}
                  {(() => {
                     const catTotals = Object.keys(CATEGORIES).map(k => {
                        const sum = stats.currentExpenses.filter(e => e.category === k).reduce((s, e) => s + e.amount, 0);
                        return { key: k, sum };
                     });
                     catTotals.sort((a, b) => b.sum - a.sum);
                     const topCatObj = catTotals[0]?.sum > 0 ? CATEGORIES[catTotals[0].key as keyof typeof CATEGORIES] : null;
                     const topCatLabel = topCatObj ? (catTotals[0].key === 'items' ? 'Покупки' : topCatObj.label) : '—';
                     const topCatSum = topCatObj ? `$${catTotals[0].sum.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '';

                     const opsCount = stats.currentExpenses.length;
                     const avgExpense = opsCount > 0 ? Math.round(stats.bizExpenses / opsCount) : 0;
                     const latestOp = opsCount > 0 ? stats.currentExpenses[0] : null;

                     return (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                           {/* 1. Главная категория */}
                           <div className="bg-slate-950/60 border border-white/[0.05] rounded-2xl p-3 flex flex-col justify-between">
                              <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-1">Главная категория</span>
                              <div className="flex items-baseline justify-between gap-1">
                                 <span className="text-xs sm:text-sm font-extrabold text-white truncate font-outfit">{topCatLabel}</span>
                                 {topCatSum && <span className="text-[10px] font-mono font-bold text-indigo-400 shrink-0">{topCatSum}</span>}
                              </div>
                           </div>

                           {/* 2. Количество операций */}
                           <div className="bg-slate-950/60 border border-white/[0.05] rounded-2xl p-3 flex flex-col justify-between">
                              <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-1">Количество операций</span>
                              <span className="text-xs sm:text-sm font-extrabold text-white font-mono">{opsCount} {opsCount === 1 ? 'операция' : (opsCount >= 2 && opsCount <= 4 ? 'операции' : 'операций')}</span>
                           </div>

                           {/* 3. Средний расход */}
                           <div className="bg-slate-950/60 border border-white/[0.05] rounded-2xl p-3 flex flex-col justify-between">
                              <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-1">Средний расход</span>
                              <span className="text-xs sm:text-sm font-extrabold text-white font-mono">${avgExpense.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                           </div>

                           {/* 4. Последняя операция */}
                           <div className="bg-slate-950/60 border border-white/[0.05] rounded-2xl p-3 flex flex-col justify-between min-w-0">
                              <span className="text-[9px] font-mono font-bold text-slate-400 uppercase tracking-wider block mb-1">Последняя операция</span>
                              <span className="text-xs sm:text-sm font-extrabold text-white font-mono truncate">
                                 {latestOp ? `$${latestOp.amount.toLocaleString()} (${CATEGORIES[latestOp.category as keyof typeof CATEGORIES]?.label || 'Прочее'})` : '—'}
                              </span>
                           </div>
                        </div>
                     );
                  })()}

                  {/* Основная область: При отсутствии данных аккуратное пустое состояние */}
                  {stats.currentExpenses.length === 0 ? (
                     <div className="py-10 px-4 rounded-2xl bg-slate-950/40 border border-white/[0.03] text-center flex flex-col items-center justify-center gap-2">
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-1 shadow-inner">
                           <ICONS.Wallet size={22} />
                        </div>
                        <h3 className="text-sm font-black font-outfit text-white uppercase tracking-wider">
                           Расходов за этот период пока нет
                        </h3>
                        <p className="text-xs font-medium text-slate-400 max-w-sm">
                           Добавьте первую операцию через блок «Быстрый расход» выше.
                        </p>
                     </div>
                  ) : (
                     <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        {/* Слева — распределение расходов */}
                        <div className="lg:col-span-5 bg-slate-950/50 border border-white/[0.04] p-4 sm:p-5 rounded-2xl space-y-4">
                           <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
                              <h3 className="text-xs font-black font-outfit text-white uppercase tracking-wider">
                                 Распределение расходов
                              </h3>
                              <span className="text-[10px] font-mono text-slate-400">
                                 По категориям
                              </span>
                           </div>

                           <div className="space-y-3">
                              {(() => {
                                 const sortedCats = Object.entries(CATEGORIES).map(([k, v]) => {
                                    const total = stats.currentExpenses.filter(e => e.category === k).reduce((s, e) => s + e.amount, 0);
                                    const pct = stats.bizExpenses > 0 ? (total / stats.bizExpenses) * 100 : 0;
                                    return { key: k, category: v, total, pct };
                                 });
                                 sortedCats.sort((a, b) => b.total - a.total);

                                 return sortedCats.map(({ key, category, total, pct }) => {
                                    const isItems = key === 'items';
                                    const label = isItems ? 'Покупки' : category.label;

                                    return (
                                       <div key={key} className="space-y-1.5 p-2 rounded-xl hover:bg-white/[0.02] transition-colors">
                                          <div className="flex items-center justify-between text-xs font-mono">
                                             <div className="flex items-center gap-2 min-w-0">
                                                <span className={`w-2 h-2 rounded-full ${category.color.replace('text-', 'bg-')} shrink-0`} />
                                                <span className="text-slate-200 font-bold truncate">{label}</span>
                                             </div>
                                             <div className="flex items-center gap-2 shrink-0">
                                                <span className="text-[10px] font-semibold text-slate-500">({pct.toFixed(0)}%)</span>
                                                <span className="text-white font-black">${total.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                                             </div>
                                          </div>
                                          <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden p-[0.5px]">
                                             <div 
                                                className={`h-full rounded-full transition-all duration-500 ${category.color.replace('text-', 'bg-')}`} 
                                                style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} 
                                             />
                                          </div>
                                       </div>
                                    );
                                 });
                              })()}
                           </div>
                        </div>

                        {/* Справа — журнал операций */}
                        <div className="lg:col-span-7 bg-slate-950/50 border border-white/[0.04] p-4 sm:p-5 rounded-2xl space-y-4">
                           <div className="flex items-center justify-between pb-2 border-b border-white/[0.04]">
                              <h3 className="text-xs font-black font-outfit text-white uppercase tracking-wider">
                                 Журнал операций
                              </h3>
                              <span className="text-[10px] font-mono text-slate-400">
                                 Записи периода ({stats.currentExpenses.length})
                              </span>
                           </div>

                           <div className="space-y-2.5">
                              <div className="relative">
                                 <ICONS.Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                                 <input 
                                    type="text" 
                                    placeholder="Поиск по расходам..." 
                                    className="bg-slate-950 border border-white/10 rounded-xl pl-8.5 pr-3 py-1.5 text-xs text-white outline-none focus:border-indigo-500/50 w-full placeholder-slate-500 font-mono transition-colors"
                                    value={expenseSearch}
                                    onChange={e => setExpenseSearch(e.target.value)}
                                 />
                              </div>

                              <div className="flex flex-wrap gap-1 overflow-x-auto no-scrollbar pb-0.5">
                                 <button 
                                    onClick={() => setExpenseFilter('all')}
                                    className={`px-2.5 py-1 rounded-lg text-[9.5px] font-mono font-bold uppercase tracking-wider transition-all border ${expenseFilter === 'all' ? 'bg-indigo-600 text-white border-indigo-500 shadow-sm' : 'bg-slate-950 text-slate-400 border-white/5 hover:border-white/15'}`}
                                 >
                                    Все
                                 </button>
                                 {Object.entries(CATEGORIES).map(([k, v]) => {
                                    const isChosen = expenseFilter === k;
                                    const label = k === 'items' ? 'Покупки' : v.label;
                                    return (
                                       <button 
                                          key={k}
                                          onClick={() => setExpenseFilter(k as any)}
                                          className={`px-2.5 py-1 rounded-lg text-[9.5px] font-mono font-bold uppercase tracking-wider transition-all border ${isChosen ? `${v.bg} ${v.color} ${v.border} shadow-sm` : 'bg-slate-950 text-slate-400 border-white/5 hover:border-white/15'}`}
                                       >
                                          {label}
                                       </button>
                                    );
                                 })}
                              </div>
                           </div>

                           <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1 scrollbar-hide">
                              {(() => {
                                 const filtered = stats.currentExpenses.filter(e => {
                                    const matchesFilter = expenseFilter === 'all' || e.category === expenseFilter;
                                    const matchesSearch = !expenseSearch || 
                                       e.comment?.toLowerCase().includes(expenseSearch.toLowerCase()) ||
                                       (CATEGORIES[e.category as keyof typeof CATEGORIES] as any)?.label.toLowerCase().includes(expenseSearch.toLowerCase());
                                    return matchesFilter && matchesSearch;
                                 });

                                 if (filtered.length === 0) {
                                    return (
                                       <div className="text-center py-8 bg-slate-950/40 rounded-xl border border-white/[0.02]">
                                          <p className="text-xs font-mono font-medium text-slate-500">Операции не найдены</p>
                                       </div>
                                    );
                                 }

                                 return filtered.map(item => {
                                    const cat = CATEGORIES[item.category as keyof typeof CATEGORIES] || CATEGORIES.other;
                                    const Icon = cat.icon;
                                    const catLabel = item.category === 'items' ? 'Покупки' : cat.label;

                                    return (
                                       <div key={item.id} className="group relative bg-slate-950/80 hover:bg-slate-900/80 border border-white/[0.04] hover:border-white/10 rounded-xl p-3 flex items-center justify-between gap-3 transition-all duration-200">
                                          <div className="flex items-center gap-3 min-w-0 flex-1">
                                             <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cat.bg} ${cat.color} border ${cat.border} shrink-0`}>
                                                <Icon size={14} />
                                             </div>
                                             <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2">
                                                   <span className="text-xs font-extrabold font-outfit text-white truncate">{catLabel}</span>
                                                   <span className="text-[9px] font-mono text-slate-500 shrink-0">{item.date}</span>
                                                </div>
                                                <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                                                   {item.comment || 'Без описания'}
                                                </p>
                                             </div>
                                          </div>

                                          <div className="flex items-center gap-3 shrink-0">
                                             <span className="text-xs font-mono font-black text-rose-400">
                                                -${item.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                             </span>
                                             <button 
                                                onClick={() => { if(confirm('Вы действительно хотите удалить эту запись?')) updateState(p => ({...p, deletedIds: [...p.deletedIds, item.id], ownerExpenses: p.ownerExpenses.filter(e => e.id !== item.id)})); }} 
                                                className="p-1.5 text-slate-500 hover:text-rose-400 bg-white/5 hover:bg-rose-500/10 rounded-lg transition-colors"
                                                title="Удалить"
                                             >
                                                <ICONS.Trash size={12}/>
                                             </button>
                                          </div>
                                       </div>
                                    );
                                 });
                              })()}
                           </div>
                        </div>
                     </div>
                  )}
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

const PayrollCategoryRow = ({ title, accrued, paid, iconBg, borderColor, hoverBorder, progressGradient }: any) => {
   const rawRemaining = accrued - paid;
   const displayRemaining = Math.max(0, rawRemaining);
   const totalRequired = Math.max(accrued, paid);
   const progress = totalRequired > 0 ? Math.min((paid / totalRequired) * 100, 100) : 0;

   return (
      <div className={`p-3 rounded-2xl bg-slate-950/60 border ${borderColor} ${hoverBorder} transition-all duration-200 shadow-sm relative group overflow-hidden`}>
         <div className="flex justify-between items-center mb-1.5 relative z-10">
            <div className="flex items-center gap-2">
               <span className={`w-2 h-2 rounded-md ${iconBg} shadow-sm`} />
               <span className="text-[11px] font-black font-outfit text-white uppercase tracking-wider">{title}</span>
            </div>
            <div className="text-right font-mono">
               <span className="text-[9px] font-semibold text-slate-400 uppercase mr-1">Начислено:</span>
               <span className="text-xs font-bold text-white">${accrued.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
            </div>
         </div>
         
         <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono font-medium mb-2 relative z-10">
            <span>Выплачено: <strong className="text-emerald-400 font-bold">${paid.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></span>
            <span>Осталось: <strong className="text-slate-200 font-bold">${displayRemaining.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong></span>
         </div>
         
         <div className="w-full h-1.5 bg-slate-900/80 rounded-full overflow-hidden border border-white/[0.04] relative z-10">
            <div className={`h-full ${progressGradient} rounded-full transition-all duration-500`} style={{ width: `${Math.min(100, progress)}%` }} />
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
