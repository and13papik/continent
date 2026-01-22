
import React, { useState, useMemo } from 'react';
import { AppState, OwnerManualExpense, OwnerManualIncome, OwnerAdvance, Platform, Admin } from '../types';
import { ICONS, PLATFORM_NAMES } from '../constants';

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

  const [editingExpense, setEditingExpense] = useState<OwnerManualExpense | null>(null);
  const [editingAdvance, setEditingAdvance] = useState<OwnerAdvance | null>(null);
  const [editingIncome, setEditingIncome] = useState<OwnerManualIncome | null>(null);

  const activePeriodId = state.selectedPeriodId;
  const activePeriod = state.accountingPeriods.find(p => p.id === activePeriodId)!;

  const stats = useMemo(() => {
    const incomes = state.incomeData.filter(r => r.periodId === activePeriodId);
    const manualIncomes = (state.ownerManualIncomes || []).filter(i => i.periodId === activePeriodId);
    const ops = state.operationsData.filter(o => o.periodId === activePeriodId);
    const modelBonuses = (state.modelBonuses || []).filter(b => b.periodId === activePeriodId);
    
    const platformGross = incomes.reduce((sum, r) => sum + r.total, 0);
    const manualGross = manualIncomes.reduce((sum, i) => sum + i.amount, 0);
    const grossTotal = platformGross + manualGross;

    const grossOF = incomes.reduce((sum, r) => sum + r.onlyFans, 0);
    const grossPP = incomes.reduce((sum, r) => sum + r.paypal, 0);
    const grossCR = incomes.reduce((sum, r) => sum + r.crypto, 0);

    const totalStaffNetIncomes = incomes.reduce((sum, r) => sum + (r.nettoOF + r.nettoPP + r.nettoCrypto), 0);
    const operatorStaffAdjustments = ops.reduce((sum, o) => {
      if (o.type === 'bonus') return sum + o.amount;
      if (['penalty', 'refund', 'internship'].includes(o.type)) return sum - o.amount;
      return sum;
    }, 0);
    const totalStaffExpense = totalStaffNetIncomes + operatorStaffAdjustments;

    const totalModelSalariesBasic = state.models.reduce((sum, model) => {
      const records = incomes.filter(r => r.model === model);
      const mOF = records.reduce((s, r) => s + r.onlyFans, 0) * (state.modelRates.of / 100);
      const mPP = records.reduce((s, r) => s + r.paypal, 0) * (state.modelRates.pp / 100);
      const mCR = records.reduce((s, r) => s + r.crypto, 0) * (state.modelRates.cr / 100);
      return sum + mOF + mPP + mCR;
    }, 0);
    const totalModelBonuses = modelBonuses.reduce((sum, b) => sum + b.amount, 0);
    const totalModelExpense = totalModelSalariesBasic + totalModelBonuses;

    const totalAdminSalaries = state.admins.reduce((sum, admin) => {
      return sum + (grossTotal * (admin.rate / 100));
    }, 0);

    const bizExpenses = state.ownerExpenses.filter(e => e.periodId === activePeriodId).reduce((s,e) => s + e.amount, 0);
    const netProfitTotal = grossTotal - (totalStaffExpense + totalModelExpense + totalAdminSalaries + bizExpenses);
    const sharePerOwner = netProfitTotal / 2;

    const advancesAndreyTotal = (state.ownerAdvances || []).filter(a => a.periodId === activePeriodId && a.ownerName === 'Andrey').reduce((s, a) => s + a.amount, 0);
    const advancesAntonTotal = (state.ownerAdvances || []).filter(a => a.periodId === activePeriodId && a.ownerName === 'Anton').reduce((s, a) => s + a.amount, 0);

    return { 
      grossTotal, platformGross, manualGross,
      grossOF, grossPP, grossCR,
      netProfitTotal, sharePerOwner,
      totalStaffExpense, totalModelExpense, totalModelBonuses, totalAdminSalaries, bizExpenses,
      andrey: { totalShare: sharePerOwner, advances: advancesAndreyTotal, final: sharePerOwner - advancesAndreyTotal },
      anton: { totalShare: sharePerOwner, advances: advancesAntonTotal, final: sharePerOwner - advancesAntonTotal },
      modelBonusesList: modelBonuses,
      manualIncomesList: manualIncomes
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

  const removeIncome = (id: string) => {
    if(!confirm('Удалить доход?')) return;
    updateState(prev => ({ 
      ...prev, 
      deletedIds: [...prev.deletedIds, id],
      ownerManualIncomes: (prev.ownerManualIncomes || []).filter(i => i.id !== id) 
    }));
  };

  const updateIncome = () => {
    if (!editingIncome) return;
    updateState(prev => ({
      ...prev,
      ownerManualIncomes: (prev.ownerManualIncomes || []).map(i => i.id === editingIncome.id ? { ...editingIncome, updatedAt: new Date().toISOString() } : i)
    }));
    setEditingIncome(null);
  };

  const updateExpense = () => {
    if (!editingExpense) return;
    updateState(prev => ({
      ...prev,
      ownerExpenses: prev.ownerExpenses.map(e => e.id === editingExpense.id ? { ...editingExpense, updatedAt: new Date().toISOString() } : e)
    }));
    setEditingExpense(null);
  };

  const removeExpense = (id: string) => {
    if(!confirm('Удалить расход?')) return;
    updateState(prev => ({ 
      ...prev, 
      deletedIds: [...prev.deletedIds, id],
      ownerExpenses: prev.ownerExpenses.filter(e => e.id !== id) 
    }));
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

  const updateAdvance = () => {
    if (!editingAdvance) return;
    updateState(prev => ({
      ...prev,
      ownerAdvances: (prev.ownerAdvances || []).map(a => a.id === editingAdvance.id ? { ...editingAdvance, updatedAt: new Date().toISOString() } : a)
    }));
    setEditingAdvance(null);
  };

  const removeAdvance = (id: string) => {
    if(!confirm('Удалить аванс?')) return;
    updateState(prev => ({ 
      ...prev, 
      deletedIds: [...prev.deletedIds, id],
      ownerAdvances: (prev.ownerAdvances || []).filter(a => a.id !== id) 
    }));
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center animate-in fade-in zoom-in duration-300">
        <div className="glass-card p-10 rounded-[32px] w-full max-w-md border-amber-500/20 shadow-2xl shadow-amber-500/5 text-center">
            <ICONS.Owner size={48} className="mx-auto text-amber-500 mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2 font-outfit">Private Dashboard</h1>
            <p className="text-slate-400 text-sm mb-6">Доступ только для владельцев</p>
            <form onSubmit={handleLogin} className="space-y-4">
              <input type="password" autoFocus className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-6 py-4 text-center text-2xl tracking-[0.5em] text-white focus:ring-2 focus:ring-amber-500 outline-none transition-all" value={password} onChange={(e) => setPassword(e.target.value)} />
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
          <div className="text-slate-400 mt-1">Детализация прибыли за {activePeriod.label}</div>
        </div>
        <button onClick={() => setIsAuthenticated(false)} className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl text-slate-500 hover:text-white flex items-center gap-2 text-sm transition-all hover:border-slate-700"><ICONS.Lock size={14} /> Заблокировать</button>
      </header>

      <section className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card p-6 rounded-[2rem] border-indigo-500/40 bg-indigo-500/5 transition-transform hover:scale-[1.02]">
            <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">Общий Брутто (ЧИСТЫЕ ID)</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-black font-outfit text-white leading-tight">${stats.grossTotal.toLocaleString(undefined, { minimumFractionDigits: 1 })}</p>
              {stats.manualGross > 0 && <p className="text-[11px] font-bold text-emerald-400 font-mono">(${stats.platformGross.toLocaleString()} + {stats.manualGross.toLocaleString()})</p>}
            </div>
            <p className="text-[10px] opacity-40 mt-1 font-bold uppercase tracking-tighter">Все платформы + Остатки</p>
          </div>
          <BalanceCard title="OnlyFans Brutto" value={stats.grossOF} sub="Gross OF" color="blue" />
          <BalanceCard title="PayPal Brutto" value={stats.grossPP} sub="Gross PP" color="sky" />
          <BalanceCard title="Crypto Brutto" value={stats.grossCR} sub="Gross CR" color="emerald" />
        </div>
      </section>

      <section className="glass-card p-8 rounded-[2.5rem] border-indigo-500/20 shadow-xl space-y-6">
        <div className="flex items-center justify-between">
           <h2 className="text-2xl font-bold font-outfit text-white flex items-center gap-3">
              <ICONS.Settings className="text-indigo-400" /> Комиссии Администраторов
           </h2>
           <span className="text-[10px] font-black uppercase text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full border border-indigo-500/20">Direct Config</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {state.admins.map(admin => (
            <div key={admin.id} className="bg-slate-900/40 p-5 rounded-3xl border border-slate-800 hover:border-indigo-500/30 transition-all group">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{admin.name}</p>
              <div className="flex items-center gap-4">
                <div className="relative flex-1">
                  <input type="number" className="w-full bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-indigo-400 font-bold outline-none focus:ring-2 focus:ring-indigo-500" value={admin.rate} onChange={(e) => updateAdminRate(admin.id, parseFloat(e.target.value) || 0)} />
                  <span className="absolute right-4 top-3.5 text-slate-500 font-bold">%</span>
                </div>
                <div className="text-right">
                   <p className="text-[8px] text-slate-600 font-black uppercase">Текущий расход</p>
                   <p className="text-lg font-mono font-bold text-white">${(stats.grossTotal * (admin.rate / 100)).toFixed(1)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="glass-card p-5 rounded-3xl border border-slate-800/50">
          <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">ЗП Операторов</p>
          <p className="text-xl font-bold text-rose-400 font-mono">-${stats.totalStaffExpense.toLocaleString(undefined, { minimumFractionDigits: 1 })}</p>
        </div>
        <div className="glass-card p-5 rounded-3xl border border-slate-800/50">
          <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">ЗП Моделей (Base)</p>
          <p className="text-xl font-bold text-rose-400 font-mono">-${(stats.totalModelExpense - stats.totalModelBonuses).toLocaleString(undefined, { minimumFractionDigits: 1 })}</p>
        </div>
        <div className="glass-card p-5 rounded-3xl border border-amber-500/10">
          <p className="text-[10px] font-black uppercase text-amber-500 tracking-widest mb-1">Бонусы Моделей</p>
          <p className="text-xl font-bold text-rose-400 font-mono">-${stats.totalModelBonuses.toLocaleString(undefined, { minimumFractionDigits: 1 })}</p>
        </div>
        <div className="glass-card p-5 rounded-3xl border border-indigo-500/20">
          <p className="text-[10px] font-black uppercase text-indigo-400 tracking-widest mb-1">ЗП Админов</p>
          <p className="text-xl font-bold text-rose-400 font-mono">-${stats.totalAdminSalaries.toLocaleString(undefined, { minimumFractionDigits: 1 })}</p>
        </div>
        <div className="glass-card p-5 rounded-3xl border border-slate-800/50">
          <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">Бизнес расходы</p>
          <p className="text-xl font-bold text-rose-400 font-mono">-${stats.bizExpenses.toLocaleString(undefined, { minimumFractionDigits: 1 })}</p>
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
              Добавить ДОХОД
            </h2>
            <div className="space-y-6">
              <p className="text-xs text-slate-500 italic">Сюда вносим остатки с прошлых месяцев или лишние деньги</p>
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Сумма ($)</label>
                  <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-5 py-4 text-white font-mono outline-none focus:ring-2 focus:ring-emerald-500 transition-all" placeholder="0.00" value={incomeAmount} onChange={e => setIncomeAmount(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Счет / Платформа</label>
                  <select className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-5 py-4 text-white font-bold outline-none cursor-pointer" value={incomePlatform} onChange={e => setIncomePlatform(e.target.value as any)}>
                    <option value="all">Общий капитал</option>
                    <option value="onlyFans">OnlyFans Account</option>
                    <option value="paypal">PayPal</option>
                    <option value="crypto">Crypto</option>
                  </select>
                </div>
              </div>
              <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-5 py-4 text-white outline-none" placeholder="Напр. 'Остаток с прошлого месяца'..." value={incomeComment} onChange={e => setIncomeComment(e.target.value)} />
              <button onClick={addExtraIncome} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-5 rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">Внести доход в новый месяц</button>
            </div>
          </div>

          <div className="glass-card p-8 rounded-[3rem] border-rose-500/20 shadow-2xl space-y-8">
             <h2 className="text-2xl font-bold font-outfit text-white flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500 shadow-inner"><ICONS.Penalty size={24} /></div>
                Бизнес расходы
             </h2>
             <div className="space-y-6">
                <div className="grid grid-cols-1 gap-4">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Категория</label>
                      <select className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 text-white font-bold outline-none cursor-pointer" value={expenseCategory} onChange={e => setExpenseCategory(e.target.value as any)}>
                         {Object.entries(CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Сумма ($)</label>
                      <input type="number" className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 text-white font-mono outline-none" placeholder="0.00" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} />
                   </div>
                </div>
                <input type="text" className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 text-white outline-none" placeholder="Комментарий..." value={expenseComment} onChange={e => setExpenseComment(e.target.value)} />
                <button onClick={addBusinessExpense} className="w-full bg-rose-600 hover:bg-rose-500 text-white font-black py-5 rounded-2xl shadow-xl transition-all active:scale-95">Сохранить расход</button>
             </div>
          </div>

          <div className="glass-card p-8 rounded-[3rem] border-amber-500/20 shadow-2xl space-y-8">
            <h2 className="text-2xl font-bold font-outfit text-white flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-500 shadow-inner"><ICONS.Salary size={24} /></div>
              Взять аванс
            </h2>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setAdvanceOwner('Andrey')} className={`p-4 rounded-2xl border text-sm font-bold transition-all ${advanceOwner === 'Andrey' ? 'bg-amber-500/20 border-amber-500 text-amber-500 shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>Андрей</button>
                  <button onClick={() => setAdvanceOwner('Anton')} className={`p-4 rounded-2xl border text-sm font-bold transition-all ${advanceOwner === 'Anton' ? 'bg-indigo-500/20 border-indigo-500 text-indigo-500 shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>Антон</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <select className="bg-slate-900 border border-slate-700 rounded-2xl px-5 py-4 text-white font-bold outline-none cursor-pointer" value={advancePlatform} onChange={e => setAdvancePlatform(e.target.value as Platform)}>
                  <option value="onlyFans">OnlyFans Account</option>
                  <option value="paypal">PayPal Balance</option>
                  <option value="crypto">Crypto Wallet</option>
                </select>
                <input type="number" className="bg-slate-900 border border-slate-700 rounded-2xl px-5 py-4 text-white font-mono outline-none" placeholder="Сумма $" value={advanceAmount} onChange={e => setAdvanceAmount(e.target.value)} />
              </div>
              <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-5 py-4 text-white outline-none" placeholder="Заметка..." value={advanceComment} onChange={e => setAdvanceComment(e.target.value)} />
              <button onClick={addOwnerAdvance} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-5 rounded-2xl shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2">Выдать аванс</button>
            </div>
          </div>
      </div>

      <div className="space-y-8">
         <div className="glass-card rounded-[2.5rem] overflow-hidden border-slate-800 shadow-xl">
            <div className="p-8 border-b border-slate-800 bg-slate-900/40 font-bold font-outfit text-lg text-emerald-400">Внесенные Доходы (Остатки)</div>
            <div className="overflow-x-auto">
               <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-950/50 text-[10px] uppercase font-black text-slate-600 tracking-widest">
                       <th className="px-8 py-4">Описание</th>
                       <th className="px-6 py-4">Счет</th>
                       <th className="px-6 py-4">Дата</th>
                       <th className="px-8 py-4 text-right">Действия / Сумма</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                     {stats.manualIncomesList.length === 0 ? (
                        <tr><td colSpan={4} className="px-8 py-10 text-center text-slate-600 italic">Нет внесенных доходов</td></tr>
                     ) : (
                        stats.manualIncomesList.map(i => (
                           <tr key={i.id} className="hover:bg-slate-900/40 group transition-colors">
                              <td className="px-8 py-5 text-white font-bold">{i.comment || 'Остаток'}</td>
                              <td className="px-6 py-5 text-slate-400 uppercase text-[10px] font-black">{i.platform === 'all' ? 'Общий' : i.platform}</td>
                              <td className="px-6 py-5 text-slate-500 font-mono text-xs">{i.date}</td>
                              <td className="px-8 py-5 text-right flex items-center justify-end gap-4">
                                 <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                                    <button onClick={() => setEditingIncome(i)} className="p-1.5 hover:bg-emerald-500/10 text-slate-500 hover:text-emerald-400 rounded-lg transition-all"><ICONS.Edit size={14}/></button>
                                    <button onClick={() => removeIncome(i.id)} className="p-1.5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-500 rounded-lg transition-all"><ICONS.Trash size={14}/></button>
                                 </div>
                                 <span className="font-mono font-bold text-emerald-400 text-base">+${i.amount.toFixed(2)}</span>
                              </td>
                           </tr>
                        ))
                     )}
                  </tbody>
               </table>
            </div>
         </div>

         <div className="glass-card rounded-[2.5rem] overflow-hidden border-slate-800 shadow-xl">
            <div className="p-8 border-b border-slate-800 bg-slate-900/40 font-bold font-outfit text-lg text-amber-400">Бонусы Моделей (Расходы)</div>
            <div className="overflow-x-auto">
               <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-950/50 text-[10px] uppercase font-black text-slate-600 tracking-widest">
                       <th className="px-8 py-4">Анкета</th>
                       <th className="px-6 py-4">Описание</th>
                       <th className="px-8 py-4 text-right">Сумма</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                     {stats.modelBonusesList.length === 0 ? (
                        <tr><td colSpan={3} className="px-8 py-10 text-center text-slate-600 italic">Нет бонусов</td></tr>
                     ) : (
                        stats.modelBonusesList.map(b => (
                           <tr key={b.id} className="hover:bg-slate-900/40 transition-colors">
                              <td className="px-8 py-5 text-white font-bold">{b.model}</td>
                              <td className="px-6 py-5 text-slate-400">{b.comment}</td>
                              <td className="px-8 py-5 text-right font-mono font-bold text-amber-500">${b.amount.toFixed(2)}</td>
                           </tr>
                        ))
                     )}
                  </tbody>
               </table>
            </div>
         </div>

         <div className="glass-card rounded-[2.5rem] overflow-hidden border-slate-800 shadow-xl">
            <div className="p-8 border-b border-slate-800 bg-slate-900/40 font-bold font-outfit text-lg text-indigo-400">История Авансов Владельцев</div>
            <div className="overflow-x-auto">
               <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-950/50 text-[10px] uppercase font-black text-slate-600 tracking-widest">
                       <th className="px-8 py-4">Владелец</th>
                       <th className="px-6 py-4">Платформа</th>
                       <th className="px-6 py-4">Дата</th>
                       <th className="px-6 py-4">Описание</th>
                       <th className="px-8 py-4 text-right">Действия / Сумма</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                     {(state.ownerAdvances || []).filter(a => a.periodId === activePeriodId).map(a => (
                        <tr key={a.id} className="hover:bg-slate-900/40 group transition-colors">
                           <td className="px-8 py-5 font-bold text-white">{a.ownerName}</td>
                           <td className="px-6 py-5 text-slate-400 uppercase text-[10px] font-black tracking-widest">{PLATFORM_NAMES[a.platform]}</td>
                           <td className="px-6 py-5 text-slate-500 font-mono text-xs">{a.date}</td>
                           <td className="px-6 py-5 text-slate-300 italic">"{a.comment || '—'}"</td>
                           <td className="px-8 py-5 text-right flex items-center justify-end gap-4">
                              <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                                 <button onClick={() => setEditingAdvance(a)} className="p-1.5 hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-400 rounded-lg transition-all"><ICONS.Edit size={14}/></button>
                                 <button onClick={() => removeAdvance(a.id)} className="p-1.5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-500 rounded-lg transition-all"><ICONS.Trash size={14}/></button>
                              </div>
                              <span className="font-mono font-bold text-rose-500 text-base">-${a.amount.toFixed(2)}</span>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>

         <div className="glass-card rounded-[2.5rem] overflow-hidden border-slate-800 shadow-xl">
            <div className="p-8 border-b border-slate-800 bg-slate-900/40 font-bold font-outfit text-lg text-rose-400">История Расходов</div>
            <div className="overflow-x-auto">
               <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-950/50 text-[10px] uppercase font-black text-slate-600 tracking-widest">
                       <th className="px-8 py-4">Категория</th>
                       <th className="px-6 py-4">Платформа</th>
                       <th className="px-6 py-4">Дата</th>
                       <th className="px-6 py-4">Заметка</th>
                       <th className="px-8 py-4 text-right">Действия / Сумма</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                     {state.ownerExpenses.filter(e => e.periodId === activePeriodId).map(e => (
                        <tr key={e.id} className="hover:bg-slate-900/40 group transition-colors">
                           <td className="px-8 py-5 text-white font-bold">{CATEGORIES[e.category]?.label || e.category}</td>
                           <td className="px-6 py-5 text-slate-400 text-[10px] font-black uppercase tracking-widest">{e.platform === 'all' ? 'Общий' : PLATFORM_NAMES[e.platform]}</td>
                           <td className="px-6 py-5 text-slate-500 font-mono text-xs">{e.date}</td>
                           <td className="px-6 py-5 text-slate-300 italic">"{e.comment || '—'}"</td>
                           <td className="px-8 py-5 text-right flex items-center justify-end gap-4">
                              <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition-opacity">
                                 <button onClick={() => setEditingExpense(e)} className="p-1.5 hover:bg-indigo-500/10 text-slate-500 hover:text-indigo-400 rounded-lg transition-all"><ICONS.Edit size={14}/></button>
                                 <button onClick={() => removeExpense(e.id)} className="p-1.5 hover:bg-rose-500/10 text-slate-500 hover:text-rose-500 rounded-lg transition-all"><ICONS.Trash size={14}/></button>
                              </div>
                              <span className="font-mono font-bold text-rose-500 text-base">-${e.amount.toFixed(2)}</span>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>
      </div>

      {editingIncome && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
           <div className="glass-card w-full max-w-lg rounded-[2.5rem] p-10 border-emerald-500/40 shadow-2xl relative">
              <button onClick={() => setEditingIncome(null)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><ICONS.Plus className="rotate-45" size={24} /></button>
              <h2 className="text-2xl font-bold text-white mb-6">Редактировать внесенный доход</h2>
              <div className="space-y-4">
                 <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-mono" value={editingIncome.amount} onChange={e => setEditingIncome({...editingIncome, amount: parseFloat(e.target.value) || 0})} />
                 <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white" value={editingIncome.comment} onChange={e => setEditingIncome({...editingIncome, comment: e.target.value})} />
                 <button onClick={updateIncome} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-xl mt-4 transition-all">Сохранить</button>
              </div>
           </div>
        </div>
      )}

      {editingAdvance && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
           <div className="glass-card w-full max-w-lg rounded-[2.5rem] p-10 border-indigo-500/40 shadow-2xl relative">
              <button onClick={() => setEditingAdvance(null)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><ICONS.Plus className="rotate-45" size={24} /></button>
              <h2 className="text-2xl font-bold text-white mb-6">Редактировать аванс</h2>
              <div className="space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <select className="bg-slate-900 border border-slate-700 rounded-xl p-3 text-white" value={editingAdvance.ownerName} onChange={e => setEditingAdvance({...editingAdvance, ownerName: e.target.value as any})}>
                       <option value="Andrey">Андрей</option>
                       <option value="Anton">Антон</option>
                    </select>
                    <input type="number" className="bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-mono" value={editingAdvance.amount} onChange={e => setEditingAdvance({...editingAdvance, amount: parseFloat(e.target.value) || 0})} />
                 </div>
                 <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white" value={editingAdvance.comment} onChange={e => setEditingAdvance({...editingAdvance, comment: e.target.value})} />
                 <button onClick={updateAdvance} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl mt-4 transition-all">Сохранить</button>
              </div>
           </div>
        </div>
      )}

      {editingExpense && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
           <div className="glass-card w-full max-w-lg rounded-[2.5rem] p-10 border-amber-500/40 shadow-2xl relative">
              <button onClick={() => setEditingExpense(null)} className="absolute top-8 right-8 text-slate-500 hover:text-white"><ICONS.Plus className="rotate-45" size={24} /></button>
              <h2 className="text-2xl font-bold text-white mb-6">Редактировать расход</h2>
              <div className="space-y-4">
                 <div className="grid grid-cols-2 gap-4">
                    <select className="bg-slate-900 border border-slate-700 rounded-xl p-3 text-white" value={editingExpense.category} onChange={e => setEditingExpense({...editingExpense, category: e.target.value as any})}>
                       {Object.entries(CATEGORIES).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                    <input type="number" className="bg-slate-900 border border-slate-700 rounded-xl p-3 text-white font-mono" value={editingExpense.amount} onChange={e => setEditingExpense({...editingExpense, amount: parseFloat(e.target.value) || 0})} />
                 </div>
                 <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-white" value={editingExpense.comment} onChange={e => setEditingExpense({...editingExpense, comment: e.target.value})} />
                 <button onClick={updateExpense} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 rounded-xl mt-4 transition-all">Сохранить изменения</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const BalanceCard: React.FC<{ title: string; value: number; sub: string; color: string; highlighted?: boolean }> = ({ title, value, sub, color, highlighted }) => (
  <div className={`glass-card p-6 rounded-[2rem] border transition-transform hover:scale-[1.02] ${highlighted ? 'border-indigo-500/40 bg-indigo-500/5 shadow-xl shadow-indigo-500/5' : `border-slate-800 text-${color}-500`}`}>
    <p className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{title}</p>
    <p className="text-2xl font-black font-outfit text-white leading-tight">${value.toLocaleString(undefined, { minimumFractionDigits: 1 })}</p>
    <p className="text-[10px] opacity-40 mt-1 font-bold uppercase tracking-tighter leading-tight">{sub}</p>
  </div>
);

const OwnerShareCard: React.FC<{ name: string; totalShare: number; advances: number; final: number; color: string }> = ({ name, totalShare, advances, final, color }) => (
  <div className={`glass-card p-8 rounded-[3rem] border shadow-2xl ${color === 'amber' ? 'bg-amber-500/10 border-amber-500/30 shadow-amber-500/5' : 'bg-indigo-500/10 border-indigo-500/30 shadow-indigo-500/5'}`}>
    <h3 className="text-3xl font-black font-outfit text-white mb-8 border-b border-slate-800/50 pb-4">{name}</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div className="bg-slate-950/40 p-5 rounded-2xl border border-slate-800">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Доля (50% Чистой):</p>
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
