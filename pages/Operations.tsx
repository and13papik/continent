import React, { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AppState, OperationType, OperationRecord, Platform, IncomeRecord } from '../types';
import { ICONS, OPERATION_META, PLATFORM_NAMES } from '../constants';
import { findPeriodIdByDate } from '../store';
import PeriodBadge from '../components/PeriodBadge';

interface OperationsProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const Operations: React.FC<OperationsProps> = ({ state, updateState }) => {
  const [type, setType] = useState<OperationType>('advance');
  const activePeriodId = state.selectedPeriodId;
  const activePeriod = state.accountingPeriods.find(p => p.id === activePeriodId);
  const currentOperators = activePeriod?.operators || state.operators;
  const currentModels = activePeriod?.models || state.models;

  const [operator, setOperator] = useState('');
  const [targetModel, setTargetModel] = useState('');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [platform, setPlatform] = useState<Platform | 'all'>('all');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetPeriodId, setTargetPeriodId] = useState(state.selectedPeriodId);

  // Sync selected period
  useEffect(() => {
    setTargetPeriodId(state.selectedPeriodId);
  }, [state.selectedPeriodId]);

  const [editingOp, setEditingOp] = useState<OperationRecord | null>(null);
  const [editingAmount, setEditingAmount] = useState('');
  const [editingComment, setEditingComment] = useState('');
  
  // Filters
  const [activeFilter, setActiveFilter] = useState<OperationType | 'all' | 'income'>('all');
  const [filterOperator, setFilterOperator] = useState('');
  const [filterModel, setFilterModel] = useState('');
  const [filterDate, setFilterDate] = useState('');

  const resetFilters = () => {
    setActiveFilter('all');
    setFilterOperator('');
    setFilterModel('');
    setFilterDate('');
  };

  const handleSubmit = () => {
    if (!operator || !amount || !eventDate) {
      alert('Заполните обязательные поля');
      return;
    }
    
    if (type === 'refund' && !targetModel) {
      alert('Для возврата необходимо выбрать модель');
      return;
    }

    const finalPeriodId = findPeriodIdByDate(eventDate, state.accountingPeriods) || targetPeriodId;

    const newOp: OperationRecord = {
      id: String(Date.now()),
      type,
      operator,
      model: (type === 'refund' || !!targetModel) ? targetModel : undefined,
      amount: parseFloat(amount),
      comment,
      date: eventDate,
      createdAt: new Date().toISOString(),
      periodId: finalPeriodId,
      platform: platform === 'all' ? undefined : platform
    };

    updateState(prev => ({
      ...prev,
      operationsData: [newOp, ...prev.operationsData]
    }));

    setAmount('');
    setComment('');
    setTargetModel('');
  };

  const handleStartEdit = (op: OperationRecord) => {
    setEditingOp(op);
    setEditingAmount(String(op.amount));
    setEditingComment(op.comment || '');
  };

  const handleUpdate = () => {
    if (!editingOp) return;
    const updAmount = parseFloat(editingAmount);
    if (isNaN(updAmount)) {
      alert('Некорректная сумма');
      return;
    }

    updateState(prev => ({
      ...prev,
      operationsData: prev.operationsData.map(o => 
        o.id === editingOp.id ? { ...o, amount: updAmount, comment: editingComment, updatedAt: new Date().toISOString() } : o
      )
    }));
    setEditingOp(null);
  };

  const deleteOp = (id: string) => {
    if (!confirm('Удалить операцию?')) return;
    updateState(prev => ({
      ...prev,
      deletedIds: [...prev.deletedIds, id],
      operationsData: prev.operationsData.filter(o => o.id !== id)
    }));
  };

  const deleteIncome = (id: string) => {
    if (!confirm('Удалить запись о доходе?')) return;
    updateState(prev => ({
      ...prev,
      deletedIds: [...prev.deletedIds, id],
      incomeData: prev.incomeData.filter(i => i.id !== id)
    }));
  };

  const unifiedHistory = useMemo(() => {
    const currentPeriodId = state.selectedPeriodId;
    
    let opsRaw = state.operationsData.filter(o => o.periodId === currentPeriodId);
    let incsRaw = state.incomeData.filter(i => i.periodId === currentPeriodId);

    if (activeFilter !== 'all') {
      if (activeFilter === 'income') {
        opsRaw = [];
      } else {
        opsRaw = opsRaw.filter(o => o.type === activeFilter);
        incsRaw = [];
      }
    }

    if (filterOperator) {
      opsRaw = opsRaw.filter(o => o.operator === filterOperator);
      incsRaw = incsRaw.filter(i => i.operator === filterOperator);
    }

    if (filterModel) {
      opsRaw = opsRaw.filter(o => o.model === filterModel);
      incsRaw = incsRaw.filter(i => i.model === filterModel);
    }

    if (filterDate) {
      opsRaw = opsRaw.filter(o => o.date === filterDate);
      incsRaw = incsRaw.filter(i => i.date === filterDate);
    }

    const ops = opsRaw.map(o => ({ ...o, entryType: 'operation' as const }));
    const incs = incsRaw.map(i => ({ ...i, entryType: 'income' as const }));

    return [...ops, ...incs].sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [state.operationsData, state.incomeData, state.selectedPeriodId, activeFilter, filterOperator, filterModel, filterDate]);

  const totals = useMemo(() => {
    return unifiedHistory.reduce((acc, item) => {
      if (item.entryType === 'operation') {
        const op = item as OperationRecord;
        if (['bonus', 'internship'].includes(op.type)) {
          acc.plus += op.amount;
        } else {
          acc.minus += op.amount;
        }
      } else {
        const inc = item as IncomeRecord;
        acc.plus += (inc.nettoOF + inc.nettoPP + inc.nettoCrypto);
      }
      return acc;
    }, { plus: 0, minus: 0 });
  }, [unifiedHistory]);

  return (
    <div className="space-y-10 animate-in fade-in duration-700 pb-20 max-w-[1600px] mx-auto px-4 sm:px-0">
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white font-outfit uppercase tracking-tighter">Финансовые потоки</h1>
          <div className="flex items-center gap-3 mt-2">
            <PeriodBadge state={state} />
            <p className="text-slate-500 font-medium text-sm hidden sm:block">Полный контроль за движением средств и балансом персонала</p>
          </div>
        </div>

        <div className="flex gap-4">
          <div className="bg-slate-900/40 border border-white/5 rounded-[2rem] p-5 flex items-center gap-4 backdrop-blur-md">
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <ICONS.Income size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Приход (Общий)</p>
              <p className="text-2xl font-mono font-black text-white tracking-tight">${totals.plus.toFixed(1)}</p>
            </div>
          </div>
          <div className="bg-slate-900/40 border border-white/5 rounded-[2rem] p-5 flex items-center gap-4 backdrop-blur-md">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-500">
              <ICONS.Penalty size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none mb-1">Расход (Общий)</p>
              <p className="text-2xl font-mono font-black text-white tracking-tight">${totals.minus.toFixed(1)}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ADD PANEL */}
        <div className="lg:col-span-4 space-y-6 lg:sticky lg:top-8">
          <div className="glass-card p-8 rounded-[2.5rem] space-y-8 border-white/5 shadow-2xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-600/10 blur-[80px] rounded-full -mr-16 -mt-16" />
            
            <div className="relative z-10">
              <h2 className="text-xl font-black font-outfit flex items-center gap-3 text-white uppercase tracking-tight">
                <div className="p-2 bg-indigo-500 rounded-xl shadow-lg shadow-indigo-500/20">
                  <ICONS.Plus size={18} className="text-white"/>
                </div>
                Новая запись
              </h2>
            </div>
            
            <div className="space-y-6 relative z-10">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                   <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Период</label>
                      <select className="w-full bg-slate-950 border border-white/5 rounded-2xl px-4 py-3.5 text-xs text-indigo-400 font-bold outline-none focus:border-indigo-500/50 appearance-none cursor-pointer" value={targetPeriodId} onChange={(e) => setTargetPeriodId(e.target.value)}>
                        {state.accountingPeriods.slice().reverse().map(p => (
                          <option key={p.id} value={p.id}>{p.label} {p.status === 'closed' ? '🔒' : ''}</option>
                        ))}
                      </select>
                   </div>
                   <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Платформа</label>
                      <select className="w-full bg-slate-950 border border-white/5 rounded-2xl px-4 py-3.5 text-[9px] font-black uppercase text-slate-300 outline-none focus:border-indigo-500/50 appearance-none cursor-pointer" value={platform} onChange={(e) => setPlatform(e.target.value as any)}>
                        <option value="all">Общий</option>
                        <option value="onlyFans">OnlyFans</option>
                        <option value="paypal">PayPal</option>
                        <option value="crypto">Crypto</option>
                      </select>
                   </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Тип транзакции</label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(OPERATION_META).map(([key, meta]) => (
                      <button 
                        key={key} 
                        onClick={() => setType(key as any)} 
                        className={`px-3 py-3 rounded-2xl text-[8px] font-black border uppercase tracking-widest transition-all text-left flex items-center gap-2 ${type === key ? 'bg-indigo-600 border-indigo-500 text-white shadow-xl shadow-indigo-600/10' : 'bg-slate-950 border-white/5 text-slate-500 hover:border-white/10'}`}
                      >
                        <meta.icon size={12} className={type === key ? 'text-white' : 'text-slate-600'} />
                        {meta.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Оператор</label>
                    <select className="w-full bg-slate-950 border border-white/5 rounded-2xl px-4 py-3.5 text-xs text-white font-bold outline-none focus:border-indigo-500/50 appearance-none" value={operator} onChange={(e) => setOperator(e.target.value)}>
                      <option value="">Выберите...</option>
                      {currentOperators.map(op => <option key={op} value={op}>{op}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Анкета</label>
                    <select className="w-full bg-slate-950 border border-white/5 rounded-2xl px-4 py-3.5 text-xs text-white font-bold outline-none focus:border-indigo-500/50 appearance-none" value={targetModel} onChange={(e) => setTargetModel(e.target.value)}>
                      <option value="">Без модели</option>
                      {currentModels.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 text-indigo-400">Сумма ($)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-black text-xs">$</span>
                      <input 
                        type="number" 
                        className="w-full bg-slate-950 border border-white/10 rounded-2xl pl-8 pr-4 py-3.5 text-sm text-white font-mono font-black outline-none focus:border-indigo-500 transition-all shadow-inner" 
                        placeholder="0.00" 
                        value={amount} 
                        onChange={(e) => setAmount(e.target.value)} 
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Дата</label>
                    <input type="date" className="w-full bg-slate-950 border border-white/5 rounded-2xl px-4 py-3.5 text-xs text-white outline-none focus:border-indigo-500/50 font-bold" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Комментарий</label>
                  <textarea className="w-full bg-slate-950 border border-white/5 rounded-2xl px-4 py-4 text-xs min-h-[100px] text-white outline-none focus:border-indigo-500/50 resize-none font-medium" placeholder="Опишите причину операции..." value={comment} onChange={(e) => setComment(e.target.value)} />
                </div>
              </div>

              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSubmit} 
                className="w-full bg-white text-slate-950 font-black text-[11px] uppercase tracking-[0.2em] py-5 rounded-[2rem] shadow-2xl shadow-indigo-600/30 transition-all flex items-center justify-center gap-3 overflow-hidden group/btn relative"
              >
                <div className="absolute inset-0 bg-indigo-500 opacity-0 group-hover/btn:opacity-10 transition-opacity" />
                СОХРАНИТЬ В БАЗУ
                <ICONS.ChevronRight size={16} className="group-hover/btn:translate-x-1 transition-transform" />
              </motion.button>
            </div>
          </div>
        </div>

        {/* LIST PANEL */}
        <div className="lg:col-span-8 space-y-8">
          {/* SEARCH & FILTERS */}
          <div className="glass-card p-8 rounded-[3rem] border-white/5 shadow-xl space-y-8 bg-slate-900/10 backdrop-blur-xl">
             <div className="flex flex-wrap gap-2 items-center">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mr-3">Фильтрация ленты:</span>
                <FilterChip label="Все" active={activeFilter === 'all'} onClick={() => setActiveFilter('all')} icon={<ICONS.Transfer size={12}/>}  />
                <FilterChip label="Доходы" active={activeFilter === 'income'} onClick={() => setActiveFilter('income')} icon={<ICONS.Income size={12}/>}  />
                {Object.entries(OPERATION_META).map(([key, meta]) => (
                  <FilterChip 
                    key={key} 
                    label={meta.label} 
                    active={activeFilter === key} 
                    onClick={() => setActiveFilter(key as any)} 
                    icon={<meta.icon size={12}/>}
                  />
                ))}
             </div>

             <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 pt-8 border-t border-white/5">
                <div className="space-y-1.5">
                   <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Поиск сотрудника</label>
                   <select className={`w-full bg-slate-950/40 border rounded-2xl px-4 py-3 text-xs text-white font-bold outline-none transition-all ${filterOperator ? 'border-indigo-500 ring-4 ring-indigo-500/10' : 'border-white/5 hover:border-white/10'}`} value={filterOperator} onChange={e => setFilterOperator(e.target.value)}>
                      <option value="">Все сотрудники</option>
                      {currentOperators.map(op => <option key={op} value={op}>{op}</option>)}
                   </select>
                </div>
                <div className="space-y-1.5">
                   <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Поиск анкеты</label>
                   <select className={`w-full bg-slate-950/40 border rounded-2xl px-4 py-3 text-xs text-white font-bold outline-none transition-all ${filterModel ? 'border-amber-500 ring-4 ring-amber-500/10' : 'border-white/5 hover:border-white/10'}`} value={filterModel} onChange={e => setFilterModel(e.target.value)}>
                      <option value="">Все анкеты</option>
                      {currentModels.map(m => <option key={m} value={m}>{m}</option>)}
                   </select>
                </div>
                <div className="space-y-1.5">
                   <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Точная дата</label>
                   <div className="flex gap-3">
                     <input type="date" className={`flex-1 bg-slate-950/40 border rounded-2xl px-4 py-3 text-xs text-white outline-none transition-all ${filterDate ? 'border-sky-500 ring-4 ring-sky-500/10' : 'border-white/5 hover:border-white/10'}`} value={filterDate} onChange={e => setFilterDate(e.target.value)} />
                     {(filterOperator || filterModel || filterDate || activeFilter !== 'all') && (
                        <button onClick={resetFilters} className="bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white w-12 h-12 flex items-center justify-center rounded-2xl border border-rose-500/20 transition-all shadow-xl active:scale-95">
                           <ICONS.RotateCcw size={18} />
                        </button>
                     )}
                   </div>
                </div>
             </div>
          </div>

          {/* HISTORY */}
          <div className="glass-card rounded-[3.5rem] overflow-hidden border-white/5 shadow-2xl relative">
            <div className="p-10 border-b border-white/5 bg-slate-900/40 flex justify-between items-center relative z-10">
              <div>
                <h2 className="text-xl font-black font-outfit text-white uppercase tracking-tight">Лог транзакций</h2>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mt-1">Отображаются события за выбранный период</p>
              </div>
              <div className="bg-slate-950/80 px-5 py-2 rounded-2xl border border-white/10 shadow-inner">
                <span className="text-[11px] font-black uppercase text-indigo-400 font-mono tracking-tighter">Hits: {unifiedHistory.length}</span>
              </div>
            </div>

            <div className="divide-y divide-white/5 overflow-y-auto max-h-[1200px] scrollbar-hide relative z-10 min-h-[500px]">
              <AnimatePresence mode="popLayout">
                {unifiedHistory.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="p-40 text-center flex flex-col items-center gap-6"
                  >
                    <div className="w-24 h-24 rounded-full bg-slate-900/50 flex items-center justify-center border border-white/5 shadow-inner">
                      <ICONS.History size={40} className="text-slate-700" />
                    </div>
                    <div className="space-y-2">
                       <p className="text-xl font-black text-white font-outfit uppercase">Записей не найдено</p>
                       <p className="text-sm text-slate-500 font-medium">Попробуйте изменить параметры поиска или <button onClick={resetFilters} className="text-indigo-400 hover:underline">сбросьте фильтры</button></p>
                    </div>
                  </motion.div>
                ) : (
                  unifiedHistory.map((item, idx) => {
                    const isOp = item.entryType === 'operation';
                    const key = isOp ? (item as OperationRecord).id : (item as IncomeRecord).id;
                    
                    if (isOp) {
                      const op = item as OperationRecord;
                      const meta = OPERATION_META[op.type];
                      const isProfit = ['bonus', 'internship'].includes(op.type);

                      return (
                        <motion.div 
                          key={key}
                          layout
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: Math.min(idx * 0.02, 0.5) }}
                          className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 group hover:bg-white/[0.015] transition-all border-l-[6px] border-transparent hover:border-indigo-500"
                        >
                          <div className="flex items-center gap-6">
                            <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center bg-slate-950 border border-white/5 text-2xl shadow-2xl transition-transform group-hover:scale-105 ${meta.color}`}>
                              <meta.icon size={28} />
                            </div>
                            <div>
                              <div className="flex flex-wrap items-center gap-4">
                                <span className="font-outfit font-black text-xl text-white uppercase tracking-tighter">{op.operator}</span>
                                {op.platform && (
                                  <div className="bg-indigo-500/10 text-indigo-400 text-[9px] font-black px-3 py-1 rounded-xl border border-indigo-500/20 uppercase tracking-[0.2em] shadow-lg shadow-indigo-500/5">
                                    {PLATFORM_NAMES[op.platform]}
                                  </div>
                                )}
                                <div className="flex items-center gap-1.5 bg-slate-900/80 px-3 py-1 rounded-xl border border-white/5 text-slate-500">
                                   <ICONS.Calendar size={12} />
                                   <span className="text-[10px] font-mono font-black">{op.date}</span>
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-4 mt-3">
                                 <span className="text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 group-hover:text-slate-400 transition-colors">{meta.label}</span>
                                 {op.model && (
                                   <div className="flex items-center gap-1.5 text-amber-500/60 bg-amber-500/5 px-2.5 py-1 rounded-lg border border-amber-500/10">
                                      <ICONS.Models size={12} />
                                      <span className="text-[10px] font-black uppercase tracking-widest">{op.model}</span>
                                   </div>
                                 )}
                                 {op.comment && (
                                   <div className="flex items-center gap-2 group-hover:scale-105 transition-transform origin-left">
                                      <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                                      <p className="text-xs text-slate-400 italic font-medium max-w-sm truncate whitespace-nowrap">{op.comment}</p>
                                   </div>
                                 )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between md:justify-end gap-10">
                            <div className="text-right">
                               <div className={`font-black font-mono text-3xl tracking-tighter ${isProfit ? 'text-emerald-400 shadow-[0_0_20px_rgba(52,211,153,0.1)]' : 'text-rose-400 shadow-[0_0_20px_rgba(251,113,133,0.1)]'}`}>
                                  {isProfit ? '+' : '-'}${op.amount.toFixed(2)}
                               </div>
                               <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mt-1">Корректировка</p>
                            </div>

                            <div className="flex items-center gap-2">
                               <button onClick={() => handleStartEdit(op)} className="p-3 bg-slate-900/50 text-slate-500 hover:text-white hover:bg-indigo-500 rounded-2xl transition-all border border-white/5 shadow-xl active:scale-90">
                                  <ICONS.Edit size={18} />
                               </button>
                               <button onClick={() => deleteOp(op.id)} className="p-3 bg-slate-900/50 text-slate-500 hover:text-white hover:bg-rose-500 rounded-2xl transition-all border border-white/5 shadow-xl active:scale-90">
                                  <ICONS.Trash size={18} />
                               </button>
                            </div>
                          </div>
                        </motion.div>
                      );
                    } else {
                      const inc = item as IncomeRecord;
                      const net = inc.nettoOF + inc.nettoPP + inc.nettoCrypto;
                      return (
                        <motion.div 
                          key={key}
                          layout
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: Math.min(idx * 0.02, 0.5) }}
                          className="p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 group hover:bg-emerald-500/[0.02] transition-all border-l-[6px] border-transparent hover:border-emerald-500"
                        >
                          <div className="flex items-center gap-6">
                            <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center bg-slate-950 border border-white/5 text-2xl shadow-2xl transition-transform group-hover:scale-105 text-emerald-500`}>
                              <ICONS.Income size={28} />
                            </div>
                            <div>
                               <div className="flex flex-wrap items-center gap-4">
                                  <span className="font-outfit font-black text-xl text-white uppercase tracking-tighter">{inc.operator}</span>
                                  <div className="bg-emerald-500/10 text-emerald-400 text-[10px] font-black px-4 py-1.5 rounded-2xl border border-emerald-500/20 uppercase tracking-[0.2em] shadow-lg shadow-emerald-500/5">
                                    РАСЧЕТНЫЙ ДОХОД
                                  </div>
                                  <div className="flex items-center gap-1.5 bg-slate-900/80 px-3 py-1 rounded-xl border border-white/5 text-slate-500">
                                     <ICONS.Calendar size={12} />
                                     <span className="text-[10px] font-mono font-black">{inc.date}</span>
                                  </div>
                               </div>
                               <div className="flex items-center gap-3 mt-3">
                                  <div className="flex items-center gap-1.5 text-amber-500/60 bg-amber-500/5 px-2.5 py-1 rounded-lg border border-amber-500/10">
                                     <ICONS.Models size={12} />
                                     <span className="text-[10px] font-black uppercase tracking-widest">{inc.model}</span>
                                  </div>
                               </div>
                               <div className="flex gap-6 mt-4 p-4 bg-slate-950/40 rounded-[1.5rem] border border-white/5 w-fit shadow-inner">
                                  <div>
                                     <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mb-1">Gross Platform</p>
                                     <p className="text-xs font-mono font-black text-slate-200">${inc.total.toFixed(0)}</p>
                                  </div>
                                  <div className="w-px h-full bg-white/5 self-stretch" />
                                  <div>
                                     <p className="text-[8px] font-black text-indigo-400/60 uppercase tracking-widest mb-1">Netto Earnings</p>
                                     <p className="text-xs font-mono font-black text-indigo-400">${net.toFixed(1)}</p>
                                  </div>
                               </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-between md:justify-end gap-10">
                            <div className="text-right">
                               <div className="font-black font-mono text-3xl tracking-tighter text-emerald-400">
                                  +${net.toFixed(2)}
                               </div>
                               <p className="text-[8px] font-black text-slate-600 uppercase tracking-widest mt-1">Начисление в ЗП</p>
                            </div>
                            <button onClick={() => deleteIncome(inc.id)} className="p-3 bg-slate-900/50 text-slate-500 hover:text-white hover:bg-rose-500 rounded-2xl transition-all border border-white/5 shadow-xl active:scale-90 opacity-0 group-hover:opacity-100">
                               <ICONS.Trash size={18} />
                            </button>
                          </div>
                        </motion.div>
                      );
                    }
                  })
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* EDIT MODAL */}
      <AnimatePresence>
        {editingOp && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-2xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="glass-card w-full max-w-xl rounded-[3.5rem] p-12 border-white/10 shadow-[0_30px_100px_rgba(0,0,0,0.8)] relative overflow-hidden"
            >
              {/* Decorative Glow */}
              <div className="absolute top-0 right-0 w-80 h-80 bg-indigo-600/20 blur-[100px] rounded-full -mr-40 -mt-40" />
              
              <button 
                onClick={() => setEditingOp(null)} 
                className="absolute top-10 right-10 w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 text-slate-500 hover:text-white hover:bg-white/10 transition-all border border-white/5 z-20"
              >
                <ICONS.Close size={24} />
              </button>

              <div className="relative z-10">
                <div className="flex items-center gap-5 mb-10">
                  <div className="w-16 h-16 bg-white text-slate-950 rounded-2xl flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.25)]">
                    <ICONS.Edit size={32} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-white font-outfit uppercase tracking-tighter">Редактирование</h2>
                    <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1">ID: {editingOp.id}</p>
                  </div>
                </div>

                <div className="space-y-8">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest ml-1">Оператор</label>
                       <div className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-5 py-4 text-white font-black uppercase tracking-tight opacity-40">
                         {editingOp.operator}
                       </div>
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest ml-1">Тип операции</label>
                       <div className="w-full bg-slate-950/50 border border-white/10 rounded-2xl px-5 py-4 text-white font-black uppercase tracking-tight opacity-40">
                         {OPERATION_META[editingOp.type].label}
                       </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-indigo-400 font-black uppercase tracking-widest ml-1 text-center block">Новая сумма ($)</label>
                    <div className="relative">
                      <span className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-500 font-black text-3xl">$</span>
                      <input 
                        type="number" 
                        step="0.01"
                        autoFocus
                        className="w-full bg-slate-950 border-2 border-white/10 rounded-[2.5rem] pl-12 pr-6 py-6 text-4xl text-white font-mono font-black outline-none focus:border-indigo-500 transition-all text-center tracking-tighter" 
                        value={editingAmount} 
                        onChange={e => setEditingAmount(e.target.value)} 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest ml-1">Комментарий к правке</label>
                    <textarea 
                      className="w-full bg-slate-950 border border-white/5 rounded-2xl px-5 py-4 text-sm text-white outline-none focus:border-white/20 min-h-[120px] resize-none font-medium" 
                      value={editingComment} 
                      onChange={e => setEditingComment(e.target.value)} 
                    />
                  </div>

                  <div className="flex gap-4">
                    <button onClick={() => setEditingOp(null)} className="flex-1 bg-slate-900 hover:bg-slate-850 text-slate-500 font-black py-5 rounded-[2rem] transition-all uppercase text-[10px] tracking-[0.2em] border border-white/5">Отменить</button>
                    <button onClick={handleUpdate} className="flex-[2] bg-white text-slate-950 font-black py-5 rounded-[2rem] shadow-3xl transition-all uppercase text-[10px] tracking-[0.2em] hover:scale-[1.02]">Применить изменения</button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

// HELPER COMPONENTS
const FilterChip = ({ label, active, onClick, icon }: { label: string, active: boolean, onClick: () => void, icon?: React.ReactNode }) => (
  <button 
    onClick={onClick}
    className={`flex items-center gap-2.5 px-5 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all border ${
      active 
        ? 'bg-white text-slate-950 border-white shadow-[0_10px_20px_rgba(255,255,255,0.15)]' 
        : 'bg-slate-900/50 border-white/5 text-slate-500 hover:border-white/10 hover:text-slate-300'
    }`}
  >
    {icon && <span className={active ? 'text-slate-950' : 'text-slate-600'}>{icon}</span>}
    {label}
  </button>
);

export default Operations;
