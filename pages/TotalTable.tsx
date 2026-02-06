
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppState, DailyTotalEntry, ShiftData } from '../types';
import { ICONS } from '../constants';

const TG_TOKEN = '8497961851:AAEmwmEgJNV6KwyQjdcG62GY3IdX8zz6YV4';

const SHIFTS = [
  { key: 'night' as const, label: 'Ночь', icon: '🌙', color: 'bg-indigo-950/80', cellColor: 'bg-indigo-500/5', textColor: 'text-indigo-400' },
  { key: 'morning' as const, label: 'Утро', icon: '🌅', color: 'bg-amber-700/80', cellColor: 'bg-amber-500/5', textColor: 'text-amber-400' },
  { key: 'day' as const, label: 'День', icon: '☀️', color: 'bg-emerald-700/80', cellColor: 'bg-emerald-500/5', textColor: 'text-emerald-400' },
  { key: 'evening' as const, label: 'Вечер', icon: '🌇', color: 'bg-rose-800/80', cellColor: 'bg-rose-500/5', textColor: 'text-rose-400' },
];

const getCellStatusClasses = (balance: any, goal: number) => {
  if (balance === undefined || balance === null || balance === '') {
    return 'bg-slate-900/20 border-slate-800 text-slate-700 opacity-40';
  }

  const val = parseFloat(balance);
  
  if (val === 0) return 'bg-rose-600 border-rose-400 text-white ring-4 ring-rose-500/50 shadow-[0_0_25px_rgba(244,63,94,0.6)] font-black animate-pulse z-10';
  
  const ratio = val / goal;
  if (ratio < 0.5) return 'bg-orange-600/30 border-orange-500/50 text-orange-200';
  if (ratio < 1) return 'bg-amber-500/20 border-amber-500/40 text-amber-200';
  return 'bg-emerald-600/50 border-emerald-400 text-emerald-100 font-black shadow-[0_0_15px_rgba(16,185,129,0.3)]';
};

const TotalTable: React.FC<{ state: AppState; updateState: (updater: (prev: AppState) => AppState) => void }> = ({ state, updateState }) => {
  const tableRef = useRef<HTMLDivElement>(null);
  const [isSending, setIsSending] = useState<string | null>(null);

  useEffect(() => {
    if (!state.totalTableEntries || state.totalTableEntries.length === 0) {
      const initialEntries = state.models.map(m => ({
        id: `entry-${m}-${Date.now()}`,
        modelName: m,
        night: { balance: undefined as any, goal: 60 },
        morning: { balance: undefined as any, goal: 60 },
        day: { balance: undefined as any, goal: 60 },
        evening: { balance: undefined as any, goal: 60 }
      }));
      updateState(prev => ({ ...prev, totalTableEntries: initialEntries }));
    }
  }, [state.models, state.totalTableEntries]);

  const entries = state.totalTableEntries || [];

  const handleUpdate = (entryId: string, shift: keyof DailyTotalEntry, field: keyof ShiftData, value: string) => {
    const val = value === '' ? undefined : parseFloat(value);
    updateState(prev => ({
      ...prev,
      totalTableEntries: (prev.totalTableEntries || []).map(e => 
        e.id === entryId ? { ...e, [shift]: { ...(e[shift] as ShiftData), [field]: val } } : e
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
      night: { balance: undefined as any, goal: 60 },
      morning: { balance: undefined as any, goal: 60 },
      day: { balance: undefined as any, goal: 60 },
      evening: { balance: undefined as any, goal: 60 }
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
        night: { ...e.night, balance: undefined as any },
        morning: { ...e.morning, balance: undefined as any },
        day: { ...e.day, balance: undefined as any },
        evening: { ...e.evening, balance: undefined as any }
      }))
    }));
  };

  const sendTelegramReport = async (shiftKey: 'night' | 'morning' | 'day' | 'evening') => {
    let chatId = state.tgChatId;
    if (!chatId) {
      chatId = prompt('Введите ID чата (например, 12345678 или -100...):') || undefined;
      if (!chatId) return;
      updateState(prev => ({ ...prev, tgChatId: chatId }));
    }

    const shiftInfo = SHIFTS.find(s => s.key === shiftKey)!;
    setIsSending(shiftKey);

    try {
      if (!tableRef.current) throw new Error("Table ref is missing");
      
      const canvas = await (window as any).html2canvas(tableRef.current, {
        backgroundColor: '#020617',
        scale: 3, // Высокое разрешение
        logging: false,
        useCORS: true,
        allowTaint: true,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc: Document) => {
          const clonedContainer = clonedDoc.querySelector('.glass-card') as HTMLElement;
          const clonedScrollable = clonedDoc.querySelector('.overflow-x-auto') as HTMLElement;
          const clonedTable = clonedDoc.querySelector('table') as HTMLElement;

          if (clonedContainer && clonedScrollable && clonedTable) {
            // 1. Убираем все ограничения по переполнению
            clonedDoc.body.style.overflow = 'visible';
            clonedScrollable.style.overflow = 'visible';
            clonedScrollable.style.width = 'auto';
            clonedScrollable.style.height = 'auto';
            
            // 2. Устанавливаем ширину контейнера равную физической ширине таблицы
            const fullWidth = clonedTable.offsetWidth;
            clonedContainer.style.width = `${fullWidth}px`;
            clonedContainer.style.maxWidth = 'none';
            clonedContainer.style.height = 'auto';
            clonedContainer.style.overflow = 'visible';
            
            // 3. Исправляем проблему с "обрезанными" инпутами:
            // Заменяем инпуты на статический текст, чтобы html2canvas не путал высоту строки
            const inputs = clonedDoc.querySelectorAll('input');
            inputs.forEach((input) => {
              const val = (input as HTMLInputElement).value || (input as HTMLInputElement).placeholder || '';
              const span = clonedDoc.createElement('span');
              span.textContent = val;
              span.style.display = 'block';
              span.style.width = '100%';
              span.style.textAlign = 'center';
              span.style.lineHeight = '1.5';
              span.style.fontSize = window.getComputedStyle(input).fontSize;
              span.style.fontWeight = window.getComputedStyle(input).fontWeight;
              span.style.color = window.getComputedStyle(input).color;
              span.style.fontFamily = window.getComputedStyle(input).fontFamily;
              
              if (input.parentElement) {
                input.parentElement.replaceChild(span, input);
              }
            });
          }
        }
      });
      
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/png', 1.0));
      if (!blob) throw new Error('Не удалось создать изображение таблицы');

      let message = `📊 *ОТЧЕТ: ${shiftInfo.label.toUpperCase()} ${shiftInfo.icon}*\n`;
      message += `📅 Дата: ${new Date().toLocaleDateString('ru-RU')}\n\n`;

      let totalShiftBal = 0;
      let totalShiftGoal = 0;

      entries.forEach(e => {
        const s = e[shiftKey] as ShiftData;
        const bal = s.balance === undefined ? 0 : s.balance;
        totalShiftBal += bal;
        totalShiftGoal += s.goal;
        
        const status = s.balance === undefined ? '⚪️ НЕ ЗАПОЛНЕНО' : 
                       bal === 0 ? '🔴 КРИТИЧЕСКАЯ СРАКА (0$)' :
                       bal >= s.goal ? '✅ ПЛАН' : '❌НЕ ВЫПОЛНЕН';
        
        message += `• *${e.modelName}*: ${bal}$ / ${s.goal}$ — ${status}\n`;
      });

      const totalOverallPlan = entries.reduce((acc, e) => acc + (e.night.goal || 0) + (e.morning.goal || 0) + (e.day.goal || 0) + (e.evening.goal || 0), 0);
      const totalOverallBal = entries.reduce((acc, e) => acc + (e.night.balance || 0) + (e.morning.balance || 0) + (e.day.balance || 0) + (e.evening.balance || 0), 0);

      message += `\n📈 *ИТОГО ЗА ${shiftInfo.label.toUpperCase()} СМЕНУ*: ${totalShiftBal}$ / ${totalShiftGoal}$`;
      message += `\n\n🏆 *ОБЩИЙ ТОТАЛ*: ${totalOverallBal}$ / ${totalOverallPlan}$ (${totalOverallPlan > 0 ? Math.round(totalOverallBal/totalOverallPlan*100) : 0}%)`;

      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('photo', blob, 'report.png');
      formData.append('caption', message);
      formData.append('parse_mode', 'Markdown');

      const res = await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        alert('Отчет успешно доставлен в Telegram!');
      } else {
        const resultData = await res.json();
        alert(`Ошибка Telegram: ${resultData.description || 'Неизвестная ошибка'}`);
      }
    } catch (e: any) {
      alert(`Сбой при отправке: ${e.message}`);
    } finally {
      setIsSending(null);
    }
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
      res.night.balance += (e.night.balance || 0); res.night.goal += (e.night.goal || 0);
      res.morning.balance += (e.morning.balance || 0); res.morning.goal += (e.morning.goal || 0);
      res.day.balance += (e.day.balance || 0); res.day.goal += (e.day.goal || 0);
      res.evening.balance += (e.evening.balance || 0); res.evening.goal += (e.evening.goal || 0);
    });

    res.overallPlan = res.night.goal + res.morning.goal + res.day.goal + res.evening.goal;
    res.overallBalance = res.night.balance + res.morning.balance + res.day.balance + res.evening.balance;
    res.overallRemaining = Math.max(0, res.overallPlan - res.overallBalance);

    return res;
  }, [entries]);

  const isShiftComplete = (shiftKey: 'night' | 'morning' | 'day' | 'evening') => {
    return entries.length > 0 && entries.every(e => e[shiftKey].balance !== undefined);
  };

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
           {state.tgChatId && (
             <div className="text-[10px] text-emerald-500 font-bold uppercase tracking-tighter bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20 flex items-center gap-2">
               <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
               TG: {state.tgChatId}
             </div>
           )}
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

      {/* MAIN TABLE WRAPPER FOR SCREENSHOT */}
      <div ref={tableRef} className="glass-card rounded-[2rem] border-slate-800 shadow-2xl overflow-hidden bg-slate-950">
        <div className="overflow-x-auto">
           <table className="w-full border-collapse">
              <thead>
                 {/* SHIFT GROUPS */}
                 <tr>
                    <th className="bg-slate-950 p-4 w-12 border-r border-slate-800"></th>
                    <th className="bg-slate-950 p-4 text-left border-r border-slate-800 text-slate-500 text-[10px] font-black uppercase tracking-widest">Анкета</th>
                    {SHIFTS.map(s => (
                       <th key={s.key} colSpan={2} className={`${s.color} p-3 text-center border-r border-slate-800/50`}>
                          <div className="flex flex-col items-center justify-center gap-1">
                             <div className="flex items-center gap-2">
                                <span className="text-lg">{s.icon}</span>
                                <span className="text-[10px] font-black text-white uppercase tracking-[0.2em]">{s.label}</span>
                             </div>
                             {isShiftComplete(s.key) && (
                               <button 
                                 data-html2canvas-ignore
                                 onClick={(e) => { e.stopPropagation(); sendTelegramReport(s.key); }}
                                 disabled={isSending === s.key}
                                 className="mt-1 bg-white hover:bg-indigo-400 text-slate-950 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest transition-all active:scale-95 disabled:opacity-50 shadow-lg"
                               >
                                 {isSending === s.key ? 'Отправка...' : '🚀 Отчет в TG'}
                               </button>
                             )}
                          </div>
                       </th>
                    ))}
                    <th colSpan={3} className="bg-indigo-900/50 p-3 text-center text-[10px] font-black text-white uppercase tracking-[0.2em]">Итого</th>
                    <th data-html2canvas-ignore className="bg-slate-950 p-4 w-12"></th>
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
                    <th data-html2canvas-ignore className="p-2">Удалить</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                 {entries.map((entry, idx) => {
                    const rowPlan = (entry.night.goal || 0) + (entry.morning.goal || 0) + (entry.day.goal || 0) + (entry.evening.goal || 0);
                    const rowBalance = (entry.night.balance || 0) + (entry.morning.balance || 0) + (entry.day.balance || 0) + (entry.evening.balance || 0);
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
                                <td className={`p-1 border-r border-slate-800/30 transition-all ${getCellStatusClasses(entry[s.key].balance, entry[s.key].goal)}`}>
                                   <input 
                                      type="number" 
                                      className="w-full bg-transparent text-center text-sm font-black outline-none transition-all py-2 placeholder:text-slate-700/50"
                                      value={entry[s.key].balance ?? ''} 
                                      onChange={e => handleUpdate(entry.id, s.key, 'balance', e.target.value)}
                                      placeholder="0"
                                   />
                                </td>
                                <td className={`p-1 border-r border-slate-800 ${s.cellColor}`}>
                                   <input 
                                      type="number" 
                                      className="w-full bg-transparent text-center text-sm font-black text-slate-200 outline-none focus:bg-white/5 transition-all py-2 placeholder:text-slate-700"
                                      value={entry[s.key].goal ?? ''} 
                                      onChange={e => handleUpdate(entry.id, s.key, 'goal', e.target.value)}
                                      placeholder="0"
                                   />
                                </td>
                             </React.Fragment>
                          ))}

                          <td className="p-3 text-center border-r border-slate-800/30 font-bold font-mono text-indigo-400 bg-indigo-500/5">{rowPlan}</td>
                          <td className={`p-3 text-center border-r border-slate-800/30 font-bold font-mono ${rowRemaining > 0 ? 'text-rose-400' : 'text-emerald-400'} bg-slate-950/30`}>{rowRemaining}</td>
                          <td className="p-3 text-center font-black font-mono text-emerald-400 bg-emerald-500/5 border-r border-slate-800">{rowBalance}</td>
                          <td data-html2canvas-ignore className="p-3 text-center">
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
                    <td data-html2canvas-ignore className="p-4"></td>
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
