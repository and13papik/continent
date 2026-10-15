import React, { lazy, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Banknote, Check, Search, Wallet, LockKeyhole, UsersRound, ChevronDown, ArrowUpRight, Plus, List, LayoutGrid } from 'lucide-react';
import type { AppState } from '../types';
import { operatorPayrollRows } from '../operatorPayroll';
import { dashboardSummary } from '../dashboardSummary';
import { MetricCard, money } from '../components/RefinedUI';
import { OnlyFansLogo, PayPalLogo } from '../components/ServiceLogos';
import PayrollPaymentDialog from '../components/PayrollPaymentDialog';
import { operatorPayrollOperations } from '../financialCalculations';

import OperatorManagementDialog from '../components/OperatorManagementDialog';
const Reports = lazy(() => import('./Reports'));

const operatorUrl = (operator: string) => '/operator-payroll?operator=' + encodeURIComponent(operator);

type PayrollRow = ReturnType<typeof operatorPayrollRows>[number];
type Filter = 'all' | 'due' | 'partial' | 'paid';
function readPreference<T extends string>(key: string, allowed: T[], fallback: T): T {
  try { const saved = localStorage.getItem(`continental_payroll_${key}_v1`); return allowed.includes(saved as T) ? saved as T : fallback; } catch { return fallback; }
}
const payable = (row: PayrollRow) => row.isPaid ? 0 : Math.max(0, row.remainder);
const paymentStatus = (row: PayrollRow) => row.isPaid || (row.paidOut > 0 && row.remainder <= 0)
  ? 'paid' : row.remainder > 0 ? (row.paidOut > 0 ? 'partial' : 'due') : 'empty';
const statusLabels = { paid: 'Выплачено', partial: 'Частично', due: 'К выплате', empty: 'Нет к выплате' };
const filters: { id: Filter; label: string }[] = [{ id: 'all', label: 'Все' }, { id: 'due', label: 'К выплате' }, { id: 'partial', label: 'Частично' }, { id: 'paid', label: 'Выплачено' }];
const matches = (row: PayrollRow, filter: Filter) => filter === 'all' || (filter === 'due' ? payable(row) > 0 : paymentStatus(row) === filter);

function Adjustments({ row, compact = false }: { row: PayrollRow; compact?: boolean }) {
  const empty = row.bonuses === 0 && row.penalties === 0 && row.advances === 0 && row.refunds === 0 && (!compact || row.salaryPayments === 0);
  return <div className={`ct-payroll-tags${compact ? ' ct-payroll-tags-compact' : ''}`}>
    {compact && row.salaryPayments > 0 && <span className="is-salary">ЗП <b>{money(row.salaryPayments)}</b></span>}
    {row.advances > 0 && <span className="is-advance">Аванс <b>{money(row.advances)}</b></span>}
    {row.penalties > 0 && <span className="is-penalty">Штраф <b>−{money(row.penalties)}</b></span>}
    {row.bonuses > 0 && <span className="is-bonus">Бонус <b>+{money(row.bonuses)}</b></span>}
    {row.refunds > 0 && <span>Возврат <b>{money(row.refunds)}</b></span>}
    {empty && (compact ? <span className="ct-adjustments-empty" aria-label="Нет выплат и правок">—</span> : <span>Без правок и авансов</span>)}
  </div>;
}

function PayrollDetails({ row, state, periodId }: { row: PayrollRow; state: AppState; periodId: string }) {
  const history = operatorPayrollOperations(state.operationsData.filter(operation => operation.periodId === periodId), row.op)
    .filter(operation => operation.type === 'advance' || operation.type === 'salary_payment')
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  return <div className="ct-payroll-detail-content">
    <div className="ct-payroll-formula" aria-label="Формула расчёта">
      {[['Начисления', row.totalNet], ['+ Бонусы', row.bonuses], ['− Штрафы', row.penalties], ['− Авансы', row.advances], ['− Выплаты ЗП', row.salaryPayments], ['= Остаток', row.remainder]].map(([label, value]) => <div key={label}><span>{label}</span><strong>{money(value as number)}</strong></div>)}
    </div>
    <p className="ct-formula-note">Начисления уже учитывают возвраты. Штрафы включают удержания за стажировку.{row.isPaid && row.remainder > 0.005 && ' Есть отметка «Выплачено»: в ведомости к выплате показан ноль, расчётный остаток указан выше.'}</p>
    <div className="ct-payroll-platform-details">
      {[{ name: 'OnlyFans', icon: <OnlyFansLogo />, gross: row.ofG, net: row.ofN }, { name: 'PayPal', icon: <PayPalLogo />, gross: row.ppG, net: row.ppN }, { name: 'Crypto', gross: row.crG, net: row.crN }].map(platform => <div key={platform.name}><h3>{platform.icon}{platform.name}</h3><span>Доход <b>{money(platform.gross)}</b></span><span>Начислено <b>{money(platform.net)}</b></span></div>)}
    </div>
    <div className="ct-payroll-detail-footer"><div><Adjustments row={row} /><p>Выплаты зарплаты: {money(row.salaryPayments)} · Авансы: {money(row.advances)}</p>{row.refunds > 0 && <p>Возвраты уже учтены в доходе и начислениях.</p>}{row.remainder < 0 && <p>Превышение выплат и удержаний над начислениями: {money(-row.remainder)}</p>}</div><Link to={operatorUrl(row.op)}>Полный расчёт <ArrowUpRight size={14} /></Link></div>
    <section className="ct-payment-history" aria-label={`История выплат ${row.op}`}><h3>История выплат <span>{history.length}</span></h3>{history.length === 0 ? <p>Авансов и выплат за этот месяц пока нет.</p> : <ol>{history.map(operation => <li key={operation.id}><time dateTime={operation.date}>{/^\d{4}-\d{2}-\d{2}$/.test(operation.date) ? operation.date.split('-').reverse().join('.') : operation.date}</time><span className={operation.type === 'advance' ? 'is-advance' : ''}>{operation.type === 'advance' ? 'Аванс' : 'Зарплата'}</span><strong>{money(operation.amount)}</strong><p>{operation.comment || 'Без комментария'}</p></li>)}</ol>}</section>
  </div>;
}

export default function OperatorPayroll({ state, updateState }: { state: AppState; updateState: (updater: (prev: AppState) => AppState) => boolean | void }) {
  const [params, setParams] = useSearchParams();
  const selectedOperator = params.get('operator');
  const [layout, setLayout] = useState<'list' | 'cards'>(() => readPreference('layout', ['list', 'cards'], 'list'));
  const [managing, setManaging] = useState(false);
  useEffect(() => { try { localStorage.setItem('continental_payroll_layout_v1', layout); } catch {} }, [layout]);
  const activePeriodId = state.selectedPeriodId;
  const activePeriod = state.accountingPeriods.find(p => p.id === activePeriodId);
  const rows = useMemo(() => operatorPayrollRows(state, activePeriodId), [state, activePeriodId]);
  const stats = useMemo(() => dashboardSummary(state, activePeriodId), [state, activePeriodId]);
  const remaining = rows.reduce((sum, row) => sum + (row.isPaid ? 0 : Math.max(0, row.remainder)), 0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [view, setView] = useState<'compact' | 'platforms'>(() => readPreference('view', ['compact', 'platforms'], 'compact'));
  const [sort, setSort] = useState(() => readPreference('sort', ['remainder', 'accrued', 'name'], 'remainder'));
  const [payment, setPayment] = useState<{ operator: string; periodId: string } | null>(null);
  useEffect(() => { try { localStorage.setItem('continental_payroll_view_v1', view); } catch {} }, [view]);
  useEffect(() => { try { localStorage.setItem('continental_payroll_sort_v1', sort); } catch {} }, [sort]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const searched = rows.filter(row => row.op.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim()));
  const filtered = searched.filter(row => matches(row, filter)).sort((a, b) => sort === 'name' ? a.op.localeCompare(b.op) : sort === 'accrued' ? b.accrued - a.accrued : payable(b) - payable(a));
  const columns = view === 'compact' ? 6 : 9;
  const removePaidMarker = (op: string) => {
    if (activePeriod?.status !== 'open') return;
    if (!confirm(`Снять отметку «Выплачено» для ${op}? Записи выплат сохранятся. Для исправления платежа используйте раздел «Операции».`)) return;
    updateState(previous => {
      if (previous.selectedPeriodId !== activePeriodId || previous.accountingPeriods.find(period => period.id === activePeriodId)?.status !== 'open') return previous;
      const removed = previous.paidStatuses.filter(item => item.entityName === op && item.entityType === 'operator' && item.periodId === activePeriodId);
      return { ...previous, deletedIds: [...new Set([...previous.deletedIds, ...removed.map(item => item.id)])], paidStatuses: previous.paidStatuses.filter(item => !removed.includes(item)) };
    });
  };
  const paymentDialog = payment && <PayrollPaymentDialog key={`${payment.periodId}:${payment.operator}`} state={state} operator={payment.operator} periodId={payment.periodId} updateState={updateState} close={() => setPayment(null)} />;
  if (selectedOperator) {
    const row = rows.find(item => item.op === selectedOperator);
    if (!row) return <div className="ct-card ct-empty"><p>У этого оператора нет записей в выбранном периоде.</p><button className="ct-button" onClick={() => setParams({})}>К списку операторов</button></div>;
    return <><div className="ct-legacy"><Reports key={`${activePeriodId}:${selectedOperator}`} state={state} updateState={updateState} selectedOperator={selectedOperator} setSelectedOperator={operator => setParams({ operator })} onBack={() => setParams({})} onPay={() => setPayment({ operator: selectedOperator, periodId: activePeriodId })} payDisabled={activePeriod?.status !== 'open' || row.isPaid || Math.round(row.remainder * 100) <= 0} /></div>{paymentDialog}</>;
  }
  return <div className="ct-page ct-payroll">
    <header className="ct-page-heading"><h1>ЗП операторов</h1><div className="ct-payroll-heading-actions"><Link to="/advance-request" className="ct-button"><Wallet size={16} />Заявки на аванс</Link><button type="button" className="ct-button ct-primary" onClick={() => setManaging(true)}><Plus size={16} />Добавить оператора</button></div></header>
    <div className="ct-payroll-summary"><MetricCard label="Начислено операторам" value={stats.netEarned + stats.bonuses - stats.penalties} icon={<UsersRound size={18} />} /><MetricCard label="Выплачено" value={stats.paidOut} icon={<Check size={18} />} /><MetricCard label="Осталось выплатить" value={remaining} icon={<Banknote size={18} />} tone="green" /></div>
    {activePeriod?.status === 'closed' && <p className="ct-notice"><LockKeyhole size={18} />Месяц закрыт. Ведомость доступна для просмотра; выплаты защищены от изменений.</p>}
    <section className="ct-card ct-ledger">
      <div className="ct-ledger-heading"><div><h2>Ведомость персонала</h2><p className="ct-muted">Выплачено — с учётом авансов. Итоги сверху — за весь месяц.</p></div><label className="ct-search"><Search size={17} /><input aria-label="Найти оператора" placeholder="Найти оператора" value={search} onChange={e => setSearch(e.target.value)} /></label></div>
      <div className="ct-payroll-tools">
        <div className="ct-payroll-filters" role="group" aria-label="Статус выплаты">{filters.map(item => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}<span>{searched.filter(row => matches(row, item.id)).length}</span></button>)}</div>
        <div className="ct-payroll-options"><div className="ct-payroll-view ct-payroll-layout" role="group" aria-label="Отображение операторов"><button type="button" aria-pressed={layout === 'list'} onClick={() => setLayout('list')}><List size={14} />Список</button><button type="button" aria-pressed={layout === 'cards'} onClick={() => setLayout('cards')}><LayoutGrid size={14} />Карточки</button></div><label className="ct-payroll-sort">Сортировка<select aria-label="Сортировка операторов" value={sort} onChange={e => setSort(e.target.value)}><option value="remainder">По остатку</option><option value="accrued">По начислению</option><option value="name">По имени</option></select></label><div className="ct-payroll-view" role="group" aria-label="Вид ведомости"><button type="button" aria-pressed={view === 'compact'} onClick={() => setView('compact')}>Кратко</button><button type="button" aria-pressed={view === 'platforms'} onClick={() => setView('platforms')}>По платформам</button></div></div>
      </div>
      {layout === 'cards' ? <div className="ct-payroll-cards" role="region" aria-label="Карточки операторов">
        {filtered.map(row => <article key={row.op} className="ct-payroll-person" aria-label={`Оператор ${row.op}`}>
          <header><Link className="ct-payroll-person-link" to={operatorUrl(row.op)} aria-label={`Отчёт ${row.op}`}><span className="ct-avatar">{row.op.replace(/^@/, '').slice(0, 2).toUpperCase()}</span><strong>{row.op}</strong><ArrowUpRight size={15} /></Link><span className={`ct-payment-status is-${paymentStatus(row)}`}>{statusLabels[paymentStatus(row)]}</span></header>
          <div className="ct-payroll-person-totals"><div><span>Начислено</span><strong>{money(row.accrued)}</strong></div><div><span>Выплачено</span><strong>{money(row.paidOut)}</strong></div></div>
          {view === 'platforms' && <div className="ct-payroll-card-platforms">{[{name:'OnlyFans', icon:<OnlyFansLogo />, gross:row.ofG, net:row.ofN}, {name:'PayPal', icon:<PayPalLogo />, gross:row.ppG, net:row.ppN}, {name:'Crypto', icon:<Banknote size={14} />, gross:row.crG, net:row.crN}].map(platform => <div key={platform.name}><span>{platform.icon}{platform.name}</span><small>Доход {money(platform.gross)}</small><strong>Начислено {money(platform.net)}</strong></div>)}</div>}
          <div className="ct-payroll-card-adjustments"><Adjustments row={row} compact /></div>
          <footer><div><span>К выплате</span><strong className={payable(row) > 0 ? 'ct-payable' : 'ct-zero'}>{money(payable(row))}</strong></div><div className="ct-payroll-action"><button type="button" className="ct-button ct-pay-button" disabled={activePeriod?.status !== 'open' || row.isPaid || Math.round(row.remainder * 100) <= 0} onClick={() => setPayment({operator:row.op, periodId:activePeriodId})} aria-label={`PAY ${row.op}`}>PAY</button>{row.isPaid && <button type="button" className="ct-remove-paid" disabled={activePeriod?.status !== 'open'} onClick={() => removePaidMarker(row.op)} aria-label={`Отменить статус выплаты ${row.op}`}>Снять отметку</button>}</div></footer>
        </article>)}
        {filtered.length === 0 && <div className="ct-empty"><p>По выбранным условиям операторов нет</p><button className="ct-button" onClick={() => {setSearch('');setFilter('all');}}>Сбросить фильтры</button></div>}
      </div> : <div className="ct-table-scroll ct-payroll-scroll" role="region" aria-label="Ведомость операторов" tabIndex={0}><table className={`ct-payroll-table ct-payroll-${view}`}><thead><tr><th scope="col">Оператор</th>{view === 'compact' ? <><th scope="col">Начислено</th><th scope="col">Выплаты и правки</th></> : <><th scope="col">Доход</th><th scope="col"><span className="ct-platform-heading"><OnlyFansLogo />OnlyFans</span><small>доход / начислено</small></th><th scope="col"><span className="ct-platform-heading"><PayPalLogo />PayPal</span><small>доход / начислено</small></th><th scope="col">Crypto<small>доход / начислено</small></th><th scope="col">Правки и авансы</th></>}<th scope="col">К выплате</th><th scope="col">Статус</th><th scope="col"><span className="sr-only">Действие</span></th></tr></thead><tbody>
        {filtered.map((row, index) => {
          const key = `${activePeriodId}:${row.op}`, open = expanded === key, status = paymentStatus(row), detailId = `payroll-detail-${index}`;
          return <React.Fragment key={key}><tr className={`ct-payroll-row ${row.isPaid ? 'ct-row-paid' : ''}`}>
            <th scope="row"><div className="ct-payroll-operator-cell"><button type="button" className="ct-payroll-expand" aria-expanded={open} aria-controls={detailId} aria-label={`Расчёт ${row.op}`} onClick={() => setExpanded(open ? null : key)}><ChevronDown size={15} /></button><Link className="ct-payroll-name" to={operatorUrl(row.op)} aria-label={`Отчёт ${row.op}`}>{row.op}</Link></div></th>
            {view === 'compact' ? <><td data-label="Начислено"><strong className={row.accrued === 0 ? 'ct-zero' : ''}>{money(row.accrued)}</strong></td><td data-label="Выплаты и правки" className="ct-payroll-adjustments"><Adjustments row={row} compact /></td></> : <><td data-label="Доход"><strong className={row.totalGross === 0 ? 'ct-zero' : ''}>{money(row.totalGross)}</strong>{row.refunds > 0 && <small>Возвраты: {money(row.refunds)}</small>}</td>{[[row.ofG, row.ofN], [row.ppG, row.ppN], [row.crG, row.crN]].map(([gross, net], platform) => <td key={platform} data-label={['OnlyFans', 'PayPal', 'Crypto'][platform]}><div className={gross === 0 && net === 0 ? 'ct-zero' : ''}><small>{money(gross)}</small><strong>{money(net)}</strong></div></td>)}<td data-label="Правки и авансы"><Adjustments row={row} /></td></>}
            <td data-label="К выплате"><strong className={payable(row) > 0 ? 'ct-payable' : 'ct-zero'}>{money(payable(row))}</strong></td>
            <td data-label="Статус"><span className={`ct-payment-status is-${status}`}>{statusLabels[status]}</span></td>
            <td className="ct-payroll-action"><button type="button" className="ct-button ct-pay-button" disabled={activePeriod?.status !== 'open' || row.isPaid || Math.round(row.remainder * 100) <= 0} onClick={() => setPayment({ operator: row.op, periodId: activePeriodId })} aria-label={`PAY ${row.op}`}>PAY</button>{row.isPaid && <button type="button" className="ct-remove-paid" disabled={activePeriod?.status !== 'open'} onClick={() => removePaidMarker(row.op)} aria-label={`Отменить статус выплаты ${row.op}`}>Снять отметку</button>}</td>
          </tr><tr className="ct-payroll-detail" hidden={!open} id={detailId}><td colSpan={columns}>{open && <PayrollDetails row={row} state={state} periodId={activePeriodId} />}</td></tr></React.Fragment>;
        })}
        {filtered.length === 0 && <tr><td colSpan={columns} className="ct-empty">{rows.length === 0 ? 'В этом периоде нет операторов' : 'По выбранным условиям операторов нет'}{(search || filter !== 'all') && <button type="button" className="ct-button" onClick={() => { setSearch(''); setFilter('all'); }}>Сбросить фильтры</button>}</td></tr>}
      </tbody></table></div>}
      <div className="ct-payroll-footer" role="status">Показано {filtered.length} из {rows.length} · К выплате в списке: <strong>{money(filtered.reduce((sum, row) => sum + payable(row), 0))}</strong></div>
    </section>
    {paymentDialog}
    {managing && <OperatorManagementDialog state={state} updateState={updateState} close={() => setManaging(false)} />}
  </div>;
}
