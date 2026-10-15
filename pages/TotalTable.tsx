import { telegramFetch } from '../telegramClient';

import React, { useState, useMemo, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import { AppState, DailyTotalEntry, ShiftData } from '../types';
import { ICONS } from '../constants';
import { findPeriodIdByDate } from '../store';
import { Moon, Sunrise, Sun, Sunset } from 'lucide-react';
import './TotalTable.css';

const DEFAULT_CHAT_ID = '-1003748692600';

const SHIFTS = [
  { key: 'night' as const, label: 'Ночь', icon: '🌙', color: 'bg-indigo-950/80', cellColor: 'bg-indigo-500/5', textColor: 'text-indigo-400' },
  { key: 'morning' as const, label: 'Утро', icon: '🌅', color: 'bg-amber-700/80', cellColor: 'bg-amber-500/5', textColor: 'text-amber-400' },
  { key: 'day' as const, label: 'День', icon: '☀️', color: 'bg-emerald-700/80', cellColor: 'bg-emerald-500/5', textColor: 'text-emerald-400' },
  { key: 'evening' as const, label: 'Вечер', icon: '🌇', color: 'bg-rose-800/80', cellColor: 'bg-rose-500/5', textColor: 'text-rose-400' },
];

const getCellStatusClasses = (balance: any, goal: number) => {
  if (balance === undefined || balance === null || balance === '' || isNaN(parseFloat(balance))) return 'is-empty';
  const val = parseFloat(balance);
  if (val === 0) return 'is-zero';
  const ratio = val / (goal || 1);
  return ratio < 0.5 ? 'is-low' : ratio < 1 ? 'is-progress' : 'is-reached';
};

const TotalTable: React.FC<{ state: AppState; updateState: (updater: (prev: AppState) => AppState) => boolean | void }> = ({ state, updateState }) => {
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
  const inactiveModelsSet = new Set((state.inactiveModels || []).map(m => m.trim()));

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
    // И которые НЕ скрыты (inactiveModels)
    return allForDate.filter(e => {
      const modelName = e.modelName.trim();
      return currentPlans[modelName] !== undefined && currentPlans[modelName] !== null && !inactiveModelsSet.has(modelName);
    });
  }, [state.totalTableEntries, selectedDate, state.accountingPeriods, state.selectedPeriodId, currentPlans, state.inactiveModels]);

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
      if (state.accountingPeriods.find(period => period.id === targetPeriodId)?.status === 'closed') return;
      
      // 1. Получаем список имен моделей, у которых есть месячный план (динамические цели)
      // И которые НЕ скрыты на постоянной основе
      const modelsWithPlans = Object.keys(currentPlans)
        .map(m => m.trim())
        .filter(m => m !== '' && !inactiveModelsSet.has(m));
      
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
        if (updateState(prev => {
          const existingIds = new Set((prev.totalTableEntries || []).map(e => e.id));
          const filteredNew = newEntries.filter(ne => !existingIds.has(ne.id));
          
          if (filteredNew.length === 0) return prev;
          
          return { 
            ...prev, 
            totalTableEntries: [...(prev.totalTableEntries || []), ...filteredNew] 
          };
        }) === false) return;
      }
    }
  }, [selectedDate, currentPlans, entriesForDate.length, state.deletedIds, state.inactiveModels, state.accountingPeriods, state.selectedPeriodId, updateState]);

  const handleUpdate = (entryId: string, shift: keyof DailyTotalEntry, field: keyof ShiftData, value: string) => {
    const val = value === '' ? undefined : parseFloat(value);
    
    if (updateState(prev => {
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
    }) === false) return;
  };

  const handleSyncGoalsToAll = () => {
    if (!confirm('Применить текущие цели из этой таблицы КО ВСЕМ дням (существующим и будущим)?')) return;
    
    if (updateState(prev => {
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
    }) === false) return;
    alert('Цели успешно синхронизированы по всей системе!');
  };

  const handleRecalculateDynamicGoals = () => {
    if (!confirm('Пересчитать динамические цели для всех анкет на эту дату на основе месячного плана и остатка?')) return;
    
    if (updateState(prev => ({
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
    })) === false) return;
  };

  const handleRenameModel = (entryId: string, newName: string) => {
    if (updateState(prev => ({
      ...prev,
      totalTableEntries: (prev.totalTableEntries || []).map(e => 
        (e && e.id === entryId) ? { ...e, modelName: newName, updatedAt: new Date().toISOString() } : e
      )
    })) === false) return;
  };

  const handleRemoveModel = (entryId: string) => {
    const entry = (state.totalTableEntries || []).find(e => e.id === entryId);
    if (!entry) return;

    const action = confirm(`Удалить анкету "${entry.modelName}"?\n\nOK — Только за это число (${selectedDate.split('-').reverse().join('.')})\nОтмена — Отмена действия`);
    
    if (action) {
      const hidePermanently = confirm(`Скрыть "${entry.modelName}" НА СОВСЕМ из Total Table (чтобы не возвращалась завтра)?`);
      
      if (updateState(prev => {
        let newState = {
          ...prev,
          deletedIds: [...(prev.deletedIds || []), entryId],
          totalTableEntries: (prev.totalTableEntries || []).filter(e => e && e.id !== entryId)
        };

        if (hidePermanently) {
           newState.inactiveModels = Array.from(new Set([...(prev.inactiveModels || []), entry.modelName.trim()]));
        }

        return newState;
      }) === false) return;
    }
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
    if (updateState(prev => ({
      ...prev,
      totalTableEntries: [...(prev.totalTableEntries || []), newEntry]
    })) === false) return;
  };

  const handleReset = () => {
    if (!confirm('Очистить БАЛАНСЫ за выбранную дату? ЦЕЛИ останутся зафиксированными.')) return;
    const now = new Date().toISOString();
    if (updateState(prev => ({
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
    })) === false) return;
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

      let h2c = html2canvas;
      if (typeof h2c !== 'function') {
        h2c = (window as any).html2canvas;
      }
      if (typeof h2c !== 'function') {
        throw new Error("Модуль html2canvas недоступен");
      }
      
      // Render canvas
      const canvas = await h2c(tableRef.current, {
        backgroundColor: getComputedStyle(tableRef.current).backgroundColor,
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: false,
        imageTimeout: 10000,
        scrollX: 0,
        scrollY: 0,
        windowWidth: 1600,
        onclone: (clonedDoc: Document) => {
          const clonedContainer = (
            clonedDoc.getElementById('total-table-card') ||
            clonedDoc.querySelector('[data-report-table-container="true"]') ||
            clonedDoc.querySelector('.total-table-card') ||
            clonedDoc.querySelector('.glass-card') ||
            clonedDoc.querySelector('table')?.closest('.overflow-x-auto')?.parentElement
          ) as HTMLElement;
          const clonedScrollable = (clonedContainer?.querySelector('.overflow-x-auto') || clonedDoc.querySelector('.overflow-x-auto')) as HTMLElement;
          const clonedTable = (clonedContainer?.querySelector('table') || clonedDoc.querySelector('table')) as HTMLElement;

          clonedDoc.body.style.overflow = 'visible';
          clonedContainer?.querySelectorAll('.ct-total-sticky').forEach(el => { (el as HTMLElement).style.position = 'static'; });

          if (clonedScrollable) {
            clonedScrollable.style.overflow = 'visible';
            clonedScrollable.style.width = '100%';
            clonedScrollable.style.height = 'auto';
          }
          
          if (clonedContainer) {
            clonedContainer.style.width = '1100px';
            clonedContainer.style.minWidth = '1100px';
            clonedContainer.style.maxWidth = 'none';
            clonedContainer.style.height = 'auto';
            clonedContainer.style.overflow = 'visible';
            clonedContainer.style.borderRadius = '24px';
          }

          if (clonedTable) {
            clonedTable.style.width = '1100px';
            clonedTable.style.minWidth = '1100px';
            clonedTable.style.borderCollapse = 'collapse';
          }

          // Disable pulse animation in snapshot so zero-balance warning doesn't freeze in mid-pulse
          clonedDoc.querySelectorAll('.animate-pulse').forEach((el) => {
            (el as HTMLElement).style.animation = 'none';
            (el as HTMLElement).style.opacity = '1';
          });
          
          const inputs = (clonedContainer || clonedDoc).querySelectorAll('input');
          inputs.forEach((input) => {
            const inputEl = input as HTMLInputElement;
            const isText = inputEl.type === 'text';
            const val = inputEl.value;
            const hasVal = val !== '' && val !== undefined && val !== null;
            const placeholder = inputEl.placeholder || '';
            const textToDisplay = hasVal ? val : placeholder;

            const span = clonedDoc.createElement('span');
            span.textContent = textToDisplay;
            span.style.display = 'block';
            span.style.width = '100%';
            span.style.lineHeight = '1.3';
            
            const comp = window.getComputedStyle(inputEl);
            span.style.fontSize = comp.fontSize || '14px';
            span.style.fontFamily = comp.fontFamily || 'Inter, sans-serif';
            span.style.backgroundColor = comp.backgroundColor;
            span.style.borderRadius = comp.borderRadius;
            
            if (isText) {
              span.style.textAlign = 'left';
              span.style.padding = '6px 8px';
              span.style.fontWeight = '700';
              span.style.color = comp.color || '#252d3b';
            } else {
              span.style.textAlign = 'center';
              span.style.padding = '8px 4px';
              span.style.fontWeight = '900';
              if (hasVal) {
                span.style.color = comp.color || '#ffffff';
              } else {
                span.style.color = 'rgba(148, 163, 184, 0.45)';
              }
            }
            
            if (inputEl.parentElement) {
              inputEl.parentElement.replaceChild(span, inputEl);
            }
          });
        }
      });
      
      // Use JPEG with 0.92 quality for sharp text and clean numbers
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);

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

      // Telegram limits photo caption to 1024 chars
      let captionToSend = message;
      if (message.length > 950) {
        const percent = totals.overallPlan > 0 ? Math.round(totals.overallBalance / totals.overallPlan * 100) : 0;
        captionToSend = `<b>📊 ОТЧЕТ: ${shiftInfo.label.toUpperCase()} ${shiftInfo.icon}</b>\n` +
          `📅 Дата: ${selectedDate.split('-').reverse().join('.')}\n\n` +
          `📈 <b>ИТОГО ЗА ${shiftInfo.label.toUpperCase()} СМЕНУ</b>: ${totalShiftBal.toFixed(0)}$ / ${totalShiftGoal.toFixed(0)}$\n` +
          `🏆 <b>ОБЩИЙ ТОТАЛ СУТОК</b>: ${totals.overallBalance.toFixed(0)}$ / ${totals.overallPlan.toFixed(0)}$ (${percent}%)\n\n` +
          `🔔 <a href="tg://user?id=8679682362">@adm_viksi_viii [Adm]Vi</a> <a href="tg://user?id=6537516111">@adm_rctr Rector</a> <a href="tg://user?id=1434399006">@continental_agency</a>`;
      }

      const res = await fetch('/api/telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'photo', image: dataUrl, text: captionToSend, chat_id: chatId })
      });
      const resultData = await res.json();
      if (!res.ok || !resultData.ok) throw new Error(resultData.error || 'Отправка не подтверждена. Проверьте чат перед повтором.');
      const sentSuccessfully = true;
      if (message.length > 950) {
        const fullText = await telegramFetch('sendMessage', {
          method: 'POST', body: JSON.stringify({ text: message, chat_id: chatId })
        });
        if (!fullText.ok) throw new Error('Изображение отправлено, полный текст не подтверждён. Проверьте чат перед повтором.');
      }

      if (sentSuccessfully) {
        alert('Отчет успешно доставлен в Telegram!');
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

  const shiftIcons = {night: Moon, morning: Sunrise, day: Sun, evening: Sunset};
  const completion = totals.overallPlan > 0 ? Math.round((totals.overallBalance / totals.overallPlan) * 100) : 0;

  return <div className="ct-page ct-total-page">
    <header className="ct-page-heading"><div><h1>Total Table</h1><p>Балансы и цели по сменам · USD</p></div><div className="ct-total-actions"><label className="ct-total-date"><ICONS.Calendar size={16} /><input aria-label="Дата таблицы" type="date" value={selectedDate} onChange={e => {if(e.target.value)setSelectedDate(e.target.value);}} /></label><button className="ct-button ct-button-primary" onClick={handleAddModel}><ICONS.Plus size={15} />Добавить анкету</button></div></header>
    <div className="ct-total-toolbar"><div className="ct-total-actions"><button className="ct-button" onClick={handleRecalculateDynamicGoals}><ICONS.RotateCcw size={14} />Пересчитать цели</button><button className="ct-button" onClick={handleSyncGoalsToAll}><ICONS.Layers size={14} />Цели ко всем дням</button></div><button className="ct-button ct-total-clear" onClick={handleReset}><ICONS.Trash size={14} />Очистить балансы</button></div>
    <section className="ct-total-board" aria-label="Балансы смен">
      <div ref={tableRef} id="total-table-card" data-report-table-container="true" className="ct-total-capture">
        <div className="overflow-x-auto ct-total-scroll" tabIndex={0} aria-label="Таблица балансов с горизонтальной прокруткой">
          <table className="ct-total-table"><caption className="sr-only">Балансы смен за {selectedDate.split('-').reverse().join('.')}</caption><thead>
            <tr><th className="ct-total-sticky ct-total-number" rowSpan={2} scope="col">№</th><th className="ct-total-sticky ct-total-name" rowSpan={2} scope="col">Анкета<small>{entriesForDate.length} в таблице</small></th>{SHIFTS.map(s=>{const ShiftIcon=shiftIcons[s.key];return <th key={s.key} colSpan={2} scope="colgroup" className={`ct-total-shift is-${s.key}`}><div><ShiftIcon size={17} /><span>{s.label}</span></div><div className="ct-total-report-slot" data-html2canvas-ignore="true">{isShiftComplete(s.key) ? <button aria-label={`Отчёт в TG: ${s.label}`} onClick={()=>sendTelegramReport(s.key)} disabled={isSending!==null}><ICONS.Send size={11} />{isSending===s.key?'Отправка…':'Отчёт в TG'}</button> : <span>Заполните балансы</span>}</div></th>;})}<th data-html2canvas-ignore="true" colSpan={4} scope="colgroup" className="ct-total-result-heading">Итоги дня и месяца</th><th data-html2canvas-ignore="true" rowSpan={2} className="ct-total-remove"><span className="sr-only">Действия</span></th></tr>
            <tr className="ct-total-subheads">{SHIFTS.map(s=><React.Fragment key={s.key}><th scope="col" className={`ct-total-balance-head is-${s.key}`}>Баланс</th><th scope="col" className={`ct-total-goal-head is-${s.key}`}>Цель</th></React.Fragment>)}<th data-html2canvas-ignore="true" scope="col">План</th><th data-html2canvas-ignore="true" scope="col">Осталось</th><th data-html2canvas-ignore="true" scope="col" className="is-total">Итого</th><th data-html2canvas-ignore="true" scope="col" className="ct-total-month">Месяц</th></tr>
          </thead><tbody>{entriesForDate.map((entry,idx)=>{
            const rowPlan=(entry.night?.goal||0)+(entry.morning?.goal||0)+(entry.day?.goal||0)+(entry.evening?.goal||0);
            const rowBalance=(entry.night?.balance||0)+(entry.morning?.balance||0)+(entry.day?.balance||0)+(entry.evening?.balance||0);
            const rowRemaining=Math.max(0,rowPlan-rowBalance);
            const monthlyPlan=currentPlans[entry.modelName]||0;
            const earnedInPeriod=(state.incomeData||[]).filter(r=>r.model.trim()===entry.modelName.trim()&&r.periodId===activePeriodId).reduce((sum,r)=>sum+(r.onlyFans||0),0);
            const monthlyPercent=monthlyPlan>0?Math.round((earnedInPeriod/monthlyPlan)*100):0;
            return <tr key={entry.id||`fallback-idx-${idx}`} data-entry-id={entry.id}>
              <td className="ct-total-sticky ct-total-number">{idx+1}</td><th scope="row" className="ct-total-sticky ct-total-name"><input type="text" aria-label={`Название анкеты ${idx+1}`} value={entry.modelName||''} onChange={e=>handleRenameModel(entry.id,e.target.value)} /></th>
              {SHIFTS.map(s=><React.Fragment key={s.key}><td className="ct-total-balance"><input type="number" step="any" inputMode="decimal" aria-label={`${entry.modelName}: ${s.label}, баланс`} className={getCellStatusClasses(entry[s.key]?.balance,entry[s.key]?.goal||0)} value={entry[s.key]?.balance??''} onChange={e=>handleUpdate(entry.id,s.key,'balance',e.target.value)} placeholder="—" /></td><td className={`ct-total-goal is-${s.key}`}><input type="number" step="any" inputMode="decimal" aria-label={`${entry.modelName}: ${s.label}, цель`} value={entry[s.key]?.goal??''} onChange={e=>handleUpdate(entry.id,s.key,'goal',e.target.value)} placeholder="—" /></td></React.Fragment>)}
              <td data-html2canvas-ignore="true" className="ct-total-plan">{rowPlan.toFixed(0)}</td><td data-html2canvas-ignore="true" className={`ct-total-remaining ${rowRemaining===0?'is-complete':''}`}>{rowRemaining.toFixed(0)}</td><td data-html2canvas-ignore="true" className="ct-total-result">{rowBalance.toFixed(0)}</td><td data-html2canvas-ignore="true" className="ct-total-month"><strong>{monthlyPercent}%</strong><div className="ct-total-progress" role="progressbar" aria-label={`Месячный план: ${entry.modelName}`} aria-valuenow={Math.max(0,Math.min(100,monthlyPercent))} aria-valuemin={0} aria-valuemax={100} aria-valuetext={`${monthlyPercent}%`}><i style={{width:`${Math.max(0,Math.min(100,monthlyPercent))}%`}} /></div><small>{earnedInPeriod.toFixed(0)} / {monthlyPlan.toFixed(0)}</small></td><td data-html2canvas-ignore="true" className="ct-total-remove"><button title="Удалить анкету из таблицы" aria-label={`Удалить: ${entry.modelName}`} onClick={()=>handleRemoveModel(entry.id)}><ICONS.Trash size={14} /></button></td>
            </tr>;
          })}</tbody><tfoot><tr><th colSpan={2} className="ct-total-sticky" scope="row">Итого</th>{SHIFTS.map(s=><React.Fragment key={s.key}><td>{totals[s.key].balance.toFixed(0)}</td><td className="ct-total-goal">{totals[s.key].goal.toFixed(0)}</td></React.Fragment>)}<td data-html2canvas-ignore="true" className="ct-total-plan">{totals.overallPlan.toFixed(0)}</td><td data-html2canvas-ignore="true" className="ct-total-remaining">{totals.overallRemaining.toFixed(0)}</td><td data-html2canvas-ignore="true" className="ct-total-result">{totals.overallBalance.toFixed(0)}</td><td data-html2canvas-ignore="true" colSpan={2} /></tr></tfoot></table>
        </div>
      </div>
      {!entriesForDate.length && <div className="ct-total-empty"><ICONS.ClipboardList size={25} /><h2>За эту дату пока нет анкет</h2><p>Здесь отображаются анкеты с месячным планом, которые не скрыты из состава.</p></div>}
      <footer className="ct-total-legend"><span><i className="is-empty" />Не заполнено</span><span><i className="is-zero" />Нулевой баланс</span><span><i className="is-low" />Меньше 50%</span><span><i className="is-progress" />До цели</span><span><i className="is-reached" />Цель достигнута</span><small>Нажмите на число для ввода · Tab — следующая ячейка</small></footer>
    </section>
    <section className="ct-total-shift-totals" aria-label="Итоги смен">{SHIFTS.map(s=>{const ShiftIcon=shiftIcons[s.key];return <div key={s.key} className={`is-${s.key}`}><span><ShiftIcon size={17} />{s.label}</span><strong>{totals[s.key].balance.toFixed(0)}<small> / {totals[s.key].goal.toFixed(0)}</small></strong></div>;})}</section>
    <section className="ct-total-summary" aria-label="Итоговая сводка"><header><ICONS.Chart size={17} /><h2>Итоги за {selectedDate.split('-').reverse().join('.')}</h2><span>USD</span></header><div><section aria-label="Общий план"><span>Общий план</span><strong>{totals.overallPlan.toFixed(0)}</strong></section><section aria-label="Общий баланс"><span>Общий баланс</span><strong>{totals.overallBalance.toFixed(0)}</strong></section><section aria-label="Осталось"><span>Осталось</span><strong>{totals.overallRemaining.toFixed(0)}</strong></section><section aria-label="Выполнено"><span>Выполнено</span><strong>{completion}%</strong></section></div></section>
  </div>;
};

export default TotalTable;
