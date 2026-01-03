
import React, { useState } from 'react';
import { AppState, OperationType, OperationRecord, Platform } from '../types';
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

  // Edit State
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
      operationsData: prev.operationsData.map(o => o.id === editingOp.id ? editingOp : o)
    }));
    setEditingOp(null);
  };

  const deleteOp = (id: string) => {
    if (!confirm('Удалить операцию?')) return;
    updateState(prev => ({
      ...prev,
      operationsData: prev.operationsData.filter(o => o.id !== id)
    }));
  };

  const filteredOps = state.operationsData.filter(o => o.periodId === state.selectedPeriodId);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header>
        <h1 className="text-3xl font-bold text-white">Операции</h1>
        <p className="text-slate-400">Учет выплат и штрафов с привязкой к платформе.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="glass-card p-6 rounded-2xl space-y-6 h-fit">
          <h2 className="text-lg font-bold font-outfit">Новая запись</h2>
          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">1. Период и Платформа</label>
              <div className="flex gap-2">
                <select 
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-indigo-400 font-bold"
                  value={targetPeriodId}
                  onChange={(e) => setTargetPeriodId(e.target.value)}
                >
                  {state.accountingPeriods.slice().reverse().map(p => (
                    <option key={p.id} value={p.id}>{p.label} {p.status === 'closed' ? '🔒' : ''}</option>
                  ))}
                </select>
                <select 
                  className="w-28 bg-slate-900 border border-slate-700 rounded-xl px-2 py-3 text-[10px] font-bold uppercase text-slate-300"
                  value={platform}
                  onChange={(e) => setPlatform(e.target.value as any)}
                >
                  <option value="all">Общий</option>
                  <option value="onlyFans">OF</option>
                  <option value="paypal">PP</option>
                  <option value="crypto">CR</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">2. Тип и Оператор</label>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {['advance', 'salary_payment', 'bonus', 'penalty', 'refund', 'internship'].map(k => (
                  <button key={k} onClick={() => setType(k as any)} className={`px-2 py-2 rounded-lg text-[9px] font-bold border uppercase tracking-tighter ${type === k ? 'bg-indigo-500/20 border-indigo-500 text-white shadow-lg shadow-indigo-500/10' : 'bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700'}`}>
                    {(OPERATION_META[k] as any).label}
                  </button>
                ))}
              </div>
              <select className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white" value={operator} onChange={(e) => setOperator(e.target.value)}>
                <option value="">Выберите оператора</option>
                {state.operators.map(op => <option key={op} value={op}>{op}</option>)}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Сумма $</label>
                <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white font-mono" placeholder="0.00" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Дата факта</label>
                <input type="date" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
              </div>
            </div>

            <textarea className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm min-h-[80px] text-white" placeholder="Комментарий (причина)..." value={comment} onChange={(e) => setComment(e.target.value)} />

            <button onClick={handleSubmit} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-indigo-600/20 transition-all active:scale-95">Сохранить операцию</button>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="glass-card rounded-2xl overflow-hidden border-indigo-500/10 shadow-2xl">
            <div className="p-6 border-b border-slate-800 bg-slate-900/40 flex justify-between items-center">
              <h2 className="text-lg font-bold">История за {state.accountingPeriods.find(p => p.id === state.selectedPeriodId)?.label}</h2>
              <div className="flex gap-2">
                 <span className="text-[10px] px-2 py-1 bg-indigo-500/10 text-indigo-400 rounded-lg border border-indigo-500/20 font-bold uppercase tracking-widest">Все платформы</span>
              </div>
            </div>
            <div className="divide-y divide-slate-800 overflow-y-auto max-h-[600px]">
              {filteredOps.length === 0 ? (
                <div className="p-12 text-center text-slate-500 italic flex flex-col items-center gap-3">
                  <ICONS.Operations size={32} className="opacity-20" />
                  Записей в этом периоде пока нет
                </div>
              ) : (
                filteredOps.map(op => {
                  const meta = OPERATION_META[op.type];
                  return (
                    <div key={op.id} className="p-4 flex items-center justify-between group hover:bg-slate-800/30 transition-colors">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-slate-900 border border-slate-800 ${meta.color}`}><meta.icon size={20} /></div>
                        <div>
                          <div className="flex items-center gap-2">
                             <span className="font-bold text-white text-sm">{op.operator}</span>
                             {op.platform && <span className="text-[8px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-black border border-slate-700 uppercase tracking-tighter">{PLATFORM_NAMES[op.platform]}</span>}
                             <span className="text-slate-500 text-[9px] font-mono">/ {op.date}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 truncate max-w-[200px]">{op.comment || meta.label}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className={`font-bold font-mono text-sm ${['bonus', 'internship'].includes(op.type) ? 'text-emerald-500' : 'text-rose-500'}`}>
                           {['bonus', 'internship'].includes(op.type) ? '+' : '-'}${op.amount.toFixed(2)}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                          <button onClick={() => setEditingOp(op)} className="text-slate-500 hover:text-indigo-400 p-2 rounded-lg hover:bg-indigo-500/10">
                             <ICONS.Edit size={16}/>
                          </button>
                          <button onClick={() => deleteOp(op.id)} className="text-slate-500 hover:text-rose-500 p-2 rounded-lg hover:bg-rose-500/10">
                             <ICONS.Trash size={16}/>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingOp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="glass-card w-full max-w-lg rounded-3xl p-8 border-indigo-500/30 shadow-2xl relative">
            <button onClick={() => setEditingOp(null)} className="absolute top-6 right-6 text-slate-500 hover:text-white"><ICONS.Plus className="rotate-45" size={24} /></button>
            <h2 className="text-2xl font-bold text-white mb-6 font-outfit">Редактировать операцию</h2>
            
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(OPERATION_META).map(([key, meta]) => (
                  <button key={key} onClick={() => setEditingOp({...editingOp, type: key as any})} className={`p-3 rounded-xl border text-[10px] font-bold uppercase transition-all flex items-center gap-2 ${editingOp.type === key ? 'bg-indigo-500/20 border-indigo-500 text-white' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                    <meta.icon size={14} />
                    {meta.label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase">Платформа</label>
                  <select className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white outline-none" value={editingOp.platform || 'all'} onChange={e => setEditingOp({...editingOp, platform: e.target.value === 'all' ? undefined : e.target.value as any})}>
                    <option value="all">Общая</option>
                    <option value="onlyFans">OnlyFans</option>
                    <option value="paypal">PayPal</option>
                    <option value="crypto">Crypto</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold uppercase">Сумма $</label>
                  <input type="number" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white font-mono outline-none" value={editingOp.amount} onChange={e => setEditingOp({...editingOp, amount: parseFloat(e.target.value) || 0})} />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] text-slate-500 font-bold uppercase">Комментарий</label>
                <input type="text" className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white outline-none" value={editingOp.comment} onChange={e => setEditingOp({...editingOp, comment: e.target.value})} />
              </div>

              <button onClick={handleUpdate} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-4 rounded-xl shadow-xl shadow-indigo-600/20 transition-all mt-4">Применить изменения</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Operations;
