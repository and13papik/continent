
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppState, AccountingPeriod, PaidStatus, OperationRecord, IncomeRecord } from '../types';
import { ICONS } from '../constants';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell
} from 'recharts';
import { motion } from 'motion/react';

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
    indigo: 'from-indigo-500/[0.08] to-indigo-500/[0.02] border-indigo-500/20 text-indigo-400 group-hover:border-indigo-500/40',
    sky: 'from-sky-500/[0.08] to-sky-500/[0.02] border-sky-500/20 text-sky-400 group-hover:border-sky-500/40',
    emerald: 'from-emerald-500/[0.08] to-emerald-500/[0.02] border-emerald-500/20 text-emerald-400 group-hover:border-emerald-500/40',
    rose: 'from-rose-500/[0.08] to-rose-500/[0.02] border-rose-500/20 text-rose-400 group-hover:border-rose-500/40',
    amber: 'from-amber-400/[0.12] to-amber-600/[0.04] border-amber-500/30 text-amber-400 group-hover:border-amber-400/50',
    blue: 'from-blue-500/[0.08] to-blue-500/[0.02] border-blue-500/20 text-blue-400 group-hover:border-blue-500/40'
  };

  const currentClass = colorClasses[color] || 'from-slate-800/10 to-slate-900/5 border-slate-700/20';
  const isGold = color === 'amber' && highlighted;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.015, y: -2 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className={`relative group bg-gradient-to-b ${currentClass} ${highlighted ? 'p-6' : 'p-5'} rounded-2xl border backdrop-blur-xl transition-all duration-300 shadow-sm overflow-hidden min-w-0 ${isGold ? 'border-amber-500/40 shadow-[0_8px_30px_rgb(0,0,0,0.12)]' : highlighted ? 'border-white/10' : ''}`}
    >
      {/* Subtle inner highlight */}
      <div className="absolute inset-0 border border-white/[0.03] rounded-2xl pointer-events-none" />
      
      {/* Decorative gradient overlay */}
      <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700 ${isGold ? 'bg-[radial-gradient(circle_at_50%_0%,rgba(245,158,11,0.08),transparent)]' : 'bg-[radial-gradient(circle_at_50%_0%,rgba(255,255,255,0.03),transparent)]'}`} />
      
      {isGold && (
        <>
          <div className="absolute -right-12 -top-12 w-40 h-40 bg-amber-500/10 blur-[80px] pointer-events-none" />
          
          <motion.div 
            animate={{ 
              x: ['-200%', '200%'],
            }}
            transition={{ 
              duration: 4, 
              repeat: Infinity, 
              ease: "linear",
              repeatDelay: 5
            }}
            className="absolute top-0 bottom-0 w-32 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent skew-x-[-20deg] pointer-events-none"
          />
        </>
      )}
      
      <div className="relative flex items-center gap-5 overflow-visible">
        <div className={`relative w-12 h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 ${isGold ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20' : highlighted ? 'bg-white/5 text-white border border-white/10' : 'bg-slate-800/30 text-slate-400 border border-slate-700/20'}`}>
          <div className="relative z-10 scale-110">
            {icon}
          </div>
        </div>
        <div className="min-w-0 flex-1 overflow-visible">
          <p className={`text-[10px] uppercase font-bold tracking-[0.2em] mb-1.5 opacity-60 group-hover:opacity-100 transition-opacity ${isGold ? 'text-amber-400/90' : 'text-slate-400'}`}>{title}</p>
          <div className="flex items-baseline gap-2">
            <p className={`font-black text-white font-outfit leading-none whitespace-nowrap overflow-visible ${highlighted ? 'text-3xl tracking-tight' : 'text-2xl tracking-tight'}`}>
              {value}
            </p>
          </div>
          {subValue && (
            <div className="flex items-center gap-2 mt-2.5">
              <span className="text-[9px] font-bold py-0.5 px-2 rounded-full bg-white/[0.03] border border-white/[0.05] text-slate-500 font-mono tracking-wider uppercase whitespace-nowrap">
                {subLabel}
              </span>
              <p className="text-[11px] font-bold text-slate-500 font-mono whitespace-nowrap">
                {subValue}
              </p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
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
      {/* Subtle background glow */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-500/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[120px]" />
      </div>

      <div className="relative space-y-10 animate-in fade-in duration-700 pb-20 max-w-[1600px] mx-auto px-4 sm:px-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white font-outfit">Main Dashboard</h1>
          <div className="flex flex-wrap items-center gap-4 mt-1">
             <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest opacity-60">Период:</span>
                <select className="bg-white/[0.03] border border-white/[0.08] hover:border-white/20 rounded-xl px-4 py-1.5 text-indigo-400 font-bold outline-none cursor-pointer text-sm transition-colors" value={state.selectedPeriodId} onChange={(e) => updateState(prev => ({ ...prev, selectedPeriodId: e.target.value }))}>
                   {[...state.accountingPeriods].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()).reverse().map(p => <option key={p.id} value={p.id} className="bg-slate-900">{p.label} {p.status === 'closed' ? '🔒' : ''}</option>)}
                </select>
             </div>
             
              <div className="flex items-center gap-3">
                {activePeriod?.status === 'open' ? (
                   <button 
                     onClick={handleCloseMonth} 
                     className="flex items-center gap-2 px-4 py-2 bg-rose-500/[0.08] hover:bg-rose-500 text-rose-500 hover:text-white text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all border border-rose-500/20 hover:border-rose-500 active:scale-95 shadow-sm group"
                   >
                     <LockIcon size={14} className="group-hover:rotate-12 transition-transform duration-300" /> Закрыть месяц
                   </button>
                ) : (
                   <div className="flex items-center gap-2 px-4 py-2 bg-white/[0.03] text-slate-500 text-[10px] font-bold uppercase tracking-widest rounded-xl border border-white/[0.05]">
                     <LockIcon size={14} /> Месяц закрыт
                   </div>
                )}
                
                {isLatestPeriod && (
                   <button 
                     onClick={handleStartNextMonth} 
                     className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-widest rounded-xl transition-all shadow-[0_4px_15px_rgba(79,70,229,0.2)] hover:shadow-[0_4px_25px_rgba(79,70,229,0.3)] active:scale-95 group"
                   >
                     <ICONS.Plus size={14} className="group-hover:scale-125 transition-transform duration-300" /> Открыть следующий
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

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-8">
        <div className="space-y-6">
          <div className="flex items-center gap-3 ml-1">
             <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
             <h2 className="text-[10px] uppercase font-bold tracking-[0.25em] text-slate-400 opacity-60">Доходы и Платформы</h2>
          </div>
          <div className="flex flex-col gap-4">
            <StatCard title="ОБЩИЙ ТОТАЛ (Грязными)" value={`$${stats.totalGross.toLocaleString()}`} color="amber" icon={<span className="text-2xl">💰</span>} highlighted />
            <div className="grid grid-cols-1 gap-3 pt-2 border-t border-slate-800/50">
              <StatCard title="ONLYFANS" value={`$${stats.of.gross.toLocaleString()}`} subValue={`$${stats.of.net.toLocaleString()}`} subLabel="Net" color="indigo" icon={<IncomeIcon size={16}/>} />
              <StatCard title="PAYPAL" value={`$${stats.pp.gross.toLocaleString()}`} subValue={`$${stats.pp.net.toLocaleString()}`} subLabel="Net" color="sky" icon={<TransferIcon size={16}/>} />
              <StatCard title="CRYPTO" value={`$${stats.cr.gross.toLocaleString()}`} subValue={`$${stats.cr.net.toLocaleString()}`} subLabel="Net" color="emerald" icon={<IncomeIcon size={16}/>} />
            </div>
          </div>
        </div>
        <div className="space-y-6">
          <div className="flex items-center gap-3 ml-1">
             <div className="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]"></div>
             <h2 className="text-[10px] uppercase font-bold tracking-[0.25em] text-slate-400 opacity-60">Корректировки</h2>
          </div>
          <div className="flex flex-col gap-3">
            <StatCard title="ШТРАФОВ" value={`$${stats.penalties.toLocaleString()}`} color="rose" icon={<PenaltyIcon size={16}/>} />
            <StatCard title="БОНУСОВ" value={`$${stats.bonuses.toLocaleString()}`} color="emerald" icon={<BonusIcon size={16}/>} />
            <StatCard title="ВОЗВРАТОВ" value={`$${stats.refunds.toLocaleString()}`} color="blue" icon={<RotateIcon size={16}/>} />
            <StatCard title="АВАНСОВ (Staff)" value={`$${stats.advances.toLocaleString()}`} color="amber" icon={<AdvanceIcon size={16}/>} />
          </div>
        </div>
        <div className="space-y-6">
          <div className="flex items-center gap-3 ml-1">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]"></div>
             <h2 className="text-[10px] uppercase font-bold tracking-[0.25em] text-slate-400 opacity-60">Операционная ЗП</h2>
          </div>
          <div className="flex flex-col gap-3">
            <StatCard title="ОБЩАЯ ЗП ОПЕРАТОРОВ" value={`$${stats.netEarned.toLocaleString()}`} color="emerald" icon={<SalaryIcon size={16}/>} />
            <StatCard title="ВЫПЛАЧЕНО ОПЕРАТОРАМ" value={`$${stats.paidOut.toLocaleString()}`} color="sky" icon={<TransferIcon size={16}/>} />
            <StatCard title="ОСТАТОК ОПЕРАТОРАМ" value={`$${stats.remainder.toLocaleString()}`} color="emerald" icon={<RemainderIcon size={16}/>} highlighted />
          </div>
        </div>
        <div className="space-y-6">
          <div className="flex items-center gap-3 ml-1">
             <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]"></div>
             <h2 className="text-[10px] uppercase font-bold tracking-[0.25em] text-slate-400 opacity-60">Администраторы</h2>
          </div>
          <div className="flex flex-col gap-3">
            {stats.adminDetails.map((ad) => (
              <motion.div 
                key={ad.name}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                whileHover={{ scale: 1.015 }}
                className="relative group glass-card p-5 rounded-2xl bg-slate-900/40 border border-white/[0.05] transition-all duration-300 flex flex-col justify-center min-w-0 shadow-sm hover:shadow-indigo-500/[0.05] hover:border-white/10 overflow-hidden"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="flex justify-between items-start mb-2.5">
                  <p className="text-[10px] uppercase text-slate-500 font-black tracking-widest truncate opacity-70 group-hover:opacity-100 transition-opacity">{ad.name}</p>
                  <span className="text-[10px] text-indigo-400 font-bold bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 shadow-sm">{ad.rate}%</span>
                </div>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <p className="text-2xl font-black text-white font-outfit leading-none">${ad.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                </div>
              </motion.div>
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
    </div>
  );
};

export default Dashboard;
