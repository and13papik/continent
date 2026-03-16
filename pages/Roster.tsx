
import React, { useState, useMemo } from 'react';
import { AppState, RosterEntry, ShiftType, AccountingPeriod } from '../types';
import { ICONS } from '../constants';
import { motion, AnimatePresence } from 'framer-motion';

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

  const getAssignment = (model: string, shift: ShiftType) => {
    return rosterEntries.find((e: RosterEntry) => e.shift === shift && e.models.includes(model));
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

  const handleAssign = (operator: string) => {
    if (!editingCell) return;

    updateState(prev => {
      const roster = [...(prev.rosterData || [])];
      
      // Find if this operator already has an entry for this shift in this period
      const existingEntryIdx = roster.findIndex((e: RosterEntry) => 
        e.shift === editingCell.shift && 
        e.operator === operator &&
        e.periodId === state.selectedPeriodId
      );

      if (existingEntryIdx > -1) {
        // Operator already assigned to some models in this shift
        const entry = { ...roster[existingEntryIdx] };
        if (entry.models.includes(editingCell.model)) {
          // Remove if already there (toggle)
          entry.models = entry.models.filter((m: string) => m !== editingCell.model);
        } else {
          // Add if not there, but limit to 2 models
          if (entry.models.length < 2) {
            entry.models = [...entry.models, editingCell.model];
          } else {
            entry.models = [entry.models[1], editingCell.model];
          }
        }
        
        if (entry.models.length === 0) {
          roster.splice(existingEntryIdx, 1);
        } else {
          roster[existingEntryIdx] = entry;
        }
      } else {
        // New assignment for this operator in this shift
        // But first, check if this (model, shift) already has someone else
        const otherOpIdx = roster.findIndex((e: RosterEntry) => 
          e.shift === editingCell.shift && 
          e.models.includes(editingCell.model) &&
          e.periodId === state.selectedPeriodId
        );
        
        if (otherOpIdx > -1) {
          const otherEntry = { ...roster[otherOpIdx] };
          otherEntry.models = otherEntry.models.filter((m: string) => m !== editingCell.model);
          if (otherEntry.models.length === 0) {
            roster.splice(otherOpIdx, 1);
          } else {
            roster[otherOpIdx] = otherEntry;
          }
        }

        roster.push({
          id: String(Date.now()),
          periodId: state.selectedPeriodId,
          date: 'monthly', // No longer day-specific
          shift: editingCell.shift,
          operator,
          models: [editingCell.model],
          createdAt: new Date().toISOString()
        });
      }

      return { ...prev, rosterData: roster };
    });
    setEditingCell(null);
  };

  const clearCell = () => {
    if (!editingCell) return;
    updateState(prev => {
      const roster = (prev.rosterData || []).filter((e: RosterEntry) => {
        if (e.shift === editingCell.shift && e.models.includes(editingCell.model) && e.periodId === state.selectedPeriodId) {
          e.models = e.models.filter((m: string) => m !== editingCell.model);
          return e.models.length > 0;
        }
        return true;
      });
      return { ...prev, rosterData: roster };
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
        {models.map((model: string, mIdx: number) => (
          <tr key={model} className={`group transition-colors ${mIdx % 2 === 0 ? 'bg-white/[0.01]' : 'bg-transparent'}`}>
            <td className="p-6 border-b border-slate-800/30">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-slate-400 group-hover:bg-indigo-500/20 group-hover:text-indigo-400 transition-all">
                    <ICONS.Models size={20} />
                  </div>
                  <span className="font-bold text-slate-200 group-hover:text-white transition-colors">{model}</span>
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
                </div>
              </div>
            </td>
            {SHIFTS.map(shift => {
              const assignment = getAssignment(model, shift.type);
              const isGap = assignment?.operator === 'ДЫРКА';
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
                      isGap
                        ? 'bg-rose-500/20 border-rose-500/50 hover:border-rose-500'
                        : assignment 
                          ? 'bg-indigo-500/10 border-indigo-500/30 hover:border-indigo-500/50' 
                          : 'bg-slate-900/20 border-dashed border-slate-800 hover:border-slate-700 hover:bg-slate-800/30'
                    }`}
                  >
                    {assignment ? (
                      <>
                        <span className={`text-xs font-black uppercase tracking-tighter ${isGap ? 'text-rose-400' : 'text-indigo-400'}`}>
                          {assignment.operator}
                        </span>
                        {!isGap && (
                          <div className="flex gap-1">
                            {assignment.models.map((m: string, i: number) => (
                              <div key={i} className="w-1 h-1 rounded-full bg-indigo-500" />
                            ))}
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
        ))}
      </>
    );
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">Состав</h1>
          <p className="text-slate-400 font-medium">Управление сменами и распределение операторов</p>
        </div>
        
        <div className="flex items-center gap-4 bg-indigo-500/10 px-6 py-3 rounded-2xl border border-indigo-500/20">
          <ICONS.Calendar size={20} className="text-indigo-400" />
          <span className="text-white font-black uppercase tracking-wider">{currentPeriod?.label || 'Текущий месяц'}</span>
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
                  <button 
                    onClick={() => setEditingCell(null)}
                    className="w-12 h-12 rounded-2xl bg-slate-900 flex items-center justify-center text-slate-500 hover:text-white transition-colors"
                  >
                    <ICONS.Close size={24} />
                  </button>
                </div>

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
                    const isAssignedToThis = rosterEntries.find((e: RosterEntry) => e.shift === editingCell.shift && e.operator === op && e.models.includes(editingCell.model));
                    const otherModels = rosterEntries.find((e: RosterEntry) => e.shift === editingCell.shift && e.operator === op)?.models.filter((m: string) => m !== editingCell.model) || [];
                    
                    return (
                      <button
                        key={op}
                        onClick={() => handleAssign(op)}
                        className={`p-4 rounded-2xl border-2 transition-all text-left space-y-1 group ${
                          isAssignedToThis
                            ? 'bg-indigo-600 border-indigo-500 text-white'
                            : 'bg-slate-900/50 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-white'
                        }`}
                      >
                        <div className="font-bold truncate">{op}</div>
                        {otherModels.length > 0 && (
                          <div className={`text-[9px] uppercase font-black tracking-tighter ${isAssignedToThis ? 'text-indigo-200' : 'text-slate-600'}`}>
                            + {otherModels[0]}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-4 flex gap-4">
                  <button
                    onClick={clearCell}
                    className="flex-1 py-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 font-bold hover:bg-rose-500/20 transition-all"
                  >
                    Очистить ячейку
                  </button>
                  <button
                    onClick={() => setEditingCell(null)}
                    className="flex-1 py-4 rounded-2xl bg-slate-800 text-slate-300 font-bold hover:bg-slate-700 transition-all"
                  >
                    Отмена
                  </button>
                </div>
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
