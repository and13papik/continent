
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppState, AccountingPeriod, PaidStatus, OperationRecord, IncomeRecord } from '../types';
import { ICONS } from '../constants';

// --- ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ ---

function StatCard({ 
  title, 
  value, 
  icon, 
  color, 
  subValue, 
  subLabel = 'N', 
  highlighted 
}: { 
  title: string; 
  value: string; 
  icon: React.ReactNode; 
  color: string; 
  subValue?: string;
  subLabel?: string;
  highlighted?: boolean;
}) {
  const colorClasses: Record<string, string> = {
    indigo: 'border-indigo-500/40 bg-indigo-500/10 text-indigo-400 shadow-indigo-500/5',
    sky: 'border-sky-500/40 bg-sky-500/10 text-sky-400 shadow-sky-500/5',
    emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400 shadow-emerald-500/5',
    rose: 'border-rose-500/40 bg-rose-500/10 text-rose-400 shadow-rose-500/5',
    amber: 'border-amber-500/40 bg-amber-500/10 text-amber-400 shadow-amber-500/5',
    blue: 'border-blue-500/40 bg-blue-500/10 text-blue-400 shadow-blue-500/5'
  };

  const currentClass = colorClasses[color] || 'border-slate-800';

  return (
    <div className={`glass-card p-4 rounded-2xl flex flex-col justify-center transition-transform hover:scale-[1.02] min-w-0 ${highlighted ? currentClass : 'border-slate-800'}`}>
      <div className="flex items-center gap-3 overflow-visible">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shadow-inner shrink-0 ${highlighted ? '' : 'bg-slate-800 text-slate-400'}`}>
          {icon}
        </div>
        <div className="min-w-0 flex-1 overflow-visible">
          <p className="text-[9px] uppercase text-slate-500 font-black tracking-widest mb-0.5 truncate">{title}</p>
          <p className="text-lg font-black text-white font-outfit leading-tight whitespace-nowrap overflow-visible">
            {value}
          </p>
          {subValue && (
            <p className="text-[8px] font-bold mt-1 text-slate-500 font-mono whitespace-nowrap">
              {subLabel}: {subValue}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// --- ОСНОВНОЙ КОМПОНЕНТ ---

interface DashboardProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ state, updateState }) => {
  const navigate = useNavigate();
  const activePeriodId = state.selectedPeriodId;
  const activePeriod = state.accountingPeriods.find(p => p.id === activePeriodId);

  const currentOperators = activePeriod?.operators || state.operators;
  const currentModels = activePeriod?.models || state.models;

  // Проверка на наличие "бездомных" записей (из-за которых данные могли "пропасть")
  const homelessRecords = useMemo(() => {
    const periodIds = new Set(state.accountingPeriods.map(p => p.id));
    const badIncome = state.incomeData.filter(i => !periodIds.has(i.periodId));
    const badOps = state.operationsData.filter(o => !periodIds.has(o.periodId));
    return [...badIncome, ...badOps];
  }, [state.incomeData, state.operationsData, state.accountingPeriods]);

  const repairHomeless = () => {
    const confirmRepair = confirm(`Обнаружено ${homelessRecords.length} записей без привязки к периоду. Создать для них новый период "Восстановленные данные"?`);
    if (!confirmRepair) return;

    updateState(prev => {
      const newPeriod: AccountingPeriod = {
        id: `recovered-${Date.now()}`,
        label: `Восстановлено ${new Date().toLocaleDateString()}`,
        startAt: new Date().toISOString(),
        endAt: null,
        status: 'open'
      };
      
      const periodIds = new Set(prev.accountingPeriods.map(p => p.id));
      
      return {
        ...prev,
        accountingPeriods: [...prev.accountingPeriods, newPeriod],
        selectedPeriodId: newPeriod.id,
        incomeData: prev.incomeData.map(i => periodIds.has(i.periodId) ? i : { ...i, periodId: newPeriod.id }),
        operationsData: prev.operationsData.map(o => periodIds.has(o.periodId) ? o : { ...o, periodId: newPeriod.id })
      };
    });
    alert('Данные успешно возвращены в систему!');
  };

  const stats = useMemo(() => {
    const periodIncomes = state.incomeData.filter(r => r.periodId === activePeriodId);
    const manualIncomes = (state.ownerManualIncomes || []).filter(i => i.periodId === activePeriodId);
    const periodOps = state.operationsData.filter(o => o.periodId === activePeriodId);
    const currentAdmins = activePeriod?.admins || state.admins;
    const adminNames = currentAdmins.map(a => a.name);
    
    const rawPlatformGross = periodIncomes.reduce((s, r) => s + r.total, 0);
    const rawManualGross = manualIncomes.reduce((s, i) => s + i.amount, 0);
    const totalRefunds = periodOps.filter(o => o.type === 'refund').reduce((s, o) => s + o.amount, 0);
    
    const totalGross = (rawPlatformGross + rawManualGross) - totalRefunds;
    const totalRawNet = periodIncomes.reduce((s, r) => s + (r.nettoOF + r.nettoPP + r.nettoCrypto), 0);
    const avgOpRate = rawPlatformGross > 0 ? totalRawNet / rawPlatformGross : 0.20;

    const totals = { 
      totalGross, platformGross: rawPlatformGross, manualGross: rawManualGross,
      netEarned: totalRawNet - (totalRefunds * avgOpRate),
      bonuses: 0, penalties: 0, refunds: totalRefunds, advances: 0, paidOut: 0, remainder: 0, 
      adminDetails: [] as { name: string, amount: number, rate: number }[],
      of: { gross: 0, net: 0 }, pp: { gross: 0, net: 0 }, cr: { gross: 0, net: 0 } 
    };

    periodIncomes.forEach(r => {
      totals.of.gross += r.onlyFans; totals.of.net += r.nettoOF;
      totals.pp.gross += r.paypal; totals.pp.net += r.nettoPP;
      totals.cr.gross += r.crypto; totals.cr.net += r.nettoCrypto;
    });

    periodOps.forEach(op => {
      const isOperator = !adminNames.includes(op.operator);
      if (!op.model) {
        if (op.type === 'bonus' && isOperator) totals.bonuses += op.amount;
        else if ((op.type === 'penalty' || op.type === 'internship') && isOperator) totals.penalties += op.amount;
        else if (op.type === 'advance' && isOperator) { totals.advances += op.amount; totals.paidOut += op.amount; }
        else if (op.type === 'salary_payment' && isOperator) totals.paidOut += op.amount;
      }
    });

    totals.remainder = (totals.netEarned + totals.bonuses) - (totals.penalties + totals.paidOut);
    currentAdmins.forEach(admin => { totals.adminDetails.push({ name: admin.name, amount: totalGross * (admin.rate / 100), rate: admin.rate }); });
    return totals;
  }, [state.incomeData, state.ownerManualIncomes, state.operationsData, state.admins, activePeriodId, activePeriod]);

  const operatorRows = useMemo(() => {
    const raw = currentOperators.map(op => {
      const incomes = state.incomeData.filter(r => r.operator === op && r.periodId === activePeriodId);
      const ops = state.operationsData.filter(o => o.operator === op && o.periodId === activePeriodId && !o.model);
      const rawG = incomes.reduce((sum, r) => sum + r.total, 0);
      const rawN = incomes.reduce((sum, r) => sum + (r.nettoOF + r.nettoPP + r.nettoCrypto), 0);
      const opRefunds = state.operationsData.filter(o => o.type === 'refund' && o.operator === op && o.periodId === activePeriodId).reduce((sum, o) => sum + o.amount, 0);
      const avgRate = rawG > 0 ? rawN / rawG : 0.20;
      const totalGross = rawG - opRefunds;
      const totalNet = rawN - (opRefunds * avgRate);
      const adjPlus = ops.filter(o => o.type === 'bonus').reduce((sum, o) => sum + o.amount, 0);
      const adjMinus = ops.filter(o => ['penalty', 'advance', 'salary_payment', 'internship'].includes(o.type)).reduce((sum, o) => sum + o.amount, 0);
      const remainder = totalNet + adjPlus - adjMinus;
      const isPaid = state.paidStatuses.some(s => s.entityName === op && s.entityType === 'operator' && s.periodId === activePeriodId);
      return { 
        op, totalGross, refunds: opRefunds, remainder, isPaid,
        ofG: incomes.reduce((sum, r) => sum + r.onlyFans, 0), ofN: incomes.reduce((sum, r) => sum + r.nettoOF, 0),
        ppG: incomes.reduce((sum, r) => sum + r.paypal, 0), ppN: incomes.reduce((sum, r) => sum + r.nettoPP, 0),
        crG: incomes.reduce((sum, r) => sum + r.crypto, 0), crN: incomes.reduce((sum, r) => sum + r.nettoCrypto, 0)
      };
    });
    const sorted = raw.sort((a, b) => b.remainder - a.remainder);
    const maxGross = Math.max(...sorted.map(r => r.totalGross), 1);
    return sorted.map(r => ({ ...r, percentOfMax: (r.totalGross / maxGross) * 100 }));
  }, [state.incomeData, state.operationsData, currentOperators, activePeriodId, state.paidStatuses]);

  const toggleOperatorPaid = (op: string, currentRemainder: number) => {
    const existingStatus = state.paidStatuses.find(s => 
      s.entityName === op && 
      s.entityType === 'operator' && 
      s.periodId === activePeriodId
    );

    if (existingStatus) {
      if (!confirm(`Отменить статус "Выплачено" для ${op}? ВНИМАНИЕ: Автоматически созданная операция выплаты НЕ будет удалена. Если вы хотите аннулировать платеж, удалите его вручную в разделе "Операции".`)) return;
      
      updateState(prev => ({ 
        ...prev, 
        deletedIds: [...(prev.deletedIds || []), existingStatus.id],
        paidStatuses: prev.paidStatuses.filter(s => s.id !== existingStatus.id) 
      }));
    } else {
      if (currentRemainder <= 0) {
        if (!confirm(`У оператора ${op} нулевой или отрицательный остаток. Все равно отметить как выплачено?`)) return;
      } else {
        if (!confirm(`Создать операцию выплаты для ${op} на сумму $${currentRemainder.toFixed(1)} и отметить как выплачено?`)) return;
      }

      updateState(prev => {
        let newOperations = [...prev.operationsData];
        if (currentRemainder > 0) {
          const autoPayment: OperationRecord = {
            id: `auto-sal-${op}-${Date.now()}`,
            type: 'salary_payment',
            operator: op,
            amount: currentRemainder,
            comment: 'Авто-выплата (Dashboard)',
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
      });
    }
  };

  const handleCloseMonth = () => {
    if (!activePeriod || activePeriod.status === 'closed') return;
    const confirmClose = window.confirm(`Закрыть период "${activePeriod.label}"? Это переключит вас на следующий месяц.`);
    if (!confirmClose) return;

    updateState(prev => {
      const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
      
      // Находим текущий индекс активного периода в списке
      const activeIdx = prev.accountingPeriods.findIndex(p => p.id === activePeriodId);
      const nextInList = prev.accountingPeriods[activeIdx + 1];
      
      let nextId = nextInList?.id;
      let newPeriods = prev.accountingPeriods.map(p => 
        p.id === activePeriodId ? { ...p, status: 'closed' as const, endAt: new Date().toISOString() } : p
      );

      if (!nextId) {
        // Если следующего периода нет в списке, создаем его
        const lastP = prev.accountingPeriods[prev.accountingPeriods.length - 1];
        let nextMonthIdx = new Date().getMonth(), nextYear = new Date().getFullYear();
        if (lastP) {
          const lastDate = new Date(lastP.startAt);
          nextMonthIdx = lastDate.getMonth() + 1; 
          nextYear = lastDate.getFullYear();
          if (nextMonthIdx > 11) { nextMonthIdx = 0; nextYear += 1; }
        }
        nextId = String(Date.now());
        const newP: AccountingPeriod = { 
          id: nextId, 
          label: `${months[nextMonthIdx]} ${nextYear}`, 
          startAt: new Date(nextYear, nextMonthIdx, 1).toISOString(), 
          endAt: null, 
          status: 'open',
          operators: activePeriod?.operators || prev.operators,
          models: activePeriod?.models || prev.models,
          modelRates: activePeriod?.modelRates || prev.modelRates,
          modelDefaultGoals: activePeriod?.modelDefaultGoals || prev.modelDefaultGoals,
          admins: activePeriod?.admins || prev.admins
        };
        newPeriods = [...newPeriods, newP];
      }

      return { 
        ...prev, 
        accountingPeriods: newPeriods, 
        selectedPeriodId: nextId 
      };
    });
  };

  const handleStartNextMonth = () => {
    updateState(prev => {
      const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
      const lastP = prev.accountingPeriods[prev.accountingPeriods.length - 1];
      let nextMonthIdx = new Date().getMonth(), nextYear = new Date().getFullYear();
      if (lastP) {
        const lastDate = new Date(lastP.startAt);
        nextMonthIdx = lastDate.getMonth() + 1; 
        nextYear = lastDate.getFullYear();
        if (nextMonthIdx > 11) { nextMonthIdx = 0; nextYear += 1; }
      }
      const nextId = String(Date.now());
      const newP: AccountingPeriod = { 
        id: nextId, 
        label: `${months[nextMonthIdx]} ${nextYear}`, 
        startAt: new Date(nextYear, nextMonthIdx, 1).toISOString(), 
        endAt: null, 
        status: 'open',
        operators: activePeriod?.operators || prev.operators,
        models: activePeriod?.models || prev.models,
        modelRates: activePeriod?.modelRates || prev.modelRates,
        modelDefaultGoals: activePeriod?.modelDefaultGoals || prev.modelDefaultGoals,
        admins: activePeriod?.admins || prev.admins
      };
      return { 
        ...prev, 
        accountingPeriods: [...prev.accountingPeriods, newP], 
        selectedPeriodId: nextId 
      };
    });
  };

  const isLatestPeriod = state.accountingPeriods[state.accountingPeriods.length - 1]?.id === activePeriodId;
  const canStartNext = isLatestPeriod; // Можно добавить проверку на текущую дату, если нужно

  const DashboardIcon = ICONS.Dashboard || 'span';
  const TransferIcon = ICONS.Transfer || 'span';
  const IncomeIcon = ICONS.Income || 'span';
  const PenaltyIcon = ICONS.Penalty || 'span';
  const BonusIcon = ICONS.Bonus || 'span';
  const RotateIcon = ICONS.RotateCcw || 'span';
  const AdvanceIcon = ICONS.CircleDollarSign || 'span';
  const SalaryIcon = ICONS.Salary || 'span';
  const RemainderIcon = ICONS.BadgeDollarSign || 'span';
  const LockIcon = ICONS.Lock || 'span';

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-outfit">Main Dashboard</h1>
          <div className="flex flex-wrap items-center gap-4 mt-1">
             <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Период:</span>
                <select className="bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-1.5 text-indigo-400 font-bold outline-none cursor-pointer text-sm" value={state.selectedPeriodId} onChange={(e) => updateState(prev => ({ ...prev, selectedPeriodId: e.target.value }))}>
                   {state.accountingPeriods.slice().reverse().map(p => <option key={p.id} value={p.id}>{p.label} {p.status === 'closed' ? '🔒' : ''}</option>)}
                </select>
             </div>
             
             <div className="flex items-center gap-2">
               {activePeriod?.status === 'open' ? (
                  <button onClick={handleCloseMonth} className="flex items-center gap-2 px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600 text-rose-500 hover:text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all border border-rose-500/30 active:scale-95 shadow-lg shadow-rose-500/5">
                    <LockIcon size={12} /> Закрыть месяц
                  </button>
               ) : (
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 text-slate-500 text-[9px] font-black uppercase tracking-widest rounded-xl border border-slate-700/50">
                    <LockIcon size={12} /> Месяц закрыт
                  </div>
               )}
               
               {isLatestPeriod && (
                  <button onClick={handleStartNextMonth} className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-500/20 active:scale-95">
                    <ICONS.Plus size={12} /> Открыть следующий
                  </button>
               )}
             </div>
          </div>
        </div>
      </header>

      {homelessRecords.length > 0 && (
        <div className="bg-rose-500/10 border border-rose-500/20 p-6 rounded-[2rem] flex flex-col md:flex-row items-center justify-between gap-6 animate-pulse shadow-xl shadow-rose-500/5">
           <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/20 flex items-center justify-center text-rose-500 shadow-inner">
                 <ICONS.AlertTriangle size={24} />
              </div>
              <div>
                 <h3 className="text-lg font-bold text-white font-outfit uppercase tracking-tight">Обнаружены "пропавшие" записи</h3>
                 <p className="text-xs text-slate-400">Найдено {homelessRecords.length} записей, у которых удален период (февраль мог исчезнуть из-за конфликта синхронизации).</p>
              </div>
           </div>
           <button onClick={repairHomeless} className="bg-rose-600 hover:bg-rose-500 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-rose-600/20 active:scale-95">
              Восстановить данные
           </button>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <div className="space-y-4">
          <h2 className="text-[9px] uppercase font-black tracking-[0.2em] text-slate-500 ml-1">Доходы и Платформы</h2>
          <div className="flex flex-col gap-3">
            <StatCard title="ОБЩИЙ ТОТАЛ (Грязными)" value={`$${stats.totalGross.toLocaleString()}`} color="indigo" icon={<DashboardIcon size={16}/>} />
            <StatCard title="PAYPAL" value={`$${stats.pp.gross.toLocaleString()}`} subValue={`$${stats.pp.net.toLocaleString()}`} subLabel="Net" color="sky" icon={<TransferIcon size={16}/>} />
            <StatCard title="CRYPTO" value={`$${stats.cr.gross.toLocaleString()}`} subValue={`$${stats.cr.net.toLocaleString()}`} subLabel="Net" color="emerald" icon={<IncomeIcon size={16}/>} />
          </div>
        </div>
        <div className="space-y-4">
          <h2 className="text-[9px] uppercase font-black tracking-[0.2em] text-slate-500 ml-1">Корректировки</h2>
          <div className="flex flex-col gap-3">
            <StatCard title="ШТРАФОВ" value={`$${stats.penalties.toLocaleString()}`} color="rose" icon={<PenaltyIcon size={16}/>} />
            <StatCard title="БОНУСОВ" value={`$${stats.bonuses.toLocaleString()}`} color="emerald" icon={<BonusIcon size={16}/>} />
            <StatCard title="ВОЗВРАТОВ" value={`$${stats.refunds.toLocaleString()}`} color="blue" icon={<RotateIcon size={16}/>} />
            <StatCard title="АВАНСОВ (Staff)" value={`$${stats.advances.toLocaleString()}`} color="amber" icon={<AdvanceIcon size={16}/>} />
          </div>
        </div>
        <div className="space-y-4">
          <h2 className="text-[9px] uppercase font-black tracking-[0.2em] text-slate-500 ml-1">Операционная ЗП</h2>
          <div className="flex flex-col gap-3">
            <StatCard title="ОБЩАЯ ЗП ОПЕРАТОРОВ" value={`$${stats.netEarned.toLocaleString()}`} color="emerald" icon={<SalaryIcon size={16}/>} />
            <StatCard title="ВЫПЛАЧЕНО ОПЕРАТОРАМ" value={`$${stats.paidOut.toLocaleString()}`} color="sky" icon={<TransferIcon size={16}/>} />
            <StatCard title="ОСТАТОК ОПЕРАТОРАМ" value={`$${stats.remainder.toLocaleString()}`} color="indigo" icon={<RemainderIcon size={16}/>} highlighted />
          </div>
        </div>
        <div className="space-y-4">
          <h2 className="text-[9px] uppercase font-black tracking-[0.2em] text-slate-500 ml-1">Администраторы</h2>
          <div className="flex flex-col gap-3">
            {stats.adminDetails.map((ad) => (
              <div key={ad.name} className="glass-card p-4 rounded-2xl bg-slate-900/40 border-slate-800 transition-transform hover:scale-[1.02] flex flex-col justify-center min-w-0">
                <p className="text-[9px] uppercase text-slate-500 font-black tracking-widest mb-1 truncate">{ad.name}</p>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className="text-lg font-black text-white font-outfit leading-tight">${ad.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                  <span className="text-[8px] text-slate-500 font-bold">({ad.rate}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="glass-card rounded-[2rem] overflow-hidden shadow-2xl border-slate-800/50">
        <div className="p-6 border-b border-slate-800 bg-slate-900/40 flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-lg font-bold font-outfit">Ведомость персонала</h2>
          <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">REFUNDS ALREADY DEDUCTED FROM GROSS</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-slate-900/50 text-slate-500 uppercase text-[9px] font-black tracking-widest border-b border-slate-800">
                <th className="px-6 py-4">Оператор</th>
                <th className="px-4 py-4 text-center">Clean Gross</th>
                <th className="px-4 py-4 text-center">OF (G/N)</th>
                <th className="px-4 py-4 text-center">PP (G/N)</th>
                <th className="px-4 py-4 text-center">CR (G/N)</th>
                <th className="px-4 py-4 text-center">Остаток (Net)</th>
                <th className="px-6 py-4 text-right">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {operatorRows.map(row => (
                <tr key={row.op} className="hover:bg-indigo-500/5 transition-all">
                  <td className="px-6 py-4"><div className="font-bold text-white text-sm cursor-pointer" onClick={() => navigate('/reports', { state: { operator: row.op } })}>{row.op}</div></td>
                  <td className="px-4 py-4 w-44">
                    <div className="flex flex-col gap-1">
                       <div className="flex justify-between items-center text-[8px] font-black text-slate-500">
                          <span className="text-white">${row.totalGross.toFixed(0)}</span>
                          {row.refunds > 0 && <span className="text-rose-500">Ref: -${row.refunds.toFixed(0)}</span>}
                       </div>
                       <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden"><div className="h-full bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-all duration-1000" style={{ width: `${row.percentOfMax}%` }}></div></div>
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center"><div className="flex flex-col"><span className="text-[9px] text-slate-500 font-mono">${row.ofG.toFixed(0)}</span><span className="text-blue-400 font-mono font-bold text-xs">${row.ofN.toFixed(1)}</span></div></td>
                  <td className="px-4 py-4 text-center"><div className="flex flex-col"><span className="text-[9px] text-slate-500 font-mono">${row.ppG.toFixed(0)}</span><span className="text-sky-400 font-mono font-bold text-xs">${row.ppN.toFixed(1)}</span></div></td>
                  <td className="px-4 py-4 text-center"><div className="flex flex-col"><span className="text-[9px] text-slate-500 font-mono">${row.crG.toFixed(0)}</span><span className="text-emerald-400 font-mono font-bold text-xs">${row.crN.toFixed(1)}</span></div></td>
                  <td className="px-4 py-4 text-center"><div className={`text-sm font-black font-mono ${row.remainder >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>${row.remainder.toFixed(1)}</div></td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => toggleOperatorPaid(row.op, row.remainder)} className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${row.isPaid ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}>
                      {row.isPaid ? 'Выплачено' : 'Ожидает'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
