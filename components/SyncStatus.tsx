import React, { useState } from 'react';
import { AlertTriangle, Check, ChevronDown, Clock3, RefreshCw } from 'lucide-react';

interface SyncStatusProps {
  status: 'idle' | 'loading' | 'success' | 'error' | 'conflict';
  syncing: boolean;
  connected: boolean;
  needsReview: boolean;
  lastCheck: string | null;
  refresh: () => Promise<void>;
}

export default function SyncStatus({ status, syncing, connected, needsReview, lastCheck, refresh }: SyncStatusProps) {
  const [expanded, setExpanded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkFailed, setCheckFailed] = useState(false);
  const problem = !connected || status === 'error' || status === 'conflict' || needsReview || checkFailed;
  const busy = syncing || checking || status === 'loading';
  const saved = connected && status === 'success' && !busy && !problem;
  const label = !connected ? 'Облако не подключено'
    : status === 'conflict' || needsReview ? 'Есть спорные правки'
    : status === 'error' || checkFailed ? 'Синхронизация недоступна'
    : syncing ? 'Сохраняем…'
    : busy ? 'Проверяем…'
    : saved ? 'Все изменения сохранены' : 'Ожидаем синхронизации…';
  const detail = !connected ? 'Подключение к облаку не настроено.'
    : status === 'conflict' || needsReview ? 'Есть правки, требующие проверки. Откройте сравнение в меню.'
    : status === 'error' || checkFailed ? 'Не удалось подтвердить сохранение в облаке. Проверка повторится автоматически.'
    : syncing ? 'Отправляем изменения в облако.'
    : saved ? 'Изменения на этом устройстве сохранены в облаке.' : 'Проверяем состояние данных в облаке.';
  const check = async () => {
    setChecking(true); setCheckFailed(false);
    try { await refresh(); } catch { setCheckFailed(true); }
    finally { setChecking(false); }
  };
  return <div className={`ct-sync-status ${problem ? 'has-problem' : saved ? 'is-saved' : ''}`}>
    <button className="ct-sync-trigger" aria-label={label} aria-expanded={expanded || problem} aria-controls="ct-sync-details" onClick={() => setExpanded(value => !value)}>
      {problem ? <AlertTriangle size={15} aria-hidden="true" /> : busy ? <RefreshCw size={15} className="ct-spin" aria-hidden="true" /> : saved ? <Check size={15} aria-hidden="true" /> : <Clock3 size={15} aria-hidden="true" />}
      <span role="status">{label}</span><ChevronDown size={13} aria-hidden="true" />
    </button>
    {(expanded || problem) && <div id="ct-sync-details" className="ct-sync-details">
      <p>{detail}</p><p>Последняя успешная проверка: <strong>{lastCheck || 'ещё не выполнена'}</strong></p>
      <button className="ct-button" disabled={busy || !connected} onClick={() => { void check(); }}><RefreshCw size={14} />{checking ? 'Проверяем…' : 'Проверить сейчас'}</button>
    </div>}
  </div>;
}
