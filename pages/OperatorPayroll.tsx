import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, Check, Search, Wallet, LockKeyhole, UsersRound, ChevronDown, ArrowUpRight } from 'lucide-react';
import type { AppState, PaidStatus, OperationRecord } from '../types';
import { operatorPayrollRows } from '../operatorPayroll';
import { dashboardSummary } from '../dashboardSummary';
import { MetricCard, money } from '../components/RefinedUI';
import { OnlyFansLogo, PayPalLogo } from '../components/ServiceLogos';

type PayrollRow = ReturnType<typeof operatorPayrollRows>[number];
type Filter = 'all' | 'due' | 'partial' | 'paid';
const payable = (row: PayrollRow) => row.isPaid ? 0 : Math.max(0, row.remainder);
const paymentStatus = (row: PayrollRow) => row.isPaid || (row.paidOut > 0 && row.remainder <= 0)
  ? 'paid' : row.remainder > 0 ? (row.paidOut > 0 ? 'partial' : 'due') : 'empty';
const statusLabels = { paid: 'Выплачено', partial: 'Частично', due: 'К выплате', empty: 'Нет к выплате' };
const filters: { id: Filter; label: string }[] = [{ id: 'all', label: 'Все' }, { id: 'due', label: 'К выплате' }, { id: 'partial', label: 'Частично' }, { id: 'paid', label: 'Выплачено' }];
const matches = (row: PayrollRow, filter: Filter) => filter === 'all' || (filter === 'due' ? payable(row) > 0 : paymentStatus(row) === filter);

function Adjustments({ row }: { row: PayrollRow }) {
  return <div className="ct-payroll-tags">
    {row.bonuses > 0 && <span className="is-bonus">Бонус +{money(row.bonuses)}</span>}
    {row.penalties > 0 && <span className="is-penalty">Штраф −{money(row.penalties)}</span>}
    {row.advances > 0 && <span className="is-advance">Аванс {money(row.advances)}</span>}
    {row.refunds > 0 && <span>Возврат {money(row.refunds)}</span>}
    {row.bonuses === 0 && row.penalties === 0 && row.advances === 0 && row.refunds === 0 && <span>Без правок и авансов</span>}
  </div>;
}

function PayrollDetails({ row }: { row: PayrollRow }) {
  return <div className="ct-payroll-detail-content">
    <div className="ct-payroll-platform-details">
      {[{ name: 'OnlyFans', icon: <OnlyFansLogo />, gross: row.ofG, net: row.ofN }, { name: 'PayPal', icon: <PayPalLogo />, gross: row.ppG, net: row.ppN }, { name: 'Crypto', gross: row.crG, net: row.crN }].map(platform => <div key={platform.name}><h3>{platform.icon}{platform.name}</h3><span>Доход <b>{money(platform.gross)}</b></span><span>Начислено <b>{money(platform.net)}</b></span></div>)}
    </div>
    <div className="ct-payroll-detail-footer"><div><Adjustments row={row} /><p>Выплаты зарплаты: {money(row.salaryPayments)} · Авансы: {money(row.advances)}</p>{row.refunds > 0 && <p>Возвраты уже учтены в доходе и начислениях.</p>}{row.remainder < 0 && <p>Превышение выплат и удержаний над начислениями: {money(-row.remainder)}</p>}</div><Link to="/reports" state={{ operator: row.op }}>Полный расчёт <ArrowUpRight size={14} /></Link></div>
  </div>;
}

export default function OperatorPayroll({ state, updateState }: { state: AppState; updateState: (updater: (prev: AppState) => AppState) => boolean | void }) {
  const activePeriodId = state.selectedPeriodId;
  const activePeriod = state.accountingPeriods.find(p => p.id === activePeriodId);
  const rows = useMemo(() => operatorPayrollRows(state, activePeriodId), [state, activePeriodId]);
  const stats = useMemo(() => dashboardSummary(state, activePeriodId), [state, activePeriodId]);
  const remaining = rows.reduce((sum, row) => sum + (row.isPaid ? 0 : Math.max(0, row.remainder)), 0);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [view, setView] = useState<'compact' | 'platforms'>('compact');
  const [sort, setSort] = useState('remainder');
  const [expanded, setExpanded] = useState<string | null>(null);
  const searched = rows.filter(row => row.op.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim()));
  const filtered = searched.filter(row => matches(row, filter)).sort((a, b) => sort === 'name' ? a.op.localeCompare(b.op) : sort === 'accrued' ? b.accrued - a.accrued : payable(b) - payable(a));
  const columns = view === 'compact' ? 6 : 9;
  const toggleOperatorPaid = (op: string, currentRemainder: number) => {
    if (activePeriod?.status === 'closed') return;
    const existingStatus = state.paidStatuses.find(s => 
      s.entityName === op && 
      s.entityType === 'operator' && 
      s.periodId === activePeriodId
    );

    if (existingStatus) {
      if (!confirm(`Отменить статус "Выплачено" для ${op}? ВНИМАНИЕ: Автоматически созданная операция выплаты НЕ будет удалена. Если вы хотите аннулировать платеж, удалите его вручную в разделе "Операции".`)) return;
      
      if (updateState(prev => ({
        ...prev, 
        deletedIds: [...(prev.deletedIds || []), existingStatus.id],
        paidStatuses: prev.paidStatuses.filter(s => s.id !== existingStatus.id) 
      })) === false) return;
    } else {
      if (currentRemainder <= 0) {
        if (!confirm(`${activePeriod?.label} · ${op}\nНулевой или отрицательный остаток. Всё равно отметить как выплачено?`)) return;
      } else {
        if (!confirm(`Отметить выплату?\nОператор: ${op}\nПериод: ${activePeriod?.label}\nСумма: ${money(currentRemainder)}\nБудет создана запись выплаты зарплаты.`)) return;
      }

      if (updateState(prev => {
        let newOperations = [...prev.operationsData];
        if (currentRemainder > 0) {
          const autoPayment: OperationRecord = {
            id: `auto-sal-${op}-${Date.now()}`,
            type: 'salary_payment',
            operator: op,
            amount: currentRemainder,
            comment: 'Авто-выплата (ЗП операторов)',
            date: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            periodId: activePeriodId
          };
          newOperations = [autoPayment, ...newOperations];
        }

        const newStatus: PaidStatus = {
          id: `paid-op-${op}-${activePeriodId}-${Date.now()}`,
          entityName: op,
          entityType: 'operator',
          periodId: activePeriodId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        return { 
          ...prev, 
          operationsData: newOperations,
          paidStatuses: [...prev.paidStatuses, newStatus] 
        };
      }) === false) return;
    }
  };
  return <div className="ct-page ct-payroll">
    <header className="ct-page-heading"><h1>ЗП операторов</h1><Link to="/advance-request" className="ct-button"><Wallet size={16} />Заявки на аванс</Link></header>
    <div className="ct-payroll-summary"><MetricCard label="Начислено операторам" value={stats.netEarned + stats.bonuses - stats.penalties} icon={<UsersRound size={18} />} /><MetricCard label="Выплачено" value={stats.paidOut} icon={<Check size={18} />} /><MetricCard label="Осталось выплатить" value={remaining} icon={<Banknote size={18} />} tone="green" /></div>
    {activePeriod?.status === 'closed' && <p className="ct-notice"><LockKeyhole size={18} />Месяц закрыт. Ведомость доступна для просмотра; выплаты защищены от изменений.</p>}
    <section className="ct-card ct-ledger">
      <div className="ct-ledger-heading"><div><h2>Ведомость персонала</h2><p className="ct-muted">Выплачено — с учётом авансов. Итоги сверху — за весь месяц.</p></div><label className="ct-search"><Search size={17} /><input aria-label="Найти оператора" placeholder="Найти оператора" value={search} onChange={e => setSearch(e.target.value)} /></label></div>
      <div className="ct-payroll-tools">
        <div className="ct-payroll-filters" role="group" aria-label="Статус выплаты">{filters.map(item => <button key={item.id} type="button" aria-pressed={filter === item.id} onClick={() => setFilter(item.id)}>{item.label}<span>{searched.filter(row => matches(row, item.id)).length}</span></button>)}</div>
        <div className="ct-payroll-options"><label className="ct-payroll-sort">Сортировка<select aria-label="Сортировка операторов" value={sort} onChange={e => setSort(e.target.value)}><option value="remainder">По остатку</option><option value="accrued">По начислению</option><option value="name">По имени</option></select></label><div className="ct-payroll-view" role="group" aria-label="Вид ведомости"><button type="button" aria-pressed={view === 'compact'} onClick={() => setView('compact')}>Кратко</button><button type="button" aria-pressed={view === 'platforms'} onClick={() => setView('platforms')}>По платформам</button></div></div>
      </div>
      <div className="ct-table-scroll ct-payroll-scroll" role="region" aria-label="Ведомость операторов" tabIndex={0}><table className={`ct-payroll-table ct-payroll-${view}`}><thead><tr><th scope="col">Оператор</th>{view === 'compact' ? <><th scope="col">Начислено</th><th scope="col">Выплачено<small>включая авансы</small></th></> : <><th scope="col">Доход</th><th scope="col"><span className="ct-platform-heading"><OnlyFansLogo />OnlyFans</span><small>доход / начислено</small></th><th scope="col"><span className="ct-platform-heading"><PayPalLogo />PayPal</span><small>доход / начислено</small></th><th scope="col">Crypto<small>доход / начислено</small></th><th scope="col">Правки и авансы</th></>}<th scope="col">К выплате</th><th scope="col">Статус</th><th scope="col"><span className="sr-only">Действие</span></th></tr></thead><tbody>
        {filtered.map((row, index) => {
          const key = `${activePeriodId}:${row.op}`, open = expanded === key, status = paymentStatus(row), detailId = `payroll-detail-${index}`;
          return <React.Fragment key={key}><tr className={`ct-payroll-row ${row.isPaid ? 'ct-row-paid' : ''}`}>
            <th scope="row"><button type="button" className="ct-payroll-expand" aria-expanded={open} aria-controls={detailId} aria-label={`Расчёт ${row.op}`} onClick={() => setExpanded(open ? null : key)}><ChevronDown size={15} /><span>{row.op}</span></button></th>
            {view === 'compact' ? <><td data-label="Начислено"><strong className={row.accrued === 0 ? 'ct-zero' : ''}>{money(row.accrued)}</strong></td><td data-label="Выплачено с авансами"><strong className={row.paidOut === 0 ? 'ct-zero' : ''}>{money(row.paidOut)}</strong></td></> : <><td data-label="Доход"><strong className={row.totalGross === 0 ? 'ct-zero' : ''}>{money(row.totalGross)}</strong>{row.refunds > 0 && <small>Возвраты: {money(row.refunds)}</small>}</td>{[[row.ofG, row.ofN], [row.ppG, row.ppN], [row.crG, row.crN]].map(([gross, net], platform) => <td key={platform} data-label={['OnlyFans', 'PayPal', 'Crypto'][platform]}><div className={gross === 0 && net === 0 ? 'ct-zero' : ''}><small>{money(gross)}</small><strong>{money(net)}</strong></div></td>)}<td data-label="Правки и авансы"><Adjustments row={row} /></td></>}
            <td data-label="К выплате"><strong className={payable(row) > 0 ? 'ct-payable' : 'ct-zero'}>{money(payable(row))}</strong></td>
            <td data-label="Статус"><span className={`ct-payment-status is-${status}`}>{statusLabels[status]}</span></td>
            <td className="ct-payroll-action"><button type="button" className="ct-button" disabled={activePeriod?.status === 'closed'} onClick={() => toggleOperatorPaid(row.op, row.remainder)} aria-label={`${row.isPaid ? 'Отменить статус выплаты' : 'Отметить выплату'} ${row.op}`}>{row.isPaid ? <><Check size={14} />Снять отметку</> : 'Отметить выплату'}</button></td>
          </tr><tr className="ct-payroll-detail" hidden={!open} id={detailId}><td colSpan={columns}>{open && <PayrollDetails row={row} />}</td></tr></React.Fragment>;
        })}
        {filtered.length === 0 && <tr><td colSpan={columns} className="ct-empty">{rows.length === 0 ? 'В этом периоде нет операторов' : 'По выбранным условиям операторов нет'}{(search || filter !== 'all') && <button type="button" className="ct-button" onClick={() => { setSearch(''); setFilter('all'); }}>Сбросить фильтры</button>}</td></tr>}
      </tbody></table></div>
      <div className="ct-payroll-footer" role="status">Показано {filtered.length} из {rows.length} · К выплате в списке: <strong>{money(filtered.reduce((sum, row) => sum + payable(row), 0))}</strong></div>
    </section>
  </div>;
}