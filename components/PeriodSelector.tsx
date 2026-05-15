
import React from 'react';
import { AppState, AccountingPeriod } from '../types';
import { ICONS } from '../constants';

interface PeriodSelectorProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
  className?: string;
}

const PeriodSelector: React.FC<PeriodSelectorProps> = ({ state, updateState, className = "" }) => {
  const activePeriod = state.accountingPeriods.find(p => p.id === state.selectedPeriodId);
  
  const sortedPeriods = [...state.accountingPeriods].sort((a, b) => 
    new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  ).reverse();

  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <div className="flex items-center gap-2 px-2">
        <ICONS.Calendar size={12} className="text-slate-500" />
        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-60">
          Активный период
        </span>
      </div>
      <div className="relative group">
        <select 
          className="w-full bg-slate-900/50 border border-slate-800 hover:border-indigo-500/50 rounded-xl px-4 py-2.5 text-indigo-400 font-bold outline-none cursor-pointer text-sm transition-all appearance-none"
          value={state.selectedPeriodId} 
          onChange={(e) => updateState(prev => ({ ...prev, selectedPeriodId: e.target.value }))}
        >
          {sortedPeriods.map(p => (
            <option key={p.id} value={p.id} className="bg-slate-900 text-slate-200">
              {p.label} {p.status === 'closed' ? '🔒' : ''}
            </option>
          ))}
        </select>
        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 group-hover:text-indigo-400 transition-colors">
          <ICONS.ChevronDown size={14} />
        </div>
      </div>
    </div>
  );
};

export default PeriodSelector;
