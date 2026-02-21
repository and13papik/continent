
import React, { useState, useMemo } from 'react';
import { AppState, OwnerManualExpense, OwnerManualIncome, OwnerAdvance, Platform, OperationRecord } from '../types';
import { ICONS } from '../constants';

interface OwnerProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const CATEGORIES = {
  traffic: { label: 'Трафик', icon: ICONS.ChevronRight, color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  infra: { label: 'Инфраструктура', icon: ICONS.Settings, color: 'text-sky-400', bg: 'bg-sky-500/10', border: 'border-sky-500/20' },
  items: { label: 'Покупки (белье/игрушки)', icon: ICONS.Gift, color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  commission: { label: 'Комиссия', icon: ICONS.Income, color: 'text-indigo-400', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  bonus: { label: 'Бонусы', icon: ICONS.Bonus, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  other: { label: 'Прочее', icon: ICONS.Reports, color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20' }
};

const Owner: React.FC<OwnerProps> = ({ state, updateState }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  
  const [expenseCategory, setExpenseCategory] = useState<keyof typeof CATEGORIES>('traffic');
  const [expensePlatform, setExpensePlatform] = useState<Platform>('onlyFans');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseComment, setExpenseComment] = useState('');

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
      if (!o.model && !state.admins.some(a => a.name === o.operator)) {
        if (o.type === 'bonus') return sum + o.amount;
        if (['penalty', 'internship'].includes(o.type)) return sum - o.amount;
      }
      return sum;
    }, 0);

    const staffPaid = ops.reduce((sum, o) => {
      if (!o.model && !state.admins.some(a => a.name === o.operator)) {
        if (['advance', 'salary_payment'].includes(o.type)) return sum + o.amount;
      }
      return sum;
    }, 0);

    // 2. МОДЕЛИ
    const modelSummary = currentModels.reduce((acc, model) => {
      const records = incomes.filter(r => r.model === model);
      const mOF = records.reduce((s, r) => s + r.onlyFans, 0) * (state.modelRates.of / 100);
      const mPP = records.reduce((s, r) => s + r.paypal, 0) * (state.modelRates.pp / 100);
      const mCR = records.reduce((s, r) => s + r.crypto, 0) * (state.modelRates.cr / 100);
      const mRefunds = ops.filter(o => o.type === 'refund' && o.model === model).reduce((s,o) => s + o.amount, 0);
      const mAdvances = ops.filter(o => o.type === 'advance' && o.model === model).reduce((s,o) => s + o.amount, 0);
      const mSalaries = ops.filter(o => o.type === 'salary_payment' && o.model === model).reduce((s,o) => s + o.amount, 0);
      const mBonuses = modelBonuses.filter(b => b.model === model).reduce((s,b) => s+b.amount, 0);
      const mAvgRate = records.length > 0 ? (mOF + mPP + mCR) / records.reduce((s,r) => s+r.total, 1) : 0.25;
      
      const accrued = (mOF + mPP + mCR + mBonuses) - (mRefunds * mAvgRate);
      acc.accrued += accrued;
      acc.paid += (mAdvances + mSalaries);
      return acc;
    }, { accrued: 0, paid: 0 });

    // 3. АДМИНЫ
    const adminDetails = state.admins.map(admin => {
      const accrued = grossTotal * (admin.rate / 100);
      const paid = ops.filter(o => o.operator === admin.name && !o.model && ['salary_payment', 'advance'].includes(o.type)).reduce((s, o) => s + o.amount, 0);
      return { ...admin, accrued, paid, remainder: accrued - paid };
    });

    const totalAdminAccrued = adminDetails.reduce((s, a) => s + a.accrued, 0);
    const totalAdminPaid = adminDetails.reduce((s, a) => s + a.paid, 0);

    const bizExpenses = state.ownerExpenses.filter(e => e.periodId === activePeriodId).reduce((s,e) => s + e.amount, 0);
    
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
      currentExpenses: state.ownerExpenses.filter(e => e.periodId === activePeriodId),
      currentManualIncomes: (state.ownerManualIncomes || []).filter(i => i.periodId === activePeriodId),
      currentOwnerAdvances: (state.ownerAdvances || []).filter(a => a.periodId === activePeriodId),
      andrey: { totalShare: sharePerOwner, advances: (state.ownerAdvances || []).filter(a => a.periodId === activePeriodId && a.ownerName === 'Andrey').reduce((s, a) => s + a.amount, 0) },
      anton: { totalShare: sharePerOwner, advances: (state.ownerAdvances || []).filter(a => a.periodId === activePeriodId && a.ownerName === 'Anton').reduce((s, a) => s + a.amount, 0) },
    };
  }, [state, activePeriodId, currentModels]);

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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '1123') setIsAuthenticated(true);
    else alert('Неверный код доступа');
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
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center animate-in fade-in zoom-in duration-300">
        <div className="glass-card p-10 rounded-[32px] w-full max-w-md border-amber-500/20 shadow-2xl text-center">
            <ICONS.Owner size={48} className="mx-auto text-amber-500 mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2 font-outfit">Private Dashboard</h1>
            <p className="text-slate-400 text-sm mb-6">Доступ только для владельцев</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="password" autoFocus className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-6 py-4 text-center text-2xl tracking-[0.5em] text-white outline-none" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 rounded-2xl transition-all shadow-lg shadow-amber-600/20">Войти</button>
            </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-amber-500"><ICONS.Owner size={20} /></span>
            <span className="text-xs font-black uppercase tracking-[0.3em] text-amber-500/70">Partnership Analytics</span>
          </div>
          <h1 className="text-4xl font-bold font-outfit text-white">Панель Владельца</h1>
          <div className="text-slate-400 mt-1">Аудит за {activePeriod.label}</div>
        </div>
        <button onClick={() => setIsAuthenticated(false)} className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-slate-500 hover:text-white flex items-center gap-2 text-sm transition-all shadow-lg active:scale-95"><ICONS.Lock size={14} /> Выйти</button>
      </header>

      {/* ГЛАВНАЯ СВОДКА ПРИБЫЛИ */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card p-6 rounded-[2rem] border-emerald-500/40 bg-emerald-500/5 col-span-1 lg:col-span-2">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Clean Gross Total</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-black font-outfit text-white leading-tight">${stats.grossTotal.toLocaleString(undefined, { minimumFractionDigits: 1 })}</p>
              <div className="flex flex-col">
                 <span className="text-[9px] font-bold text-slate-500">Platform: ${stats.rawPlatformGross.toLocaleString()}</span>
                 <span className="text-[9px] font-bold text-rose-500">Refunds: -${stats.totalRefundAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="glass-card p-6 rounded-[2rem] border-amber-500/20 bg-amber-500/5">
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Чистая прибыль ($)</p>
             <p className="text-2xl font-black font-outfit text-white leading-tight">${stats.netProfitTotal.toLocaleString(undefined, { minimumFractionDigits: 0 })}</p>
             <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">50% доля = ${stats.sharePerOwner.toLocaleString()}</p>
          </div>
          <div className="glass-card p-6 rounded-[2rem] border-rose-500/20 bg-rose-500/5">
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Бизнес расходы ($)</p>
             <p className="text-2xl font-black font-outfit text-rose-400 leading-tight">-${stats.bizExpenses.toLocaleString()}</p>
             <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">Трафик / Инфра / Покупки</p>
          </div>
      </section>

      {/* ГЛОБАЛЬНАЯ ВЕДОМОСТЬ ВЫПЛАТ */}
      <section className="glass-card p-8 rounded-[2.5rem] border-slate-800 shadow-2xl">
         <h2 className="text-2xl font-bold font-outfit text-white mb-6 flex items-center gap-3">
            <ICONS.Salary className="text-indigo-400" /> Payroll Summary
         </h2>
         <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
            <PayrollStatCard title="ОБЩАЯ ЗП АДМИНОВ" accrued={stats.adminAccrued} paid={stats.adminPaid} color="indigo" />
            <PayrollStatCard title="ОБЩАЯ ЗП МОДЕЛЕЙ" accrued={stats.modelAccrued} paid={stats.modelPaid} color="emerald" />
            <PayrollStatCard title="ОБЩАЯ ЗП ОПЕРАТОРОВ" accrued={stats.staffAccrued} paid={stats.staffPaid} color="sky" />
            <div className="lg:col-span-2 grid grid-cols-2 gap-4">
               <div className="bg-slate-900/40 p-5 rounded-3xl border border-slate-800 flex flex-col justify-center">
                  <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">ВЫПЛАЧЕНО ВСЕГО</p>
                  <p className="text-2xl font-black text-white font-mono">${stats.totalPaidGlobal.toLocaleString()}</p>
               </div>
               <div className="bg-indigo-500/10 p-5 rounded-3xl border border-indigo-500/20 flex flex-col justify-center">
                  <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mb-1">ОСТАТОК ВСЕГО</p>
                  <p className="text-2xl font-black text-indigo-400 font-mono">${stats.totalRemainderGlobal.toLocaleString()}</p>
               </div>
            </div>
         </div>
      </section>

      {/* ВЕДОМОСТЬ АДМИНОВ */}
      <section className="glass-card rounded-[2.5rem] overflow-hidden border-slate-800 shadow-xl">
         <div className="p-6 bg-slate-900/40 border-b border-slate-800 flex justify-between items-center">
            <h3 className="text-xl font-bold font-outfit text-white">Ведомость Админов</h3>
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Calculated as % of Clean Gross</span>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
               <thead>
                  <tr className="bg-slate-900/50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-800">
                     <th className="px-8 py-5">Администратор</th>
                     <th className="px-6 py-5 text-center">Ставка (%)</th>
                     <th className="px-6 py-5 text-center">Начислено ($)</th>
                     <th className="px-6 py-5 text-center">Выплачено ($)</th>
                     <th className="px-6 py-5 text-center">Остаток ($)</th>
                     <th className="px-8 py-5 text-right">Внести выплату</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-800">
                  {stats.adminDetails.map(admin => (
                     <tr key={admin.id} className="hover:bg-indigo-500/5 transition-colors">
                        <td className="px-8 py-4 font-bold text-white">{admin.name}</td>
                        <td className="px-6 py-4 text-center font-mono text-slate-400">{admin.rate}%</td>
                        <td className="px-6 py-4 text-center font-mono font-bold text-white">${admin.accrued.toFixed(1)}</td>
                        <td className="px-6 py-4 text-center font-mono text-emerald-400">${admin.paid.toFixed(1)}</td>
                        <td className={`px-6 py-4 text-center font-mono font-black ${admin.remainder > 0 ? 'text-indigo-400' : 'text-slate-500'}`}>${admin.remainder.toFixed(1)}</td>
                        <td className="px-8 py-4 text-right">
                           <div className="flex justify-end gap-2">
                              <input 
                                 type="number" 
                                 className="w-20 bg-slate-950 border border-slate-800 rounded-lg px-2 py-1 text-xs text-white outline-none focus:border-indigo-500" 
                                 placeholder="0"
                                 value={adminPaidInputs[admin.name] || ''}
                                 onChange={e => setAdminPaidInputs(prev => ({...prev, [admin.name]: e.target.value}))}
                              />
                              <button onClick={() => addAdminPayment(admin.name)} className="bg-indigo-600 hover:bg-indigo-500 text-white p-1.5 rounded-lg transition-all active:scale-90"><ICONS.Plus size={14}/></button>
                           </div>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </section>

      {/* ВЛАДЕЛЬЦЫ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OwnerShareCard name="Андрей" totalShare={stats.sharePerOwner} advances={stats.andrey.advances} color="amber" />
        <OwnerShareCard name="Антон" totalShare={stats.sharePerOwner} advances={stats.anton.advances} color="indigo" />
      </div>

      {/* ФОРМЫ ВВОДА РАСХОДОВ И ДОХОДОВ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="glass-card p-8 rounded-[3rem] border-emerald-500/20 shadow-2xl flex flex-col">
            <h2 className="text-2xl font-bold font-outfit text-white mb-6 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500"><ICONS.Income size={24} /></div>
              Внести доход
            </h2>
            <div className="space-y-4">
              <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-5 py-4 text-white font-mono outline-none" placeholder="Сумма $" value={incomeAmount} onChange={e => setIncomeAmount(e.target.value)} />
              <select className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-5 py-4 text-white font-bold outline-none" value={incomePlatform} onChange={e => setIncomePlatform(e.target.value as any)}>
                <option value="all">Общий счет</option>
                <option value="onlyFans">OnlyFans</option>
                <option value="paypal">PayPal</option>
                <option value="crypto">Crypto</option>
              </select>
              <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-5 py-4 text-white outline-none" placeholder="Заметка..." value={incomeComment} onChange={e => setIncomeComment(e.target.value)} />
              <button onClick={addExtraIncome} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl shadow-xl">Сохранить</button>
            </div>
            <HistoryList items={stats.currentManualIncomes} onRemove={(id: string) => updateState(p => ({...p, deletedIds: [...p.deletedIds, id], ownerManualIncomes: p.ownerManualIncomes?.filter(i => i.id !== id)}))} title="История доходов" />
          </div>

          <div className="glass-card p-8 rounded-[3rem] border-rose-500/20 shadow-2xl flex flex-col">
             <h2 className="text-2xl font-bold font-outfit text-white mb-6 flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500"><ICONS.Penalty size={24} /></div>
                Расходы
             </h2>
             <div className="space-y-4">
                <select className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 text-white font-bold outline-none" value={expenseCategory} onChange={e => setExpenseCategory(e.target.value as any)}>
                   {Object.entries(CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <input type="number" className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 text-white font-mono outline-none" placeholder="Сумма $" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} />
                <input type="text" className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 text-white outline-none" placeholder="Заметка..." value={expenseComment} onChange={e => setExpenseComment(e.target.value)} />
                <button onClick={addBusinessExpense} className="w-full bg-rose-600 hover:bg-rose-500 text-white font-black py-4 rounded-2xl shadow-xl">Сохранить</button>
             </div>
             <HistoryList items={stats.currentExpenses} onRemove={(id: string) => updateState(p => ({...p, deletedIds: [...p.deletedIds, id], ownerExpenses: p.ownerExpenses.filter(e => e.id !== id)}))} title="История расходов" isExpenses />
          </div>

          <div className="glass-card p-8 rounded-[3rem] border-amber-500/20 shadow-2xl flex flex-col">
            <h2 className="text-2xl font-bold font-outfit text-white mb-6 flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500"><ICONS.Salary size={24} /></div>
              Аванс Owner
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setAdvanceOwner('Andrey')} className={`p-4 rounded-2xl border text-sm font-bold transition-all ${advanceOwner === 'Andrey' ? 'bg-amber-500/20 border-amber-500 text-amber-500 shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>Андрей</button>
                  <button onClick={() => setAdvanceOwner('Anton')} className={`p-4 rounded-2xl border text-sm font-bold transition-all ${advanceOwner === 'Anton' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-500 shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>Антон</button>
              </div>
              <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-5 py-4 text-white font-mono outline-none" placeholder="Сумма $" value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)} />
              <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-5 py-4 text-white outline-none" placeholder="Заметка..." value={advanceComment} onChange={e => setAdvanceComment(e.target.value)} />
              <button onClick={addOwnerAdvance} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-4 rounded-2xl shadow-xl">Выдать</button>
            </div>
            <HistoryList items={stats.currentOwnerAdvances} onRemove={(id: string) => updateState(p => ({...p, deletedIds: [...p.deletedIds, id], ownerAdvances: p.ownerAdvances.filter(a => a.id !== id)}))} title="История авансов" isOwner />
          </div>
      </div>
    </div>
  );
};

const PayrollStatCard = ({ title, accrued, paid, color }: any) => (
   <div className="bg-slate-900/40 p-5 rounded-3xl border border-slate-800 flex flex-col gap-2 transition-transform hover:scale-[1.02]">
      <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">{title}</p>
      <div className="flex flex-col">
         <span className="text-xl font-black text-white font-mono">${accrued.toFixed(0)}</span>
         <div className="flex justify-between items-center mt-1">
            <span className="text-[10px] text-slate-500 uppercase font-bold">Paid: ${paid.toFixed(0)}</span>
            <span className={`text-[10px] font-black uppercase text-${color}-400`}>Rest: ${(accrued - paid).toFixed(0)}</span>
         </div>
      </div>
      <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden mt-1">
         <div className={`h-full bg-${color}-500 transition-all`} style={{ width: `${Math.min(100, (paid/accrued)*100)}%` }}></div>
      </div>
   </div>
);

const HistoryList = ({ items, onRemove, title, isOwner, isExpenses }: any) => (
   <div className="mt-8 space-y-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
      <h3 className="text-[10px] font-black uppercase text-slate-500 tracking-widest border-b border-slate-800 pb-3 flex justify-between">
         {title}
         <span className="text-[8px] opacity-40">Total entries: {items.length}</span>
      </h3>
      {items.length === 0 ? <p className="text-xs text-slate-700 italic py-6 text-center">История пуста</p> : items.map((item: any) => {
         const cat = isExpenses ? (CATEGORIES[item.category as keyof typeof CATEGORIES] || CATEGORIES.other) : null;
         
         return (
            <div key={item.id} className="group relative bg-slate-900/40 hover:bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden transition-all duration-300 hover:border-slate-700 hover:shadow-xl hover:shadow-black/20">
               {isExpenses && <div className={`absolute left-0 top-0 bottom-0 w-1 ${cat?.color.replace('text-', 'bg-')}`}></div>}
               <div className="p-4 flex items-center gap-4">
                  {isExpenses ? (
                     <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${cat?.bg || ''} ${cat?.color || ''} border ${cat?.border || ''} shrink-0 shadow-inner`}>
                        {cat && <cat.icon size={18} />}
                     </div>
                  ) : (
                     <div className="w-10 h-10 rounded-xl bg-emerald-500/5 flex items-center justify-center text-emerald-500 border border-emerald-500/10 shrink-0">
                        {isOwner ? <ICONS.Owner size={18} /> : <ICONS.Income size={18} />}
                     </div>
                  )}

                  <div className="flex-1 min-w-0">
                     <div className="flex justify-between items-start">
                        <p className="text-xs font-black text-white uppercase tracking-tight truncate">
                           {isExpenses ? cat?.label : (isOwner ? item.ownerName : 'Income')}
                        </p>
                        <p className={`text-sm font-black font-mono ${isExpenses ? 'text-rose-400' : 'text-emerald-400'}`}>
                           {isExpenses ? '-' : '+'}${item.amount.toLocaleString()}
                        </p>
                     </div>
                     <div className="flex justify-between items-center mt-0.5">
                        <p className="text-xs text-slate-500 italic truncate pr-4">{item.comment || '—'}</p>
                        <p className="text-[8px] font-bold text-slate-600 font-mono shrink-0 uppercase tracking-tighter">{item.date}</p>
                     </div>
                  </div>

                  <button 
                    onClick={() => { if(confirm('Удалить запись?')) onRemove(item.id); }} 
                    className="opacity-0 group-hover:opacity-100 p-2 hover:bg-rose-500/20 text-slate-600 hover:text-rose-500 rounded-lg transition-all absolute -right-2 top-1/2 -translate-y-1/2 group-hover:right-2"
                  >
                    <ICONS.Trash size={14}/>
                  </button>
               </div>
               
               {item.platform && item.platform !== 'all' && (
                  <div className="px-4 pb-2 -mt-1 flex justify-end">
                     <span className="text-[7px] font-black uppercase tracking-widest text-slate-700 border border-slate-800 px-1.5 rounded-sm">
                        {item.platform}
                     </span>
                  </div>
               )}
            </div>
         );
      })}
   </div>
);

const OwnerShareCard: React.FC<{ name: string; totalShare: number; advances: number; color: string }> = ({ name, totalShare, advances, color }) => (
  <div className={`glass-card p-8 rounded-[3rem] border shadow-2xl ${color === 'amber' ? 'bg-amber-500/10 border-amber-500/30' : 'bg-indigo-500/10 border-indigo-500/30'}`}>
    <h3 className="text-3xl font-black font-outfit text-white mb-6 border-b border-slate-800/50 pb-4">{name}</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-slate-950/40 p-4 rounded-2xl border border-slate-800">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Доля (50% Clean Net):</p>
        <p className="text-xl font-bold text-white font-mono">${totalShare.toLocaleString(undefined, { minimumFractionDigits: 1 })}</p>
      </div>
      <div className="bg-rose-500/5 p-4 rounded-2xl border border-rose-500/10">
        <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Всего авансов:</p>
        <p className="text-xl font-bold text-rose-500 font-mono">-${advances.toLocaleString(undefined, { minimumFractionDigits: 1 })}</p>
      </div>
      <div className="col-span-1 md:col-span-2 bg-emerald-500/10 p-5 rounded-2xl border border-emerald-500/20 mt-2">
        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-1">Итого к выплате:</p>
        <p className="text-3xl font-black font-mono text-white tracking-tighter">${(totalShare - advances).toLocaleString(undefined, { minimumFractionDigits: 1 })}</p>
      </div>
    </div>
  </div>
);

export default Owner;
