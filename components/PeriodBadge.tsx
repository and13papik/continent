
import React from 'react';
import { AppState } from '../types';
import { ICONS } from '../constants';

interface PeriodBadgeProps {
  state: AppState;
}

const PeriodBadge: React.FC<PeriodBadgeProps> = ({ state }) => {
  const activePeriod = state.accountingPeriods.find(p => p.id === state.selectedPeriodId);
  
  if (!activePeriod) return null;

  return (
    <div className="flex items-center gap-2 px-3.5 py-1.5 bg-indigo-500/20 border border-indigo-400/40 rounded-xl text-indigo-200 text-[11px] font-black uppercase tracking-widest shadow-md">
      <ICONS.Calendar size={14} className="text-indigo-300" />
      <span className="text-white">{activePeriod.label}</span>
      {activePeriod.status === 'closed' && (
        <ICONS.Lock size={12} className="text-rose-400 ml-1" />
      )}
    </div>
  );
};

export default PeriodBadge;
