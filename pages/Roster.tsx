
import React, { useState, useMemo } from 'react';
import { AppState, RosterEntry, ShiftType, AccountingPeriod, OperatorStatus, OperatorAssessment } from '../types';
import { ICONS } from '../constants';
import { motion, AnimatePresence } from 'framer-motion';
import PeriodBadge from '../components/PeriodBadge';

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
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const SHIFTS: { type: ShiftType; label: string; time: string; color: string }[] = [
  { type: 'morning', label: 'Утро', time: '08:00 - 14:00', color: 'from-amber-400 to-orange-500' },
  { type: 'day', label: 'День', time: '14:00 - 20:00', color: 'from-sky-400 to-blue-500' },
  { type: 'evening', label: 'Вечер', time: '20:00 - 02:00', color: 'from-indigo-400 to-purple-500' },
  { type: 'night', label: 'Ночь', time: '02:00 - 08:00', color: 'from-slate-600 to-slate-900' },
];

const Roster: React.FC<RosterProps> = ({ state, updateState }) => {
  const [editingCell, setEditingCell] = useState<{ model: string; shift: ShiftType } | null>(null);
  const [isTraineeMode, setIsTraineeMode] = useState(false);
  const [assessmentTarget, setAssessmentTarget] = useState<{ operator: string; modelName?: string } | null>(null);

  const [showSwapList, setShowSwapList] = useState(false);

  const currentPeriod = state.accountingPeriods.find((p: AccountingPeriod) => p.id === state.selectedPeriodId);
  const allModels = currentPeriod?.models || state.models;
  const operators = currentPeriod?.operators || state.operators;

  const priorityModels = state.priorityModels || [];
  const inactiveModels = state.inactiveModels || [];

  const groupedModels = useMemo(() => {
    const priority = allModels.filter(m => priorityModels.includes(m));
    const inactive = allModels.filter(m => inactiveModels.includes(m));
    const regular = allModels.filter(m => !priorityModels.includes(m) && !inactiveModels.includes(m));
    return { priority, regular, inactive };
  }, [allModels, priorityModels, inactiveModels]);

  const rosterEntries = useMemo(() => {
    return (state.rosterData || []).filter((e: RosterEntry) => e.periodId === state.selectedPeriodId);
  }, [state.rosterData, state.selectedPeriodId]);

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

  const getAssignment = (model: string, shift: ShiftType) => {
    return rosterEntries.find((e: RosterEntry) => e.shift === shift && e.models.includes(model));
  };

  const currentAssessments = useMemo(() => {
    return (state.operatorAssessments || []).filter(a => a.periodId === state.selectedPeriodId);
  }, [state.operatorAssessments, state.selectedPeriodId]);

  const getAssessment = (operator: string, modelName?: string) => {
    return currentAssessments.find(a => 
      a.operator === operator && 
      (modelName ? a.modelName === modelName : true)
    );
  };

  const handleSetAssessment = (status: OperatorStatus) => {
    if (!assessmentTarget) return;

    updateState(prev => {
      const existing = (prev.operatorAssessments || []).filter(a => 
        !(a.operator === assessmentTarget.operator && 
          a.periodId === prev.selectedPeriodId && 
          a.modelName === assessmentTarget.modelName)
      );

      if (status === 'none') {
        return { ...prev, operatorAssessments: existing };
      }

      const newAssessment: OperatorAssessment = {
        id: `asmt_${Date.now()}`,
        operator: assessmentTarget.operator,
        periodId: prev.selectedPeriodId,
        status,
        modelName: assessmentTarget.modelName,
        updatedAt: new Date().toISOString()
      };

      return {
        ...prev,
        operatorAssessments: [newAssessment, ...existing]
      };
    });
    setAssessmentTarget(null);
  };

  const toggleModelStatus = (model: string, status: 'priority' | 'inactive') => {
    updateState(prev => {
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
    });
  };

  const deleteModel = (modelToDelete: string) => {
    if (!window.confirm(`Вы уверены, что хотите полностью удалить анкету "${modelToDelete}"? Это также очистит её расписание.`)) {
      return;
    }

    updateState(prev => {
      // 1. Remove from global models
      const newGlobalModels = (prev.models || []).filter(m => m !== modelToDelete);
      
      // 2. Remove from accounting periods
      const newPeriods = prev.accountingPeriods.map(p => ({
        ...p,
        models: (p.models || []).filter(m => m !== modelToDelete)
      }));

      // 3. Remove from roster data
      const roster = (prev.rosterData || []);
      const entriesToRemove = roster.filter(e => e.models.includes(modelToDelete));
      const newDeletedIds = [...(prev.deletedIds || []), ...entriesToRemove.map(e => e.id)];
      
      const newRoster = roster.map(e => {
        if (e.models.includes(modelToDelete)) {
          return {
            ...e,
            models: e.models.filter(m => m !== modelToDelete),
            updatedAt: new Date().toISOString()
          };
        }
        return e;
      }).filter(e => e.models.length > 0);

      // 4. Remove from statuses
      const newPriority = (prev.priorityModels || []).filter(m => m !== modelToDelete);
      const newInactive = (prev.inactiveModels || []).filter(m => m !== modelToDelete);
      
      // 5. Remove from assessments
      const newAssessments = (prev.operatorAssessments || []).filter(a => a.modelName !== modelToDelete);

      return {
        ...prev,
        models: newGlobalModels,
        accountingPeriods: newPeriods,
        rosterData: newRoster,
        deletedIds: newDeletedIds,
        priorityModels: newPriority,
        inactiveModels: newInactive,
        operatorAssessments: newAssessments
      };
    });
  };

  const handleAssign = (operator: string, isTrainee: boolean = false) => {
    if (!editingCell) return;

    updateState(prev => {
      const currentPeriodId = prev.selectedPeriodId;
      const roster = [...(prev.rosterData || [])];
      const now = new Date().toISOString();
      
      // 1. Check if it's already assigned to THIS operator (toggle off)
      const wasAssignedToThis = roster.some(e => 
        e.shift === editingCell.shift && 
        e.operator === operator && 
        e.isTrainee === isTrainee &&
        e.models.includes(editingCell.model) &&
        e.periodId === currentPeriodId
      );

      // 2. Identify entries that will be deleted (those that have only this model and are in this shift)
      const entriesToDelete = roster.filter(entry => 
        entry.shift === editingCell.shift && 
        entry.periodId === currentPeriodId && 
        entry.models.includes(editingCell.model) &&
        entry.models.length === 1
      );
      const newDeletedIds = [...(prev.deletedIds || []), ...entriesToDelete.map(e => e.id)];

      // 3. Remove this model from ANY existing assignment in this shift
      const updatedRoster = roster.map(entry => {
        if (entry.shift === editingCell.shift && entry.periodId === currentPeriodId) {
          if (entry.models.includes(editingCell.model)) {
            return {
              ...entry,
              models: entry.models.filter(m => m !== editingCell.model),
              updatedAt: now
            };
          }
        }
        return entry;
      }).filter(e => e.models.length > 0);

      if (wasAssignedToThis) {
        // Toggle off: we already removed it in step 3
        return { ...prev, rosterData: updatedRoster, deletedIds: newDeletedIds };
      }

      // 4. Assign to the new operator
      const targetEntryIdx = updatedRoster.findIndex(e => 
        e.shift === editingCell.shift && 
        e.operator === operator && 
        e.isTrainee === isTrainee &&
        e.periodId === currentPeriodId
      );

      if (targetEntryIdx > -1) {
        const entry = { ...updatedRoster[targetEntryIdx] };
        // Limit to 2 models for real operators, but "ДЫРКА" can have more
        if (operator === 'ДЫРКА' || entry.models.length < 2) {
          entry.models = [...entry.models, editingCell.model];
        } else {
          // Replace the second one if already has 2
          entry.models = [entry.models[0], editingCell.model];
        }
        entry.updatedAt = now;
        updatedRoster[targetEntryIdx] = entry;
      } else {
        updatedRoster.push({
          id: `roster_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          periodId: currentPeriodId,
          date: 'monthly',
          shift: editingCell.shift,
          operator,
          isTrainee,
          models: [editingCell.model],
          createdAt: now,
          updatedAt: now
        });
      }

      return { ...prev, rosterData: updatedRoster, deletedIds: newDeletedIds };
    });
    setEditingCell(null);
    setIsTraineeMode(false);
  };

  const clearCell = () => {
    if (!editingCell) return;
    updateState(prev => {
      const currentPeriodId = prev.selectedPeriodId;
      const now = new Date().toISOString();
      
      const entriesToDelete = (prev.rosterData || []).filter(entry => 
        entry.shift === editingCell.shift && 
        entry.periodId === currentPeriodId && 
        entry.models.includes(editingCell.model) &&
        entry.models.length === 1
      );
      const newDeletedIds = [...(prev.deletedIds || []), ...entriesToDelete.map(e => e.id)];

      const roster = (prev.rosterData || []).map(e => {
        if (e.shift === editingCell.shift && e.models.includes(editingCell.model) && e.periodId === currentPeriodId) {
          return {
            ...e,
            models: e.models.filter(m => m !== editingCell.model),
            updatedAt: now
          };
        }
        return e;
      }).filter(e => e.models.length > 0);
      
      return { ...prev, rosterData: roster, deletedIds: newDeletedIds };
    });
    setEditingCell(null);
  };

  const renderModelRows = (models: string[], title: string, colorClass: string, icon: React.ReactNode) => {
    if (models.length === 0) return null;
    return (
      <>
        <tr className="bg-slate-900/60">
          <td colSpan={5} className="p-4 border-b border-slate-800/50">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClass} bg-opacity-20`}>
                {icon}
              </div>
              <span className="text-xs font-black uppercase tracking-[0.2em] text-white">{title}</span>
              <span className="text-[10px] font-bold text-slate-500 ml-auto">{models.length} анкет</span>
            </div>
          </td>
        </tr>
        {models.map((model: string, mIdx: number) => {
          const isFullyStaffed = SHIFTS.every(shift => {
            const assignment = getAssignment(model, shift.type);
            return assignment && assignment.operator !== 'ДЫРКА';
          });

          return (
            <tr key={model} className={`group transition-colors ${mIdx % 2 === 0 ? 'bg-white/[0.01]' : 'bg-transparent'}`}>
              <td className={`p-6 border-b border-slate-800/30 transition-all duration-500 ${
                isFullyStaffed 
                  ? 'bg-emerald-500/[0.02] shadow-[inset_4px_0_0_0_#10b981]' 
                  : 'bg-rose-500/[0.02] shadow-[inset_4px_0_0_0_#f43f5e]'
              }`}>
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 shadow-lg ${
                      isFullyStaffed 
                        ? 'bg-emerald-500/20 text-emerald-400 shadow-emerald-500/10 border border-emerald-500/20' 
                        : 'bg-rose-500/20 text-rose-400 shadow-rose-500/10 border border-rose-500/20'
                    }`}>
                      <ICONS.Models size={20} />
                    </div>
                    <div className="flex flex-col">
                      <span className={`font-bold transition-colors duration-500 ${isFullyStaffed ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {model}
                      </span>
                      <span className={`text-[9px] font-black uppercase tracking-widest ${isFullyStaffed ? 'text-emerald-500/50' : 'text-rose-500/50'}`}>
                        {isFullyStaffed ? 'Укомплектована' : 'Есть пропуски'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => toggleModelStatus(model, 'priority')}
                    className={`p-2 rounded-lg transition-colors ${priorityModels.includes(model) ? 'text-amber-400 bg-amber-400/10' : 'text-slate-600 hover:text-amber-400 hover:bg-amber-400/10'}`}
                    title="Приоритетная"
                  >
                    <ICONS.Crown size={14} />
                  </button>
                  <button 
                    onClick={() => toggleModelStatus(model, 'inactive')}
                    className={`p-2 rounded-lg transition-colors ${inactiveModels.includes(model) ? 'text-rose-400 bg-rose-400/10' : 'text-slate-600 hover:text-rose-400 hover:bg-rose-400/10'}`}
                    title="Без чаттеров"
                  >
                    <ICONS.Penalty size={14} />
                  </button>
                  <button 
                    onClick={() => deleteModel(model)}
                    className="p-2 rounded-lg text-slate-600 hover:text-rose-600 hover:bg-rose-600/10 transition-colors"
                    title="Удалить анкету"
                  >
                    <ICONS.Trash size={14} />
                  </button>
                </div>
              </div>
            </td>
            {SHIFTS.map(shift => {
              const assignment = getAssignment(model, shift.type);
              const isGap = assignment?.operator === 'ДЫРКА';
              const isLegacyTrainee = assignment?.operator === 'СТАЖЕР';
              const isTrainee = assignment?.isTrainee || isLegacyTrainee;
              const daysWorked = assignment ? (operatorWorkingDays[assignment.operator] || 0) : 0;
              const isGraduated = isTrainee && daysWorked >= 7;

              return (
                <td 
                  key={shift.type} 
                  className="p-3 border-b border-slate-800/30 border-l border-slate-800/10"
                >
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setEditingCell({ model, shift: shift.type })}
                    className={`w-full h-16 rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1 relative overflow-hidden group/cell ${
                      isGap || isLegacyTrainee
                        ? 'bg-rose-500/20 border-rose-500/50 hover:border-rose-500'
                        : isTrainee
                          ? 'bg-purple-500/20 border-purple-500/50 hover:border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                          : assignment 
                            ? 'bg-indigo-500/10 border-indigo-500/30 hover:border-indigo-500/50' 
                            : 'bg-slate-900/20 border-dashed border-slate-800 hover:border-slate-700 hover:bg-slate-800/30'
                    }`}
                  >
                    {assignment ? (
                      <>
                        <div className="flex items-center gap-1.5 px-2">
                          {isTrainee && <ICONS.Internship size={12} className={isGraduated ? 'text-emerald-400' : 'text-purple-400'} />}
                          <span className={`text-xs font-black uppercase tracking-tighter truncate ${
                            isGap ? 'text-rose-400' : isLegacyTrainee ? 'text-white bg-rose-500 px-1 rounded' : isTrainee ? isGraduated ? 'text-emerald-400' : 'text-purple-400' : 'text-indigo-400'
                          }`}>
                            {isLegacyTrainee ? 'ВЫБРАТЬ ИМЯ' : assignment.operator}
                          </span>
                          {(() => {
                            const asmt = getAssessment(assignment.operator, model);
                            if (!asmt) return null;
                            const meta = ASSESSMENT_META[asmt.status];
                            return (
                              <div className={`p-1 rounded-md ${meta.bg} ${meta.color} ml-1`} title={meta.label}>
                                <meta.icon size={10} />
                              </div>
                            );
                          })()}
                          {isGraduated && (
                            <div className="absolute top-1 right-1">
                               <div className="bg-emerald-500 text-[6px] text-white font-black px-1 rounded-sm animate-bounce">READY</div>
                            </div>
                          )}
                        </div>
                        {!isGap && (
                          <div className="flex items-center gap-2 mt-0.5">
                            {isTrainee && (
                              <div className={`px-1.5 py-0.5 rounded-md text-[7px] font-black border leading-none ${
                                isGraduated 
                                  ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400' 
                                  : 'bg-purple-500/20 border-purple-500/30 text-purple-300'
                              }`}>
                                {daysWorked}/7ДН
                              </div>
                            )}
                            <div className="flex gap-0.5">
                              {assignment.models.map((m: string, i: number) => (
                                <div key={i} className={`w-1 h-1 rounded-full ${isTrainee ? isGraduated ? 'bg-emerald-500' : 'bg-purple-500' : 'bg-indigo-500'}`} />
                              ))}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <ICONS.Plus size={16} className="text-slate-700 group-hover/cell:text-slate-500 transition-colors" />
                    )}
                  </motion.button>
                </td>
              );
            })}
            </tr>
          );
        })}
      </>
    );
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight">Состав</h1>
          <div className="flex items-center gap-3 mt-1">
            <PeriodBadge state={state} />
            <p className="text-slate-400 font-medium">Управление сменами и распределение операторов</p>
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="glass-card rounded-[2.5rem] border-slate-800/50 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-900/40">
                <th className="p-6 text-left border-b border-slate-800/50 min-w-[250px]">
                  <span className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-500">Модель / Анкета</span>
                </th>
                {SHIFTS.map(shift => (
                  <th key={shift.type} className="p-6 text-center border-b border-slate-800/50 min-w-[180px]">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-sm font-black text-white">{shift.label}</span>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{shift.time}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {renderModelRows(groupedModels.priority, "Основные анкеты", "text-amber-400", <ICONS.Crown size={16} />)}
              {renderModelRows(groupedModels.regular, "Стандартные", "text-indigo-400", <ICONS.Models size={16} />)}
              {renderModelRows(groupedModels.inactive, "Без чаттеров", "text-slate-500", <ICONS.Penalty size={16} />)}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assignment Modal */}
      <AnimatePresence>
        {editingCell && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingCell(null)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-xl"
            />
            
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl glass-card rounded-[2.5rem] border-slate-800 p-8 md:p-12 shadow-2xl overflow-hidden"
            >
              {/* Background Glow */}
              <div className="absolute -top-24 -right-24 w-64 h-64 bg-indigo-600/20 blur-[100px] rounded-full" />
              
              <div className="relative space-y-8">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-white">Назначить оператора</h2>
                    <p className="text-slate-400 font-medium">
                      {editingCell.model} • {SHIFTS.find(s => s.type === editingCell.shift)?.label}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer group/toggle">
                      <div 
                        onClick={() => setIsTraineeMode(!isTraineeMode)}
                        className={`w-12 h-6 rounded-full transition-all relative ${isTraineeMode ? 'bg-purple-500' : 'bg-slate-800'}`}
                      >
                        <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${isTraineeMode ? 'left-7' : 'left-1'}`} />
                      </div>
                      <span className={`text-xs font-black uppercase tracking-widest ${isTraineeMode ? 'text-purple-400' : 'text-slate-500'}`}>Стажер</span>
                    </label>
                    <button 
                      onClick={() => {
                        setEditingCell(null);
                        setShowSwapList(false);
                      }}
                      className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-slate-500 hover:text-white transition-colors"
                    >
                      <ICONS.Close size={24} />
                    </button>
                  </div>
                </div>

                {editingCell && getAssignment(editingCell.model, editingCell.shift) && !showSwapList ? (
                  <div className="space-y-6">
                    <div className="p-8 rounded-[2rem] bg-white/[0.03] border border-white/5 flex items-center justify-between">
                       <div className="flex items-center gap-6">
                          <div className="w-16 h-16 rounded-[1.5rem] bg-indigo-500/20 text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-lg shadow-indigo-500/10">
                            <ICONS.User size={32} />
                          </div>
                          <div>
                             <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Текущий оператор</p>
                             <p className="text-3xl font-black text-white uppercase tracking-tighter">
                               {getAssignment(editingCell.model, editingCell.shift)?.operator === 'СТАЖЕР' ? 'ИМЯ НЕ ВЫБРАНО' : getAssignment(editingCell.model, editingCell.shift)?.operator}
                             </p>
                             <div className="flex gap-2 mt-2">
                               {getAssignment(editingCell.model, editingCell.shift) && (getAssignment(editingCell.model, editingCell.shift)?.isTrainee || getAssignment(editingCell.model, editingCell.shift)?.operator === 'СТАЖЕР') && (
                                 <span className="px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-400 text-[8px] font-black uppercase tracking-widest border border-purple-500/30">Стажер</span>
                               )}
                               {getAssignment(editingCell.model, editingCell.shift)?.operator === 'СТАЖЕР' && (
                                 <span className="px-2 py-0.5 rounded-lg bg-rose-500 text-white text-[8px] font-black uppercase tracking-widest">Ошибка: Нужно имя!</span>
                               )}
                               {(() => {
                                  const assignment = getAssignment(editingCell.model, editingCell.shift);
                                  if (!assignment || assignment.operator === 'СТАЖЕР') return null;
                                  const asmt = getAssessment(assignment.operator, editingCell.model);
                                  if (!asmt) return null;
                                  const meta = ASSESSMENT_META[asmt.status];
                                  return (
                                    <span className={`px-2 py-0.5 rounded-lg ${meta.bg} ${meta.color} text-[8px] font-black uppercase tracking-widest border border-white/5`}>
                                      {meta.label}
                                    </span>
                                  );
                               })()}
                             </div>
                          </div>
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <button 
                         onClick={() => setShowSwapList(true)}
                         className="p-6 rounded-[2rem] bg-indigo-600 text-white font-black uppercase text-xs tracking-widest flex flex-col items-center gap-3 shadow-xl shadow-indigo-600/20 hover:scale-[1.02] transition-all"
                       >
                         <ICONS.RotateCcw size={24} />
                         Заменить (Swap)
                       </button>
                       <button 
                         onClick={() => {
                           const assignment = getAssignment(editingCell.model, editingCell.shift);
                           if (assignment && assignment.operator !== 'СТАЖЕР') {
                             setAssessmentTarget({ operator: assignment.operator, modelName: editingCell.model });
                             setEditingCell(null);
                           }
                         }}
                         className={`p-6 rounded-[2rem] font-black uppercase text-xs tracking-widest flex flex-col items-center gap-3 border transition-all ${
                           getAssignment(editingCell.model, editingCell.shift)?.operator === 'СТАЖЕР' 
                            ? 'bg-slate-900 text-slate-700 border-white/5 cursor-not-allowed'
                            : 'bg-slate-800 text-white border-white/5 hover:bg-slate-750'
                         }`}
                         disabled={getAssignment(editingCell.model, editingCell.shift)?.operator === 'СТАЖЕР'}
                       >
                         <ICONS.Star size={24} />
                         Поставить статус
                       </button>
                    </div>

                    <div className="flex gap-4">
                       <button 
                         onClick={clearCell}
                         className="flex-1 py-5 rounded-[2rem] bg-rose-500/10 border border-rose-500/20 text-rose-500 font-black uppercase text-[10px] tracking-widest hover:bg-rose-500/20 transition-all"
                       >
                         Убрать из смены
                       </button>
                       <button 
                         onClick={() => setEditingCell(null)}
                         className="flex-1 py-5 rounded-[2rem] bg-slate-900 text-slate-500 font-black uppercase text-[10px] tracking-widest border border-white/5 hover:bg-slate-850 transition-all"
                       >
                         Закрыть
                       </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {showSwapList && (
                      <button 
                        onClick={() => setShowSwapList(false)}
                        className="text-indigo-400 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 hover:translate-x-1 transition-transform"
                      >
                         <ICONS.ChevronRight size={14} className="rotate-180" /> Назад к действиям
                      </button>
                    )}
                    
                    {isTraineeMode && (
                      <div className="bg-purple-500/10 border border-purple-500/20 p-4 rounded-2xl flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-purple-500 text-white flex items-center justify-center">
                            <ICONS.Internship size={18} />
                         </div>
                         <div>
                            <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Режим стажировки</p>
                            <p className="text-xs font-bold text-white leading-none">Выберите оператора из списка ниже</p>
                         </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[40vh] overflow-y-auto pr-2 custom-scrollbar">
                  {/* GAP BUTTON */}
                  <button
                    onClick={() => handleAssign('ДЫРКА')}
                    className="p-4 rounded-2xl border-2 border-rose-500/30 bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-all flex flex-col items-center justify-center gap-1"
                  >
                    <ICONS.Penalty size={20} />
                    <span className="font-black text-xs uppercase">ДЫРКА</span>
                  </button>

                  {operators.map((op: string) => {
                    const isAssignedToThis = rosterEntries.find((e: RosterEntry) => e.shift === editingCell.shift && e.operator === op && e.models.includes(editingCell.model) && e.isTrainee === isTraineeMode);
                    const currentAssignment = rosterEntries.find((e: RosterEntry) => e.shift === editingCell.shift && e.operator === op);
                    const otherModels = currentAssignment?.models.filter((m: string) => m !== editingCell.model) || [];
                    const daysWorked = operatorWorkingDays[op] || 0;
                    const isGraduated = isTraineeMode && daysWorked >= 7;
                    const asmt = getAssessment(op, editingCell.model);
                    
                    return (
                      <div key={op} className="relative group">
                        <button
                          onClick={() => handleAssign(op, isTraineeMode)}
                          className={`w-full p-4 rounded-2xl border-2 transition-all text-left space-y-1 relative ${
                            isAssignedToThis
                              ? isTraineeMode ? 'bg-purple-600 border-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.3)]' : 'bg-indigo-600 border-indigo-500 text-white'
                              : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-bold truncate">{op}</div>
                            <div className="flex gap-1 items-center">
                              {asmt && (() => {
                                const Icon = ASSESSMENT_META[asmt.status].icon;
                                return (
                                  <div className={`p-1 rounded-md ${ASSESSMENT_META[asmt.status].bg} ${ASSESSMENT_META[asmt.status].color}`}>
                                    <Icon size={8} />
                                  </div>
                                );
                              })()}
                              {isTraineeMode && (
                                <div className={`px-1.5 py-0.5 rounded text-[8px] font-black ${isGraduated ? 'bg-emerald-500 text-white' : 'bg-purple-500/40 text-purple-200'}`}>
                                  {daysWorked}/7дн
                                </div>
                              )}
                            </div>
                          </div>
                          {isGraduated && (
                            <div className="text-[7px] text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1">
                               <ICONS.ShieldCheck size={8} /> Стажировка окончена
                            </div>
                          )}
                          {otherModels.length > 0 && !isGraduated && (
                            <div className={`text-[9px] uppercase font-black tracking-tighter ${
                              isAssignedToThis ? isTraineeMode ? 'text-purple-200' : 'text-indigo-200' : 'text-slate-600'
                            }`}>
                              + {otherModels[0]}
                            </div>
                          )}
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setAssessmentTarget({ operator: op, modelName: editingCell.model });
                          }}
                          className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all z-10 hover:bg-white hover:text-slate-950 shadow-xl"
                          title="Поставить отметку"
                        >
                          <ICONS.Star size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    )}
  </AnimatePresence>

      {/* Replacement List */}
      <div className="mt-12 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center border border-orange-500/20 shadow-lg shadow-orange-500/10">
            <ICONS.Users size={20} />
          </div>
          <div>
            <h2 className="text-xl font-black text-white uppercase tracking-tight">На замену</h2>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Операторы, требующие ротации в текущем периоде</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {currentAssessments.filter(a => a.status === 'replace').length === 0 ? (
            <div className="col-span-full py-12 px-8 rounded-[2.5rem] bg-white/[0.02] border border-dashed border-white/5 flex flex-col items-center justify-center gap-3">
               <ICONS.ShieldCheck size={32} className="text-slate-800" />
               <p className="text-sm font-bold text-slate-600 uppercase tracking-widest">Кандидатов на замену нет</p>
            </div>
          ) : (
            currentAssessments.filter(a => a.status === 'replace').map(asmt => (
              <motion.div 
                key={asmt.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-card p-6 rounded-3xl border-rose-500/20 bg-rose-500/5 flex items-center justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-lg shadow-rose-500/30">
                    <ICONS.Users size={24} />
                  </div>
                  <div>
                    <p className="text-lg font-black text-white leading-none">{asmt.operator}</p>
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mt-1">Анкета: {asmt.modelName || 'Общий'}</p>
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setAssessmentTarget({ operator: asmt.operator, modelName: asmt.modelName });
                  }}
                  className="w-10 h-10 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center text-slate-500 hover:text-white transition-all"
                >
                  <ICONS.Edit size={16} />
                </button>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Assessment Target Modal */}
      <AnimatePresence>
        {assessmentTarget && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass-card w-full max-w-sm rounded-[3rem] p-8 border-white/10 shadow-2xl relative overflow-hidden"
            >
              <div className="relative z-10 space-y-8">
                <div className="text-center">
                  <h3 className="text-xl font-black text-white uppercase">{assessmentTarget.operator}</h3>
                  <p className="text-xs font-bold text-indigo-400 uppercase tracking-widest mt-1">Цель: {assessmentTarget.modelName || 'Общий'}</p>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(ASSESSMENT_META).map(([key, meta]) => {
                    const StatusIcon = meta.icon;
                    return (
                      <button
                        key={key}
                        onClick={() => handleSetAssessment(key as OperatorStatus)}
                        className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${
                          getAssessment(assessmentTarget.operator, assessmentTarget.modelName)?.status === key
                            ? 'bg-white text-slate-950 border-white'
                            : 'bg-slate-900/50 border-white/5 text-slate-400 hover:border-white/20'
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${meta.bg} ${meta.color}`}>
                          <StatusIcon size={18} />
                        </div>
                        <span className="font-black uppercase tracking-widest text-[10px]">{meta.label}</span>
                      </button>
                    );
                  })}
                </div>

                <button 
                  onClick={() => setAssessmentTarget(null)}
                  className="w-full py-4 rounded-2xl bg-slate-800 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-slate-700 transition-all border border-white/5"
                >
                  Закрыть
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.02);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 10px;
        }
      `}</style>
    </div>
  );
};

export default Roster;
