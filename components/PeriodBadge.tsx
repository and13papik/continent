
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
    <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 text-[10px] font-black uppercase tracking-widest shadow-sm">
      <ICONS.Calendar size={12} className="opacity-70" />
      <span>{activePeriod.label}</span>
      {activePeriod.status === 'closed' && (
        <ICONS.Lock size={10} className="text-rose-400" />
      )}
    </div>
  );
};

export default PeriodBadge;
