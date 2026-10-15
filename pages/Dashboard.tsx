import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Landmark, AlertTriangle, LockKeyhole, Plus, Gift, Undo2, Wallet, ArrowUpRight, X, RotateCcw, CircleDollarSign, ArrowLeftRight, Bitcoin, Info } from 'lucide-react';
import { startNextPeriod } from '../accountingPeriods';
import type { AppState, AccountingPeriod } from '../types';
import { dashboardSummary } from '../dashboardSummary';
import { getOrphanedRecordsBreakdown, getOrphanedRecordsSignature, isOrphanedBannerDismissed, dismissOrphanedBanner } from '../store';
import { MetricCard, PeriodLabel, MoneyAmount, money } from '../components/RefinedUI';

interface DashboardProps {
  state: AppState;
  userRole: 'user' | 'owner' | null;
  updateState: (updater: (prev: AppState) => AppState) => boolean | void;
  headerControls?: React.ReactNode;
}

export default function Dashboard({ state, userRole, updateState, headerControls }: DashboardProps) {
  const activePeriodId = state.selectedPeriodId;
  const activePeriod = state.accountingPeriods.find(p => p.id === activePeriodId);
  // Проверка на наличие "бездомных" записей (из-за которых данные могли "пропасть" или остаться после удаления месяцев)
  const homelessBreakdown = useMemo(() => {
    return getOrphanedRecordsBreakdown(state);
  }, [state]);

  const orphanedSignature = useMemo(() => {
    return getOrphanedRecordsSignature(state);
  }, [state]);

  const [isBannerDismissed, setIsBannerDismissed] = useState(() => {
    return isOrphanedBannerDismissed(orphanedSignature);
  });

  // Если состав архивных записей изменится, снова показываем уведомление
  useEffect(() => {
    setIsBannerDismissed(isOrphanedBannerDismissed(orphanedSignature));
  }, [orphanedSignature]);

  // Слушаем изменение статуса скрытия из настроек или других вкладок
  useEffect(() => {
    const handleBannerChange = () => {
      setIsBannerDismissed(isOrphanedBannerDismissed(orphanedSignature));
    };
    window.addEventListener('continental_orphaned_banner_changed', handleBannerChange);
    window.addEventListener('storage', handleBannerChange);
    return () => {
      window.removeEventListener('continental_orphaned_banner_changed', handleBannerChange);
      window.removeEventListener('storage', handleBannerChange);
    };
  }, [orphanedSignature]);

  const handleDismissBanner = () => {
    dismissOrphanedBanner(orphanedSignature);
    setIsBannerDismissed(true);
  };

  const repairHomeless = () => {
    const confirmRepair = confirm(`Обнаружено ${homelessBreakdown.total} записей без привязки к периоду. Создать для них новый период "Восстановленные данные"?`);
    if (!confirmRepair) return;

    if (updateState(prev => {
      const newPeriod: AccountingPeriod = {
        id: `recovered-${Date.now()}`,
        label: `Восстановлено ${new Date().toLocaleDateString()}`,
        startAt: new Date().toISOString(),
        endAt: null,
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      const periodIds = new Set(prev.accountingPeriods.map(p => p.id));
      
      return {
        ...prev,
        accountingPeriods: [...prev.accountingPeriods, newPeriod],
        selectedPeriodId: newPeriod.id,
        incomeData: prev.incomeData.map(i => periodIds.has(i.periodId) ? i : { ...i, periodId: newPeriod.id }),
        operationsData: prev.operationsData.map(o => periodIds.has(o.periodId) ? o : { ...o, periodId: newPeriod.id }),
        ownerManualIncomes: (prev.ownerManualIncomes || []).map(m => periodIds.has(m.periodId) ? m : { ...m, periodId: newPeriod.id })
      };
    }) === false) return;
    alert('Данные успешно возвращены в систему!');
  };
  const handleCloseMonth = () => {
    if (!activePeriod || activePeriod.status === 'closed') return;
    if (!window.confirm(`Закрыть период "${activePeriod.label}"? Его записи будут защищены от изменений. Вы перейдёте на следующий месяц. Овнер сможет открыть период для исправлений в Настройках.`)) return;
    if (updateState(prev => startNextPeriod(prev, activePeriodId, true)) === false) return;
  };

  const handleStartNextMonth = () => {
    if (updateState(prev => startNextPeriod(prev, activePeriodId)) === false) return;
  };
  const sortedPeriodsForCheck = [...state.accountingPeriods].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const isLatestPeriod = sortedPeriodsForCheck[sortedPeriodsForCheck.length - 1]?.id === activePeriodId;
  const stats = useMemo(() => dashboardSummary(state, activePeriodId), [state, activePeriodId]);
  const progress = stats.totalTarget > 0 ? Math.max(0, Math.min(100, stats.totalGross / stats.totalTarget * 100)) : 0;
  return <div className="ct-page ct-dashboard">
    <header className="ct-page-heading">
      <div><h1>Dashboard</h1><PeriodLabel state={state} /></div>
      {headerControls}
    </header>
    {homelessBreakdown.total > 0 && !isBannerDismissed && <section className="ct-notice" role="status">
      <AlertTriangle size={22} /><div><h2>Архивные записи удалённых периодов · {homelessBreakdown.total}</h2><p>Доходов: {homelessBreakdown.incomeCount}, операций: {homelessBreakdown.operationsCount}, ручных доходов: {homelessBreakdown.manualIncomesCount}, расходов: {homelessBreakdown.expensesCount}. Записи сохранены без изменений.</p><div className="ct-actions"><button className="ct-button" onClick={handleDismissBanner}><X size={15} />Скрыть уведомление</button><button className="ct-button" onClick={repairHomeless}><RotateCcw size={15} />Восстановить в период</button></div></div>
    </section>}
    <div className="ct-overview-grid">
      <section className="ct-card ct-total" aria-label="Тотал общий">
        <div className="ct-total-heading"><div><h2 className="ct-eyebrow">Тотал общий</h2><p className="ct-total-value" data-testid="dashboard-total"><MoneyAmount value={stats.totalGross} /></p></div><span className="ct-bank" aria-hidden="true"><Landmark size={29} /></span></div>
        <div className="ct-platforms">
          {[{ label: 'OnlyFans', value: stats.of.gross, Icon: CircleDollarSign }, { label: 'PayPal', value: stats.pp.gross, Icon: ArrowLeftRight }, { label: 'Crypto', value: stats.cr.gross, Icon: Bitcoin }].map(({ label, value, Icon }) => <div key={label}><span><Icon size={14} aria-hidden="true" />{label}</span><strong>{money(value)}</strong></div>)}
        </div>
        {(stats.manualGross !== 0 || stats.refunds !== 0) && <div className="ct-income-notes">{stats.manualGross !== 0 && <span>Прочий доход: {money(stats.manualGross)}</span>}{stats.refunds !== 0 && <span>Возвраты: −{money(stats.refunds)}</span>}</div>}
        <div className="ct-goal"><div className="ct-goal-caption"><span>Цель месяца <strong>{money(stats.totalTarget)}</strong></span><strong>{stats.totalTarget > 0 ? `${(stats.totalGross / stats.totalTarget * 100).toLocaleString('ru-RU', { maximumFractionDigits: 1 })}%` : 'Не задана'}</strong></div>
          <div className="ct-progress" role="progressbar" aria-label="Выполнение цели месяца" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${progress}%` }} /></div>
          {stats.totalTarget > 0 && <div className="ct-goal-remaining"><span>{stats.totalGross >= stats.totalTarget ? 'Цель достигнута' : 'До цели месяца'}</span><span>{money(Math.max(0, stats.totalTarget - stats.totalGross))}</span></div>}
          <div className="ct-forecast"><span>Прогноз месяца</span><strong>{money(stats.forecast)}</strong></div>
        </div>
      </section>
      <aside className="ct-overview-side">
        <section className="ct-card ct-admins" aria-label="Админ-состав"><div className="ct-admin-title"><h2>Админ-состав</h2><details className="ct-info"><summary aria-label="Как рассчитаны начисления админов"><Info size={16} /></summary><p>Начисления за выбранный период рассчитываются от общего дохода месяца по ставке каждого админа.</p></details></div>{stats.adminDetails.map((admin, index) => <div className="ct-admin-row" key={admin.name}><div className="ct-admin-label"><span className="ct-avatar">А{index + 1}</span><span className="ct-muted">{admin.name}</span><span className="ct-rate">{admin.rate}%</span></div><strong><MoneyAmount value={admin.amount} /></strong></div>)}{stats.adminDetails.length === 0 && <p className="ct-muted">Админы для периода не указаны</p>}</section>
    <section aria-label="Бонусы и правки"><div className="ct-section-heading"><h2>Бонусы и правки</h2><Link to="/operations">Все операции <ArrowUpRight size={15} /></Link></div><div className="ct-adjustment-grid">
      <MetricCard label="Штрафы" value={stats.penalties} icon={<AlertTriangle size={17} />} tone="rose" />
      <MetricCard label="Бонусы" value={stats.bonuses} icon={<Gift size={17} />} tone="green" />
      <MetricCard label="Возвраты" value={stats.refunds} icon={<Undo2 size={17} />} />
      <MetricCard label="Авансы персонала" value={stats.advances} icon={<Wallet size={17} />} tone="gold" />
    </div></section>
      </aside>
    </div>
    {userRole === 'owner' && <footer className="ct-period-actions"><span className="ct-muted">Управление расчётным периодом</span><div className="ct-actions">{activePeriod?.status === 'open' ? <button className="ct-button" onClick={handleCloseMonth}><LockKeyhole size={15} />Закрыть месяц</button> : <span className="ct-period-label"><LockKeyhole size={15} />Месяц закрыт</span>}{isLatestPeriod && <button className="ct-button" onClick={handleStartNextMonth}><Plus size={15} />Новый период</button>}</div></footer>}
  </div>;
}
