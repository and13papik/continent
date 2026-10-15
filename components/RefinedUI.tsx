import React from 'react';
import { CalendarDays, LockKeyhole } from 'lucide-react';
import type { AppState } from '../types';

const dollars = new Intl.NumberFormat('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const money = (value: number) => `${value < 0 ? '−' : ''}$${dollars.format(Math.abs(value))}`;

export function MoneyAmount({ value }: { value: number }) {
  const [whole, cents] = money(value).split(',');
  return <>{whole}<small className="ct-cents">,{cents}</small></>;
}

export function PeriodLabel({ state }: { state: AppState }) {
  const period = state.accountingPeriods.find(p => p.id === state.selectedPeriodId);
  return <span className="ct-period-label"><CalendarDays size={15} />{period?.label || 'Выберите период'}{period?.status === 'closed' && <LockKeyhole size={13} aria-label="Период закрыт" />}</span>;
}

export function MetricCard({ label, value, icon, tone }: { label: string; value: number; icon?: React.ReactNode; tone?: string }) {
  return <section className={`ct-card ct-metric ${tone ? `ct-tone-${tone}` : ''}`} aria-label={label}>
    <h2>{icon}{label}</h2><strong><MoneyAmount value={value} /></strong>
  </section>;
}
