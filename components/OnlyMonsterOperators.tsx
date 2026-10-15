import React from 'react';
import { Activity, UserRound } from 'lucide-react';

export interface OperatorMetricRow {
  user_id: string;
  name: string;
  messages_count: number;
  paid_messages_count: number;
  sold_messages_count: number;
  earnings?: number;
  reply_time_avg?: number | null;
  creator_ids?: string[];
}

export const omMoney = (value: number | null | undefined) => typeof value === 'number' && Number.isFinite(value)
  ? '$' + value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';

export function OnlyMonsterOperators<T extends OperatorMetricRow>({ operators, view, formatDuration, onDetail, renderModels, isHandover }: {
  operators: T[];
  view: 'list' | 'cards';
  formatDuration: (value?: number | null) => string;
  onDetail: (operator: T) => void;
  renderModels: (operator: T) => React.ReactNode;
  isHandover: (operator: T) => boolean;
}) {
  const conversion = (op: T) => op.paid_messages_count > 0 ? `${Math.round(op.sold_messages_count / op.paid_messages_count * 100)}%` : '—';
  const person = (op: T) => <button className="om-person" onClick={() => onDetail(op)} aria-label={`Статистика ${op.name}`} title="Открыть статистику">
    <span className="om-avatar"><UserRound size={17} /></span>
    <span><strong>{op.name}</strong>{isHandover(op) && <small>Передал смену</small>}</span>
  </button>;
  if (!operators.length) return <p className="om-empty">По этому запросу операторы не найдены.</p>;
  if (view === 'cards') return <div className="om-operator-cards">{operators.map(op => <article key={op.user_id} className="om-operator-card">
    <header>{person(op)}<strong className="om-income" title="Доход от продаж в чатах · NET">{omMoney(op.earnings)}</strong></header>
    <div className="om-model-chips">{renderModels(op)}</div>
    <dl><div><dt>Сообщения</dt><dd>{op.messages_count}</dd></div><div><dt>Ср. ответ</dt><dd>{formatDuration(op.reply_time_avg)}</dd></div><div><dt title="PPV отправлено / продано">PPV <span className="sr-only">отправлено / продано</span></dt><dd>{op.paid_messages_count} / {op.sold_messages_count}</dd></div><div><dt>Конверсия</dt><dd>{conversion(op)}</dd></div></dl>
  </article>)}</div>;
  return <div className="om-table-scroll"><table className="om-operator-table"><thead><tr><th>Оператор</th><th>Сообщения</th><th>Ср. ответ</th><th>PPV<br />отпр. / прод.</th><th>Конверсия</th><th>Доход NET</th><th><span className="sr-only">Статистика</span></th></tr></thead>
    <tbody>{operators.map(op => <tr key={op.user_id}><td>{person(op)}<div className="om-model-chips">{renderModels(op)}</div></td><td>{op.messages_count}</td><td>{formatDuration(op.reply_time_avg)}</td><td>{op.paid_messages_count} / {op.sold_messages_count}</td><td>{conversion(op)}</td><td className="om-income">{omMoney(op.earnings)}</td><td><button className="om-detail-button" onClick={() => onDetail(op)} aria-label={`Статистика ${op.name}`}><Activity size={16} /></button></td></tr>)}</tbody>
  </table></div>;
}
