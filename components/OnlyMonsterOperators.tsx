import React from 'react';
import { Activity, Award, UserRound } from 'lucide-react';

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

export function OnlyMonsterOperators<T extends OperatorMetricRow>({ operators, view, formatDuration, onDetail, renderModels, isHandover, getRank, highlightRanks }: {
  operators: T[];
  view: 'list' | 'cards';
  formatDuration: (value?: number | null) => string;
  onDetail: (operator: T) => void;
  renderModels: (operator: T, avatars?: boolean) => React.ReactNode;
  isHandover: (operator: T) => boolean;
  getRank: (operator: T) => number;
  highlightRanks: boolean;
}) {
  const conversion = (op: T) => op.paid_messages_count > 0 ? `${Math.round(op.sold_messages_count / op.paid_messages_count * 100)}%` : '—';
  const person = (op: T) => <button className="om-person" onClick={() => onDetail(op)} aria-label={`Статистика ${op.name}`} title="Открыть статистику">
    <span className="om-avatar"><UserRound size={17} /></span>
    <span><strong>{op.name}</strong>{isHandover(op) && <small>Передал смену</small>}</span>
  </button>;
  if (!operators.length) return <p className="om-empty">По этому запросу операторы не найдены.</p>;
  if (view === 'cards') return <div className="om-operator-cards">{operators.map(op => {
    const rank = getRank(op);
    const podium = highlightRanks && rank <= 3 ? rank : undefined;
    const rate = op.paid_messages_count > 0 ? Math.min(100, Math.max(0, op.sold_messages_count / op.paid_messages_count * 100)) : 0;
    return <article key={op.user_id} className="om-operator-card" data-podium={podium}>
      <header>
        <div className="om-card-identity">
          <span className="om-rank" title={`Позиция по текущей сортировке: ${rank}`} aria-label={`Позиция ${rank}`}>{podium === 1 ? <Award size={13} /> : `#${rank}`}</span>
          <div className="om-model-avatars">{renderModels(op, true)}</div>
          <button className="om-person om-card-person" onClick={() => onDetail(op)} aria-label={`Статистика ${op.name}`} title={op.name}>
            <span><strong>{op.name}</strong><small>{isHandover(op) ? 'Передал смену' : `ID: ${op.user_id}`}</small></span>
          </button>
        </div>
        <div className="om-card-actions">
          <span className="om-earnings-badge" title="Доход от продаж в чатах · NET"><strong>{omMoney(op.earnings)}</strong><small>NET</small></span>
          <button className="om-detail-button" onClick={() => onDetail(op)} aria-label={`Статистика ${op.name}`}><Activity size={14} /></button>
        </div>
      </header>
      <dl>
        <div><dt>Сообщения</dt><dd>{op.messages_count}</dd></div>
        <div><dt>Ср. ответ</dt><dd>{formatDuration(op.reply_time_avg)}</dd></div>
        <div className="om-stat-sent"><dt>PPV отпр.</dt><dd>{op.paid_messages_count}</dd></div>
        <div className="om-stat-sold"><dt>PPV прод.</dt><dd>{op.sold_messages_count}</dd></div>
      </dl>
      <footer className="om-conversion"><span>Конверсия PPV</span><span className="om-conversion-track" aria-hidden="true"><i style={{ width: `${rate}%` }} /></span><strong>{conversion(op)}</strong></footer>
    </article>;
  })}</div>;
  return <div className="om-table-scroll"><table className="om-operator-table"><thead><tr><th>Оператор</th><th>Сообщения</th><th>Ср. ответ</th><th>PPV<br />отпр. / прод.</th><th>Конверсия</th><th>Доход NET</th><th><span className="sr-only">Статистика</span></th></tr></thead>
    <tbody>{operators.map(op => <tr key={op.user_id}><td>{person(op)}<div className="om-model-chips">{renderModels(op)}</div></td><td>{op.messages_count}</td><td>{formatDuration(op.reply_time_avg)}</td><td>{op.paid_messages_count} / {op.sold_messages_count}</td><td>{conversion(op)}</td><td className="om-income">{omMoney(op.earnings)}</td><td><button className="om-detail-button" onClick={() => onDetail(op)} aria-label={`Статистика ${op.name}`}><Activity size={16} /></button></td></tr>)}</tbody>
  </table></div>;
}
