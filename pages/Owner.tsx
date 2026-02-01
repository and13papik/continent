
import React, { useState, useMemo } from 'react';
import { AppState, OwnerManualExpense, OwnerManualIncome, OwnerAdvance, Platform } from '../types';
import { ICONS } from '../constants';

interface OwnerProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const CATEGORIES = {
  traffic: { label: 'Трафик', icon: ICONS.ChevronRight, color: 'text-amber-400' },
  infra: { label: 'Инфраструктура', icon: ICONS.Settings, color: 'text-sky-400' },
  items: { label: 'Покупки (белье/игрушки)', icon: ICONS.Gift, color: 'text-rose-400' },
  commission: { label: 'Комиссия', icon: ICONS.Income, color: 'text-indigo-400' },
  bonus: { label: 'Бонусы', icon: ICONS.Bonus, color: 'text-emerald-400' },
  other: { label: 'Прочее', icon: ICONS.Reports, color: 'text-slate-400' }
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
  const [advancePlatform, setAdvancePlatform] = useState<Platform>('onlyFans');
  const [advanceAmount, setAdvanceAmount] = useState('');
  const [advanceComment, setAdvanceComment] = useState('');

  const activePeriodId = state.selectedPeriodId;
  const activePeriod = state.accountingPeriods.find(p => p.id === activePeriodId)!;

  const stats = useMemo(() => {
    const incomes = state.incomeData.filter(r => r.periodId === activePeriodId);
    const manualIncomes = (state.ownerManualIncomes || []).filter(i => i.periodId === activePeriodId);
    const ops = state.operationsData.filter(o => o.periodId === activePeriodId);
    const modelBonuses = (state.modelBonuses || []).filter(b => b.periodId === activePeriodId);
    
    const rawPlatformGross = incomes.reduce((sum, r) => sum + r.total, 0);
    const manualGross = manualIncomes.reduce((sum, i) => sum + i.amount, 0);
    const totalRefundAmount = ops.filter(o => o.type === 'refund').reduce((s, o) => s + o.amount, 0);

    const grossTotal = (rawPlatformGross + manualGross) - totalRefundAmount;

    // ЗП Операторов
    const rawStaffNet = incomes.reduce((sum, r) => sum + (r.nettoOF + r.nettoPP + r.nettoCrypto), 0);
    const avgOpRate = rawPlatformGross > 0 ? rawStaffNet / rawPlatformGross : 0.20;
    
    const totalStaffExpense = (rawStaffNet - (totalRefundAmount * avgOpRate)) + ops.reduce((sum, o) => {
      if (o.type === 'bonus') return sum + o.amount;
      if (['penalty', 'internship'].includes(o.type)) return sum - o.amount;
      return sum;
    }, 0);

    // ЗП Моделей детально
    const modelSummary = state.models.reduce((acc, model) => {
      const records = incomes.filter(r => r.model === model);
      const mOF = records.reduce((s, r) => s + r.onlyFans, 0) * (state.modelRates.of / 100);
      const mPP = records.reduce((s, r) => s + r.paypal, 0) * (state.modelRates.pp / 100);
      const mCR = records.reduce((s, r) => s + r.crypto, 0) * (state.modelRates.cr / 100);
      
      const mRefunds = ops.filter(o => o.type === 'refund' && o.model === model).reduce((s,o) => s + o.amount, 0);
      const mAdvances = ops.filter(o => o.type === 'advance' && o.model === model).reduce((s,o) => s + o.amount, 0);
      const mBonuses = modelBonuses.filter(b => b.model === model).reduce((s,b) => s+b.amount, 0);
      
      const mAvgRate = records.length > 0 ? (mOF + mPP + mCR) / records.reduce((s,r) => s+r.total, 1) : 0.25;
      
      const accrued = (mOF + mPP + mCR + mBonuses) - (mRefunds * mAvgRate);
      
      acc.accrued += accrued;
      acc.advances += mAdvances;
      return acc;
    }, { accrued: 0, advances: 0 });

    const totalModelExpense = modelSummary.accrued; // Начисления - это расход владельца
    const modelRemainder = modelSummary.accrued - modelSummary.advances;

    // ЗП админов
    const totalAdminSalaries = state.admins.reduce((sum, admin) => {
      return sum + (grossTotal * (admin.rate / 100));
    }, 0);

    const bizExpenses = state.ownerExpenses.filter(e => e.periodId === activePeriodId).reduce((s,e) => s + e.amount, 0);
    
    // Чистая прибыль
    const netProfitTotal = grossTotal - (totalStaffExpense + totalModelExpense + totalAdminSalaries + bizExpenses);
    const sharePerOwner = netProfitTotal / 2;

    const advancesAndreyTotal = (state.ownerAdvances || []).filter(a => a.periodId === activePeriodId && a.ownerName === 'Andrey').reduce((s, a) => s + a.amount, 0);
    const advancesAntonTotal = (state.ownerAdvances || []).filter(a => a.periodId === activePeriodId && a.ownerName === 'Anton').reduce((s, a) => s + a.amount, 0);

    return { 
      grossTotal, rawPlatformGross, manualGross, totalRefundAmount,
      netProfitTotal, sharePerOwner,
      totalStaffExpense, totalModelExpense, totalAdminSalaries, bizExpenses,
      modelSummary, modelRemainder,
      andrey: { totalShare: sharePerOwner, advances: advancesAndreyTotal, final: sharePerOwner - advancesAndreyTotal },
      anton: { totalShare: sharePerOwner, advances: advancesAntonTotal, final: sharePerOwner - advancesAntonTotal },
    };
  }, [state, activePeriodId]);

  const updateAdminRate = (id: string, rate: number) => {
    updateState(prev => ({
      ...prev,
      admins: prev.admins.map(a => a.id === id ? { ...a, rate } : a)
    }));
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '1233211') setIsAuthenticated(true);
    else alert('Неверный код доступа');
  };

  const addBusinessExpense = () => {
    if (!expenseAmount || parseFloat(expenseAmount) <= 0) return;
    const expense: OwnerManualExpense = {
      id: String(Date.now() + Math.random()),
      periodId: activePeriodId,
      category: expenseCategory,
      platform: expensePlatform,
      amount: parseFloat(expenseAmount),
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
    if (!incomeAmount || parseFloat(incomeAmount) <= 0) return;
    const income: OwnerManualIncome = {
      id: String(Date.now() + Math.random()),
      periodId: activePeriodId,
      platform: incomePlatform,
      amount: parseFloat(incomeAmount),
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
    if (!advanceAmount || parseFloat(advanceAmount) <= 0) return;
    const advance: OwnerAdvance = {
      id: String(Date.now() + Math.random()),
      periodId: activePeriodId,
      ownerName: advanceOwner,
      platform: advancePlatform,
      amount: parseFloat(advanceAmount),
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
          <div className="text-slate-400 mt-1">Финансовый аудит за {activePeriod.label}</div>
        </div>
        <button onClick={() => setIsAuthenticated(false)} className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-slate-500 hover:text-white flex items-center gap-2 text-sm transition-all"><ICONS.Lock size={14} /> Выйти</button>
      </header>

      {/* ГЛАВНАЯ СВОДКА */}
      <section className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card p-6 rounded-[2rem] border-emerald-500/40 bg-emerald-500/5 col-span-1 lg:col-span-2">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Clean Gross Total</p>
            <div className="flex items-baseline gap-2">
              <p className="text-3xl font-black font-outfit text-white leading-tight">${stats.grossTotal.toLocaleString(undefined, { minimumFractionDigits: 1 })}</p>
              <div className="flex flex-col">
                 <span className="text-[9px] font-bold text-slate-500">Raw: ${ (stats.rawPlatformGross + stats.manualGross).toLocaleString() }</span>
                 <span className="text-[9px] font-bold text-rose-500">Refunds: -${stats.totalRefundAmount.toLocaleString()}</span>
              </div>
            </div>
          </div>
          <div className="glass-card p-6 rounded-[2rem] border-amber-500/20 bg-amber-500/5">
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Чистая прибыль ($)</p>
             <p className="text-2xl font-black font-outfit text-white leading-tight">${stats.netProfitTotal.toLocaleString(undefined, { minimumFractionDigits: 0 })}</p>
             <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">К распределению 50/50</p>
          </div>
          <div className="glass-card p-6 rounded-[2rem] border-slate-800">
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Общий расход ($)</p>
             <p className="text-2xl font-black font-outfit text-rose-400 leading-tight">-${(stats.grossTotal - stats.netProfitTotal).toLocaleString(undefined, { minimumFractionDigits: 0 })}</p>
             <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">ЗП + Бонусы + Расходы</p>
          </div>
        </div>
      </section>

      {/* ДЕТАЛИЗАЦИЯ МОДЕЛЕЙ */}
      <section className="glass-card p-8 rounded-[2.5rem] border-indigo-500/20 bg-indigo-500/5 shadow-xl space-y-6">
         <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold font-outfit text-white flex items-center gap-3">
               <ICONS.Models className="text-indigo-400" /> Ведомость моделей
            </h2>
            <div className="flex gap-4">
               <div className="text-right">
                  <p className="text-[10px] font-black text-slate-500 uppercase">Начислено ЗП</p>
                  <p className="text-lg font-black text-white">${stats.modelSummary.accrued.toLocaleString(undefined, { minimumFractionDigits: 1 })}</p>
               </div>
               <div className="w-px h-10 bg-slate-800"></div>
               <div className="text-right">
                  <p className="text-[10px] font-black text-amber-500 uppercase">Выдано авансов</p>
                  <p className="text-lg font-black text-amber-400">-${stats.modelSummary.advances.toLocaleString(undefined, { minimumFractionDigits: 1 })}</p>
               </div>
               <div className="w-px h-10 bg-slate-800"></div>
               <div className="text-right">
                  <p className="text-[10px] font-black text-indigo-400 uppercase">Остаток к выплате</p>
                  <p className="text-lg font-black text-indigo-400">${stats.modelRemainder.toLocaleString(undefined, { minimumFractionDigits: 1 })}</p>
               </div>
            </div>
         </div>
      </section>

      {/* КОМИССИИ АДМИНОВ */}
      <section className="glass-card p-8 rounded-[2.5rem] border-slate-800 shadow-xl space-y-6">
        <h2 className="text-2xl font-bold font-outfit text-white flex items-center gap-3">
           <ICONS.Settings className="text-slate-400" /> Комиссии Администраторов
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {state.admins.map(admin => (
            <div key={admin.id} className="bg-slate-900/40 p-5 rounded-3xl border border-slate-800 hover:border-indigo-500/30 transition-all group">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{admin.name}</p>
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <input type="number" className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-indigo-400 font-bold outline-none" value={admin.rate} onChange={(e) => updateAdminRate(admin.id, parseFloat(e.target.value) || 0)} />
                  <span className="absolute right-4 top-3.5 text-slate-500 font-bold">%</span>
                </div>
                <div className="text-right">
                   <p className="text-lg font-mono font-bold text-white">${(stats.grossTotal * (admin.rate / 100)).toFixed(1)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <OwnerShareCard name="Андрей" totalShare={stats.andrey.totalShare} advances={stats.andrey.advances} final={stats.andrey.final} color="amber" />
        <OwnerShareCard name="Антон" totalShare={stats.anton.totalShare} advances={stats.anton.advances} final={stats.anton.final} color="indigo" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="glass-card p-8 rounded-[3rem] border-emerald-500/20 shadow-2xl space-y-8">
            <h2 className="text-2xl font-bold font-outfit text-white flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-inner"><ICONS.Income size={24} /></div>
              Добавить доход
            </h2>
            <div className="space-y-6">
              <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-5 py-4 text-white font-mono outline-none" placeholder="Сумма $" value={incomeAmount} onChange={e => setIncomeAmount(e.target.value)} />
              <select className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-5 py-4 text-white font-bold outline-none" value={incomePlatform} onChange={e => setIncomePlatform(e.target.value as any)}>
                <option value="all">Общий капитал</option>
                <option value="onlyFans">OnlyFans</option>
                <option value="paypal">PayPal</option>
                <option value="crypto">Crypto</option>
              </select>
              <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-5 py-4 text-white outline-none" placeholder="Заметка..." value={incomeComment} onChange={e => setIncomeComment(e.target.value)} />
              <button onClick={addExtraIncome} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-5 rounded-2xl shadow-xl transition-all">Сохранить</button>
            </div>
          </div>

          <div className="glass-card p-8 rounded-[3rem] border-rose-500/20 shadow-2xl space-y-8">
             <h2 className="text-2xl font-bold font-outfit text-white flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 shadow-inner"><ICONS.Penalty size={24} /></div>
                Расходы
             </h2>
             <div className="space-y-6">
                <select className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 text-white font-bold outline-none" value={expenseCategory} onChange={e => setExpenseCategory(e.target.value as any)}>
                   {Object.entries(CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <input type="number" className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 text-white font-mono outline-none" placeholder="Сумма $" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} />
                <input type="text" className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 text-white outline-none" placeholder="Заметка..." value={expenseComment} onChange={e => setExpenseComment(e.target.value)} />
                <button onClick={addBusinessExpense} className="w-full bg-rose-600 hover:bg-rose-500 text-white font-black py-5 rounded-2xl shadow-xl">Сохранить</button>
             </div>
          </div>

          <div className="glass-card p-8 rounded-[3rem] border-amber-500/20 shadow-2xl space-y-8">
            <h2 className="text-2xl font-bold font-outfit text-white flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-inner"><ICONS.Salary size={24} /></div>
              Аванс Owner
            </h2>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setAdvanceOwner('Andrey')} className={`p-4 rounded-2xl border text-sm font-bold transition-all ${advanceOwner === 'Andrey' ? 'bg-amber-500/20 border-amber-500 text-amber-500 shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>Андрей</button>
                  <button onClick={() => setAdvanceOwner('Anton')} className={`p-4 rounded-2xl border text-sm font-bold transition-all ${advanceOwner === 'Anton' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-500 shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>Антон</button>
              </div>
              <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-5 py-4 text-white font-mono outline-none" placeholder="Сумма $" value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)} />
              <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-5 py-4 text-white outline-none" placeholder="Заметка..." value={advanceComment} onChange={e => setAdvanceComment(e.target.value)} />
              <button onClick={addOwnerAdvance} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-5 rounded-2xl shadow-xl active:scale-95">Выдать аванс</button>
            </div>
          </div>
      </div>
    </div>
  );
};

const OwnerShareCard: React.FC<{ name: string; totalShare: number; advances: number; final: number; color: string }> = ({ name, totalShare, advances, final, color }) => (
  <div className={`glass-card p-8 rounded-[3rem] border shadow-2xl ${color === 'amber' ? 'bg-amber-500/10 border-amber-500/30 shadow-amber-500/5' : 'bg-indigo-500/10 border-indigo-500/30 shadow-indigo-500/5'}`}>
    <h3 className="text-3xl font-black font-outfit text-white mb-8 border-b border-slate-800/50 pb-4">{name}</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Доля (50% Clean Net):</p>
        <p className="text-2xl font-bold text-white font-mono">${totalShare.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
      </div>
      <div className="bg-rose-500/5 p-5 rounded-2xl border border-rose-500/10">
        <p className="text-[10px] font-black text-rose-500 uppercase tracking-widest mb-1">Всего авансов:</p>
        <p className="text-2xl font-bold text-rose-500 font-mono">-${advances.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
      </div>
      <div className="col-span-1 md:col-span-2 bg-emerald-500/10 p-6 rounded-2xl border border-emerald-500/20 mt-2 shadow-inner">
        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-[0.3em] mb-2">Итого к выплате на руки:</p>
        <p className="text-4xl font-black font-mono text-white tracking-tighter">${final.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
      </div>
    </div>
  </div>
);

export default Owner;
