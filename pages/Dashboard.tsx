
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppState, AccountingPeriod, PaidStatus } from '../types';
import { ICONS } from '../constants';

interface DashboardProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ state, updateState }) => {
  const navigate = useNavigate();
  const activePeriodId = state.selectedPeriodId;
  const activePeriod = state.accountingPeriods.find(p => p.id === activePeriodId);

  const stats = useMemo(() => {
    const periodIncomes = state.incomeData.filter(r => r.periodId === activePeriodId);
    const manualIncomes = (state.ownerManualIncomes || []).filter(i => i.periodId === activePeriodId);
    const periodOps = state.operationsData.filter(o => o.periodId === activePeriodId);
    
    const platformGross = periodIncomes.reduce((s, r) => s + r.total, 0);
    const manualGross = manualIncomes.reduce((s, i) => s + i.amount, 0);
    const totalGross = platformGross + manualGross;
    
    const totals = { 
      totalGross,
      platformGross,
      manualGross,
      netEarned: 0, // Чистая ЗП операторов (база)
      bonuses: 0,
      penalties: 0,
      paidOut: 0, // Получено (авансы + выплаты ЗП)
      remainder: 0, // Остаток к получению
      adminDetails: [] as { name: string, amount: number, rate: number }[],
      of: { gross: 0, net: 0 }, 
      pp: { gross: 0, net: 0 }, 
      cr: { gross: 0, net: 0 } 
    };

    // Расчет доходов по платформам и базовой чистой ЗП
    periodIncomes.forEach(r => {
      totals.netEarned += (r.nettoOF + r.nettoPP + r.nettoCrypto);
      totals.of.gross += r.onlyFans;
      totals.of.net += r.nettoOF;
      totals.pp.gross += r.paypal;
      totals.pp.net += r.nettoPP;
      totals.cr.gross += r.crypto;
      totals.cr.net += r.nettoCrypto;
    });

    // Расчет корректировок (бонусы, штрафы, выплаты)
    periodOps.forEach(op => {
      if (op.type === 'bonus') {
        totals.bonuses += op.amount;
      } else if (op.type === 'penalty' || op.type === 'refund' || op.type === 'internship') {
        totals.penalties += op.amount;
      } else if (op.type === 'advance' || op.type === 'salary_payment') {
        totals.paidOut += op.amount;
      }
    });

    // Остаток = (Чистая ЗП + Бонусы) - (Штрафы/Удержания + Выплачено)
    totals.remainder = (totals.netEarned + totals.bonuses) - (totals.penalties + totals.paidOut);

    state.admins.forEach(admin => {
      totals.adminDetails.push({ 
        name: admin.name, 
        amount: totalGross * (admin.rate / 100),
        rate: admin.rate
      });
    });

    return totals;
  }, [state.incomeData, state.ownerManualIncomes, state.operationsData, state.admins, activePeriodId]);

  const operatorRows = useMemo(() => {
    const raw = state.operators.map(op => {
      const incomes = state.incomeData.filter(r => r.operator === op && r.periodId === activePeriodId);
      const ops = state.operationsData.filter(o => o.operator === op && o.periodId === activePeriodId);
      
      const ofG = incomes.reduce((sum, r) => sum + r.onlyFans, 0);
      const ofN = incomes.reduce((sum, r) => sum + r.nettoOF, 0);
      const ppG = incomes.reduce((sum, r) => sum + r.paypal, 0);
      const ppN = incomes.reduce((sum, r) => sum + r.nettoPP, 0);
      const crG = incomes.reduce((sum, r) => sum + r.crypto, 0);
      const crN = incomes.reduce((sum, r) => sum + r.nettoCrypto, 0);
      
      const totalNet = ofN + ppN + crN;
      const totalGross = ofG + ppG + crG;
      
      const adjPlus = ops.filter(o => o.type === 'bonus').reduce((sum, o) => sum + o.amount, 0);
      const adjMinus = ops.filter(o => ['penalty', 'refund', 'advance', 'salary_payment', 'internship'].includes(o.type)).reduce((sum, o) => sum + o.amount, 0);

      const remainder = totalNet + adjPlus - adjMinus;
      const isPaid = state.paidStatuses.some(s => s.entityName === op && s.entityType === 'operator' && s.periodId === activePeriodId);

      return { op, totalGross, ofG, ofN, ppG, ppN, crG, crN, remainder, isPaid };
    });

    const sorted = raw.sort((a, b) => b.remainder - a.remainder);
    const maxGross = Math.max(...sorted.map(r => r.totalGross), 1);
    return sorted.map(r => ({ ...r, percentOfMax: (r.totalGross / maxGross) * 100 }));
  }, [state.incomeData, state.operationsData, state.operators, activePeriodId, state.paidStatuses]);

  const handleCloseMonth = () => {
    if (!activePeriod || activePeriod.status === 'closed') return;
    const confirmClose = window.confirm(`Закрыть период "${activePeriod.label}"?`);
    if (!confirmClose) return;

    updateState(prev => {
      const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
      const lastP = prev.accountingPeriods[prev.accountingPeriods.length - 1];
      let nextMonthIdx = new Date().getMonth(), nextYear = new Date().getFullYear();
      if (lastP) {
        const lastDate = new Date(lastP.startAt);
        nextMonthIdx = lastDate.getMonth() + 1; nextYear = lastDate.getFullYear();
        if (nextMonthIdx > 11) { nextMonthIdx = 0; nextYear += 1; }
      }
      const nextPeriodLabel = `${months[nextMonthIdx]} ${nextYear}`;
      const nextId = String(Date.now());
      const newP: AccountingPeriod = { id: nextId, label: nextPeriodLabel, startAt: new Date(nextYear, nextMonthIdx, 1).toISOString(), endAt: null, status: 'open' };
      return { ...prev, accountingPeriods: [...prev.accountingPeriods.map(p => p.id === activePeriodId ? { ...p, status: 'closed' as const, endAt: new Date().toISOString() } : p), newP], selectedPeriodId: nextId };
    });
  };

  const toggleOperatorPaid = (op: string) => {
    updateState(prev => {
      const exists = prev.paidStatuses.some(s => s.entityName === op && s.entityType === 'operator' && s.periodId === activePeriodId);
      if (exists) return { ...prev, paidStatuses: prev.paidStatuses.filter(s => !(s.entityName === op && s.entityType === 'operator' && s.periodId === activePeriodId)) };
      
      const newPaid: PaidStatus = {
        id: `paid-op-${op}-${activePeriodId}`,
        entityName: op,
        entityType: 'operator',
        periodId: activePeriodId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      return { ...prev, paidStatuses: [...prev.paidStatuses, newPaid] };
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white font-outfit">Main Dashboard</h1>
          <div className="flex items-center gap-4 mt-2">
             <select className="bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-1.5 text-indigo-400 font-bold outline-none cursor-pointer" value={state.selectedPeriodId} onChange={(e) => updateState(prev => ({ ...prev, selectedPeriodId: e.target.value }))}>
                {state.accountingPeriods.slice().reverse().map(p => <option key={p.id} value={p.id}>{p.label} {p.status === 'closed' ? '🔒' : ''}</option>)}
             </select>
             {activePeriod?.status === 'open' && (
                <button onClick={handleCloseMonth} className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg active:scale-95">
                  <ICONS.Lock size={14} /> Закрыть месяц
                </button>
             )}
          </div>
        </div>
      </header>

      <div className="space-y-8">
        {/* БЛОК 1: ОСНОВНЫЕ ПОКАЗАТЕЛИ ОПЕРАТОРОВ (6 карточек) */}
        <div>
          <h2 className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-500 mb-4 ml-1">Операционная деятельность</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6 gap-4">
            <div className="glass-card p-5 xl:p-6 rounded-3xl bg-indigo-500/5 border-indigo-500/20 transition-transform hover:scale-[1.02] flex flex-col justify-center min-w-0">
              <p className="text-[10px] uppercase text-slate-500 font-black tracking-widest mb-1 truncate">ОБЩИЙ ТОТАЛ (грязными)</p>
              <p className="text-xl xl:text-2xl font-black text-white font-outfit leading-tight whitespace-nowrap overflow-visible">
                ${stats.totalGross.toLocaleString()}
              </p>
              {stats.manualGross > 0 && <p className="text-[9px] text-emerald-400 font-bold mt-2 truncate">Incl. ${stats.manualGross.toLocaleString()} extra</p>}
            </div>

            <StatCard title="ОБЩАЯ ЗП ОПЕРАТОРОВ (ЧИСТЫМИ)" value={`$${stats.netEarned.toLocaleString()}`} color="emerald" icon={<ICONS.Salary size={20}/>} />
            <StatCard title="ШТРАФОВ" value={`$${stats.penalties.toLocaleString()}`} color="rose" icon={<ICONS.Penalty size={20}/>} />
            <StatCard title="БОНУСОВ" value={`$${stats.bonuses.toLocaleString()}`} color="emerald" icon={<ICONS.Bonus size={20}/>} />
            <StatCard title="ПОЛУЧЕНО" value={`$${stats.paidOut.toLocaleString()}`} color="sky" icon={<ICONS.Transfer size={20}/>} />
            <StatCard title="ОСТАТОК К ПОЛУЧЕНИЮ" value={`$${stats.remainder.toLocaleString()}`} color="indigo" icon={<ICONS.BadgeDollarSign size={20}/>} highlighted />
          </div>
        </div>

        {/* БЛОК 2: ПЛАТФОРМЫ И АДМИНЫ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
           {/* Платформы */}
           <div className="space-y-4">
             <h2 className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-500 ml-1">Платформы</h2>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StatCard 
                  title="PayPal" 
                  value={`$${stats.pp.gross.toLocaleString()}`} 
                  subValue={`$${stats.pp.net.toLocaleString()}`}
                  subLabel="N"
                  color="sky" 
                  icon={<ICONS.Transfer size={20}/>} 
                />
                <StatCard 
                  title="Crypto" 
                  value={`$${stats.cr.gross.toLocaleString()}`} 
                  subValue={`$${stats.cr.net.toLocaleString()}`}
                  subLabel="N"
                  color="emerald" 
                  icon={<ICONS.Income size={20}/>} 
                />
             </div>
           </div>

           {/* Админы */}
           <div className="space-y-4">
             <h2 className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-500 ml-1">Администраторы</h2>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {stats.adminDetails.map((ad) => (
                  <div key={ad.name} className="glass-card p-5 xl:p-6 rounded-3xl bg-slate-900/40 border-slate-800 transition-transform hover:scale-[1.02] flex flex-col justify-center min-w-0">
                    <p className="text-[10px] uppercase text-slate-500 font-black tracking-widest mb-1 truncate">{ad.name}</p>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <p className="text-xl xl:text-2xl font-black text-white font-outfit leading-tight whitespace-nowrap overflow-visible">
                        ${ad.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </p>
                      <span className="text-[9px] text-slate-500 font-bold">({ad.rate}%)</span>
                    </div>
                  </div>
                ))}
             </div>
           </div>
        </div>
      </div>

      <div className="glass-card rounded-[2.5rem] overflow-hidden shadow-2xl border-slate-800/50">
        <div className="p-8 border-b border-slate-800 bg-slate-900/40 flex flex-col md:flex-row justify-between items-center gap-4">
          <h2 className="text-xl font-bold font-outfit">Ведомость персонала (Топ по выплатам)</h2>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sorted by Balance</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-slate-900/50 text-slate-500 uppercase text-[10px] font-black tracking-widest border-b border-slate-800">
                <th className="px-8 py-6">Оператор</th>
                <th className="px-4 py-6 text-center">Общий Gross</th>
                <th className="px-4 py-6 text-center">OF (G / N)</th>
                <th className="px-4 py-6 text-center">PP (G / N)</th>
                <th className="px-4 py-6 text-center">CR (G / N)</th>
                <th className="px-4 py-6 text-center">Остаток (Net)</th>
                <th className="px-8 py-6 text-right">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {operatorRows.map(row => (
                <tr key={row.op} className="hover:bg-indigo-500/5 transition-all">
                  <td className="px-8 py-5">
                    <div className="font-bold text-white text-base cursor-pointer" onClick={() => navigate('/reports', { state: { operator: row.op } })}>{row.op}</div>
                  </td>
                  <td className="px-4 py-5 w-48">
                    <div className="flex flex-col gap-1.5">
                       <div className="flex justify-between text-[9px] font-black text-slate-500">
                          <span>${row.totalGross.toFixed(0)}</span>
                       </div>
                       <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                          <div className="h-full bg-indigo-500 rounded-full shadow-[0_0_8px_rgba(99,102,241,0.5)] transition-all duration-1000" style={{ width: `${row.percentOfMax}%` }}></div>
                       </div>
                    </div>
                  </td>
                  <td className="px-4 py-5 text-center">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500 font-mono">${row.ofG.toFixed(0)}</span>
                      <span className="text-blue-400 font-mono font-bold">${row.ofN.toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-5 text-center">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500 font-mono">${row.ppG.toFixed(0)}</span>
                      <span className="text-sky-400 font-mono font-bold">${row.ppN.toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-5 text-center">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-slate-500 font-mono">${row.crG.toFixed(0)}</span>
                      <span className="text-emerald-400 font-mono font-bold">${row.crN.toFixed(1)}</span>
                    </div>
                  </td>
                  <td className="px-4 py-5 text-center">
                    <div className={`text-base font-black font-mono ${row.remainder >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ${row.remainder.toFixed(1)}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button onClick={() => toggleOperatorPaid(row.op)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${row.isPaid ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}>
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

const StatCard: React.FC<{ 
  title: string; 
  value: string; 
  icon: any; 
  color: string; 
  subValue?: string;
  subLabel?: string;
  highlighted?: boolean;
}> = ({ title, value, icon, color, subValue, subLabel = 'N', highlighted }) => (
  <div className={`glass-card p-5 xl:p-6 rounded-3xl flex flex-col justify-center transition-transform hover:scale-[1.02] min-w-0 ${highlighted ? `border-${color}-500/40 bg-${color}-500/10 shadow-xl shadow-${color}-500/5` : 'border-slate-800'}`}>
    <div className="flex items-center gap-3 xl:gap-4 overflow-visible">
      <div className={`w-10 h-10 xl:w-12 xl:h-12 rounded-2xl flex items-center justify-center bg-${color}-500/10 text-${color}-400 shadow-inner shrink-0`}>{icon}</div>
      <div className="min-w-0 flex-1 overflow-visible">
        <p className="text-[10px] uppercase text-slate-500 font-black tracking-widest mb-0.5 truncate">{title}</p>
        <p className="text-xl xl:text-2xl font-black text-white font-outfit leading-tight whitespace-nowrap overflow-visible">
          {value}
        </p>
        {subValue && (
          <p className={`text-[9px] font-bold mt-1.5 text-${color}-400/80 font-mono whitespace-nowrap`}>
            {subLabel}: {subValue}
          </p>
        )}
      </div>
    </div>
  </div>
);

export default Dashboard;
