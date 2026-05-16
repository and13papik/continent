
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppState, DailyTotalEntry, ShiftData } from '../types';
import { ICONS } from '../constants';
import { findPeriodIdByDate } from '../store';
import PeriodBadge from '../components/PeriodBadge';

const TG_TOKEN = '8497961851:AAEmwmEgJNV6KwyQjdcG62GY3IdX8zz6YV4';
const DEFAULT_CHAT_ID = '-1003748692600';

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
  if (isNaN(val)) return 'bg-slate-900/20 border-slate-800 text-slate-700 opacity-40';
  
  if (val === 0) return 'bg-rose-600 border-rose-400 text-white ring-4 ring-rose-500/50 shadow-[0_0_25px_rgba(244,63,94,0.6)] font-black animate-pulse z-10';
  
  const safeGoal = goal || 1; 
  const ratio = val / safeGoal;
  if (ratio < 0.5) return 'bg-orange-600/30 border-orange-500/50 text-orange-200';
  if (ratio < 1) return 'bg-amber-500/20 border-amber-500/40 text-amber-200';
  return 'bg-emerald-600/50 border-emerald-400 text-emerald-100 font-black shadow-[0_0_15px_rgba(16,185,129,0.3)]';
};

const TotalTable: React.FC<{ state: AppState; updateState: (updater: (prev: AppState) => AppState) => void }> = ({ state, updateState }) => {
  const tableRef = useRef<HTMLDivElement>(null);
  const [isSending, setIsSending] = useState<string | null>(null);

  // Хелпер для получения учетной даты (смена в 03:00 по Киеву)
  const getAccountingDate = () => {
    const now = new Date();
    const kyivTime = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Kiev" }));
    if (kyivTime.getHours() < 3) {
      kyivTime.setDate(kyivTime.getDate() - 1);
    }
    const y = kyivTime.getFullYear();
    const m = String(kyivTime.getMonth() + 1).padStart(2, '0');
    const d = String(kyivTime.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const [selectedDate, setSelectedDate] = useState(getAccountingDate());

  const activePeriodId = state.selectedPeriodId;
  const activePeriod = state.accountingPeriods.find(p => p.id === activePeriodId);
  const currentModels = activePeriod?.models || state.models;
  const currentGoals = activePeriod?.modelDefaultGoals || state.modelDefaultGoals || {};
  const currentPlans = activePeriod?.modelMonthlyPlans || state.modelMonthlyPlans || {};

  const esc = (str: string) => str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const getDynamicGoal = (modelName: string, dateStr: string) => {
    const plan = currentPlans[modelName.trim()];
    if (plan === undefined || plan === null) return null;

    const date = new Date(dateStr);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    
    // Количество дней в этом месяце (UTC)
    const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const currentDay = date.getUTCDate();
    const remainingDays = daysInMonth - currentDay + 1;

    if (remainingDays <= 0) return null;

    // Сколько уже заработано в этом периоде (OnlyFans gross) ДО этой даты
    const earnedSoFar = (state.incomeData || [])
      .filter(r => r.model.trim() === modelName.trim() && r.periodId === activePeriodId && r.date < dateStr)
      .reduce((sum, r) => sum + (r.onlyFans || 0), 0);

    const remainingToEarn = Math.max(0, plan - earnedSoFar);
    // Цель на одну смену (4 смены в день)
    const shiftGoal = Math.round(remainingToEarn / (remainingDays * 4));
    
    return shiftGoal;
  };

  const entriesForDate = useMemo(() => {
    const targetPeriodId = findPeriodIdByDate(selectedDate, state.accountingPeriods) || state.selectedPeriodId;
    const allForDate = (state.totalTableEntries || []).filter(e => e && e.date === selectedDate && e.periodId === targetPeriodId);
    
    // Оставляем только те анкеты, у которых ЕСТЬ месячный план (динамические цели)
    // Это убирает дубликаты от "Стандартов" и показывает только нужные анкеты
    return allForDate.filter(e => {
      const modelName = e.modelName.trim();
      return currentPlans[modelName] !== undefined && currentPlans[modelName] !== null;
    });
  }, [state.totalTableEntries, selectedDate, state.accountingPeriods, state.selectedPeriodId, currentPlans]);

  const getLastKnownGoals = (modelName: string, dateStr: string) => {
    // Пытаемся рассчитать динамическую цель
    const dynamicGoal = getDynamicGoal(modelName, dateStr);
    
    // Если есть динамическая цель - используем её, иначе 0 (как просил пользователь - оставить только динамические)
    const goalVal = dynamicGoal !== null ? dynamicGoal : 0;
    
    return {
      night: goalVal,
      morning: goalVal,
      day: goalVal,
      evening: goalVal
    };
  };

  useEffect(() => {
    if (selectedDate) {
      const targetPeriodId = findPeriodIdByDate(selectedDate, state.accountingPeriods) || state.selectedPeriodId;
      
      // 1. Получаем список имен моделей, у которых есть месячный план (динамические цели)
      const modelsWithPlans = Object.keys(currentPlans).map(m => m.trim()).filter(m => m !== '');
      
      // 2. Проверяем, какие модели УЖЕ есть в таблице за это число
      const existingModelNames = new Set(entriesForDate.map(e => e.modelName.trim()));
      
      // 3. Проверяем, какие модели были УДАЛЕНЫ за это число
      const deletedIdsSet = new Set(state.deletedIds || []);
      
      const newEntries: DailyTotalEntry[] = [];
      
      modelsWithPlans.forEach((modelName) => {
        if (existingModelNames.has(modelName)) return;
        
        // Детерминированный ID для авто-генерации
        const deterministicId = `entry-${selectedDate}-${modelName.replace(/\s+/g, '-').toLowerCase()}`;
        
        // Если этот ID был удален - не добавляем его снова
        if (deletedIdsSet.has(deterministicId)) return;
        
        const goals = getLastKnownGoals(modelName, selectedDate);
        newEntries.push({
          id: deterministicId,
          date: selectedDate,
          modelName: modelName,
          periodId: targetPeriodId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          night: { balance: undefined as any, goal: goals.night },
          morning: { balance: undefined as any, goal: goals.morning },
          day: { balance: undefined as any, goal: goals.day },
          evening: { balance: undefined as any, goal: goals.evening }
        });
      });
      
      if (newEntries.length > 0) {
        updateState(prev => {
          const existingIds = new Set((prev.totalTableEntries || []).map(e => e.id));
          const filteredNew = newEntries.filter(ne => !existingIds.has(ne.id));
          
          if (filteredNew.length === 0) return prev;
          
          return { 
            ...prev, 
            totalTableEntries: [...(prev.totalTableEntries || []), ...filteredNew] 
          };
        });
      }
    }
  }, [selectedDate, currentPlans, entriesForDate.length, state.deletedIds, updateState]);

  const handleUpdate = (entryId: string, shift: keyof DailyTotalEntry, field: keyof ShiftData, value: string) => {
    const val = value === '' ? undefined : parseFloat(value);
    
    updateState(prev => {
      const targetEntry = (prev.totalTableEntries || []).find(e => e.id === entryId);
      const modelName = targetEntry?.modelName;

      // Если обновляем ЦЕЛЬ, сохраняем её как глобальную цель по умолчанию для этой модели В ЭТОМ ПЕРИОДЕ
      let updatedDefaults = currentGoals;
      if (field === 'goal' && modelName && val !== undefined) {
        updatedDefaults = {
          ...updatedDefaults,
          [modelName]: {
            ...(updatedDefaults[modelName] || { night: 60, morning: 60, day: 60, evening: 60 }),
            [shift]: val
          }
        };
      }

      return {
        ...prev,
        accountingPeriods: prev.accountingPeriods.map(p => p.id === activePeriodId ? { ...p, modelDefaultGoals: updatedDefaults } : p),
        totalTableEntries: (prev.totalTableEntries || []).map(e => 
          (e && e.id === entryId) ? { 
            ...e, 
            [shift]: { ...((e[shift] as ShiftData) || {}), [field]: val },
            updatedAt: new Date().toISOString()
          } : e
        )
      };
    });
  };

  const handleSyncGoalsToAll = () => {
    if (!confirm('Применить текущие цели из этой таблицы КО ВСЕМ дням (существующим и будущим)?')) return;
    
    updateState(prev => {
      const currentDateEntries = (prev.totalTableEntries || []).filter(e => e.date === selectedDate);
      const newDefaults: Record<string, any> = { ...currentGoals };
      
      currentDateEntries.forEach(e => {
        newDefaults[e.modelName] = {
          night: e.night.goal,
          morning: e.morning.goal,
          day: e.day.goal,
          evening: e.evening.goal
        };
      });

      // Также обновляем цели во ВСЕХ существующих записях таблицы
      const updatedTotalEntries = (prev.totalTableEntries || []).map(e => {
        const def = newDefaults[e.modelName];
        if (!def) return e;
        return {
          ...e,
          night: { ...e.night, goal: def.night },
          morning: { ...e.morning, goal: def.morning },
          day: { ...e.day, goal: def.day },
          evening: { ...e.evening, goal: def.evening },
          updatedAt: new Date().toISOString()
        };
      });

      return {
        ...prev,
        accountingPeriods: prev.accountingPeriods.map(p => p.id === activePeriodId ? { ...p, modelDefaultGoals: newDefaults } : p),
        totalTableEntries: updatedTotalEntries
      };
    });
    alert('Цели успешно синхронизированы по всей системе!');
  };

  const handleRecalculateDynamicGoals = () => {
    if (!confirm('Пересчитать динамические цели для всех анкет на эту дату на основе месячного плана и остатка?')) return;
    
    updateState(prev => ({
      ...prev,
      totalTableEntries: (prev.totalTableEntries || []).map(e => {
        if (e.date !== selectedDate) return e;
        const goals = getDynamicGoal(e.modelName, selectedDate);
        if (goals === null) return e;
        return {
          ...e,
          night: { ...e.night, goal: goals },
          morning: { ...e.morning, goal: goals },
          day: { ...e.day, goal: goals },
          evening: { ...e.evening, goal: goals },
          updatedAt: new Date().toISOString()
        };
      })
    }));
  };

  const handleRenameModel = (entryId: string, newName: string) => {
    updateState(prev => ({
      ...prev,
      totalTableEntries: (prev.totalTableEntries || []).map(e => 
        (e && e.id === entryId) ? { ...e, modelName: newName, updatedAt: new Date().toISOString() } : e
      )
    }));
  };

  const handleRemoveModel = (entryId: string) => {
    if (!confirm('Удалить эту анкету из таблицы за это число?')) return;
    updateState(prev => ({
      ...prev,
      deletedIds: [...(prev.deletedIds || []), entryId],
      totalTableEntries: (prev.totalTableEntries || []).filter(e => e && e.id !== entryId)
    }));
  };

  const handleAddModel = () => {
    const name = prompt('Введите имя анкеты:');
    if (!name) return;
    const goals = getLastKnownGoals(name, selectedDate);
    const targetPeriodId = findPeriodIdByDate(selectedDate, state.accountingPeriods) || state.selectedPeriodId;
    const deterministicId = `entry-custom-${selectedDate}-${name.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`;
    
    const newEntry: DailyTotalEntry = {
      id: deterministicId,
      date: selectedDate,
      modelName: name,
      periodId: targetPeriodId,
      updatedAt: new Date().toISOString(),
      night: { balance: undefined as any, goal: goals.night },
      morning: { balance: undefined as any, goal: goals.morning },
      day: { balance: undefined as any, goal: goals.day },
      evening: { balance: undefined as any, goal: goals.evening }
    };
    updateState(prev => ({
      ...prev,
      totalTableEntries: [...(prev.totalTableEntries || []), newEntry]
    }));
  };

  const handleReset = () => {
    if (!confirm('Очистить БАЛАНСЫ за выбранную дату? ЦЕЛИ останутся зафиксированными.')) return;
    const now = new Date().toISOString();
    updateState(prev => ({
      ...prev,
      totalTableEntries: (prev.totalTableEntries || []).map(e => 
        (e && e.date === selectedDate) ? {
          ...e,
          updatedAt: now,
          night: { ...(e.night || {}), balance: undefined as any },
          morning: { ...(e.morning || {}), balance: undefined as any },
          day: { ...(e.day || {}), balance: undefined as any },
          evening: { ...(e.evening || {}), balance: undefined as any }
        } : e
      )
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

    entriesForDate.forEach(e => {
      if (!e) return;
      res.night.balance += (e.night?.balance || 0); res.night.goal += (e.night?.goal || 0);
      res.morning.balance += (e.morning?.balance || 0); res.morning.goal += (e.morning?.goal || 0);
      res.day.balance += (e.day?.balance || 0); res.day.goal += (e.day?.goal || 0);
      res.evening.balance += (e.evening?.balance || 0); res.evening.goal += (e.evening?.goal || 0);
    });

    res.overallPlan = res.night.goal + res.morning.goal + res.day.goal + res.evening.goal;
    res.overallBalance = res.night.balance + res.morning.balance + res.day.balance + res.evening.balance;
    res.overallRemaining = Math.max(0, res.overallPlan - res.overallBalance);

    return res;
  }, [entriesForDate]);

  const sendTelegramReport = async (shiftKey: 'night' | 'morning' | 'day' | 'evening') => {
    const chatId = DEFAULT_CHAT_ID;
    const shiftInfo = SHIFTS.find(s => s.key === shiftKey)!;
    setIsSending(shiftKey);

    try {
      if (!tableRef.current) throw new Error("Table ref is missing");
      
      const canvas = await (window as any).html2canvas(tableRef.current, {
        backgroundColor: '#020617',
        scale: 3,
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
            clonedDoc.body.style.overflow = 'visible';
            clonedScrollable.style.overflow = 'visible';
            clonedScrollable.style.width = 'auto';
            clonedScrollable.style.height = 'auto';
            
            clonedContainer.style.width = 'fit-content';
            clonedContainer.style.maxWidth = 'none';
            clonedContainer.style.height = 'auto';
            clonedContainer.style.overflow = 'visible';
            
            const inputs = clonedDoc.querySelectorAll('input');
            inputs.forEach((input) => {
              const val = (input as HTMLInputElement).value || (input as HTMLInputElement).placeholder || '';
              const span = clonedDoc.createElement('span');
              span.textContent = val;
              span.style.display = 'block';
              span.style.width = '100%';
              span.style.textAlign = 'center';
              span.style.lineHeight = '1.2';
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

      let message = `<b>📊 ОТЧЕТ: ${shiftInfo.label.toUpperCase()} ${shiftInfo.icon}</b>\n`;
      message += `📅 Дата: ${selectedDate.split('-').reverse().join('.')}\n\n`;

      let totalShiftBal = 0;
      let totalShiftGoal = 0;

      entriesForDate.forEach(e => {
        if (!e) return;
        const s = (e[shiftKey] as ShiftData) || { balance: undefined, goal: 0 };
        const bal = s.balance === undefined ? 0 : s.balance;
        const goal = s.goal || 0;

        totalShiftBal += bal;
        totalShiftGoal += goal;
        
        const status = s.balance === undefined ? '⚪️ НЕ ЗАПОЛНЕНО' : 
                       bal === 0 ? '🔴 КРИТИЧЕСКАЯ СРАКА (0$)' :
                       bal >= goal ? '✅ ПЛАН' : '❌НЕ ВЫПОЛНЕН';
        
        message += `• <b>${esc(e.modelName || 'Неизвестно')}</b>: ${bal}$ / ${goal}$ — ${status}\n`;
      });

      message += `\n📈 <b>ИТОГО ЗА ${shiftInfo.label.toUpperCase()} СМЕНУ</b>: ${totalShiftBal.toFixed(0)}$ / ${totalShiftGoal.toFixed(0)}$`;

      if (shiftKey === 'evening') {
        message += `\n\n━━━━━━━━━━━━━━━\n`;
        message += `<b>🏆 ИТОГИ ДНЯ (FULL DAY)</b>\n\n`;
        
        message += `📊 <b>ПО СМЕНАМ:</b>\n`;
        message += `🌙 Ночь: ${totals.night.balance.toFixed(0)}$ / ${totals.night.goal.toFixed(0)}$\n`;
        message += `🌅 Утро: ${totals.morning.balance.toFixed(0)}$ / ${totals.morning.goal.toFixed(0)}$\n`;
        message += `☀️ День: ${totals.day.balance.toFixed(0)}$ / ${totals.day.goal.toFixed(0)}$\n`;
        message += `🌇 Вечер: ${totals.evening.balance.toFixed(0)}$ / ${totals.evening.goal.toFixed(0)}$\n\n`;

        message += `👤 <b>ПЕРСОНАЛЬНЫЙ ИТОГ:</b>\n`;
        entriesForDate.forEach(e => {
            if (!e) return;
            const modelDailyTotal = (e.night?.balance || 0) + (e.morning?.balance || 0) + (e.day?.balance || 0) + (e.evening?.balance || 0);
            const modelDailyGoal = (e.night?.goal || 0) + (e.morning?.goal || 0) + (e.day?.goal || 0) + (e.evening?.goal || 0);
            const status = modelDailyTotal >= modelDailyGoal ? '✅' : '❌';
            message += `• ${esc(e.modelName || 'Неизвестно')}: ${modelDailyTotal.toFixed(0)}$ / ${modelDailyGoal.toFixed(0)}$ — ${status}\n`;
        });

        const percent = totals.overallPlan > 0 ? Math.round(totals.overallBalance/totals.overallPlan*100) : 0;
        message += `\n🏁 <b>ИТОГ ДНЯ</b>: ${totals.overallBalance.toFixed(0)}$ / ${totals.overallPlan.toFixed(0)}$ (${percent}%)\n`;
        message += percent >= 100 ? `🔥 <b>ПЛАН ВЫПОЛНЕН!</b>` : `❌ <b>ПЛАН НЕ ВЫПОЛНЕН</b>`;
      } else {
        message += `\n\n🏆 <b>ОБЩИЙ ТОТАЛ СУТОК</b>: ${totals.overallBalance.toFixed(0)}$ / ${totals.overallPlan.toFixed(0)}$ (${totals.overallPlan > 0 ? Math.round(totals.overallBalance/totals.overallPlan*100) : 0}%)`;
      }

      message += `\n\n🔔 <a href="tg://user?id=8679682362">@adm_viksi_viii [Adm]Vi</a> <a href="tg://user?id=6537516111">@adm_rctr Rector</a> <a href="tg://user?id=1434399006">@continental_agency</a>`;

      const formData = new FormData();
      formData.append('chat_id', chatId);
      formData.append('photo', blob, 'report.png');
      formData.append('caption', message);
      formData.append('parse_mode', 'HTML');

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

  const isShiftComplete = (shiftKey: 'night' | 'morning' | 'day' | 'evening') => {
    return entriesForDate.length > 0 && entriesForDate.every(e => {
        if (!e || !e[shiftKey]) return false;
        return e[shiftKey].balance !== undefined && e[shiftKey].balance !== null;
    });
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-700 pb-20 max-w-[1400px] mx-auto">
      <header className="flex flex-col md:flex-row gap-4 justify-between items-center bg-slate-900/50 p-4 rounded-2xl border border-slate-800 shadow-xl">
        <div className="flex items-center gap-4">
           <div className="bg-indigo-600 p-2 rounded-xl text-white font-bold font-outfit text-sm">Continental Core</div>
           <div className="h-6 w-px bg-slate-800 hidden md:block"></div>
           
           <PeriodBadge state={state} />

           <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 shadow-inner group transition-all hover:border-indigo-500/30">
              <ICONS.Calendar size={14} className="text-slate-500 group-hover:text-indigo-400" />
              <input 
                type="date" 
                className="bg-transparent text-[11px] font-black text-white outline-none uppercase tracking-widest cursor-pointer" 
                value={selectedDate} 
                onChange={(e) => setSelectedDate(e.target.value)} 
              />
           </div>

           <div className="text-[10px] text-emerald-500 font-bold uppercase tracking-tighter bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20 flex items-center gap-2">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></div>
             TG: {DEFAULT_CHAT_ID}
           </div>
        </div>
        
        <div className="flex gap-3">
           <button onClick={handleRecalculateDynamicGoals} className="bg-sky-600/20 hover:bg-sky-600 border border-sky-500/30 text-sky-400 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 shadow-lg shadow-sky-500/10">
              <ICONS.RotateCcw size={14} /> Пересчитать динамические цели
           </button>
           <button onClick={handleSyncGoalsToAll} className="bg-emerald-600/20 hover:bg-emerald-600 border border-emerald-500/30 text-emerald-400 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2 shadow-lg shadow-emerald-500/10">
              <ICONS.RotateCcw size={14} /> Применить цели ко всем дням
           </button>
           <button onClick={handleAddModel} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2">
              <ICONS.Plus size={14} /> Добавить анкету
           </button>
           <button onClick={handleReset} className="bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2">
              <ICONS.Trash size={14} /> Очистить
           </button>
        </div>
      </header>

      <div ref={tableRef} className="glass-card rounded-[2.5rem] border-slate-800 shadow-2xl overflow-hidden bg-slate-950">
        <div className="overflow-x-auto">
           <table className="w-full border-collapse">
              <thead>
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
                    <th data-html2canvas-ignore colSpan={3} className="bg-indigo-900/50 p-3 text-center text-[10px] font-black text-white uppercase tracking-[0.2em]">Итого</th>
                    <th data-html2canvas-ignore className="bg-slate-950 p-4 w-12"></th>
                 </tr>
                 <tr className="bg-slate-900/80 text-[9px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-800">
                    <th className="p-2 border-r border-slate-800">№</th>
                    <th className="p-2 text-left border-r border-slate-800">Name</th>
                    {SHIFTS.map(s => (
                       <React.Fragment key={s.key}>
                          <th className="p-2 border-r border-slate-800/30">Баланс</th>
                          <th className="p-2 border-r border-slate-800">Цель</th>
                       </React.Fragment>
                    ))}
                    <th data-html2canvas-ignore className="p-2 border-r border-slate-800/30 text-indigo-400">План</th>
                    <th data-html2canvas-ignore className="p-2 border-r border-slate-800/30 text-rose-400">Осталось</th>
                    <th data-html2canvas-ignore className="p-2 border-r border-slate-800 text-emerald-400">Итого</th>
                    <th data-html2canvas-ignore className="p-2 border-r border-slate-800 text-amber-400">Месяц</th>
                    <th data-html2canvas-ignore className="p-2">Удалить</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                 {entriesForDate.map((entry, idx) => {
                    if (!entry) return null; 

                    const nightG = entry.night?.goal || 0;
                    const mornG = entry.morning?.goal || 0;
                    const dayG = entry.day?.goal || 0;
                    const eveG = entry.evening?.goal || 0;
                    const rowPlan = nightG + mornG + dayG + eveG;

                    const nightB = entry.night?.balance || 0;
                    const mornB = entry.morning?.balance || 0;
                    const dayB = entry.day?.balance || 0;
                    const eveB = entry.evening?.balance || 0;
                    const rowBalance = nightB + mornB + dayB + eveB;
                    
                    const rowRemaining = Math.max(0, rowPlan - rowBalance);

                    const monthlyPlan = currentPlans[entry.modelName] || 0;
                    const earnedInPeriod = (state.incomeData || [])
                      .filter(r => r.model.trim() === entry.modelName.trim() && r.periodId === activePeriodId)
                      .reduce((sum, r) => sum + (r.onlyFans || 0), 0);
                    const monthlyPercent = monthlyPlan > 0 ? Math.round((earnedInPeriod / monthlyPlan) * 100) : 0;

                    return (
                       <tr key={entry.id || `fallback-idx-${idx}`} className="hover:bg-slate-900/30 transition-colors group">
                          <td className="p-3 text-center border-r border-slate-800 text-[10px] font-bold text-slate-600">{idx + 1}</td>
                          <td className="p-3 border-r border-slate-800 font-bold text-slate-200 text-sm">
                             <input 
                                type="text" 
                                className="bg-transparent w-full text-white font-bold outline-none focus:bg-white/5 px-2 py-1 rounded" 
                                value={entry.modelName || ''} 
                                onChange={e => handleRenameModel(entry.id, e.target.value)} 
                             />
                          </td>
                          
                          {SHIFTS.map(s => (
                             <React.Fragment key={s.key}>
                                <td className={`p-1 border-r border-slate-800/30 transition-all ${getCellStatusClasses(entry[s.key]?.balance, entry[s.key]?.goal || 0)}`}>
                                   <input 
                                      type="number" 
                                      className="w-full bg-transparent text-center text-sm font-black outline-none transition-all py-2 placeholder:text-slate-700/50"
                                      value={entry[s.key]?.balance ?? ''} 
                                      onChange={e => handleUpdate(entry.id, s.key, 'balance', e.target.value)}
                                      placeholder="0"
                                   />
                                </td>
                                <td className={`p-1 border-r border-slate-800 ${s.cellColor}`}>
                                   <input 
                                      type="number" 
                                      className="w-full bg-transparent text-center text-sm font-black text-slate-200 outline-none focus:bg-white/5 transition-all py-2 placeholder:text-slate-700"
                                      value={entry[s.key]?.goal ?? ''} 
                                      onChange={e => handleUpdate(entry.id, s.key, 'goal', e.target.value)}
                                      placeholder="0"
                                   />
                                </td>
                             </React.Fragment>
                          ))}

                          <td data-html2canvas-ignore className="p-3 text-center border-r border-slate-800/30 font-bold font-mono text-indigo-400 bg-indigo-500/5">{rowPlan.toFixed(0)}</td>
                          <td data-html2canvas-ignore className={`p-3 text-center border-r border-slate-800/30 font-bold font-mono ${rowRemaining > 0 ? 'text-rose-400' : 'text-emerald-400'} bg-slate-950/30`}>{rowRemaining.toFixed(0)}</td>
                          <td data-html2canvas-ignore className="p-3 text-center font-black font-mono text-emerald-400 bg-emerald-500/5 border-r border-slate-800">{rowBalance.toFixed(0)}</td>
                          <td data-html2canvas-ignore className="p-3 text-center border-r border-slate-800 bg-slate-950">
                             <div className="flex flex-col items-center">
                                <span className="text-[10px] font-black text-amber-500">{monthlyPercent}%</span>
                                <span className="text-[8px] text-slate-500 font-bold">{earnedInPeriod.toFixed(0)} / {monthlyPlan.toFixed(0)}</span>
                             </div>
                          </td>
                          <td data-html2canvas-ignore className="p-3 text-center">
                             <button onClick={() => handleRemoveModel(entry.id)} className="text-slate-600 hover:text-rose-500 transition-colors">
                                <ICONS.Trash size={16} />
                             </button>
                          </td>
                       </tr>
                    );
                 })}
                 <tr className="bg-slate-950 font-black text-xs">
                    <td colSpan={2} className="p-4 text-center border-r border-slate-800 text-slate-400 uppercase tracking-widest">Итого</td>
                    {SHIFTS.map(s => (
                       <React.Fragment key={s.key}>
                          <td className={`p-4 text-center border-r border-slate-800/30 text-white font-mono ${s.cellColor}`}>{totals[s.key].balance.toFixed(0)}</td>
                          <td className={`p-4 text-center border-r border-slate-800 text-slate-200 font-mono font-black ${s.cellColor}`}>{totals[s.key].goal.toFixed(0)}</td>
                       </React.Fragment>
                    ))}
                    <td data-html2canvas-ignore className="p-4 text-center border-r border-slate-800/30 text-indigo-400 font-mono">{totals.overallPlan.toFixed(0)}</td>
                    <td data-html2canvas-ignore className="p-4 text-center border-r border-slate-800/30 text-rose-400 font-mono">{totals.overallRemaining.toFixed(0)}</td>
                    <td data-html2canvas-ignore className="p-4 text-center text-emerald-400 font-mono border-r border-slate-800">{totals.overallBalance.toFixed(0)}</td>
                    <td data-html2canvas-ignore className="p-4"></td>
                 </tr>
              </tbody>
           </table>
        </div>
      </div>

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

      <div className="glass-card p-8 rounded-[2.5rem] bg-gradient-to-r from-indigo-900/20 via-slate-900 to-indigo-900/20 border-slate-800 shadow-2xl relative overflow-hidden">
         <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500/30"></div>
         <div className="flex items-center gap-4 mb-6">
            <ICONS.Income className="text-indigo-400" />
            <h2 className="text-xl font-black font-outfit text-white uppercase tracking-widest">Итоговая Сводка за {selectedDate.split('-').reverse().join('.')}</h2>
         </div>
         <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            <div className="text-center space-y-1">
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Общий План</p>
               <p className="text-4xl font-black text-white font-outfit">{totals.overallPlan.toFixed(0)}</p>
            </div>
            <div className="text-center space-y-1">
               <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Общий Баланс</p>
               <p className="text-4xl font-black text-indigo-400 font-outfit">{totals.overallBalance.toFixed(0)}</p>
            </div>
            <div className="text-center space-y-1">
               <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Осталось</p>
               <p className="text-4xl font-black text-white font-outfit">{totals.overallRemaining.toFixed(0)}</p>
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
