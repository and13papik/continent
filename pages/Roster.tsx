import { telegramFetch } from '../telegramClient';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import html2canvas from 'html2canvas';
import { AppState, RosterEntry, ShiftType, AccountingPeriod, OperatorStatus, OperatorAssessment } from '../types';
import { ICONS } from '../constants';
import { createPortal } from 'react-dom';
import { Sunrise, Sun, Sunset, Moon, Info } from 'lucide-react';
import './Roster.css';

const ASSESSMENT_META: Record<OperatorStatus, { label: string; color: string; bg: string; icon: any }> = {
  good: { label: 'Хороший', color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: ICONS.ShieldCheck },
  average: { label: 'Средний', color: 'text-sky-400', bg: 'bg-sky-500/10', icon: ICONS.Star },
  bad: { label: 'Плохой', color: 'text-rose-400', bg: 'bg-rose-500/10', icon: ICONS.Penalty },
  deadline: { label: 'Дедлайн', color: 'text-amber-400', bg: 'bg-amber-500/10', icon: ICONS.Clock },
  replace: { label: 'Заменить', color: 'text-rose-500', bg: 'bg-rose-500/10', icon: ICONS.Users },
  none: { label: 'Нет', color: 'text-slate-400', bg: 'bg-slate-800', icon: ICONS.Close }
};

interface RosterProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => boolean | void;
}

const SHIFTS: { type: ShiftType; label: string; time: string; color: string }[] = [
  { type: 'morning', label: 'Утро', time: '08:00 - 14:00', color: 'from-amber-400 to-orange-500' },
  { type: 'day', label: 'День', time: '14:00 - 20:00', color: 'from-sky-400 to-blue-500' },
  { type: 'evening', label: 'Вечер', time: '20:00 - 02:00', color: 'from-indigo-400 to-purple-500' },
  { type: 'night', label: 'Ночь', time: '02:00 - 08:00', color: 'from-slate-600 to-slate-900' },
];

const Roster: React.FC<RosterProps> = ({ state, updateState }) => {
  const [editingCell, setEditingCell] = useState<{ model: string; shift: ShiftType } | null>(null);
  const [assessmentTarget, setAssessmentTarget] = useState<{ operator: string; modelName?: string } | null>(null);

  const [showSwapList, setShowSwapList] = useState(false);
  const [operatorSearch, setOperatorSearch] = useState('');
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);
  const rosterRef = useRef<HTMLDivElement>(null);

  const [isManagingModels, setIsManagingModels] = useState(false);
  const [newModelName, setNewModelName] = useState('');

  const [isManagingOperators, setIsManagingOperators] = useState(false);
  const [newOperatorName, setNewOperatorName] = useState('');
  const [syncBanner, setSyncBanner] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  const currentPeriod = state.accountingPeriods.find((p: AccountingPeriod) => p.id === state.selectedPeriodId);
  
  // Find fallback period if current period has no roster entries yet
  const fallbackPeriodId = useMemo(() => {
    const hasCurrent = (state.rosterData || []).some((e: RosterEntry) => e.periodId === state.selectedPeriodId);
    if (hasCurrent) return state.selectedPeriodId;

    const periodsWithRoster = state.accountingPeriods
      .filter(p => (state.rosterData || []).some(e => e.periodId === p.id))
      .sort((a, b) => new Date(b.startAt).getTime() - new Date(a.startAt).getTime());

    return periodsWithRoster[0]?.id || null;
  }, [state.rosterData, state.selectedPeriodId, state.accountingPeriods]);

  const rosterEntries = useMemo(() => {
    const direct = (state.rosterData || []).filter((e: RosterEntry) => e.periodId === state.selectedPeriodId);
    if (direct.length > 0) return direct;

    if (fallbackPeriodId && fallbackPeriodId !== state.selectedPeriodId) {
      return (state.rosterData || [])
        .filter((e: RosterEntry) => e.periodId === fallbackPeriodId)
        .map(e => ({ ...e, periodId: state.selectedPeriodId }));
    }

    return [];
  }, [state.rosterData, state.selectedPeriodId, fallbackPeriodId]);

  // Auto-clone roster to current month if it is empty so it is fixed and persisted across months
  useEffect(() => {
    if (!state.selectedPeriodId || currentPeriod?.status === 'closed') return;
    const hasCurrent = (state.rosterData || []).some((e: RosterEntry) => e.periodId === state.selectedPeriodId);
    if (!hasCurrent && fallbackPeriodId && fallbackPeriodId !== state.selectedPeriodId) {
      const sourceEntries = (state.rosterData || []).filter(e => e.periodId === fallbackPeriodId);
      if (sourceEntries.length > 0) {
        const cloned = sourceEntries.map(e => ({
          ...e,
          id: `roster_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`,
          periodId: state.selectedPeriodId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));

        const hasCurrentAsmts = (state.operatorAssessments || []).some(a => a.periodId === state.selectedPeriodId);
        const sourceAsmts = hasCurrentAsmts ? [] : (state.operatorAssessments || []).filter(a => a.periodId === fallbackPeriodId);
        const clonedAsmts = sourceAsmts.map(a => ({
          ...a,
          id: `asmt_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`,
          periodId: state.selectedPeriodId,
          updatedAt: new Date().toISOString()
        }));

        if (updateState(prev => ({
          ...prev,
          rosterData: [...(prev.rosterData || []), ...cloned],
          operatorAssessments: [...(prev.operatorAssessments || []), ...clonedAsmts]
        })) === false) return;
      }
    }
  }, [state.selectedPeriodId, currentPeriod?.status, fallbackPeriodId, state.rosterData, state.operatorAssessments, updateState]);

  const operatorWorkingDays = useMemo(() => {
    const counts: Record<string, number> = {};
    const operatorsInRoster = Array.from(new Set(rosterEntries.map(e => e.operator)));
    
    operatorsInRoster.forEach(opName => {
      const uniqueDates = new Set(
        state.incomeData
          .filter(r => r.operator === opName)
          .map(r => r.date)
      );
      counts[opName] = uniqueDates.size;
    });
    return counts;
  }, [state.incomeData, rosterEntries]);

  // Alert for finishing internship
  useEffect(() => {
    // Collect all operators currently in roster
    const operatorsInRoster = Array.from(new Set(rosterEntries.map(e => e.operator)));
    
    operatorsInRoster.forEach(async opName => {
      if (opName === 'ДЫРКА' || opName === 'СТАЖЕР') return;
      
      const days = operatorWorkingDays[opName] || 0;
      const alreadyNotified = (state.notifiedInterns || []).includes(opName);
      
      // If reached 7 days and never notified
      if (days >= 7 && !alreadyNotified) {
        try {
          await fetch('/api/telegram', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `🎓 <b>СТАЖИРОВКА ЗАВЕРШЕНА</b>\n\nСтажер <b>${opName}</b> отработал 7 дней и успешно закончил стажировку!`,
            })
          });

          if (updateState(prev => ({
            ...prev,
            notifiedInterns: [...(prev.notifiedInterns || []), opName]
          })) === false) return;
        } catch (e) {
          console.error("Failed to notify graduate", e);
        }
      }
    });
  }, [rosterEntries, operatorWorkingDays, state.notifiedInterns, updateState]);

  const [rosterNeedsFix, setRosterNeedsFix] = useState(false);
  const [rosterStatusText, setRosterStatusText] = useState<string | null>(null);
  const isAutoSendingRef = useRef(false);

  // Poll roster status from server
  useEffect(() => {
    let isMounted = true;

    const checkStatus = async () => {
      try {
        const res = await fetch('/api/roster/status');
        if (!res.ok) return;
        const data = await res.json();
        
        if (isMounted && data.success) {
          const needsFix = !!data.rosterState?.needsFix;
          setRosterNeedsFix(needsFix);

          if (needsFix) {
            setRosterStatusText(`Требуется исправление (отклонил: ${data.rosterState?.rejectedBy || 'Админ'})`);
          } else if (data.rosterState?.status === 'ok') {
            setRosterStatusText(data.rosterState?.confirmedBy ? `Подтвержден (${data.rosterState.confirmedBy})` : null);
          } else {
            setRosterStatusText(null);
          }

          // Check for scheduled send trigger (10:00 / 22:00 Kyiv time)
          if (data.pendingScheduledSend && !isAutoSendingRef.current && !isSendingTelegram) {
            isAutoSendingRef.current = true;
            console.log(`[Scheduled Send] Executing scheduled send for slot: ${data.pendingScheduledSend}`);
            await sendRosterToTelegram(false, needsFix, data.pendingScheduledSend);
            isAutoSendingRef.current = false;
          }
        }
      } catch (e) {
        console.error("Failed to check roster status:", e);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [isSendingTelegram]);

  const sendRosterToTelegram = async (isManual = false, isCorrection = false, scheduledSlot?: string) => {
    if (!rosterRef.current) {
      if (isManual) alert('Ошибка: Таблица состава не найдена');
      return;
    }
    if (isSendingTelegram) return;

    setIsSendingTelegram(true);

    try {
      let h2c = html2canvas;
      if (typeof h2c !== 'function') {
        h2c = (window as any).html2canvas;
      }

      if (typeof h2c !== 'function') {
        throw new Error('Модуль html2canvas недоступен');
      }

      // Capture the roster as image
      const canvas = await h2c(rosterRef.current, {
        backgroundColor: getComputedStyle(rosterRef.current).backgroundColor,
        scale: 2,
        logging: false,
        useCORS: true,
        allowTaint: false,
        imageTimeout: 10000
      });
      
      // JPEG compressed 0.85
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

      const DEFAULT_CHAT_ID = '-1003748692600';

      const headerText = (isCorrection || rosterNeedsFix)
        ? `📊 <b>СОСТАВ КОМАНДЫ (актуальный состав после исправления)</b>`
        : `📊 <b>СОСТАВ КОМАНДЫ</b>`;

      const captionText = `${headerText}\nПериод: ${currentPeriod?.label || 'Текущий'}\nДата: ${new Date().toLocaleDateString('ru-RU')}\n\n<b>СОСТАВ АКТУАЛЕН?</b>\n\n🔔 <a href="tg://user?id=8679682362">@adm_viksi_viii [Adm]Vi</a> <a href="tg://user?id=6537516111">@adm_rctr Rector</a>`;

      const replyMarkup = {
        inline_keyboard: [
          [
            { text: 'АКТУАЛЕН', callback_data: 'roster_actual' },
            { text: 'НЕТ', callback_data: 'roster_not_actual' }
          ]
        ]
      };

      let sentSuccessfully = false;
      let lastErrMsg = '';
      let legacyEndpointMissing = false;

      // 1. Try sending via backend proxy
      try {
        const response = await fetch('/api/telegram/send-roster', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: dataUrl,
            periodLabel: currentPeriod?.label || 'Текущий',
            isCorrection: isCorrection || rosterNeedsFix,
            scheduledSlot
          })
        });

        const responseText = await response.text();
        let result: any = null;
        try {
          result = JSON.parse(responseText);
        } catch {
          console.warn("Backend /api/telegram/send-roster response was not JSON:", responseText.substring(0, 100));
        }

        if (response.ok && result?.success) {
          sentSuccessfully = true;
        } else {
          lastErrMsg = result?.error || `HTTP ${response.status}: Ошибка сервера`;
          legacyEndpointMissing = response.status === 404 || response.status === 405;
        }
      } catch (apiErr: any) {
        console.warn("Backend API call failed, falling back to direct Telegram send:", apiErr);
        lastErrMsg = apiErr?.message || String(apiErr);
      }

      // 2. Fallback to direct Telegram API if backend failed
      if (!sentSuccessfully) {
        if (!legacyEndpointMissing) throw new Error(lastErrMsg || 'Отправка не подтверждена. Проверьте чат перед повтором.');
        const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
        if (!blob) throw new Error('Не удалось сформировать изображение');

        const formData = new FormData();
        formData.append('chat_id', DEFAULT_CHAT_ID);
        formData.append('photo', blob, 'roster.jpg');
        formData.append('caption', captionText);
        formData.append('parse_mode', 'HTML');
        formData.append('reply_markup', JSON.stringify(replyMarkup));

        const directRes = await telegramFetch('sendPhoto', {
          method: 'POST',
          body: formData
        });

        const directText = await directRes.text();
        let directResult: any = null;
        try {
          directResult = JSON.parse(directText);
        } catch {
          throw new Error('Telegram API вернул некорректный ответ: ' + directText.substring(0, 80));
        }

        if (directRes.ok && directResult?.ok) {
          sentSuccessfully = true;
          // Notify server of the state change
          fetch('/api/roster/status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'pending_approval', needsFix: false })
          }).catch(() => {});
        } else {
          throw new Error(directResult?.description || lastErrMsg || 'Ошибка при отправке в Telegram');
        }
      }

      if (sentSuccessfully) {
        setRosterNeedsFix(false);
        setRosterStatusText('Отправлено на подтверждение');

        if (isManual) {
          alert('Состав успешно отправлен в Telegram!');
        }
      }
    } catch (error: any) {
      console.error('Error generating roster screenshot or sending to Telegram:', error);
      if (isManual) {
        alert(`Ошибка при отправке: ${error?.message || error}`);
      }
    } finally {
      setIsSendingTelegram(false);
    }
  };

  // Models to show: designated models for this period OR models that have assigned shifts
  const allModels = useMemo(() => {
    const periodModels = currentPeriod?.models || state.models;
    const modelsWithAssignments = rosterEntries.flatMap(e => e.models || []);
    return Array.from(new Set([...periodModels, ...modelsWithAssignments]));
  }, [currentPeriod?.models, state.models, rosterEntries]);
  
  // Available models are those in state.models but not in currentPeriod.models
  const availableModels = useMemo(() => {
    if (!currentPeriod?.models) return [];
    return state.models.filter(m => !currentPeriod.models?.includes(m));
  }, [state.models, currentPeriod?.models]);

  const addModelToPeriod = (modelName: string) => {
    if (updateState(prev => {
      const activeP = prev.accountingPeriods.find(p => p.id === prev.selectedPeriodId);
      if (!activeP) return prev;
      
      const currentModels = activeP.models || prev.models;
      if (currentModels.includes(modelName)) return prev;

      // Also ensure it exists in global models if it's a new one
      let newGlobalModels = prev.models;
      if (!newGlobalModels.includes(modelName)) {
        newGlobalModels = [...newGlobalModels, modelName];
      }

      return {
        ...prev,
        models: newGlobalModels,
        accountingPeriods: prev.accountingPeriods.map(p => 
          p.id === prev.selectedPeriodId 
            ? { ...p, models: [...currentModels, modelName], updatedAt: new Date().toISOString() } 
            : p
        )
      };
    }) === false) return;
    setNewModelName('');
  };

  const removeModelFromPeriod = (modelName: string) => {
    if (!confirm(`Скрыть анкету "${modelName}" из состава на этот период? Данные в отчетах сохранятся, анкета останется в системе.`)) return;
    
    if (updateState(prev => {
      const activeP = prev.accountingPeriods.find(p => p.id === prev.selectedPeriodId);
      if (!activeP) return prev;
      
      const currentModels = activeP.models || prev.models;
      return {
        ...prev,
        accountingPeriods: prev.accountingPeriods.map(p => 
          p.id === prev.selectedPeriodId 
            ? { ...p, models: currentModels.filter(m => m !== modelName), updatedAt: new Date().toISOString() } 
            : p
        )
      };
    }) === false) return;
  };

  const availableOperators = useMemo(() => {
    const currentOps = currentPeriod?.operators || state.operators;
    return state.operators.filter(o => !currentOps.includes(o));
  }, [state.operators, currentPeriod?.operators]);

  const addOperatorToPeriod = (opName: string) => {
    if (updateState(prev => {
      const activeP = prev.accountingPeriods.find(p => p.id === prev.selectedPeriodId);
      if (!activeP) return prev;
      
      const currentOps = activeP.operators || prev.operators;
      if (currentOps.includes(opName)) return prev;

      let newGlobalOps = prev.operators;
      if (!newGlobalOps.includes(opName)) {
        newGlobalOps = [...newGlobalOps, opName];
      }

      return {
        ...prev,
        operators: newGlobalOps,
        accountingPeriods: prev.accountingPeriods.map(p => 
          p.id === prev.selectedPeriodId 
            ? { ...p, operators: [...currentOps, opName], updatedAt: new Date().toISOString() } 
            : p
        )
      };
    }) === false) return;
    setNewOperatorName('');
  };

  const removeOperatorFromPeriod = (opName: string) => {
    if (!confirm(`Скрыть оператора "${opName}" из состава на этот период?`)) return;
    
    if (updateState(prev => {
      const activeP = prev.accountingPeriods.find(p => p.id === prev.selectedPeriodId);
      if (!activeP) return prev;
      
      const currentOps = activeP.operators || prev.operators;
      return {
        ...prev,
        accountingPeriods: prev.accountingPeriods.map(p => 
          p.id === prev.selectedPeriodId 
            ? { ...p, operators: currentOps.filter(o => o !== opName), updatedAt: new Date().toISOString() } 
            : p
        )
      };
    }) === false) return;
  };

  const operators = currentPeriod?.operators || state.operators;

  const priorityModels = state.priorityModels || [];
  const inactiveModels = state.inactiveModels || [];

  const groupedModels = useMemo(() => {
    const priority = allModels.filter(m => priorityModels.includes(m));
    const inactive = allModels.filter(m => inactiveModels.includes(m));
    const regular = allModels.filter(m => !priorityModels.includes(m) && !inactiveModels.includes(m));
    return { priority, regular, inactive };
  }, [allModels, priorityModels, inactiveModels]);

  const getAssignment = (model: string, shift: ShiftType) => {
    return rosterEntries.find((e: RosterEntry) => e.shift === shift && e.models.includes(model));
  };

  const currentAssessments = useMemo(() => {
    return (state.operatorAssessments || []).filter(a => a.periodId === state.selectedPeriodId);
  }, [state.operatorAssessments, state.selectedPeriodId]);

  const getAssessment = (operator: string, modelName?: string) => {
    // Favor model-specific assessment, fall back to global
    const assessments = currentAssessments.filter(a => a.operator === operator);
    const specific = assessments.find(a => (a.modelName || '') === (modelName || ''));
    
    // If we have a specific assessment (including 'none' status which acts as an override), return it
    if (specific) return specific;
    
    // Fall back to global assessment (no modelName)
    return assessments.find(a => !a.modelName || a.modelName === '');
  };

  const handleSetAssessment = (status: OperatorStatus) => {
    if (!assessmentTarget) return;

    const op = assessmentTarget.operator;
    const model = assessmentTarget.modelName;
    const period = state.selectedPeriodId;

    if (updateState(prev => {
      const allAssessments = prev.operatorAssessments || [];
      let eliminatedIds: string[] = [];
      
      // Find what we are about to remove to track in deletedIds
      const targetModel = model || '';
      if (!targetModel) {
        // Clearing global: we clear ALL for this operator/period
        eliminatedIds = allAssessments
          .filter(a => a.operator === op && a.periodId === period)
          .map(a => a.id);
      } else {
        // Model-specific context: only clear the exact model-specific assessment
        eliminatedIds = allAssessments
          .filter(a => a.operator === op && a.periodId === period && (a.modelName || '') === targetModel)
          .map(a => a.id);
      }

      let assessments = allAssessments.filter(a => !eliminatedIds.includes(a.id));

      if (status !== 'none') {
        const newAsmt: OperatorAssessment = {
          id: `asmt_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          operator: op,
          periodId: period,
          status,
          modelName: model,
          updatedAt: new Date().toISOString()
        };
        assessments.push(newAsmt);
      } else if (model && model !== '') {
        // Special case: if clearing a specific model status but a global one exists,
        // we add an explicit 'none' status for this model to override the global fallback.
        const hasGlobal = assessments.some(a => 
          a.operator === op && a.periodId === period && (!a.modelName || a.modelName === '')
        );
        if (hasGlobal) {
          const override: OperatorAssessment = {
            id: `asmt_none_${Date.now()}`,
            operator: op,
            periodId: period,
            status: 'none',
            modelName: model,
            updatedAt: new Date().toISOString()
          };
          assessments.push(override);
        }
      }

      return {
        ...prev,
        operatorAssessments: assessments,
        deletedIds: Array.from(new Set([...(prev.deletedIds || []), ...eliminatedIds]))
      };
    }) === false) return;
  };

  const toggleModelStatus = (model: string, status: 'priority' | 'inactive') => {
    if (updateState(prev => {
      let newPriority = [...(prev.priorityModels || [])];
      let newInactive = [...(prev.inactiveModels || [])];

      if (status === 'priority') {
        if (newPriority.includes(model)) {
          newPriority = newPriority.filter(m => m !== model);
        } else {
          newPriority.push(model);
          newInactive = newInactive.filter(m => m !== model);
        }
      } else {
        if (newInactive.includes(model)) {
          newInactive = newInactive.filter(m => m !== model);
        } else {
          newInactive.push(model);
          newPriority = newPriority.filter(m => m !== model);
        }
      }

      return { ...prev, priorityModels: newPriority, inactiveModels: newInactive };
    }) === false) return;
  };

  const handleAssign = (operator: string) => {
    if (!editingCell) return;

    const daysWorked = operatorWorkingDays[operator] || 0;
    const isTrainee = operator !== 'ДЫРКА' && daysWorked < 7;

    if (updateState(prev => {
      const currentPeriodId = prev.selectedPeriodId;
      const roster = [...(prev.rosterData || [])];
      const now = new Date().toISOString();
      
      // Determine target periods: current period and future open periods
      const currentP = prev.accountingPeriods.find(p => p.id === currentPeriodId);
      const currentStart = currentP ? new Date(currentP.startAt).getTime() : 0;
      const targetPeriodIds = Array.from(new Set([
        currentPeriodId,
        ...prev.accountingPeriods
          .filter(p => p.status === 'open' && new Date(p.startAt).getTime() >= currentStart)
          .map(p => p.id)
      ]));

      // 1. Check if it's already assigned to THIS operator in current period (toggle off)
      const wasAssignedToThis = roster.some(e => 
        e.shift === editingCell.shift && 
        e.operator === operator && 
        e.models.includes(editingCell.model) &&
        e.periodId === currentPeriodId
      );

      // 2. Identify entries that will be deleted
      const entriesToDelete = roster.filter(entry => 
        entry.shift === editingCell.shift && 
        targetPeriodIds.includes(entry.periodId) && 
        entry.models.includes(editingCell.model) &&
        entry.models.length === 1
      );
      const newDeletedIds = [...(prev.deletedIds || []), ...entriesToDelete.map(e => e.id)];

      // 3. Remove this model from ANY existing assignment in this shift across target periods
      let updatedRoster = roster.map(entry => {
        if (entry.shift === editingCell.shift && targetPeriodIds.includes(entry.periodId)) {
          if (entry.models.includes(editingCell.model)) {
            return {
              ...entry,
              models: entry.models.filter(m => m !== editingCell.model),
              updatedAt: now
            };
          }
        }
        return entry;
      // Remove only assignments emptied by this edit; preserve unrelated history.
      }).filter(e => e.models.length > 0 || !entriesToDelete.some(entry => entry.id === e.id));

      if (wasAssignedToThis) {
        // Toggle off: we already removed it in step 3
        return { ...prev, rosterData: updatedRoster, deletedIds: newDeletedIds };
      }

      // 4. Assign to the operator across target periods
      targetPeriodIds.forEach(pId => {
        const targetEntryIdx = updatedRoster.findIndex(e => 
          e.shift === editingCell.shift && 
          e.operator === operator && 
          e.periodId === pId
        );

        if (targetEntryIdx > -1) {
          const entry = { ...updatedRoster[targetEntryIdx] };
          entry.isTrainee = isTrainee;

          if (operator === 'ДЫРКА' || entry.models.length < 2) {
            entry.models = [...entry.models, editingCell.model];
          } else {
            entry.models = [entry.models[0], editingCell.model];
          }
          entry.updatedAt = now;
          updatedRoster[targetEntryIdx] = entry;
        } else {
          updatedRoster.push({
            id: `roster_${pId}_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`,
            periodId: pId,
            date: 'monthly',
            shift: editingCell.shift,
            operator,
            isTrainee,
            models: [editingCell.model],
            createdAt: now,
            updatedAt: now
          });
        }
      });

      return { ...prev, rosterData: updatedRoster, deletedIds: newDeletedIds };
    }) === false) return;
    setEditingCell(null);
  };

  const clearCell = () => {
    if (!editingCell) return;
    if (updateState(prev => {
      const currentPeriodId = prev.selectedPeriodId;
      const now = new Date().toISOString();
      
      const currentP = prev.accountingPeriods.find(p => p.id === currentPeriodId);
      const currentStart = currentP ? new Date(currentP.startAt).getTime() : 0;
      const targetPeriodIds = Array.from(new Set([
        currentPeriodId,
        ...prev.accountingPeriods
          .filter(p => p.status === 'open' && new Date(p.startAt).getTime() >= currentStart)
          .map(p => p.id)
      ]));

      const entriesToDelete = (prev.rosterData || []).filter(entry => 
        entry.shift === editingCell.shift && 
        targetPeriodIds.includes(entry.periodId) && 
        entry.models.includes(editingCell.model) &&
        entry.models.length === 1
      );
      const newDeletedIds = [...(prev.deletedIds || []), ...entriesToDelete.map(e => e.id)];

      const roster = (prev.rosterData || []).map(e => {
        if (e.shift === editingCell.shift && e.models.includes(editingCell.model) && targetPeriodIds.includes(e.periodId)) {
          return {
            ...e,
            models: e.models.filter(m => m !== editingCell.model),
            updatedAt: now
          };
        }
        return e;
      }).filter(e => e.models.length > 0 || !entriesToDelete.some(entry => entry.id === e.id));
      
      return { ...prev, rosterData: roster, deletedIds: newDeletedIds };
    }) === false) return;
    setEditingCell(null);
  };

  const syncRosterToAllMonths = () => {
    if (!state.selectedPeriodId) return;
    const currentRoster = rosterEntries;
    if (currentRoster.length === 0) {
      setSyncBanner({ message: 'В текущем месяце еще нет заполненного состава для переноса.', type: 'error' });
      setTimeout(() => setSyncBanner(null), 5000);
      return;
    }

    const otherPeriods = state.accountingPeriods.filter(p => p.id !== state.selectedPeriodId);
    if (otherPeriods.length === 0) {
      setSyncBanner({ message: 'Состав зафиксирован. Другие месяцы пока не созданы — при переходе в новый месяц состав перенесется автоматически.', type: 'info' });
      setTimeout(() => setSyncBanner(null), 5000);
      return;
    }

    const totalBindings = currentRoster.reduce((sum, r) => sum + r.models.length, 0);

    if (updateState(prev => {
      const now = new Date().toISOString();
      const newEntries: RosterEntry[] = [];
      const deletedIds: string[] = [];

      otherPeriods.forEach(p => {
        const oldEntries = (prev.rosterData || []).filter(r => r.periodId === p.id);
        deletedIds.push(...oldEntries.map(e => e.id));

        currentRoster.forEach(r => {
          newEntries.push({
            ...r,
            id: `roster_${p.id}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
            periodId: p.id,
            createdAt: now,
            updatedAt: now
          });
        });
      });

      const currentPeriodRoster = (prev.rosterData || []).filter(r => r.periodId === prev.selectedPeriodId);
      const retained = currentPeriodRoster.length > 0 ? currentPeriodRoster : currentRoster.map(r => ({
        ...r,
        id: `roster_${prev.selectedPeriodId}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        periodId: prev.selectedPeriodId,
        createdAt: now,
        updatedAt: now
      }));

      return {
        ...prev,
        rosterData: [...retained, ...newEntries],
        deletedIds: Array.from(new Set([...(prev.deletedIds || []), ...deletedIds]))
      };
    }) === false) return;

    setSyncBanner({
      message: `Состав успешно зафиксирован на ВСЕ месяцы (${totalBindings} распределений операторов перенесены во все периоды)!`,
      type: 'success'
    });
    setTimeout(() => setSyncBanner(null), 6000);
  };

  const isNamed = (entry?: RosterEntry) => !!entry && entry.models.length > 0 && entry.operator !== 'ДЫРКА' && entry.operator !== 'СТАЖЕР';
  const activeModels = allModels.filter(model => !inactiveModels.includes(model));
  const filledSlots = activeModels.reduce((sum, model) => sum + SHIFTS.filter(shift => isNamed(getAssignment(model, shift.type))).length, 0);
  const totalSlots = activeModels.length * SHIFTS.length;
  const staffedModels = activeModels.filter(model => SHIFTS.every(shift => isNamed(getAssignment(model, shift.type)))).length;
  const assignedOperators = new Set(rosterEntries.filter(isNamed).map(entry => entry.operator)).size;
  const replacements = currentAssessments.filter(a => a.status === 'replace');
  const selectedAssignment = editingCell ? getAssignment(editingCell.model, editingCell.shift) : undefined;
  const closeAssignment = () => { setEditingCell(null); setShowSwapList(false); setOperatorSearch(''); };
  const shiftIcons = [Sunrise, Sun, Sunset, Moon, Info];

  const assessmentBadge = (operator: string, model?: string) => {
    const assessment = getAssessment(operator, model);
    if (!assessment || assessment.status === 'none') return null;
    const meta = ASSESSMENT_META[assessment.status];
    return <span className={`ct-roster-tag is-${assessment.status}`}><meta.icon size={11} />{meta.label}</span>;
  };

  const renderModelRows = (models: string[], title: string, kind: string, icon: React.ReactNode) => !models.length ? null : <React.Fragment key={kind}>
    <tr className={`ct-roster-group is-${kind}`}><th colSpan={5} scope="colgroup"><div>{icon}<span>{title}</span><b>{models.length}</b></div></th></tr>
    {models.map(model => {
      const filled = SHIFTS.filter(shift => isNamed(getAssignment(model, shift.type))).length;
      return <tr key={model} className="ct-roster-row" data-model={model}>
        <th scope="row"><div className="ct-roster-model"><span className="ct-roster-avatar">{model.slice(0, 2).toLocaleUpperCase()}</span><div><strong>{model}</strong><small className={filled === 4 ? 'is-complete' : ''}>{kind === 'inactive' ? 'Без чаттеров' : `${filled} из 4 смен заполнено`}</small></div></div>
          <div className="ct-roster-model-actions" data-html2canvas-ignore="true">
            <button aria-label={`Приоритетная: ${model}`} title="Приоритетная анкета" aria-pressed={priorityModels.includes(model)} onClick={() => toggleModelStatus(model, 'priority')}><ICONS.Crown size={13} /></button>
            <button aria-label={`Без чаттеров: ${model}`} title="Без чаттеров" aria-pressed={inactiveModels.includes(model)} onClick={() => toggleModelStatus(model, 'inactive')}><ICONS.Penalty size={13} /></button>
            <button aria-label={`Скрыть анкету: ${model}`} title="Скрыть из состава" onClick={() => removeModelFromPeriod(model)}><ICONS.Close size={13} /></button>
          </div>
        </th>
        {SHIFTS.map(shift => {
          const assignment = getAssignment(model, shift.type);
          const gap = assignment?.operator === 'ДЫРКА';
          const legacy = assignment?.operator === 'СТАЖЕР';
          const days = assignment ? operatorWorkingDays[assignment.operator] || 0 : 0;
          const trainee = assignment && !gap && (legacy || days < 7);
          return <td key={shift.type}><button className={`ct-roster-cell ${gap || legacy ? 'is-gap' : assignment ? 'is-assigned' : 'is-empty'}`} aria-label={`${model}, ${shift.label}: ${legacy ? 'Выбрать имя' : gap ? 'Нет оператора' : assignment?.operator || 'Назначить оператора'}`} onClick={() => {setShowSwapList(false);setOperatorSearch('');setEditingCell({model,shift:shift.type});}}>
            {assignment ? <><strong>{gap ? <><ICONS.Penalty size={14} />Нет оператора</> : legacy ? 'Выбрать имя' : assignment.operator}</strong><span className="ct-roster-cell-meta">{trainee && <span className="ct-roster-tag is-trainee"><ICONS.Internship size={12} />Стажёр · {days}/7</span>}{!gap && assessmentBadge(assignment.operator, model)}{!gap && assignment.models.length > 1 && <span className="ct-roster-linked" title={assignment.models.join(', ')}><ICONS.Layers size={11} />{assignment.models.length}</span>}</span></> : <><ICONS.Plus size={16} /><span>Назначить</span></>}
          </button></td>;
        })}
      </tr>;
    })}
  </React.Fragment>;

  return <div className="ct-page ct-roster-page">
    <header className="ct-page-heading"><div><h1>Состав</h1><p className="ct-roster-subtitle">Команда, анкеты и распределение по сменам</p></div><div className="ct-roster-actions"><button className="ct-button" onClick={() => setIsManagingOperators(true)}><ICONS.Users size={16} />Операторы</button><button className="ct-button ct-button-primary" onClick={() => setIsManagingModels(true)}><ICONS.Plus size={16} />Добавить анкету</button></div></header>
    {rosterNeedsFix && <div className="ct-roster-notice is-error" role="status"><ICONS.Penalty size={20} /><div><strong>Состав требует исправления</strong><span>{rosterStatusText || 'Проверьте назначения перед повторной отправкой.'}</span></div><button className="ct-button" disabled={isSendingTelegram} onClick={() => sendRosterToTelegram(true, true)}>{isSendingTelegram ? 'Отправляем…' : 'Отправить исправленный'}</button></div>}
    {syncBanner && <div className={`ct-roster-notice ${syncBanner.type === 'error' ? 'is-error' : ''}`} role="status"><Info size={18} /><span>{syncBanner.message}</span><button aria-label="Закрыть уведомление" onClick={() => setSyncBanner(null)}><ICONS.Close size={16} /></button></div>}
    <section className="ct-roster-summary" aria-label="Обзор состава">
      <div><span><ICONS.Models size={17} />Анкеты в составе</span><strong>{allModels.length}</strong><small>{inactiveModels.filter(m => allModels.includes(m)).length} без чаттеров</small></div>
      <div><span><ICONS.Users size={17} />Операторы на сменах</span><strong>{assignedOperators}</strong><small>Уникальные сотрудники</small></div>
      <div><span><ICONS.ShieldCheck size={17} />Укомплектованы</span><strong>{staffedModels}<em> / {activeModels.length}</em></strong><small>Все четыре смены заняты</small></div>
      <div className={totalSlots > filledSlots ? 'is-attention' : 'is-covered'}><span><ICONS.Clock size={17} />Свободные смены</span><strong>{totalSlots - filledSlots}</strong><small>Без учёта анкет без чаттеров</small></div>
    </section>
    <section className="ct-roster-board" aria-label="Расписание состава">
      <header className="ct-roster-board-heading"><div><h2>Распределение по сменам</h2><p>Нажмите на ячейку, чтобы назначить или заменить оператора</p></div><span><ICONS.Calendar size={15} />{currentPeriod?.label}</span></header>
      <div className="ct-roster-scroll" tabIndex={0} aria-label="Таблица смен, прокручивается по горизонтали"><div className="ct-roster-capture" ref={rosterRef}>
        <table className="ct-roster-table"><caption className="sr-only">Состав на {currentPeriod?.label}</caption><colgroup><col className="ct-roster-model-col" />{SHIFTS.map(shift => <col key={shift.type} />)}</colgroup><thead><tr><th scope="col"><span>Анкета</span><small>4 смены · время Киева</small></th>{SHIFTS.map((shift,index) => {const ShiftIcon=shiftIcons[index];return <th key={shift.type} scope="col"><div className={`ct-roster-shift is-${shift.type}`}><ShiftIcon size={18} /><span>{shift.label}<small>{shift.time.replace(' - ', '–')}</small></span></div></th>;})}</tr></thead><tbody>
          {renderModelRows(groupedModels.priority,'Приоритетные анкеты','priority',<ICONS.Crown size={14} />)}
          {renderModelRows(groupedModels.regular,'Основной состав','regular',<ICONS.Models size={14} />)}
          {renderModelRows(groupedModels.inactive,'Без чаттеров','inactive',<ICONS.Penalty size={14} />)}
        </tbody></table>
        {!allModels.length && <div className="ct-roster-empty"><ICONS.Users size={26} /><h3>Добавьте первую анкету</h3><p>Затем назначьте операторов на её смены.</p></div>}
        <div className="ct-roster-legend"><span><i />Назначен</span><span><i className="is-trainee" />Стажёр</span><span><i className="is-gap" />Нужен оператор</span><span className="ct-roster-coverage">Заполнено {filledSlots} из {totalSlots} рабочих смен</span></div>
      </div></div>
    </section>
    <section className="ct-roster-bottom">
      <div className="ct-roster-replacements"><header><h2><ICONS.Transfer size={17} />На замену <b>{replacements.length}</b></h2></header>{!replacements.length ? <p className="ct-roster-all-good"><ICONS.Check size={16} />Нет операторов с отметкой «Заменить»</p> : <div className="ct-roster-replacement-list">{replacements.map(asmt => <button key={asmt.id} onClick={() => setAssessmentTarget({operator:asmt.operator,modelName:asmt.modelName})}><span><strong>{asmt.operator}</strong><small>{asmt.modelName || 'Общий статус'}</small></span><ICONS.Edit size={15} /></button>)}</div>}</div>
      <div className="ct-roster-tools"><h2><ICONS.Send size={17} />Отправка состава</h2><p>По расписанию: 10:00 и 22:00 · Киев</p>{!rosterNeedsFix && rosterStatusText && <p className="ct-roster-all-good" role="status">{rosterStatusText}</p>}<div className="ct-roster-actions"><button className="ct-button" disabled={isSendingTelegram} onClick={() => sendRosterToTelegram(true)}><ICONS.Send size={14} />{isSendingTelegram ? 'Отправляем…' : 'Отправить в TG'}</button><button className="ct-button" onClick={syncRosterToAllMonths}><ICONS.Layers size={14} />На все месяцы</button></div><small>«На все месяцы» заменяет состав остальных периодов текущим.</small></div>
    </section>

    {editingCell && <RosterDialog title="Назначить оператора" close={closeAssignment} wide>
      <p className="ct-roster-dialog-subtitle">{editingCell.model} · {SHIFTS.find(s => s.type === editingCell.shift)?.label} · {SHIFTS.find(s => s.type === editingCell.shift)?.time}</p>
      {selectedAssignment && !showSwapList ? <>
        <div className="ct-roster-current"><span className="ct-roster-avatar"><ICONS.User size={22} /></span><div><small>Текущий оператор</small><strong>{selectedAssignment.operator === 'СТАЖЕР' ? 'Имя не выбрано' : selectedAssignment.operator === 'ДЫРКА' ? 'Нет оператора' : selectedAssignment.operator}</strong><div className="ct-roster-cell-meta">{assessmentBadge(selectedAssignment.operator,editingCell.model)}{(selectedAssignment.isTrainee || selectedAssignment.operator === 'СТАЖЕР') && <span className="ct-roster-tag is-trainee">Стажёр</span>}</div></div></div>
        <div className="ct-roster-choice-actions"><button className="ct-button ct-button-primary" onClick={() => setShowSwapList(true)}><ICONS.Transfer size={16} />Заменить оператора</button><button className="ct-button" disabled={selectedAssignment.operator === 'СТАЖЕР'} onClick={() => {setAssessmentTarget({operator:selectedAssignment.operator,modelName:editingCell.model});closeAssignment();}}><ICONS.Star size={16} />Поставить статус</button></div>
        <footer><button className="ct-button ct-roster-danger" onClick={clearCell}><ICONS.Close size={14} />Убрать из смены</button><button className="ct-button" onClick={closeAssignment}>Закрыть</button></footer>
      </> : <>
        {showSwapList && <button className="ct-roster-back" onClick={() => setShowSwapList(false)}><ICONS.ArrowLeft size={15} />К текущему назначению</button>}
        <label className="ct-roster-search"><ICONS.Search size={17} /><input aria-label="Найти оператора" placeholder="Поиск по имени оператора" value={operatorSearch} onChange={e => setOperatorSearch(e.target.value)} /></label>
        <div className="ct-roster-picker"><button className="ct-roster-pick is-gap" onClick={() => handleAssign('ДЫРКА')}><ICONS.Penalty size={17} /><span><strong>Нет оператора</strong><small>Отметить пропуск в смене</small></span></button>
          {operators.filter(op => op !== 'ДЫРКА' && op.toLocaleLowerCase().includes(operatorSearch.trim().toLocaleLowerCase())).map(op => {
            const days = operatorWorkingDays[op] || 0;
            const assignment = rosterEntries.find(e => e.shift === editingCell.shift && e.operator === op);
            const otherModels = assignment?.models.filter(m => m !== editingCell.model) || [];
            return <div className="ct-roster-picker-item" key={op}><button className={`ct-roster-pick ${selectedAssignment?.operator === op ? 'is-selected' : ''}`} onClick={() => handleAssign(op)}><span className="ct-roster-avatar">{op.replace('@','').slice(0,2).toLocaleUpperCase()}</span><span><strong>{op}</strong><small>{otherModels.length ? otherModels.join(' · ') : 'Свободен в этой смене'}</small><span className="ct-roster-cell-meta">{days < 7 && <span className="ct-roster-tag is-trainee">Стажёр · {days}/7</span>}{assessmentBadge(op,editingCell.model)}</span></span></button><button className="ct-roster-picker-status" title="Поставить статус" aria-label={`Статус: ${op}`} onClick={() => {setAssessmentTarget({operator:op,modelName:editingCell.model});closeAssignment();}}><ICONS.Star size={15} /></button></div>;
          })}
          {!operators.some(op => op !== 'ДЫРКА' && op.toLocaleLowerCase().includes(operatorSearch.trim().toLocaleLowerCase())) && <p className="ct-roster-empty-search">Операторы не найдены</p>}
        </div>
      </>}
    </RosterDialog>}

    {assessmentTarget && <RosterDialog title="Статус оператора" close={() => setAssessmentTarget(null)}>
      <p className="ct-roster-dialog-subtitle">{assessmentTarget.operator} · {assessmentTarget.modelName || 'Общий статус'}</p>
      <div className="ct-roster-assessments">{Object.entries(ASSESSMENT_META).map(([key,meta]) => {const active=(getAssessment(assessmentTarget.operator,assessmentTarget.modelName)?.status || 'none') === key;return <button key={key} aria-pressed={active} className={active ? 'is-selected' : ''} onClick={() => handleSetAssessment(active ? 'none' : key as OperatorStatus)}><span className={`ct-roster-tag is-${key}`}><meta.icon size={17} /></span><span>{key === 'none' ? 'Без отметки' : meta.label}</span>{active && <ICONS.Check size={16} />}</button>;})}</div><footer><button className="ct-button" onClick={() => setAssessmentTarget(null)}>Готово</button></footer>
    </RosterDialog>}

    {(isManagingModels || isManagingOperators) && <RosterDialog title={isManagingModels ? 'Управление анкетами' : 'Управление операторами'} close={() => {setIsManagingModels(false);setIsManagingOperators(false);}} wide>
      <p className="ct-roster-dialog-subtitle">Состав на {currentPeriod?.label}</p>
      <form className="ct-roster-add" onSubmit={e => {e.preventDefault();const name=(isManagingModels ? newModelName : newOperatorName).trim();if(name)(isManagingModels ? addModelToPeriod : addOperatorToPeriod)(name);}}><label>{isManagingModels ? 'Название анкеты' : 'Имя оператора'}<input required value={isManagingModels ? newModelName : newOperatorName} onChange={e => (isManagingModels ? setNewModelName : setNewOperatorName)(e.target.value)} placeholder={isManagingModels ? 'Например, Alena' : 'Например, @username'} /></label><button className="ct-button ct-button-primary" disabled={!(isManagingModels ? newModelName : newOperatorName).trim()}><ICONS.Plus size={15} />Добавить</button></form>
      <section className="ct-roster-manage-section"><h3>Добавить из общего списка</h3><div className="ct-roster-managed-list">{(isManagingModels ? availableModels : availableOperators).map(name => <button key={name} onClick={() => (isManagingModels ? addModelToPeriod : addOperatorToPeriod)(name)}><span>{name}</span><ICONS.Plus size={14} /></button>)}</div>{!(isManagingModels ? availableModels : availableOperators).length && <p>Все уже добавлены в текущий состав.</p>}</section>
      {!isManagingModels && <section className="ct-roster-manage-section"><h3>В составе · {operators.filter(op => op !== 'ДЫРКА').length}</h3><div className="ct-roster-managed-list">{operators.filter(op => op !== 'ДЫРКА').map(op => <div key={op}><span>{op}</span><button title="Скрыть из состава" aria-label={`Скрыть оператора: ${op}`} onClick={() => removeOperatorFromPeriod(op)}><ICONS.Close size={14} /></button></div>)}</div></section>}
      <footer><button className="ct-button" onClick={() => {setIsManagingModels(false);setIsManagingOperators(false);}}>Готово</button></footer>
    </RosterDialog>}
  </div>;
};

function RosterDialog({title,close,children,wide=false}: {title:string;close:()=>void;children:React.ReactNode;wide?:boolean}) {
  const ref=useRef<HTMLDialogElement>(null);
  const titleId=React.useId();
  useEffect(() => {const dialog=ref.current!,previous=document.activeElement as HTMLElement|null;dialog.showModal();return () => {dialog.close();previous?.focus();};},[]);
  return createPortal(<dialog ref={ref} className={`ct-roster-dialog${wide ? ' is-wide' : ''}`} aria-labelledby={titleId} onCancel={close}><header><h2 id={titleId}>{title}</h2><button aria-label="Закрыть окно" onClick={close}><ICONS.Close size={20} /></button></header>{children}</dialog>,document.body);
}

export default Roster;
