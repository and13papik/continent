import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Banknote, Check, Search, Wallet, LockKeyhole, UsersRound } from 'lucide-react';
import type { AppState, PaidStatus, OperationRecord } from '../types';
import { operatorPayrollRows } from '../operatorPayroll';
import { dashboardSummary } from '../dashboardSummary';
import { MetricCard, PeriodLabel, money } from '../components/RefinedUI';

export default function OperatorPayroll({ state, updateState }: { state: AppState; updateState: (updater: (prev: AppState) => AppState) => boolean | void }) {
  const activePeriodId = state.selectedPeriodId;
  const activePeriod = state.accountingPeriods.find(p => p.id === activePeriodId);
  const rows = useMemo(() => operatorPayrollRows(state, activePeriodId), [state, activePeriodId]);
  const stats = useMemo(() => dashboardSummary(state, activePeriodId), [state, activePeriodId]);
  const remaining = rows.reduce((sum, row) => sum + (row.isPaid ? 0 : Math.max(0, row.remainder)), 0);
  const [search, setSearch] = useState('');
  const filtered = rows.filter(row => row.op.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim()));
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
        if (!confirm(`У оператора ${op} нулевой или отрицательный остаток. Все равно отметить как выплачено?`)) return;
      } else {
        if (!confirm(`Создать операцию выплаты для ${op} на сумму $${currentRemainder.toFixed(1)} и отметить как выплачено?`)) return;
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
    <header className="ct-page-heading"><div><p className="ct-eyebrow">Рабочее пространство / Выплаты</p><h1>ЗП операторов</h1><PeriodLabel state={state} /></div><Link to="/advance-request" className="ct-button"><Wallet size={16} />Заявки на аванс</Link></header>
    <div className="ct-payroll-summary"><MetricCard label="Начислено операторам" value={stats.netEarned + stats.bonuses - stats.penalties} icon={<UsersRound size={18} />} /><MetricCard label="Выплачено" value={stats.paidOut} icon={<Check size={18} />} /><MetricCard label="Осталось выплатить" value={remaining} icon={<Banknote size={18} />} tone="green" /></div>
    {activePeriod?.status === 'closed' && <p className="ct-notice"><LockKeyhole size={18} />Месяц закрыт. Ведомость доступна для просмотра; выплаты защищены от изменений.</p>}
    <section className="ct-card ct-ledger"><div className="ct-ledger-heading"><div><h2>Ведомость персонала</h2><p className="ct-muted">Доход и начисления по платформам, правки и выплаты</p></div><label className="ct-search"><Search size={17} /><input aria-label="Найти оператора" placeholder="Найти оператора" value={search} onChange={e => setSearch(e.target.value)} /></label></div>
      <div className="ct-table-scroll" role="region" aria-label="Ведомость операторов — прокрутите для просмотра всех столбцов" tabIndex={0}><table className="ct-payroll-table"><thead><tr><th scope="col">Оператор</th><th scope="col">Доход</th><th scope="col">OnlyFans<small>доход / начислено</small></th><th scope="col">PayPal<small>доход / начислено</small></th><th scope="col">Crypto<small>доход / начислено</small></th><th scope="col">Правки и авансы</th><th scope="col">К выплате</th><th scope="col">Выплата</th></tr></thead><tbody>
        {filtered.map(row => <tr key={row.op} className={row.isPaid ? 'ct-row-paid' : ''}>
          <th scope="row"><Link to="/reports" state={{ operator: row.op }} className="ct-operator-link">{row.op}<small>{row.isPaid ? 'Отмечено как выплачено' : 'Открыть расчёт'}</small></Link></th>
          <td><strong>{money(row.totalGross)}</strong><div className="ct-row-progress" aria-label={`${row.percentOfMax.toFixed(0)}% от наибольшего дохода`}><span style={{ width: `${Math.max(0, Math.min(100, row.percentOfMax))}%` }} /></div>{row.refunds > 0 && <small>Возвраты: {money(row.refunds)}</small>}</td>
          {[[row.ofG, row.ofN], [row.ppG, row.ppN], [row.crG, row.crN]].map(([gross, net], index) => <td key={index}><small>{money(gross)}</small><strong>{money(net)}</strong></td>)}
          <td className="ct-adjustment-cell">{row.bonuses > 0 && <span>Бонус +{money(row.bonuses)}</span>}{row.penalties > 0 && <span>Штраф −{money(row.penalties)}</span>}{row.advances > 0 && <span>Аванс −{money(row.advances)}</span>}{row.refunds > 0 && <span>Возврат −{money(row.refunds)}</span>}{row.bonuses === 0 && row.penalties === 0 && row.advances === 0 && row.refunds === 0 && <span>—</span>}</td>
          <td><strong className="ct-payable">{money(row.isPaid ? 0 : Math.max(0, row.remainder))}</strong></td>
          <td><button className={`ct-button ${row.isPaid ? '' : 'ct-button-primary'}`} disabled={activePeriod?.status === 'closed'} onClick={() => toggleOperatorPaid(row.op, row.remainder)} aria-label={`${row.isPaid ? 'Отменить статус выплаты' : 'Выплатить'} ${row.op}`}>{row.isPaid ? <><Check size={15} />Выплачено</> : 'Выплатить'}</button></td>
        </tr>)}
        {filtered.length === 0 && <tr><td colSpan={8} className="ct-empty">{search ? 'Оператор не найден' : 'В этом периоде нет операторов'}</td></tr>}
      </tbody></table></div>
    </section>
  </div>;
}
