
import React from 'react';
import { AppState } from '../types';
import { ICONS } from '../constants';
import { ChevronDown } from 'lucide-react';

interface PeriodSelectorProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
  className?: string;
  compact?: boolean;
}

const PeriodSelector: React.FC<PeriodSelectorProps> = ({ state, updateState, className = "", compact = false }) => {
  const activePeriod = state.accountingPeriods.find(p => p.id === state.selectedPeriodId);
  const isClosed = activePeriod?.status === 'closed';
  
  const sortedPeriods = [...state.accountingPeriods].sort((a, b) => 
    new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  ).reverse();

  return <div className={`ct-period-selector ${compact ? 'is-compact' : ''} ${className}`}>
    <label htmlFor="active-period">Активный период {isClosed && <ICONS.Lock size={12} aria-label="Закрыт" />}</label>
    <select id="active-period" value={state.selectedPeriodId} onChange={e => updateState(prev => ({ ...prev, selectedPeriodId: e.target.value }))}>
      {sortedPeriods.map(p => <option key={p.id} value={p.id}>{p.label}{p.status === 'closed' ? ' 🔒' : ''}</option>)}
    </select>
    {compact && <ChevronDown className="ct-period-chevron" size={13} aria-hidden="true" />}
  </div>;
};

export default PeriodSelector;
