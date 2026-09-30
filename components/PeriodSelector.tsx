
import React from 'react';
import { AppState } from '../types';
import { ICONS } from '../constants';

interface PeriodSelectorProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
  className?: string;
}

const PeriodSelector: React.FC<PeriodSelectorProps> = ({ state, updateState, className = "" }) => {
  const activePeriod = state.accountingPeriods.find(p => p.id === state.selectedPeriodId);
  const isClosed = activePeriod?.status === 'closed';
  
  const sortedPeriods = [...state.accountingPeriods].sort((a, b) => 
    new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  ).reverse();

  return (
    <div className={`relative group ${className}`}>
      <div className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-indigo-400/50 rounded-xl px-3 py-2 transition-all duration-300 backdrop-blur-md shadow-md">
        <div className="flex items-center justify-between gap-1.5 mb-1">
          <div className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${isClosed ? 'bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]' : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]'}`} />
            <span className="text-[8.5px] font-black uppercase tracking-[0.2em] text-slate-300">
              Активный период
            </span>
          </div>
          {isClosed && (
            <span className="text-[8px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/20 px-1.5 py-0.5 rounded border border-amber-500/30">
              Закрыт
            </span>
          )}
        </div>
        
        <div className="relative flex items-center">
          <select 
            className="w-full bg-transparent text-white font-extrabold outline-none cursor-pointer text-[12px] leading-tight transition-colors appearance-none pr-6 py-0.5"
            value={state.selectedPeriodId} 
            onChange={(e) => updateState(prev => ({ ...prev, selectedPeriodId: e.target.value }))}
          >
            {sortedPeriods.map(p => (
              <option key={p.id} value={p.id} className="bg-slate-900 text-white font-bold py-1">
                {p.label} {p.status === 'closed' ? '🔒' : ''}
              </option>
            ))}
          </select>
          <div className="absolute right-0 pointer-events-none text-indigo-400 group-hover:text-indigo-300 transition-colors">
            <ICONS.ChevronDown size={14} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PeriodSelector;
