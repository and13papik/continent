
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
      <div className="bg-slate-900/60 hover:bg-slate-900/90 border border-white/5 hover:border-indigo-500/30 rounded-xl px-2.5 py-1.5 transition-all duration-300 backdrop-blur-md shadow-sm">
        <div className="flex items-center justify-between gap-1.5 mb-0.5">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${isClosed ? 'bg-amber-400' : 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'}`} />
            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400">
              Активный период
            </span>
          </div>
          {isClosed && (
            <span className="text-[7.5px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-1 py-0.2 rounded border border-amber-500/20">
              Закрыт
            </span>
          )}
        </div>
        
        <div className="relative flex items-center">
          <select 
            className="w-full bg-transparent text-indigo-200 hover:text-white font-bold outline-none cursor-pointer text-[11px] leading-tight transition-colors appearance-none pr-5 py-0.5"
            value={state.selectedPeriodId} 
            onChange={(e) => updateState(prev => ({ ...prev, selectedPeriodId: e.target.value }))}
          >
            {sortedPeriods.map(p => (
              <option key={p.id} value={p.id} className="bg-slate-950 text-slate-200">
                {p.label} {p.status === 'closed' ? '🔒' : ''}
              </option>
            ))}
          </select>
          <div className="absolute right-0 pointer-events-none text-slate-500 group-hover:text-indigo-400 transition-colors">
            <ICONS.ChevronDown size={12} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default PeriodSelector;
