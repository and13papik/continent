
import React, { useState, useMemo, useEffect } from 'react';
import { AppState, DailyTotalEntry, ShiftData } from '../types';
import { ICONS } from '../constants';

const SHIFTS = [
  { key: 'night' as const, label: 'Ночь', icon: '🌙', color: 'bg-indigo-950/80', cellColor: 'bg-indigo-500/5', textColor: 'text-indigo-400' },
  { key: 'morning' as const, label: 'Утро', icon: '🌅', color: 'bg-amber-700/80', cellColor: 'bg-amber-500/5', textColor: 'text-amber-400' },
  { key: 'day' as const, label: 'День', icon: '☀️', color: 'bg-emerald-700/80', cellColor: 'bg-emerald-500/5', textColor: 'text-emerald-400' },
  { key: 'evening' as const, label: 'Вечер', icon: '🌇', color: 'bg-rose-800/80', cellColor: 'bg-rose-500/5', textColor: 'text-rose-400' },
];

const TotalTable: React.FC<{ state: AppState; updateState: (updater: (prev: AppState) => AppState) => void }> = ({ state, updateState }) => {
  // Инициализация данных, если они пусты
  useEffect(() => {
    if (!state.totalTableEntries || state.totalTableEntries.length === 0) {
      const initialEntries = state.models.map(m => ({
        id: `entry-${m}-${Date.now()}`,
        modelName: m,
        night: { balance: 0, goal: 60 },
        morning: { balance: 0, goal: 60 },
        day: { balance: 0, goal: 60 },
        evening: { balance: 0, goal: 60 }
      }));
      updateState(prev => ({ ...prev, totalTableEntries: initialEntries }));
    }
  }, [state.models, state.totalTableEntries]);

  const entries = state.totalTableEntries || [];

  const handleUpdate = (entryId: string, shift: keyof DailyTotalEntry, field: keyof ShiftData, value: string) => {
    const num = parseFloat(value) || 0;
    updateState(prev => ({
      ...prev,
      totalTableEntries: (prev.totalTableEntries || []).map(e => 
        e.id === entryId ? { ...e, [shift]: { ...(e[shift] as ShiftData), [field]: num } } : e
      )
    }));
  };

  const handleRenameModel = (entryId: string, newName: string) => {
    updateState(prev => ({
      ...prev,
      totalTableEntries: (prev.totalTableEntries || []).map(e => 
        e.id === entryId ? { ...e, modelName: newName } : e
      )
    }));
  };

  const handleRemoveModel = (entryId: string) => {
    if (!confirm('Удалить эту анкету из сегодняшней таблицы?')) return;
    updateState(prev => ({
      ...prev,
      totalTableEntries: (prev.totalTableEntries || []).filter(e => e.id !== entryId)
    }));
  };

  const handleAddModel = () => {
    const name = prompt('Введите имя анкеты:');
    if (!name) return;
    
    const newEntry: DailyTotalEntry = {
      id: `entry-custom-${Date.now()}`,
      modelName: name,
      night: { balance: 0, goal: 60 },
      morning: { balance: 0, goal: 60 },
      day: { balance: 0, goal: 60 },
      evening: { balance: 0, goal: 60 }
    };

    updateState(prev => ({
      ...prev,
      totalTableEntries: [...(prev.totalTableEntries || []), newEntry]
    }));
  };

  const handleReset = () => {
    if (!confirm('Очистить все текущие балансы? Цели останутся прежними.')) return;
    updateState(prev => ({
      ...prev,
      totalTableEntries: (prev.totalTableEntries || []).map(e => ({
        ...e,
        night: { ...e.night, balance: 0 },
        morning: { ...e.morning, balance: 0 },
        day: { ...e.day, balance: 0 },
        evening: { ...e.evening, balance: 0 }
      }))
    }));
  };

  const totals = useMemo(() => {
    const res = {
      night: { balance: 0, goal: 0 },
      morning: { balance: 0, goal: 0 },
      day: { balance: 0, goal: 0 },
      evening: { balance: 0, goal: 0 },
      overallPlan: 0,
      overallBalance: 0,
      overallRemaining: 0
    };

    entries.forEach(e => {
      res.night.balance += e.night.balance; res.night.goal += e.night.goal;
      res.morning.balance += e.morning.balance; res.morning.goal += e.morning.goal;
      res.day.balance += e.day.balance; res.day.goal += e.day.goal;
      res.evening.balance += e.evening.balance; res.evening.goal += e.evening.goal;
    });

    res.overallPlan = res.night.goal + res.morning.goal + res.day.goal + res.evening.goal;
    res.overallBalance = res.night.balance + res.morning.balance + res.day.balance + res.evening.balance;
    res.overallRemaining = Math.max(0, res.overallPlan - res.overallBalance);

    return res;
  }, [entries]);

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-20 max-w-[1400px] mx-auto">
      {/* HEADER */}
      <header className="flex justify-between items-center bg-slate-900/50 p-4 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-4">
           <div className="bg-indigo-600 p-2 rounded-xl text-white font-bold font-outfit text-sm">Continental Core</div>
           <div className="h-6 w-px bg-slate-800"></div>
           <div className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
              {new Date().toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric', month: 'short' })} • {new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
           </div>
        </div>
        <div className="flex gap-3">
           <button onClick={handleAddModel} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2">
              <ICONS.Plus size={14} /> Добавить анкету
           </button>
           <button onClick={handleReset} className="bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2">
              <ICONS.RotateCcw size={14} /> Очистить
           </button>
        </div>
      </header>

      {/* MAIN TABLE */}
      <div className="glass-card rounded-[2rem] border-slate-800 shadow-2xl overflow-hidden">
        <div className="overflow-x-auto">
           <table className="w-full border-collapse">
              <thead>
                 {/* SHIFT GROUPS */}
                 <tr>
                    <th className="bg-slate-950 p-4 w-12 border-r border-slate-800"></th>
                    <th className="bg-slate-950 p-4 text-left border-r border-slate-800 text-slate-500 text-[10px] font-black uppercase tracking-widest">Анкета</th>
                    {SHIFTS.map(s => (
                       <th key={s.key} colSpan={2} className={`${s.color} p-3 text-center border-r border-slate-800/50`}>
                          <div className="flex items-center justify-center gap-2">
                             <span className="text-lg">{s.icon}</span>
                             <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{s.label}</span>
                          </div>
                       </th>
                    ))}
                    <th colSpan={3} className="bg-indigo-900/50 p-3 text-center text-[10px] font-black text-white uppercase tracking-[0.2em]">Итого</th>
                    <th className="bg-slate-950 p-4 w-12"></th>
                 </tr>
                 {/* SUB HEADERS */}
                 <tr className="bg-slate-900/80 text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
                    <th className="p-2 border-r border-slate-800">№</th>
                    <th className="p-2 text-left border-r border-slate-800">Name</th>
                    {SHIFTS.map(s => (
                       <React.Fragment key={s.key}>
                          <th className="p-2 border-r border-slate-800/30">Баланс</th>
                          <th className="p-2 border-r border-slate-800">Цель</th>
                       </React.Fragment>
                    ))}
                    <th className="p-2 border-r border-slate-800/30 text-indigo-400">План</th>
                    <th className="p-2 border-r border-slate-800/30 text-rose-400">Осталось</th>
                    <th className="p-2 border-r border-slate-800 text-emerald-400">Итого</th>
                    <th className="p-2">Удалить</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                 {entries.map((entry, idx) => {
                    const rowPlan = entry.night.goal + entry.morning.goal + entry.day.goal + entry.evening.goal;
                    const rowBalance = entry.night.balance + entry.morning.balance + entry.day.balance + entry.evening.balance;
                    const rowRemaining = Math.max(0, rowPlan - rowBalance);

                    return (
                       <tr key={entry.id} className="hover:bg-slate-900/30 transition-colors group">
                          <td className="p-3 text-center border-r border-slate-800 text-[10px] font-bold text-slate-600">{idx + 1}</td>
                          <td className="p-3 border-r border-slate-800 font-bold text-slate-200 text-sm">
                             <input 
                                type="text" 
                                className="bg-transparent w-full text-white font-bold outline-none focus:bg-white/5 px-2 py-1 rounded" 
                                value={entry.modelName} 
                                onChange={e => handleRenameModel(entry.id, e.target.value)} 
                             />
                          </td>
                          
                          {SHIFTS.map(s => (
                             <React.Fragment key={s.key}>
                                <td className={`p-1 border-r border-slate-800/30 ${s.cellColor}`}>
                                   <input 
                                      type="number" 
                                      className="w-full bg-transparent text-center text-sm font-mono text-white outline-none focus:bg-white/5 transition-all py-2"
                                      value={entry[s.key].balance || ''} 
                                      onChange={e => handleUpdate(entry.id, s.key, 'balance', e.target.value)}
                                      placeholder="0"
                                   />
                                </td>
                                <td className={`p-1 border-r border-slate-800 ${s.cellColor}`}>
                                   <input 
                                      type="number" 
                                      className="w-full bg-transparent text-center text-sm font-black text-slate-200 outline-none focus:bg-white/5 transition-all py-2 placeholder:text-slate-700"
                                      value={entry[s.key].goal || ''} 
                                      onChange={e => handleUpdate(entry.id, s.key, 'goal', e.target.value)}
                                      placeholder="0"
                                   />
                                </td>
                             </React.Fragment>
                          ))}

                          <td className="p-3 text-center border-r border-slate-800/30 font-bold font-mono text-indigo-400 bg-indigo-500/5">{rowPlan}</td>
                          <td className={`p-3 text-center border-r border-slate-800/30 font-bold font-mono ${rowRemaining > 0 ? 'text-rose-400' : 'text-emerald-400'} bg-slate-950/30`}>{rowRemaining}</td>
                          <td className="p-3 text-center font-black font-mono text-emerald-400 bg-emerald-500/5 border-r border-slate-800">{rowBalance}</td>
                          <td className="p-3 text-center">
                             <button onClick={() => handleRemoveModel(entry.id)} className="text-slate-600 hover:text-rose-500 transition-colors">
                                <ICONS.Trash size={16} />
                             </button>
                          </td>
                       </tr>
                    );
                 })}
                 {/* FOOTER TOTALS */}
                 <tr className="bg-slate-950 font-black text-xs">
                    <td colSpan={2} className="p-4 text-center border-r border-slate-800 text-slate-400 uppercase tracking-widest">Итого</td>
                    {SHIFTS.map(s => (
                       <React.Fragment key={s.key}>
                          <td className={`p-4 text-center border-r border-slate-800/30 text-white font-mono ${s.cellColor}`}>{totals[s.key].balance.toFixed(0)}</td>
                          <td className={`p-4 text-center border-r border-slate-800 text-slate-200 font-mono font-black ${s.cellColor}`}>{totals[s.key].goal.toFixed(0)}</td>
                       </React.Fragment>
                    ))}
                    <td className="p-4 text-center border-r border-slate-800/30 text-indigo-400 font-mono">{totals.overallPlan}</td>
                    <td className="p-4 text-center border-r border-slate-800/30 text-rose-400 font-mono">{totals.overallRemaining}</td>
                    <td className="p-4 text-center text-emerald-400 font-mono border-r border-slate-800">{totals.overallBalance}</td>
                    <td className="p-4"></td>
                 </tr>
              </tbody>
           </table>
        </div>
      </div>

      {/* SUMMARY WIDGETS */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
         {SHIFTS.map(s => (
            <div key={s.key} className="glass-card p-5 rounded-3xl border-slate-800 flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <span className="text-2xl">{s.icon}</span>
                  <p className={`text-[10px] font-black uppercase tracking-widest ${s.textColor}`}>{s.label}</p>
               </div>
               <p className="text-xl font-black text-white font-mono">{totals[s.key].balance.toFixed(0)}</p>
            </div>
         ))}
      </section>

      {/* FINAL SUMMARY BANNER */}
      <div className="glass-card p-8 rounded-[2.5rem] bg-gradient-to-r from-indigo-900/20 via-slate-900 to-indigo-900/20 border-slate-800 shadow-2xl relative overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500/30"></div>
         <div className="flex items-center gap-4 mb-6">
            <ICONS.Income className="text-indigo-400" />
            <h2 className="text-xl font-black font-outfit text-white uppercase tracking-widest">Итоговая Сводка</h2>
         </div>
         <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center space-y-1">
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Общий План</p>
               <p className="text-4xl font-black text-white font-outfit">{totals.overallPlan}</p>
            </div>
            <div className="text-center space-y-1">
               <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Общий Баланс</p>
               <p className="text-4xl font-black text-indigo-400 font-outfit">{totals.overallBalance}</p>
            </div>
            <div className="text-center space-y-1">
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Осталось</p>
               <p className="text-4xl font-black text-white font-outfit">{totals.overallRemaining}</p>
            </div>
            <div className="text-center space-y-1">
               <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Выполнено</p>
               <p className="text-4xl font-black text-emerald-400 font-outfit">
                  {totals.overallPlan > 0 ? Math.round((totals.overallBalance / totals.overallPlan) * 100) : 0}%
               </p>
            </div>
         </div>
      </div>
    </div>
  );
};

export default TotalTable;
