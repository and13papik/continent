import React from 'react';
import type { AppState } from '../types';

export function ShiftAnalysisSetting({ state, updateState, userRole }: {
  state: AppState;
  updateState: (updater: (previous: AppState) => AppState) => boolean | void;
  userRole?: 'user' | 'owner' | null;
}) {
  if (userRole !== 'owner') return null;
  const enabled = state.shiftAnalysisEnabled === true;
  return <section className="ct-card ct-settings-period" aria-labelledby="shift-analysis-setting-title">
    <div>
      <h2 id="shift-analysis-setting-title">Разбор смены</h2>
      <p className="ct-muted" id="shift-analysis-setting-description">Показывать блок в Метрике LIVE для Owner и админов. При отключении разборы и эксперименты сохраняются.</p>
    </div>
    <button type="button" role="switch" aria-checked={enabled} aria-label="Разбор смены"
      aria-describedby="shift-analysis-setting-description"
      className={`ct-button${enabled ? ' ct-button-primary' : ''}`}
      onClick={() => updateState(previous => ({ ...previous, shiftAnalysisEnabled: previous.shiftAnalysisEnabled !== true }))}>
      {enabled ? 'Включён' : 'Выключен'}
    </button>
  </section>;
}
