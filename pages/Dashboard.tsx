
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppState, AccountingPeriod, PaidStatus, OperationRecord, IncomeRecord } from '../types';
import { ICONS } from '../constants';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { motion } from 'motion/react';

import PeriodBadge from '../components/PeriodBadge';

// --- ВСПОМОГАТЕЛЬНЫЕ КОМПОНЕНТЫ ---

function PlatformMiniCard({ label, value, color, icon }: { label: string; value: number; color: string; icon: React.ReactNode }) {
  const colorClasses: Record<string, string> = {
    indigo: 'text-indigo-400 border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-400/40 shadow-indigo-500/5',
    sky: 'text-sky-400 border-sky-500/20 bg-sky-500/5 hover:bg-sky-500/10 hover:border-sky-400/40 shadow-sky-500/5',
    emerald: 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-400/40 shadow-emerald-500/5',
  };

  return (
    <motion.div 
      whileHover={{ y: -4, scale: 1.02 }}
      className={`p-3.5 rounded-3xl border transition-all duration-500 flex flex-col items-center justify-center gap-1.5 min-w-[125px] backdrop-blur-2xl shadow-xl ${colorClasses[color] || 'border-slate-800'}`}
    >
       <div className="p-1 rounded-xl bg-white/5 border border-white/5 group-hover:scale-110 transition-transform">
        {React.cloneElement(icon as React.ReactElement, { size: 18 })}
       </div>
       <div className={`text-[8px] font-black uppercase tracking-[0.2em] opacity-50`}>{label}</div>
       <div className="text-base font-black text-white font-outfit tracking-tight">${value.toLocaleString()}</div>
    </motion.div>
  );
}

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
    indigo: 'from-indigo-500/[0.12] to-transparent border-indigo-500/20 text-indigo-400',
    sky: 'from-sky-500/[0.12] to-transparent border-sky-500/20 text-sky-400',
    emerald: 'from-emerald-500/[0.12] to-transparent border-emerald-500/20 text-emerald-400',
    rose: 'from-rose-500/[0.12] to-transparent border-rose-500/20 text-rose-400',
    amber: 'from-amber-400/[0.15] to-transparent border-amber-500/30 text-amber-400',
    blue: 'from-blue-500/[0.12] to-transparent border-blue-500/20 text-blue-400'
  };

  const currentClass = colorClasses[color] || 'from-slate-800/10 to-transparent border-slate-700/20';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.01 }}
      className={`relative group bg-gradient-to-br ${currentClass} ${highlighted ? 'p-6' : 'p-5'} rounded-3xl border backdrop-blur-3xl transition-all duration-500 shadow-xl hover:border-white/20 overflow-hidden`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.01] to-transparent pointer-events-none" />
      <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2 group-hover:scale-150 transition-transform duration-700" />
      
      <div className="relative flex items-center gap-5">
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border border-white/5 bg-white/5 text-current shadow-inner group-hover:scale-105 transition-transform duration-500`}>
          <div className="scale-110">{icon}</div>
        </div>
        <div className="min-w-0">
          <p className="text-[9px] uppercase font-black tracking-[0.2em] mb-1.5 text-slate-500 group-hover:text-slate-300 transition-colors">{title}</p>
          <div className="flex flex-col">
            <span className="font-outfit text-2xl font-black text-white tracking-tight leading-none group-hover:scale-[1.01] origin-left transition-transform duration-500">
              {value}
            </span>
            {subValue && (
              <div className="flex items-center gap-2 mt-2 p-1 px-2.5 bg-white/[0.04] border border-white/5 rounded-lg w-fit">
                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">{subLabel}</span>
                <span className="text-[9px] font-bold text-indigo-400 font-mono tracking-tight">{subValue}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// --- ОСНОВНОЙ КОМПОНЕНТ ---

interface DashboardProps {
  state: AppState;
  userRole: 'user' | 'owner' | null;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ state, userRole, updateState }) => {
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

    // --- Калькуляция прогноза ---
    const getAccountingDateUTC = () => {
      const now = new Date();
      const kyivStr = now.toLocaleString("en-US", { timeZone: "Europe/Kiev", hour12: false });
      const [datePart, timePart] = kyivStr.split(', ');
      const [m, d, y] = datePart.split('/').map(Number);
      const [h] = timePart.split(':').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d));
      if (h < 3) date.setUTCDate(date.getUTCDate() - 1);
      return date;
    };
    
    const accountingDate = getAccountingDateUTC();
    const sortedPeriodsForLatest = [...state.accountingPeriods].sort((a, b) => 
      new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
    );
    const isLatestPeriod = sortedPeriodsForLatest[sortedPeriodsForLatest.length - 1]?.id === activePeriodId;

    let targetMonth: number;
    let targetYear: number;
    if (activePeriod) {
      const pStart = new Date(activePeriod.startAt);
      targetMonth = pStart.getUTCMonth();
      targetYear = pStart.getUTCFullYear();
    } else {
      targetMonth = accountingDate.getUTCMonth();
      targetYear = accountingDate.getUTCFullYear();
    }

    const totalDaysInMonth = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
    const daysPassed = isLatestPeriod ? accountingDate.getUTCDate() : totalDaysInMonth;
    const runRate = totalGross / Math.max(daysPassed, 1);
    const forecast = Math.max(totalGross, runRate * totalDaysInMonth);

    // --- Калькуляция Плана ---
    const activeModels = activePeriod?.models || state.models;
    const totalTarget = activeModels.reduce((sum, mName) => {
      const mGoal = activePeriod?.modelMonthlyPlans?.[mName] || state.modelMonthlyPlans?.[mName] || 0;
      return sum + mGoal;
    }, 0);

    const totals = { 
      totalGross, platformGross: rawPlatformGross, manualGross: rawManualGross,
      netEarned: totalRawNet - (totalRefunds * avgOpRate),
      bonuses: 0, penalties: 0, refunds: totalRefunds, advances: 0, paidOut: 0, remainder: 0,
      forecast, totalTarget, 
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
  }, [state.incomeData, state.ownerManualIncomes, state.operationsData, state.admins, activePeriodId, activePeriod, state.modelMonthlyPlans, state.accountingPeriods, state.models]);

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
      
      const bns = ops.filter(o => o.type === 'bonus').reduce((sum, o) => sum + o.amount, 0);
      const pnl = ops.filter(o => o.type === 'penalty' || o.type === 'internship').reduce((sum, o) => sum + o.amount, 0);
      const adv = ops.filter(o => o.type === 'advance').reduce((sum, o) => sum + o.amount, 0);
      const pay = ops.filter(o => o.type === 'salary_payment').reduce((sum, o) => sum + o.amount, 0);
      
      const remainder = totalNet + bns - (pnl + adv + pay);
      const isPaid = state.paidStatuses.some(s => s.entityName === op && s.entityType === 'operator' && s.periodId === activePeriodId);
      
      return { 
        op, totalGross, refunds: opRefunds, remainder, isPaid,
        bonuses: bns, penalties: pnl, advances: adv,
        ofG: incomes.reduce((sum, r) => sum + r.onlyFans, 0), ofN: incomes.reduce((sum, r) => sum + r.nettoOF, 0),
        ppG: incomes.reduce((sum, r) => sum + r.paypal, 0), ppN: incomes.reduce((sum, r) => sum + r.nettoPP, 0),
        crG: incomes.reduce((sum, r) => sum + r.crypto, 0), crN: incomes.reduce((sum, r) => sum + r.nettoCrypto, 0)
      };
    });
    const sorted = raw.sort((a, b) => {
      if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
      return b.remainder - a.remainder;
    });
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
      
      const sortedPeriods = [...prev.accountingPeriods].sort((a, b) => 
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
      );

      const activeIdx = sortedPeriods.findIndex(p => p.id === activePeriodId);
      const nextInList = sortedPeriods[activeIdx + 1];
      
      let nextId = nextInList?.id;
      let newPeriods = prev.accountingPeriods.map(p => 
        p.id === activePeriodId ? { ...p, status: 'closed' as const, endAt: new Date().toISOString(), updatedAt: new Date().toISOString() } : p
      );

      if (!nextId) {
        const latestP = sortedPeriods[sortedPeriods.length - 1];
        let nextMonthIdx: number;
        let nextYear: number;
        
        if (latestP) {
          const d = new Date(latestP.startAt);
          // Используем UTC методы для надежности
          nextMonthIdx = d.getUTCMonth() + 1; 
          nextYear = d.getUTCFullYear();
          if (nextMonthIdx > 11) { nextMonthIdx = 0; nextYear += 1; }
        } else {
          const now = new Date();
          nextMonthIdx = now.getUTCMonth();
          nextYear = now.getUTCFullYear();
        }

        // Защита от дубликатов: если такой месяц уже есть, идем дальше
        while (prev.accountingPeriods.some(p => p.label === `${months[nextMonthIdx]} ${nextYear}`)) {
          nextMonthIdx++;
          if (nextMonthIdx > 11) { nextMonthIdx = 0; nextYear += 1; }
        }

        nextId = String(Date.now());
        const newP: AccountingPeriod = { 
          id: nextId, 
          label: `${months[nextMonthIdx]} ${nextYear}`, 
          startAt: new Date(Date.UTC(nextYear, nextMonthIdx, 1)).toISOString(), 
          endAt: null, 
          status: 'open',
          operators: activePeriod?.operators || prev.operators,
          models: activePeriod?.models || prev.models,
          modelRates: activePeriod?.modelRates || prev.modelRates,
          modelDefaultGoals: activePeriod?.modelDefaultGoals || prev.modelDefaultGoals,
          admins: activePeriod?.admins || prev.admins,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
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
      
      const sortedPeriods = [...prev.accountingPeriods].sort((a, b) => 
        new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
      );
      
      const latestP = sortedPeriods[sortedPeriods.length - 1];
      let nextMonthIdx: number;
      let nextYear: number;
      
      if (latestP) {
        const d = new Date(latestP.startAt);
        nextMonthIdx = d.getUTCMonth() + 1; 
        nextYear = d.getUTCFullYear();
        if (nextMonthIdx > 11) { nextMonthIdx = 0; nextYear += 1; }
      } else {
        const now = new Date();
        nextMonthIdx = now.getUTCMonth();
        nextYear = now.getUTCFullYear();
      }

      // Защита от дубликатов
      while (prev.accountingPeriods.some(p => p.label === `${months[nextMonthIdx]} ${nextYear}`)) {
        nextMonthIdx++;
        if (nextMonthIdx > 11) { nextMonthIdx = 0; nextYear += 1; }
      }

      const nextId = String(Date.now());
      const newP: AccountingPeriod = { 
        id: nextId, 
        label: `${months[nextMonthIdx]} ${nextYear}`, 
        startAt: new Date(Date.UTC(nextYear, nextMonthIdx, 1)).toISOString(), 
        endAt: null, 
        status: 'open',
        operators: activePeriod?.operators || prev.operators,
        models: activePeriod?.models || prev.models,
        modelRates: activePeriod?.modelRates || prev.modelRates,
        modelDefaultGoals: activePeriod?.modelDefaultGoals || prev.modelDefaultGoals,
        admins: activePeriod?.admins || prev.admins,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      return { 
        ...prev, 
        accountingPeriods: [...prev.accountingPeriods, newP], 
        selectedPeriodId: nextId 
      };
    });
  };

  const sortedPeriodsForCheck = [...state.accountingPeriods].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
  const isLatestPeriod = sortedPeriodsForCheck[sortedPeriodsForCheck.length - 1]?.id === activePeriodId;
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
    <div className="relative min-h-screen bg-[#0a0c10] text-slate-200">
      <style>{`
        @keyframes pulse-subtle {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.95; transform: scale(0.995); }
        }
        .pulse-subtle {
          animation: pulse-subtle 4s ease-in-out infinite;
        }
      `}</style>
      {/* Subtle background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative space-y-10 animate-in fade-in duration-700 pb-20 max-w-[1600px] mx-auto px-4 sm:px-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-white font-outfit tracking-tighter">Dashboard</h1>
          <div className="flex flex-wrap items-center gap-4 mt-2">
             <PeriodBadge state={state} />
             
              {userRole === 'owner' && (
                 <div className="flex items-center gap-2 bg-white/[0.03] p-1 rounded-2xl border border-white/[0.05] backdrop-blur-md">
                  {activePeriod?.status === 'open' ? (
                     <button 
                       onClick={handleCloseMonth} 
                       className="flex items-center gap-2 px-5 py-2 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-rose-500/20 active:scale-95 group shadow-lg shadow-rose-500/5"
                     >
                       <LockIcon size={14} className="group-hover:rotate-12 transition-transform duration-300" /> Закрыть месяц
                     </button>
                  ) : (
                     <div className="flex items-center gap-2 px-5 py-2 text-slate-500 text-[10px] font-black uppercase tracking-widest rounded-xl border border-white/5">
                       <LockIcon size={14} /> Месяц закрыт
                     </div>
                  )}
                  
                  {isLatestPeriod && (
                     <button 
                       onClick={handleStartNextMonth} 
                       className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-xl shadow-indigo-600/20 active:scale-95 group"
                     >
                       <ICONS.Plus size={14} className="group-hover:scale-125 transition-transform duration-300" /> Новый период
                     </button>
                  )}
                </div>
              )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="flex items-center gap-4 p-3 bg-white/[0.03] border border-white/[0.05] rounded-2xl backdrop-blur-md">
            <div className="flex flex-col items-end">
              <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Узлы активны</span>
              <span className="text-xs font-bold text-white">Облако: 100%</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <ICONS.ShieldCheck size={20} />
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* LEFT COLUMN: KEY METRICS + ADJUSTMENTS */}
        <div className="xl:col-span-2 space-y-8">
          <motion.div 
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="relative group overflow-hidden rounded-[3rem] border border-white/5 bg-slate-900/40 backdrop-blur-3xl shadow-[0_32px_128px_rgba(0,0,0,0.4)]"
          >
            {/* Background elements */}
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/[0.08] via-transparent to-indigo-500/[0.05] pointer-events-none" />
            <div className="absolute -top-24 -right-24 w-96 h-96 bg-amber-500/10 blur-[120px] rounded-full group-hover:scale-110 transition-transform duration-1000" />
            <div className="absolute -bottom-24 -left-24 w-96 h-96 bg-indigo-500/10 blur-[120px] rounded-full group-hover:scale-110 transition-transform duration-1000" />
            
            <svg className="absolute inset-0 w-full h-full opacity-[0.03] pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                  <path d="M 10 0 L 0 0 0 10" fill="none" stroke="currentColor" strokeWidth="0.1"/>
                </pattern>
              </defs>
              <rect width="100" height="100" fill="url(#grid)" />
            </svg>

            <div className="relative p-8 flex flex-col lg:flex-row items-center justify-between gap-8">
               <div className="flex flex-col items-center lg:items-start gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-amber-400 to-amber-600 text-white rounded-2xl flex items-center justify-center shadow-2xl shadow-amber-500/30 transform -rotate-2 group-hover:rotate-0 transition-transform duration-500">
                       <span className="text-xl">💰</span>
                    </div>
                    <div className="flex flex-col">
                      <h2 className="text-[10px] font-black text-amber-500 uppercase tracking-[0.3em] mb-0.5">Главные показатели</h2>
                      <p className="text-[9px] text-slate-500 font-bold tracking-widest uppercase">Всего заработано</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-center lg:items-start">
                    <span className="text-6xl font-black text-white font-outfit tracking-tighter leading-none pulse-subtle selection:bg-amber-500 selection:text-white">
                      ${stats.totalGross.toLocaleString()}
                    </span>
                    <div className="flex items-center gap-4 mt-6">
                      <div className="group/stat px-5 py-3 bg-white/[0.04] border border-white/5 rounded-2xl backdrop-blur-md flex flex-col hover:border-indigo-500/30 transition-all duration-500 shadow-lg">
                        <span className="text-[7px] uppercase font-black text-slate-500 tracking-[0.12em] mb-1 opacity-60">Цель месяца</span>
                        <span className="text-base font-black text-white font-outfit tracking-tight">${stats.totalTarget.toLocaleString()}</span>
                        <div className="mt-1 h-1 w-10 bg-slate-800 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min((stats.totalGross / (stats.totalTarget || 1)) * 100, 100)}%` }}
                            className="h-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]"
                          />
                        </div>
                      </div>
                      <div className="group/stat px-5 py-3 bg-indigo-500/[0.04] border border-indigo-500/20 rounded-2xl backdrop-blur-md flex flex-col hover:border-indigo-400/50 transition-all duration-500 shadow-lg">
                        <span className="text-[7px] uppercase font-black text-indigo-400/70 tracking-[0.12em] mb-1">Прогноз месяца</span>
                        <span className="text-base font-black text-indigo-400 font-outfit tracking-tight">${stats.forecast.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                        <div className="mt-1 h-1 flex items-center gap-2">
                           <div className="w-1 h-1 rounded-full bg-indigo-500 animate-pulse" />
                           <span className="text-[7px] font-bold text-indigo-400/40 uppercase tracking-widest">Активный расчет</span>
                        </div>
                      </div>
                    </div>
                  </div>
               </div>
               
               <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-1 gap-4 w-full lg:w-auto">
                  <PlatformMiniCard label="OnlyFans" value={stats.of.gross} color="indigo" icon={<IncomeIcon size={20} />} />
                  <PlatformMiniCard label="PayPal" value={stats.pp.gross} color="sky" icon={<TransferIcon size={20} />} />
                  <PlatformMiniCard label="Crypto" value={stats.cr.gross} color="emerald" icon={<IncomeIcon size={20} />} />
               </div>
            </div>
          </motion.div>

          <div className="space-y-6">
            <div className="flex items-center gap-3 ml-2">
              <div className="w-2 h-2 rounded-full bg-rose-500 shadow-[0_0_15px_rgba(244,63,94,0.5)]" />
              <h2 className="text-[10px] uppercase font-black tracking-[0.3em] text-slate-400 opacity-60">Бонусы и правки</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard title="Штрафы" value={`$${stats.penalties.toLocaleString()}`} color="rose" icon={<PenaltyIcon size={16}/>} />
              <StatCard title="Бонусы" value={`$${stats.bonuses.toLocaleString()}`} color="emerald" icon={<BonusIcon size={16}/>} />
              <StatCard title="Возвраты" value={`$${stats.refunds.toLocaleString()}`} color="blue" icon={<RotateIcon size={16}/>} />
              <StatCard title="Авансы (Staff)" value={`$${stats.advances.toLocaleString()}`} color="amber" icon={<AdvanceIcon size={16}/>} />
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: ADMIN STAFF + OPERATIONAL LEDGER */}
        <div className="xl:col-span-1 space-y-8">
          <div className="space-y-5">
            <div className="flex items-center gap-3 ml-2">
               <div className="w-2 h-2 rounded-full bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.5)]" />
               <h2 className="text-[10px] uppercase font-black tracking-[0.3em] text-slate-400 opacity-60">Админ-состав</h2>
            </div>
            <div className="grid grid-cols-1 gap-4">
              {stats.adminDetails.map((ad, idx) => (
                <motion.div 
                  key={ad.name}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="relative group bg-slate-900/40 border border-white/[0.05] rounded-[2rem] p-6 transition-all duration-500 hover:bg-slate-900/60 hover:border-white/20 hover:-translate-y-1 shadow-xl"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-[2rem]" />
                  <div className="flex justify-between items-center relative z-10">
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em] opacity-60 group-hover:opacity-100 transition-opacity">{ad.name}</p>
                      <p className="text-2xl font-black text-white font-outfit tracking-tighter leading-none">${ad.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                    </div>
                    <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex flex-col items-center justify-center text-indigo-400 font-black border border-indigo-500/20 group-hover:scale-105 transition-transform duration-500 shadow-inner">
                      <span className="text-sm leading-none">{ad.rate}</span>
                      <span className="text-[7px] opacity-60 uppercase">%</span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-3 ml-2">
               <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]" />
               <h2 className="text-[10px] uppercase font-black tracking-[0.3em] text-slate-400 opacity-60">Операторская ведомость</h2>
            </div>
            <div className="grid grid-cols-1 gap-5">
              <motion.div 
                 whileHover={{ y: -5 }}
                 className="relative group bg-emerald-500/[0.03] border border-emerald-500/20 rounded-[2.5rem] p-8 transition-all duration-500 hover:bg-emerald-500/[0.06] hover:border-emerald-400/40 shadow-2xl overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] rounded-full translate-x-1/2 -translate-y-1/2 group-hover:scale-125 transition-transform duration-1000" />
                
                <div className="flex items-center justify-between mb-6 relative z-10">
                   <div className="space-y-1">
                     <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Зарплаты операторов</p>
                     <p className="text-4xl font-black text-white font-outfit tracking-tighter leading-none">${stats.netEarned.toLocaleString()}</p>
                   </div>
                   <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400 border border-emerald-500/20 shadow-inner group-hover:rotate-6 transition-transform duration-500">
                      <SalaryIcon size={24} />
                   </div>
                </div>
                
                <div className="grid grid-cols-2 gap-6 pt-6 border-t border-white/[0.05] relative z-10">
                   <div className="space-y-1">
                     <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">Выплачено</p>
                     <p className="text-xl font-black text-sky-400 font-outfit tracking-tighter">${stats.paidOut.toLocaleString()}</p>
                   </div>
                   <div className="space-y-1">
                     <p className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">Остаток</p>
                     <p className="text-xl font-black text-emerald-400 font-outfit tracking-tighter">${stats.remainder.toLocaleString()}</p>
                   </div>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10"
      >
        <div className="bg-slate-900/40 backdrop-blur-3xl rounded-[2.5rem] overflow-hidden shadow-2xl border border-white/5">
          <div className="p-6 border-b border-white/5 bg-white/[0.01] flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                <ICONS.Users size={20} />
              </div>
              <div className="flex flex-col">
                <h2 className="text-lg font-black font-outfit text-white tracking-tight">Ведомость персонала</h2>
                <span className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-500">Детальный аудит выплат за период</span>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-white/[0.02] border border-white/5 rounded-xl">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 blur-[1px]" />
              <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Sync Alive</span>
            </div>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left text-[11px] whitespace-nowrap border-separate border-spacing-0">
              <thead>
                <tr className="bg-white/[0.02] text-slate-500 uppercase text-[8px] font-black tracking-[0.1em]">
                  <th className="px-4 py-4 border-b border-white/5 first:rounded-tl-3xl">Оператор</th>
                  <th className="px-4 py-4 border-b border-white/5 text-center">Объем & Эффект.</th>
                  <th className="px-2 py-4 border-b border-white/5 text-center">OnlyFans <span className="text-indigo-500/50">●</span></th>
                  <th className="px-2 py-4 border-b border-white/5 text-center">PayPal <span className="text-sky-500/50">●</span></th>
                  <th className="px-2 py-4 border-b border-white/5 text-center">Crypto <span className="text-emerald-500/50">●</span></th>
                  <th className="px-2 py-4 border-b border-white/5 text-center">Правки & Бонусы</th>
                  <th className="px-4 py-4 border-b border-white/5 text-center">Баланс</th>
                  <th className="px-4 py-4 border-b border-white/5 text-right last:rounded-tr-3xl">Выплата</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02]">
                {operatorRows.map((row, idx) => {
                  const isTop3 = idx < 3;
                  return (
                    <motion.tr 
                      key={row.op}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="hover:bg-white/[0.03] transition-all duration-300 group/row relative"
                    >
                      <td className="px-4 py-4">
                        <div 
                          className="flex items-center gap-3 cursor-pointer" 
                          onClick={() => navigate('/reports', { state: { operator: row.op } })}
                        >
                          <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center text-[10px] font-black transition-all duration-500 group-hover/row:scale-110 shadow-2xl ${isTop3 && !row.isPaid ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white border border-white/20' : 'bg-slate-800 border border-white/5 text-slate-400 group-hover/row:border-indigo-500/50 group-hover/row:text-indigo-400'}`}>
                            {row.op.charAt(0)}
                            {isTop3 && !row.isPaid && (
                              <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full border-2 border-slate-900 flex items-center justify-center text-[7px] animate-bounce">
                                🏆
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className={`font-black text-[13px] tracking-tight leading-tight transition-colors uppercase ${row.isPaid ? 'text-slate-500 line-through' : 'text-white group-hover/row:text-indigo-400'}`}>{row.op}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 min-w-[140px]">
                        <div className="flex flex-col gap-1.5">
                           <div className="flex justify-between items-center text-[9px] font-black">
                              <div className="flex items-center gap-1.5">
                                <span className={row.isPaid ? 'text-slate-600' : 'text-white'}>${row.totalGross.toFixed(0)}</span>
                                {row.refunds > 0 && <span className="text-rose-500 opacity-60 text-[7px]">-${row.refunds.toFixed(0)}</span>}
                              </div>
                              <span className="text-slate-500 font-mono text-[7px] uppercase">{((row.percentOfMax)).toFixed(0)}%</span>
                           </div>
                           <div className="h-1.5 w-full bg-slate-800/50 rounded-full overflow-hidden p-[1px] border border-white/[0.02]">
                              <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: `${row.percentOfMax}%` }}
                                transition={{ duration: 1.2, delay: idx * 0.05, ease: "circOut" }}
                                className={`h-full rounded-full ${row.isPaid ? 'bg-slate-700' : (isTop3 ? 'bg-gradient-to-r from-indigo-600 to-purple-500 shadow-[0_0_8px_rgba(99,102,241,0.2)]' : 'bg-indigo-500/70')}`} 
                              />
                           </div>
                        </div>
                      </td>
                      <td className="px-2 py-4 text-center">
                        <div className={`inline-flex flex-col items-center border rounded-xl p-2 min-w-[65px] transition-colors duration-500 ${row.isPaid ? 'bg-white/[0.01] border-white/5 opacity-40' : 'bg-indigo-500/[0.03] border-indigo-500/10 group-hover/row:bg-indigo-500/10'}`}>
                          <span className="text-[8px] text-indigo-400/50 font-mono mb-0.5 tracking-tighter">${row.ofG.toFixed(0)}</span>
                          <span className="text-indigo-300 font-outfit font-black text-xs leading-none">${row.ofN.toFixed(0)}</span>
                        </div>
                      </td>
                      <td className="px-2 py-4 text-center">
                        <div className={`inline-flex flex-col items-center border rounded-xl p-2 min-w-[65px] transition-colors duration-500 ${row.isPaid ? 'bg-white/[0.01] border-white/5 opacity-40' : 'bg-sky-500/[0.03] border-sky-500/10 group-hover/row:bg-sky-500/10'}`}>
                          <span className="text-[8px] text-sky-400/50 font-mono mb-0.5 tracking-tighter">${row.ppG.toFixed(0)}</span>
                          <span className="text-sky-300 font-outfit font-black text-xs leading-none">${row.ppN.toFixed(0)}</span>
                        </div>
                      </td>
                      <td className="px-2 py-4 text-center">
                        <div className={`inline-flex flex-col items-center border rounded-xl p-2 min-w-[65px] transition-colors duration-500 ${row.isPaid ? 'bg-white/[0.01] border-white/5 opacity-40' : 'bg-emerald-500/[0.03] border-emerald-500/10 group-hover/row:bg-emerald-500/10'}`}>
                          <span className="text-[8px] text-emerald-400/50 font-mono mb-0.5 tracking-tighter">${row.crG.toFixed(0)}</span>
                          <span className="text-emerald-300 font-outfit font-black text-xs leading-none">${row.crN.toFixed(0)}</span>
                        </div>
                      </td>
                      <td className="px-2 py-4">
                        <div className={`flex flex-wrap justify-center gap-1 max-w-[150px] mx-auto ${row.isPaid ? 'opacity-30' : ''}`}>
                          {row.bonuses > 0 && (
                            <div className="px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-md text-[7px] font-black uppercase tracking-tight flex items-center gap-1">
                              +${row.bonuses.toFixed(0)}
                            </div>
                          )}
                          {row.penalties > 0 && (
                            <div className="px-1.5 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-md text-[7px] font-black uppercase tracking-tight flex items-center gap-1">
                              -${row.penalties.toFixed(0)}
                            </div>
                          )}
                          {row.advances > 0 && (
                            <div className="px-1.5 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-md text-[7px] font-black uppercase tracking-tight flex items-center gap-1">
                              -${row.advances.toFixed(0)}
                            </div>
                          )}
                          {row.refunds > 0 && (
                            <div className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded-md text-[7px] font-black uppercase tracking-tight flex items-center gap-1">
                              -${row.refunds.toFixed(0)}
                            </div>
                          )}
                          {row.bonuses === 0 && row.penalties === 0 && row.advances === 0 && row.refunds === 0 && (
                            <span className="text-slate-700 text-[8px] font-bold">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className={`text-base font-black font-outfit tracking-tighter px-3 py-1.5 rounded-xl transition-all duration-500 group-hover/row:scale-105 ${row.isPaid ? 'text-slate-600 bg-white/[0.01] border border-white/5 opacity-50' : (row.remainder >= 0 ? 'text-emerald-400 bg-emerald-400/5 border border-emerald-500/10' : 'text-rose-400 bg-rose-400/5 border border-rose-500/10')}`}>
                          ${row.remainder.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <button 
                          onClick={() => toggleOperatorPaid(row.op, row.remainder)} 
                          className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all duration-300 shadow-xl transform hover:-translate-y-0.5 active:scale-95 ${row.isPaid ? 'bg-emerald-600/10 text-emerald-500/50 border border-emerald-500/10 cursor-not-allowed' : 'bg-gradient-to-r from-indigo-600 to-indigo-500 text-white shadow-indigo-600/20 border border-white/10'}`}
                        >
                          {row.isPaid ? 'Paid' : 'Pay'}
                        </button>
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
      </div>
    </div>
  );
};

export default Dashboard;
