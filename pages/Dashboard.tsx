
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppState, AccountingPeriod } from '../types';
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
    
    const platformGross = periodIncomes.reduce((s, r) => s + r.total, 0);
    const manualGross = manualIncomes.reduce((s, i) => s + i.amount, 0);
    const totalGross = platformGross + manualGross;
    
    const totals = { 
      totalGross,
      platformGross,
      manualGross,
      net: 0, 
      adminDetails: [] as { name: string, amount: number, rate: number }[],
      of: { gross: 0, net: 0 }, 
      pp: { gross: 0, net: 0 }, 
      cr: { gross: 0, net: 0 } 
    };

    periodIncomes.forEach(r => {
      totals.net += (r.nettoOF + r.nettoPP + r.nettoCrypto);
      totals.of.gross += r.onlyFans;
      totals.of.net += r.nettoOF;
      totals.pp.gross += r.paypal;
      totals.pp.net += r.nettoPP;
      totals.cr.gross += r.crypto;
      totals.cr.net += r.nettoCrypto;
    });

    // Расчет комиссий каждого админа отдельно
    state.admins.forEach(admin => {
      totals.adminDetails.push({ 
        name: admin.name, 
        amount: totalGross * (admin.rate / 100),
        rate: admin.rate
      });
    });

    return totals;
  }, [state.incomeData, state.ownerManualIncomes, state.admins, activePeriodId]);

  const handleCloseMonth = () => {
    if (!activePeriod || activePeriod.status === 'closed') return;
    
    const confirmClose = window.confirm(
      `Вы уверены, что хотите ЗАКРЫТЬ период "${activePeriod.label}"?\n\nПосле закрытия будет создан новый месяц, а этот станет доступен только для чтения.`
    );

    if (!confirmClose) return;

    updateState(prev => {
      const now = new Date();
      // Определяем следующий месяц для названия
      // Ищем последний созданный период, чтобы вычислить следующий за ним
      const lastP = prev.accountingPeriods[prev.accountingPeriods.length - 1];
      
      // Попробуем распарсить название типа "Июнь 2024"
      const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
      
      let nextMonthIdx = now.getMonth();
      let nextYear = now.getFullYear();

      // Если в системе уже есть периоды, берем дату последнего и прибавляем месяц
      if (lastP) {
        const lastDate = new Date(lastP.startAt);
        nextMonthIdx = lastDate.getMonth() + 1;
        nextYear = lastDate.getFullYear();
        if (nextMonthIdx > 11) {
          nextMonthIdx = 0;
          nextYear += 1;
        }
      }

      const nextPeriodLabel = `${months[nextMonthIdx]} ${nextYear}`;
      const nextPeriodId = String(Date.now());
      
      const newPeriod: AccountingPeriod = {
        id: nextPeriodId,
        label: nextPeriodLabel,
        startAt: new Date(nextYear, nextMonthIdx, 1).toISOString(),
        endAt: null,
        status: 'open'
      };

      // Закрываем текущий и добавляем новый
      const updatedPeriods = prev.accountingPeriods.map(p => 
        p.id === activePeriodId ? { ...p, status: 'closed' as const, endAt: new Date().toISOString() } : p
      );

      return {
        ...prev,
        accountingPeriods: [...updatedPeriods, newPeriod],
        selectedPeriodId: nextPeriodId
      };
    });
  };

  const toggleOperatorPaid = (op: string) => {
    updateState(prev => {
      const exists = prev.paidStatuses.some(s => s.entityName === op && s.entityType === 'operator' && s.periodId === activePeriodId);
      if (exists) {
        return { ...prev, paidStatuses: prev.paidStatuses.filter(s => !(s.entityName === op && s.entityType === 'operator' && s.periodId === activePeriodId)) };
      } else {
        return { ...prev, paidStatuses: [...prev.paidStatuses, { entityName: op, entityType: 'operator', periodId: activePeriodId }] };
      }
    });
  };

  const operatorRows = useMemo(() => {
    return state.operators.map(op => {
      const incomes = state.incomeData.filter(r => r.operator === op && r.periodId === activePeriodId);
      const ops = state.operationsData.filter(o => o.operator === op && o.periodId === activePeriodId);
      
      const ofG = incomes.reduce((sum, r) => sum + r.onlyFans, 0);
      const ofN = incomes.reduce((sum, r) => sum + r.nettoOF, 0);
      const ppG = incomes.reduce((sum, r) => sum + r.paypal, 0);
      const ppN = incomes.reduce((sum, r) => sum + r.nettoPP, 0);
      const crG = incomes.reduce((sum, r) => sum + r.crypto, 0);
      const crN = incomes.reduce((sum, r) => sum + r.nettoCrypto, 0);
      
      const totalNet = ofN + ppN + crN;
      
      const adjPlus = ops.filter(o => o.type === 'bonus').reduce((sum, o) => sum + o.amount, 0);
      const adjMinus = ops.filter(o => ['penalty', 'refund', 'advance', 'salary_payment', 'internship'].includes(o.type)).reduce((sum, o) => sum + o.amount, 0);

      const paid = ops.filter(o => ['advance', 'salary_payment'].includes(o.type)).reduce((sum, o) => sum + o.amount, 0);
      const remainder = totalNet + adjPlus - adjMinus;

      const isPaid = state.paidStatuses.some(s => s.entityName === op && s.entityType === 'operator' && s.periodId === activePeriodId);

      return { 
        op, 
        totalGross: ofG + ppG + crG,
        ofG, ofN,
        ppG, ppN,
        crG, crN,
        paid, 
        remainder,
        isPaid
      };
    });
  }, [state.incomeData, state.operationsData, state.operators, activePeriodId, state.paidStatuses]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white font-outfit">Dashboard Personnel</h1>
          <div className="flex flex-wrap items-center gap-4 mt-2">
             <div className="flex items-center gap-2">
                <span className="text-slate-500 text-[10px] font-black uppercase tracking-widest">Период:</span>
                <select 
                  className="bg-slate-900/50 border border-slate-800 rounded-xl px-4 py-1.5 text-indigo-400 font-bold outline-none cursor-pointer hover:bg-slate-800 transition-colors shadow-lg"
                  value={state.selectedPeriodId}
                  onChange={(e) => updateState(prev => ({ ...prev, selectedPeriodId: e.target.value }))}
                >
                  {state.accountingPeriods.slice().reverse().map(p => (
                    <option key={p.id} value={p.id} className="bg-slate-950">{p.label} {p.status === 'closed' ? '🔒' : ''}</option>
                  ))}
                </select>
             </div>

             {activePeriod?.status === 'open' && (
                <button 
                  onClick={handleCloseMonth}
                  className="flex items-center gap-2 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-95 border border-indigo-500/30"
                >
                  <ICONS.Lock size={14} />
                  Закрыть месяц
                </button>
             )}
          </div>
        </div>
      </header>

      {/* Верхние карточки статистики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Кастомная карточка Total Brutto */}
        <div className="glass-card p-6 rounded-3xl flex flex-col justify-center gap-2 border-indigo-500/20 transition-transform hover:scale-[1.02] bg-indigo-500/5 shadow-xl shadow-indigo-500/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center bg-indigo-500/10 text-indigo-400 shadow-inner">
              <ICONS.Income size={24}/>
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-500 font-black tracking-widest mb-0.5">Total Brutto</p>
              <p className="text-2xl font-black text-white font-outfit leading-none">
                ${stats.totalGross.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
          {stats.manualGross > 0 && (
            <div className="mt-1 px-3 py-1.5 bg-slate-950/50 rounded-xl border border-slate-800">
               <p className="text-[9px] text-slate-500 font-bold flex justify-between">
                 <span>Platform:</span>
                 <span className="text-white">${stats.platformGross.toLocaleString()}</span>
               </p>
               <p className="text-[9px] text-emerald-500/80 font-bold flex justify-between">
                 <span>Balance+:</span>
                 <span className="text-emerald-400 font-black">+${stats.manualGross.toLocaleString()}</span>
               </p>
            </div>
          )}
        </div>

        <StatCard title="Staff Net" value={`$${stats.net.toLocaleString()}`} color="emerald" icon={<ICONS.Salary size={20}/>} />
        
        {/* Карточки админов */}
        {stats.adminDetails.map((ad, idx) => (
          <div key={ad.name} className={`glass-card p-6 rounded-3xl flex items-center gap-4 border-slate-800 transition-transform hover:scale-[1.02] ${idx === 0 ? 'bg-violet-500/5' : 'bg-purple-500/5'}`}>
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${idx === 0 ? 'bg-violet-500/10 text-violet-400' : 'bg-purple-500/10 text-purple-400'} shadow-inner`}>
              <ICONS.Owner size={20}/>
            </div>
            <div>
              <p className="text-[10px] uppercase text-slate-500 font-black tracking-widest mb-0.5">{ad.name}</p>
              <div className="flex items-baseline gap-2">
                <p className="text-xl font-black text-white font-outfit leading-none">${ad.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                <span className="text-[9px] text-slate-500 font-bold">({ad.rate}%)</span>
              </div>
            </div>
          </div>
        ))}

        <div className="hidden lg:block">
           <StatCard title="PP & CR Net" value={`$${(stats.pp.net + stats.cr.net).toLocaleString()}`} color="sky" icon={<ICONS.Bonus size={20}/>} />
        </div>
      </div>

      <div className="glass-card rounded-[2.5rem] overflow-hidden shadow-2xl border-indigo-500/10">
        <div className="p-8 border-b border-slate-800 bg-slate-900/40">
          <h2 className="text-xl font-bold font-outfit">Ведомость Операторов</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-slate-900/50 text-slate-500 uppercase text-[10px] font-black tracking-[0.15em]">
                <th className="px-8 py-6 border-b border-slate-800">Оператор</th>
                <th className="px-4 py-6 text-center border-b border-slate-800 bg-blue-500/5">OF (Brutto / Staff Net)</th>
                <th className="px-4 py-6 text-center border-b border-slate-800 bg-sky-500/5">PP (Brutto / Staff Net)</th>
                <th className="px-4 py-6 text-center border-b border-slate-800 bg-emerald-500/5">CR (Brutto / Staff Net)</th>
                <th className="px-4 py-6 text-center border-b border-slate-800">Выплачено</th>
                <th className="px-4 py-6 text-center border-b border-slate-800">Остаток</th>
                <th className="px-8 py-6 text-right border-b border-slate-800">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {operatorRows.map(row => (
                <tr key={row.op} className="hover:bg-indigo-500/5 transition-all">
                  <td className="px-8 py-5">
                    <div className="font-bold text-white text-base cursor-pointer hover:text-indigo-400 transition-colors" onClick={() => navigate('/reports', { state: { operator: row.op } })}>{row.op}</div>
                  </td>
                  <td className="px-4 py-5 text-center bg-blue-500/5">
                    <div className="text-blue-400 font-mono font-bold">${row.ofG.toFixed(0)}</div>
                    <div className="text-[9px] text-blue-500/60 font-black uppercase">Net: ${row.ofN.toFixed(1)}</div>
                  </td>
                  <td className="px-4 py-5 text-center bg-sky-500/5">
                    <div className="text-sky-400 font-mono font-bold">${row.ppG.toFixed(0)}</div>
                    <div className="text-[9px] text-sky-500/60 font-black uppercase">Net: ${row.ppN.toFixed(1)}</div>
                  </td>
                  <td className="px-4 py-5 text-center bg-emerald-500/5">
                    <div className="text-emerald-400 font-mono font-bold">${row.crG.toFixed(0)}</div>
                    <div className="text-[9px] text-emerald-500/60 font-black uppercase">Net: ${row.crN.toFixed(1)}</div>
                  </td>
                  <td className="px-4 py-5 text-center">
                    <span className="font-mono text-rose-500/80 font-bold">-${row.paid.toFixed(1)}</span>
                  </td>
                  <td className="px-4 py-5 text-center">
                    <div className={`text-base font-black font-mono ${row.remainder >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      ${row.remainder.toFixed(2)}
                    </div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button 
                      onClick={() => toggleOperatorPaid(row.op)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${row.isPaid ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}
                    >
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

const StatCard: React.FC<{ title: string; value: string; icon: any; color: string; subtitle?: string }> = ({ title, value, icon, color, subtitle }) => (
  <div className={`glass-card p-6 rounded-3xl flex flex-col justify-center gap-2 border-slate-800 transition-transform hover:scale-[1.02] bg-${color}-500/5`}>
    <div className="flex items-center gap-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-${color}-500/10 text-${color}-400 shadow-inner`}>{icon}</div>
      <div>
        <p className="text-[10px] uppercase text-slate-500 font-black tracking-widest mb-0.5">{title}</p>
        <p className="text-2xl font-black text-white font-outfit leading-none">{value}</p>
      </div>
    </div>
    {subtitle && <p className="text-[9px] text-slate-500 font-bold italic ml-1">{subtitle}</p>}
  </div>
);

export default Dashboard;
