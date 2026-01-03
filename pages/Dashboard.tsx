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

    state.admins.forEach(admin => {
      totals.adminDetails.push({ 
        name: admin.name, 
        amount: totalGross * (admin.rate / 100),
        rate: admin.rate
      });
    });

    return totals;
  }, [state.incomeData, state.ownerManualIncomes, state.admins, activePeriodId]);

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

      const paid = ops.filter(o => ['advance', 'salary_payment'].includes(o.type)).reduce((sum, o) => sum + o.amount, 0);
      const remainder = totalNet + adjPlus - adjMinus;

      const isPaid = state.paidStatuses.some(s => s.entityName === op && s.entityType === 'operator' && s.periodId === activePeriodId);

      return { op, totalGross, ofG, ofN, ppG, ppN, crG, crN, paid, remainder, isPaid };
    });

    const maxGross = Math.max(...raw.map(r => r.totalGross), 1);
    return raw.map(r => ({ ...r, percentOfMax: (r.totalGross / maxGross) * 100 }));
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
      return { ...prev, paidStatuses: [...prev.paidStatuses, { entityName: op, entityType: 'operator', periodId: activePeriodId }] };
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="glass-card p-6 rounded-3xl bg-indigo-500/5 border-indigo-500/20">
          <p className="text-[10px] uppercase text-slate-500 font-black tracking-widest mb-1">Total Gross</p>
          <p className="text-2xl font-black text-white font-outfit leading-none">${stats.totalGross.toLocaleString()}</p>
          {stats.manualGross > 0 && <p className="text-[9px] text-emerald-400 font-bold mt-2">Incl. ${stats.manualGross.toLocaleString()} extra</p>}
        </div>
        <StatCard title="Staff Total Net" value={`$${stats.net.toLocaleString()}`} color="emerald" icon={<ICONS.Salary size={20}/>} />
        {stats.adminDetails.map((ad, idx) => (
          <div key={ad.name} className={`glass-card p-6 rounded-3xl bg-slate-900/40 border-slate-800`}>
            <p className="text-[10px] uppercase text-slate-500 font-black tracking-widest mb-1">{ad.name}</p>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-black text-white font-outfit leading-none">${ad.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
              <span className="text-[9px] text-slate-500">({ad.rate}%)</span>
            </div>
          </div>
        ))}
        <StatCard title="PP & CR Net" value={`$${(stats.pp.net + stats.cr.net).toLocaleString()}`} color="sky" icon={<ICONS.Bonus size={20}/>} />
      </div>

      <div className="glass-card rounded-[2.5rem] overflow-hidden shadow-2xl border-slate-800/50">
        <div className="p-8 border-b border-slate-800 bg-slate-900/40 flex justify-between items-center">
          <h2 className="text-xl font-bold font-outfit">Ведомость персонала</h2>
          <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Performance Index</span>
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
                <th className="px-4 py-6 text-center">Остаток</th>
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
                    <button onClick={() => toggleOperatorPaid(row.op)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${row.isPaid ? 'bg-emerald-500 text-white' : 'bg-slate-800 text-slate-500'}`}>
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

const StatCard: React.FC<{ title: string; value: string; icon: any; color: string }> = ({ title, value, icon, color }) => (
  <div className={`glass-card p-6 rounded-3xl flex flex-col justify-center gap-2 border-slate-800 bg-${color}-500/5`}>
    <div className="flex items-center gap-4">
      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center bg-${color}-500/10 text-${color}-400 shadow-inner`}>{icon}</div>
      <div>
        <p className="text-[10px] uppercase text-slate-500 font-black tracking-widest mb-0.5">{title}</p>
        <p className="text-2xl font-black text-white font-outfit leading-none">{value}</p>
      </div>
    </div>
  </div>
);

export default Dashboard;