
import React, { useState, useMemo } from 'react';
import { AppState, OperationType, OperationRecord, Platform, IncomeRecord } from '../types';
import { ICONS, OPERATION_META, PLATFORM_NAMES } from '../constants';

interface OperationsProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const Operations: React.FC<OperationsProps> = ({ state, updateState }) => {
  const [type, setType] = useState<OperationType>('advance');
  const [operator, setOperator] = useState('');
  const [amount, setAmount] = useState('');
  const [comment, setComment] = useState('');
  const [platform, setPlatform] = useState<Platform | 'all'>('all');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetPeriodId, setTargetPeriodId] = useState(state.selectedPeriodId);

  const [editingOp, setEditingOp] = useState<OperationRecord | null>(null);

  const handleSubmit = () => {
    if (!operator || !amount || !eventDate) {
      alert('Заполните обязательные поля');
      return;
    }

    const newOp: OperationRecord = {
      id: String(Date.now()),
      type,
      operator,
      amount: parseFloat(amount),
      comment,
      date: eventDate,
      createdAt: new Date().toISOString(),
      periodId: targetPeriodId,
      platform: platform === 'all' ? undefined : platform
    };

    updateState(prev => ({
      ...prev,
      operationsData: [newOp, ...prev.operationsData]
    }));

    setAmount('');
    setComment('');
    alert('Операция успешно добавлена');
  };

  const handleUpdate = () => {
    if (!editingOp) return;
    updateState(prev => ({
      ...prev,
      operationsData: prev.operationsData.map(o => o.id === editingOp.id ? { ...editingOp, updatedAt: new Date().toISOString() } : o)
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
    const ops = state.operationsData.filter(o => o.periodId === currentPeriodId).map(o => ({ ...o, entryType: 'operation' as const }));
    const incs = state.incomeData.filter(i => i.periodId === currentPeriodId).map(i => ({ ...i, entryType: 'income' as const }));

    return [...ops, ...incs].sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [state.operationsData, state.incomeData, state.selectedPeriodId]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header>
        <h1 className="text-3xl font-bold text-white font-outfit">Операции и Активность</h1>
        <p className="text-slate-400">Полный аудит начислений и доходов персонала</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="glass-card p-6 rounded-3xl space-y-6 h-fit sticky top-8 border-slate-800 shadow-xl">
          <h2 className="text-lg font-bold font-outfit flex items-center gap-2 text-white">
             <ICONS.Plus size={20} className="text-indigo-400"/> Новая корректировка
          </h2>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Период и Платформа</label>
              <div className="flex gap-2">
                <select className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-indigo-400 font-bold outline-none" value={targetPeriodId} onChange={(e) => setTargetPeriodId(e.target.value)}>
                  {state.accountingPeriods.slice().reverse().map(p => (
                    <option key={p.id} value={p.id}>{p.label} {p.status === 'closed' ? '🔒' : ''}</option>
                  ))}
                </select>
                <select className="w-28 bg-slate-900 border border-slate-700 rounded-xl px-2 py-3 text-[10px] font-bold uppercase text-slate-300 outline-none" value={platform} onChange={(e) => setPlatform(e.target.value as any)}>
                  <option value="all">Общий</option>
                  <option value="onlyFans">OF</option>
                  <option value="paypal">PP</option>
                  <option value="crypto">CR</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Тип операции</label>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {['advance', 'salary_payment', 'bonus', 'penalty', 'refund', 'internship'].map(k => (
                  <button key={k} onClick={() => setType(k as any)} className={`px-2 py-2.5 rounded-xl text-[9px] font-black border uppercase tracking-widest transition-all ${type === k ? 'bg-indigo-500/20 border-indigo-500 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                    {(OPERATION_META[k] as any).label}
                  </button>
                ))}
              </div>
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Оператор</label>
              <select className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white font-bold outline-none" value={operator} onChange={(e) => setOperator(e.target.value)}>
                <option value="">Выберите...</option>
                {state.operators.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Сумма $</label>
                <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white font-mono font-bold outline-none" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Дата</label>
                <input type="date" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
              </div>
            </div>

            <textarea className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm min-h-[80px] text-white outline-none" placeholder="Причина/Заметка..." value={comment} onChange={(e) => setComment(e.target.value)} />
            <button onClick={handleSubmit} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest py-4 rounded-2xl shadow-xl shadow-indigo-600/20 transition-all active:scale-95">Сохранить</button>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card rounded-[2.5rem] overflow-hidden border-slate-800 shadow-2xl">
            <div className="p-8 border-b border-slate-800 bg-slate-900/40 flex justify-between items-center">
              <h2 className="text-xl font-bold font-outfit text-white">Лента транзакций</h2>
              <div className="flex gap-4">
                 <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div><span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Доход</span></div>
                 <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"></div><span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Коррект.</span></div>
              </div>
            </div>
            <div className="divide-y divide-slate-800 overflow-y-auto max-h-[850px] scrollbar-hide">
              {unifiedHistory.length === 0 ? (
                <div className="p-20 text-center text-slate-500 italic flex flex-col items-center gap-4">
                  <ICONS.Operations size={48} className="opacity-10" />
                  <p className="font-outfit font-bold text-lg">История пуста</p>
                </div>
              ) : (
                unifiedHistory.map(item => {
                  if (item.entryType === 'operation') {
                    const op = item as OperationRecord;
                    const meta = OPERATION_META[op.type];
                    return (
                      <div key={op.id} className="p-6 flex items-center justify-between group hover:bg-slate-900/40 transition-all border-l-4 border-transparent hover:border-indigo-500/50">
                        <div className="flex items-center gap-5">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-950 border border-slate-800 ${meta.color} shadow-inner`}><meta.icon size={24} /></div>
                          <div>
                            <div className="flex items-center gap-3">
                               <span className="font-black text-white text-base font-outfit uppercase tracking-tight">{op.operator}</span>
                               {op.platform && <span className="text-[8px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-lg font-black border border-indigo-500/20 uppercase tracking-tighter">{PLATFORM_NAMES[op.platform]}</span>}
                               <span className="text-slate-600 text-[10px] font-mono font-bold">{op.date}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                               <span className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{meta.label}</span>
                               {op.comment && <span className="text-xs text-slate-500 italic"> — "{op.comment}"</span>}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className={`font-black font-mono text-lg text-right ${['bonus', 'internship'].includes(op.type) ? 'text-emerald-400' : 'text-rose-400'}`}>
                             {['bonus', 'internship'].includes(op.type) ? '+' : '-'}${op.amount.toFixed(2)}
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => setEditingOp(op)} className="text-slate-500 hover:text-indigo-400 p-2.5 rounded-xl hover:bg-indigo-500/10 transition-all active:scale-90"><ICONS.Edit size={18}/></button>
                            <button onClick={() => deleteOp(op.id)} className="text-slate-500 hover:text-rose-500 p-2.5 rounded-xl hover:bg-rose-500/10 transition-all active:scale-90"><ICONS.Trash size={18}/></button>
                          </div>
                        </div>
                      </div>
                    );
                  } else {
                    const inc = item as IncomeRecord;
                    const nettoTotal = inc.nettoOF + inc.nettoPP + inc.nettoCrypto;
                    return (
                      <div key={inc.id} className="p-6 flex items-center justify-between group hover:bg-emerald-500/5 transition-all border-l-4 border-transparent hover:border-emerald-500/50">
                        <div className="flex items-center gap-5">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-slate-950 border border-slate-800 text-emerald-500 shadow-inner`}><ICONS.Income size={24} /></div>
                          <div>
                            <div className="flex items-center gap-3">
                               <span className="font-black text-white text-base font-outfit uppercase tracking-tight">{inc.operator}</span>
                               <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-lg font-black border border-emerald-500/20 uppercase tracking-tighter">Income</span>
                               <span className="text-slate-600 text-[10px] font-mono font-bold">{inc.date}</span>
                            </div>
                            <div className="text-[10px] text-emerald-500/70 font-black uppercase tracking-widest mt-1">Анкета: {inc.model}</div>
                            <div className="flex gap-4 mt-1.5 p-2 bg-slate-950/50 rounded-xl border border-slate-800/50 w-fit">
                               <div className="flex flex-col">
                                  <span className="text-[8px] text-slate-500 font-black uppercase tracking-tighter">Gross</span>
                                  <span className="text-[10px] text-slate-300 font-mono font-bold">${inc.total.toFixed(1)}</span>
                               </div>
                               <div className="w-px h-full bg-slate-800"></div>
                               <div className="flex flex-col">
                                  <span className="text-[8px] text-indigo-400 font-black uppercase tracking-tighter">Salary Net</span>
                                  <span className="text-[10px] text-indigo-300 font-mono font-bold">${nettoTotal.toFixed(1)}</span>
                               </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                             <div className="font-black font-mono text-lg text-emerald-400">+${nettoTotal.toFixed(2)}</div>
                             <div className="text-[9px] text-slate-600 font-black uppercase tracking-tighter">К выплате (ЗП)</div>
                          </div>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => deleteIncome(inc.id)} className="text-slate-500 hover:text-rose-500 p-2.5 rounded-xl hover:bg-rose-500/10 transition-all active:scale-90"><ICONS.Trash size={18}/></button>
                          </div>
                        </div>
                      </div>
                    );
                  }
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {editingOp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="glass-card w-full max-w-lg rounded-[2.5rem] p-10 border-indigo-500/30 shadow-2xl relative">
            <button onClick={() => setEditingOp(null)} className="absolute top-8 right-8 text-slate-500 hover:text-white transition-all"><ICONS.Plus className="rotate-45" size={28} /></button>
            <h2 className="text-2xl font-black text-white mb-8 font-outfit uppercase tracking-tight">Редактор операции</h2>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(OPERATION_META).map(([key, meta]) => (
                  <button key={key} onClick={() => setEditingOp({...editingOp, type: key as any})} className={`p-4 rounded-2xl border text-[9px] font-black uppercase tracking-widest transition-all flex items-center gap-3 ${editingOp.type === key ? 'bg-indigo-500/20 border-indigo-500 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                    <meta.icon size={18} />
                    {meta.label}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest ml-1">Платформа</label>
                  <select className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white font-bold outline-none" value={editingOp.platform || 'all'} onChange={e => setEditingOp({...editingOp, platform: e.target.value === 'all' ? undefined : e.target.value as any})}>
                    <option value="all">Общая</option>
                    <option value="onlyFans">OnlyFans</option>
                    <option value="paypal">PayPal</option>
                    <option value="crypto">Crypto</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest ml-1">Сумма $</label>
                  <input type="number" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white font-mono font-bold outline-none" value={editingOp.amount} onChange={e => setEditingOp({...editingOp, amount: parseFloat(e.target.value) || 0})} />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest ml-1">Комментарий</label>
                <input type="text" className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white outline-none" value={editingOp.comment} onChange={e => setEditingOp({...editingOp, comment: e.target.value})} />
              </div>
              <button onClick={handleUpdate} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-600/20 transition-all mt-4 uppercase tracking-[0.2em]">Обновить данные</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Operations;
