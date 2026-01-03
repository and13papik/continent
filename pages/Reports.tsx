import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AppState, IncomeRecord, OperationType, OperationRecord, Platform } from '../types';
import { ICONS, PLATFORM_NAMES, OPERATION_META } from '../constants';

interface ReportsProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const Reports: React.FC<ReportsProps> = ({ state, updateState }) => {
  const location = useLocation();
  const [selectedOperator, setSelectedOperator] = useState('');
  
  // Быстрые операции
  const [showQuickOp, setShowQuickOp] = useState(false);
  const [qType, setQType] = useState<OperationType>('advance');
  const [qAmount, setQAmount] = useState('');
  const [qComment, setQComment] = useState('');
  const [qPlatform, setQPlatform] = useState<Platform | 'all'>('all');

  // Edit States
  const [editingIncome, setEditingIncome] = useState<IncomeRecord | null>(null);
  const [editingOperation, setEditingOperation] = useState<OperationRecord | null>(null);

  useEffect(() => {
    if (location.state && (location.state as any).operator) {
      setSelectedOperator((location.state as any).operator);
    }
  }, [location.state]);

  const activePeriod = state.accountingPeriods.find(p => p.id === state.selectedPeriodId);

  const report = useMemo(() => {
    if (!selectedOperator) return null;
    const incomes = state.incomeData.filter(r => r.operator === selectedOperator && r.periodId === state.selectedPeriodId);
    const ops = state.operationsData.filter(o => o.operator === selectedOperator && o.periodId === state.selectedPeriodId);

    const platformStats = {
      of: { gross: 0, net: 0 },
      pp: { gross: 0, net: 0 },
      cr: { gross: 0, net: 0 }
    };

    incomes.forEach(r => {
      platformStats.of.gross += r.onlyFans;
      platformStats.of.net += r.nettoOF;
      platformStats.pp.gross += r.paypal;
      platformStats.pp.net += r.nettoPP;
      platformStats.cr.gross += r.crypto;
      platformStats.cr.net += r.nettoCrypto;
    });

    const totalBrutto = platformStats.of.gross + platformStats.pp.gross + platformStats.cr.gross;
    const totalNetto = platformStats.of.net + platformStats.pp.net + platformStats.cr.net;

    // Группировка корректировок
    const adjustmentGroups = {
      advance: ops.filter(o => o.type === 'advance').reduce((s,o) => s + o.amount, 0),
      salary: ops.filter(o => o.type === 'salary_payment').reduce((s,o) => s + o.amount, 0),
      bonus: ops.filter(o => o.type === 'bonus').reduce((s,o) => s + o.amount, 0),
      internship: ops.filter(o => o.type === 'internship').reduce((s,o) => s + o.amount, 0),
      penalty: ops.filter(o => o.type === 'penalty').reduce((s,o) => s + o.amount, 0),
      refund: ops.filter(o => o.type === 'refund').reduce((s,o) => s + o.amount, 0),
    };

    // Internship теперь в группе вычитаний (deductions)
    const deductions = adjustmentGroups.advance + adjustmentGroups.salary + adjustmentGroups.penalty + adjustmentGroups.refund + adjustmentGroups.internship;
    const additions = adjustmentGroups.bonus;
    const finalBalance = totalNetto + additions - deductions;

    // Список анкет
    const activeModels = Array.from(new Set(incomes.map(i => i.model)));

    // Статистика по дням (Daily Mix)
    const dailyData: Record<string, { 
      gross: number, net: number, models: Set<string>, 
      ofG: number, ofN: number, ppG: number, ppN: number, crG: number, crN: number,
      ratesOF: Set<number>, ratesPP: Set<number>, ratesCR: Set<number> 
    }> = {};

    incomes.forEach(i => {
      if (!dailyData[i.date]) dailyData[i.date] = { gross: 0, net: 0, models: new Set(), ofG: 0, ofN: 0, ppG: 0, ppN: 0, crG: 0, crN: 0, ratesOF: new Set(), ratesPP: new Set(), ratesCR: new Set() };
      const d = dailyData[i.date];
      d.gross += i.total;
      d.net += (i.nettoOF + i.nettoPP + i.nettoCrypto);
      d.models.add(i.model);
      d.ofG += i.onlyFans; d.ofN += i.nettoOF;
      d.ppG += i.paypal; d.ppN += i.nettoPP;
      d.crG += i.crypto; d.crN += i.nettoCrypto;
      if (i.onlyFans > 0) d.ratesOF.add(i.percentOF);
      if (i.paypal > 0) d.ratesPP.add(i.percentPP);
      if (i.crypto > 0) d.ratesCR.add(i.percentCrypto);
    });

    const dailyHistory = Object.entries(dailyData).map(([date, d]) => {
      const getRate = (rates: Set<number>) => rates.size > 1 ? 'MIX %' : rates.size === 1 ? `${Array.from(rates)[0]}%` : '—';
      return {
        date, gross: d.gross, net: d.net, models: Array.from(d.models),
        ofR: getRate(d.ratesOF), ppR: getRate(d.ratesPP), crR: getRate(d.ratesCR),
        ofN: d.ofN, ppN: d.ppN, crN: d.crN
      };
    }).sort((a, b) => b.date.localeCompare(a.date));

    const fullHistory = [
      ...incomes.map(i => ({ type: 'income', date: i.date, id: i.id, label: `Earnings: ${i.model}`, amount: (i.nettoOF + i.nettoPP + i.nettoCrypto), raw: i })),
      ...ops.map(o => ({ type: 'op', date: o.date, id: o.id, label: OPERATION_META[o.type].label, amount: o.amount, opType: o.type, raw: o }))
    ].sort((a, b) => b.date.localeCompare(a.date));

    return { totalBrutto, totalNetto, finalBalance, adjustmentGroups, dailyHistory, fullHistory, platformStats, activeModels };
  }, [selectedOperator, state.incomeData, state.operationsData, state.selectedPeriodId]);

  const addQuickOp = () => {
    if (!qAmount || parseFloat(qAmount) <= 0) return;
    const op: OperationRecord = {
      id: String(Date.now()), type: qType, operator: selectedOperator,
      amount: parseFloat(qAmount), comment: qComment, date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(), periodId: state.selectedPeriodId,
      platform: qPlatform === 'all' ? undefined : qPlatform
    };
    updateState(prev => ({ ...prev, operationsData: [op, ...prev.operationsData] }));
    setQAmount(''); setQComment(''); setShowQuickOp(false);
  };

  const updateInc = () => {
    if (!editingIncome) return;
    const i = editingIncome;
    const updated: IncomeRecord = {
      ...i, total: i.onlyFans + i.paypal + i.crypto,
      nettoOF: i.onlyFans * (i.percentOF / 100), nettoPP: i.paypal * (i.percentPP / 100), nettoCrypto: i.crypto * (i.percentCrypto / 100)
    };
    updateState(prev => ({ ...prev, incomeData: prev.incomeData.map(x => x.id === i.id ? updated : x) }));
    setEditingIncome(null);
  };

  const updateOp = () => {
    if (!editingOperation) return;
    updateState(prev => ({ ...prev, operationsData: prev.operationsData.map(x => x.id === editingOperation.id ? editingOperation : x) }));
    setEditingOperation(null);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-outfit text-white">Аналитика Оператора</h1>
          <p className="text-slate-400">Детализация за <span className="text-indigo-400 font-bold">{activePeriod?.label}</span></p>
        </div>
        <div className="flex gap-3">
          <select 
            className="bg-slate-900 border border-slate-700 rounded-2xl px-6 py-3 font-bold text-white shadow-xl outline-none min-w-[280px]"
            value={selectedOperator}
            onChange={(e) => setSelectedOperator(e.target.value)}
          >
            <option value="">Выберите сотрудника</option>
            {state.operators.map(op => <option key={op} value={op}>{op}</option>)}
          </select>
          {selectedOperator && (
             <button onClick={() => setShowQuickOp(!showQuickOp)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 rounded-2xl font-bold flex items-center gap-2 transition-all active:scale-95 shadow-lg shadow-indigo-600/20">
                <ICONS.Plus size={18} className={showQuickOp ? 'rotate-45' : ''}/>
                Операция
             </button>
          )}
        </div>
      </header>

      {showQuickOp && selectedOperator && (
        <div className="glass-card p-8 rounded-[3rem] border-indigo-500/40 shadow-2xl animate-in slide-in-from-top-4">
           <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
              {Object.entries(OPERATION_META).map(([k,m]) => (
                <button key={k} onClick={() => setQType(k as any)} className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all ${qType === k ? 'bg-indigo-500/20 border-indigo-500 text-white shadow-inner' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                  <m.icon size={20} />
                  <span className="text-[10px] font-black uppercase tracking-widest">{m.label}</span>
                </button>
              ))}
           </div>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <input type="number" placeholder="Сумма $" className="bg-slate-950 border border-slate-700 rounded-2xl px-5 py-4 text-white font-mono outline-none" value={qAmount} onChange={e => setQAmount(e.target.value)} />
              <select className="bg-slate-950 border border-slate-700 rounded-2xl px-5 py-4 text-white font-bold outline-none" value={qPlatform} onChange={e => setQPlatform(e.target.value as any)}>
                 <option value="all">Общий счет</option>
                 <option value="onlyFans">OnlyFans</option>
                 <option value="paypal">PayPal</option>
                 <option value="crypto">Crypto</option>
              </select>
              <input type="text" placeholder="Комментарий..." className="bg-slate-950 border border-slate-700 rounded-2xl px-5 py-4 text-white outline-none" value={qComment} onChange={e => setQComment(e.target.value)} />
           </div>
           <button onClick={addQuickOp} className="w-full mt-6 bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 rounded-2xl shadow-xl transition-all active:scale-95">Сохранить</button>
        </div>
      )}

      {report && (
        <div className="space-y-6">
          {/* Main Financial Overview */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <InfoBox title="Total Brutto" value={report.totalBrutto} color="slate" />
            <InfoBox title="Total Staff Net" value={report.totalNetto} color="emerald" />
            <InfoBox title="Остаток к выплате" value={report.finalBalance} color="indigo" highlighted />
            <div className="glass-card p-6 rounded-3xl border-slate-800 flex flex-col justify-center">
               <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-2">Анкеты</p>
               <div className="flex flex-wrap gap-1.5">
                  {report.activeModels.map(m => <span key={m} className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-lg text-[10px] font-bold border border-indigo-500/10">{m}</span>)}
               </div>
            </div>
          </section>

          {/* Platform Detailed Summary */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="glass-card p-6 rounded-3xl border-blue-500/20 bg-blue-500/5">
               <p className="text-[10px] font-black uppercase text-blue-500 tracking-widest mb-3">OnlyFans Summary</p>
               <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-bold">Gross</p>
                    <p className="text-lg font-bold text-white font-mono">${report.platformStats.of.gross.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-blue-400 uppercase font-bold">Net</p>
                    <p className="text-xl font-black text-blue-400 font-mono">${report.platformStats.of.net.toLocaleString()}</p>
                  </div>
               </div>
            </div>
            <div className="glass-card p-6 rounded-3xl border-sky-500/20 bg-sky-500/5">
               <p className="text-[10px] font-black uppercase text-sky-500 tracking-widest mb-3">PayPal Summary</p>
               <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-bold">Gross</p>
                    <p className="text-lg font-bold text-white font-mono">${report.platformStats.pp.gross.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-sky-400 uppercase font-bold">Net</p>
                    <p className="text-xl font-black text-sky-400 font-mono">${report.platformStats.pp.net.toLocaleString()}</p>
                  </div>
               </div>
            </div>
            <div className="glass-card p-6 rounded-3xl border-emerald-500/20 bg-emerald-500/5">
               <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest mb-3">Crypto Summary</p>
               <div className="flex justify-between items-end">
                  <div>
                    <p className="text-[9px] text-slate-500 uppercase font-bold">Gross</p>
                    <p className="text-lg font-bold text-white font-mono">${report.platformStats.cr.gross.toLocaleString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-emerald-400 uppercase font-bold">Net</p>
                    <p className="text-xl font-black text-emerald-400 font-mono">${report.platformStats.cr.net.toLocaleString()}</p>
                  </div>
               </div>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="lg:col-span-2 space-y-6">
                <div className="glass-card rounded-[2.5rem] overflow-hidden shadow-xl border-slate-800">
                   <div className="p-8 border-b border-slate-800 bg-slate-900/40 font-bold font-outfit text-xl">Статистика по дням (Merged)</div>
                   <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                         <thead>
                            <tr className="bg-slate-900/50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-800">
                               <th className="px-8 py-5">Дата</th>
                               <th className="px-6 py-5 text-center">Платформы (Rate/Net)</th>
                               <th className="px-6 py-5 text-right">Gross</th>
                               <th className="px-8 py-5 text-right">Daily Net</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-800">
                            {report.dailyHistory.map(d => (
                               <tr key={d.date} className="hover:bg-indigo-500/5 transition-colors">
                                  <td className="px-8 py-5">
                                     <div className="font-mono text-slate-400 text-xs mb-1">{d.date}</div>
                                     <div className="flex gap-1 flex-wrap">
                                        {d.models.map(m => <span key={m} className="text-[8px] text-slate-600 uppercase font-black border border-slate-800 px-1 rounded">{m}</span>)}
                                     </div>
                                  </td>
                                  <td className="px-6 py-5">
                                     <div className="flex justify-center gap-3">
                                        <DailyMini pill="OF" rate={d.ofR} net={d.ofN} color="blue" />
                                        <DailyMini pill="PP" rate={d.ppR} net={d.ppN} color="sky" />
                                        <DailyMini pill="CR" rate={d.crR} net={d.crN} color="emerald" />
                                     </div>
                                  </td>
                                  <td className="px-6 py-5 text-right font-mono text-slate-500">${d.gross.toFixed(0)}</td>
                                  <td className="px-8 py-5 text-right font-black text-white text-base font-mono">${d.net.toFixed(2)}</td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </div>
             </div>

             <div className="space-y-6">
                <div className="glass-card p-8 rounded-[2.5rem] border-indigo-500/20 shadow-2xl space-y-5">
                   <h3 className="text-xl font-bold font-outfit text-white">Корректировки</h3>
                   <div className="space-y-4">
                      <AdjItem label="Аванс" val={report.adjustmentGroups.advance} type="minus" />
                      <AdjItem label="Выплата ЗП" val={report.adjustmentGroups.salary} type="minus" />
                      <AdjItem label="Штраф" val={report.adjustmentGroups.penalty} type="minus" />
                      <AdjItem label="Возврат" val={report.adjustmentGroups.refund} type="minus" />
                      <AdjItem label="Бонус" val={report.adjustmentGroups.bonus} type="plus" />
                      <AdjItem label="Стажировка" val={report.adjustmentGroups.internship} type="minus" />
                   </div>
                </div>

                <div className="glass-card p-8 rounded-[2.5rem] border-slate-800 shadow-xl space-y-4">
                   <h3 className="text-xl font-bold font-outfit text-white">Чистые по типам</h3>
                   <PlatStat label="OnlyFans Net" val={report.platformStats.of.net} color="blue" />
                   <PlatStat label="PayPal Net" val={report.platformStats.pp.net} color="sky" />
                   <PlatStat label="Crypto Net" val={report.platformStats.cr.net} color="emerald" />
                </div>
             </div>
          </section>

          <section className="glass-card rounded-[2.5rem] overflow-hidden border-slate-800 shadow-2xl">
             <div className="p-8 border-b border-slate-800 bg-slate-900/40 font-bold font-outfit text-lg flex justify-between items-center">
                <span>Полная история операций (Редактирование)</span>
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Audited Trails</span>
             </div>
             <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                   <thead>
                      <tr className="bg-slate-900/50 text-slate-500 font-bold text-[10px] uppercase tracking-[0.2em] border-b border-slate-800">
                         <th className="px-8 py-6">Дата</th>
                         <th className="px-8 py-6">Тип записи</th>
                         <th className="px-8 py-6 text-right">Начисление $</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-800">
                      {report.fullHistory.map(item => (
                         <tr key={item.id} className="hover:bg-indigo-500/5 group transition-all">
                            <td className="px-8 py-5 font-mono text-slate-500 text-xs">{item.date}</td>
                            <td className="px-8 py-5 flex items-center gap-3">
                               <div className={`w-2 h-2 rounded-full ${item.type === 'income' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : 'bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.3)]'}`}></div>
                               <span className="font-bold text-white text-base">{item.label}</span>
                            </td>
                            <td className="px-8 py-5 text-right">
                               <div className="flex items-center justify-end gap-6">
                                  <span className={`font-black font-mono text-lg ${['income', 'bonus'].includes((item as any).opType) || item.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                                     {['income', 'bonus'].includes((item as any).opType) || item.type === 'income' ? '+' : '-'}{item.amount.toFixed(2)}
                                  </span>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <button onClick={() => item.type === 'income' ? setEditingIncome(item.raw as any) : setEditingOperation(item.raw as any)} className="text-slate-500 hover:text-indigo-400 p-2 rounded-xl transition-all active:scale-90"><ICONS.Edit size={16}/></button>
                                     <button onClick={() => { if(confirm('Удалить?')) updateState(prev => ({...prev, incomeData: item.type === 'income' ? prev.incomeData.filter(x => x.id !== item.id) : prev.incomeData, operationsData: item.type === 'op' ? prev.operationsData.filter(x => x.id !== item.id) : prev.operationsData}))}} className="text-slate-500 hover:text-rose-500 p-2 rounded-xl transition-all active:scale-90"><ICONS.Trash size={16}/></button>
                                  </div>
                               </div>
                            </td>
                         </tr>
                      ))}
                   </tbody>
                </table>
             </div>
          </section>
        </div>
      )}

      {/* Edit Income Modal */}
      {editingIncome && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="glass-card w-full max-w-2xl rounded-[3rem] p-12 border-indigo-500/40 shadow-2xl relative">
              <button onClick={() => setEditingIncome(null)} className="absolute top-10 right-10 text-slate-500 hover:text-white transition-all"><ICONS.Plus className="rotate-45" size={32} /></button>
              <h2 className="text-3xl font-bold text-white mb-2 font-outfit">Редактирование дохода</h2>
              <div className="grid grid-cols-2 gap-10 mt-8">
                 <div className="space-y-6">
                    <h3 className="text-[10px] font-black uppercase text-slate-600 tracking-widest mb-2">Грязные ($)</h3>
                    <RateField label="OnlyFans" val={editingIncome.onlyFans} onChange={v => setEditingIncome({...editingIncome, onlyFans: v})} color="blue" />
                    <RateField label="PayPal" val={editingIncome.paypal} onChange={v => setEditingIncome({...editingIncome, paypal: v})} color="sky" />
                    <RateField label="Crypto" val={editingIncome.crypto} onChange={v => setEditingIncome({...editingIncome, crypto: v})} color="emerald" />
                 </div>
                 <div className="space-y-6">
                    <h3 className="text-[10px] font-black uppercase text-slate-600 tracking-widest mb-2">Ставки (%)</h3>
                    <RateField label="OF Rate" val={editingIncome.percentOF} onChange={v => setEditingIncome({...editingIncome, percentOF: v})} color="indigo" />
                    <RateField label="PP Rate" val={editingIncome.percentPP} onChange={v => setEditingIncome({...editingIncome, percentPP: v})} color="indigo" />
                    <RateField label="CR Rate" val={editingIncome.percentCrypto} onChange={v => setEditingIncome({...editingIncome, percentCrypto: v})} color="indigo" />
                 </div>
              </div>
              <button onClick={updateInc} className="mt-12 w-full bg-indigo-600 hover:bg-indigo-500 text-white font-black py-4 px-12 rounded-2xl shadow-xl transition-all active:scale-95">Сохранить</button>
           </div>
        </div>
      )}

      {/* Edit Operation Modal */}
      {editingOperation && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl animate-in fade-in duration-300">
           <div className="glass-card w-full max-w-lg rounded-[3rem] p-12 border-amber-500/40 shadow-2xl relative">
              <button onClick={() => setEditingOperation(null)} className="absolute top-10 right-10 text-slate-500 hover:text-white transition-all"><ICONS.Plus className="rotate-45" size={32} /></button>
              <h2 className="text-3xl font-bold text-white mb-8 font-outfit">Редактировать корректировку</h2>
              <div className="space-y-6">
                 <div className="grid grid-cols-2 gap-3 mb-6">
                   {Object.entries(OPERATION_META).map(([k, m]) => (
                     <button key={k} onClick={() => setEditingOperation({...editingOperation, type: k as any})} className={`p-4 rounded-xl border text-[10px] font-black uppercase transition-all flex flex-col items-center gap-2 ${editingOperation.type === k ? 'bg-amber-500/20 border-amber-500 text-white shadow-lg' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                        <m.icon size={20} />
                        {m.label}
                     </button>
                   ))}
                 </div>
                 <RateField label="Сумма $" val={editingOperation.amount} onChange={v => setEditingOperation({...editingOperation, amount: v})} color="amber" />
                 <input type="text" className="w-full bg-slate-900 border border-slate-800 rounded-2xl px-5 py-4 text-white font-bold outline-none" value={editingOperation.comment} onChange={e => setEditingOperation({...editingOperation, comment: e.target.value})} placeholder="Комментарий..." />
                 <button onClick={updateOp} className="w-full bg-amber-600 hover:bg-amber-500 text-white font-black py-5 rounded-2xl shadow-xl transition-all active:scale-95">Применить</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const InfoBox = ({ title, value, color, highlighted }: any) => (
  <div className={`glass-card p-6 rounded-3xl border ${highlighted ? 'border-indigo-500/40 bg-indigo-500/10 shadow-2xl' : 'border-slate-800'}`}>
    <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">{title}</p>
    <p className={`text-2xl font-black font-outfit ${highlighted ? 'text-white' : `text-${color}-400`}`}>${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
  </div>
);

const DailyMini = ({ pill, rate, net, color }: any) => {
  const cMap: any = { blue: 'text-blue-400 bg-blue-500/10 border-blue-500/10', sky: 'text-sky-400 bg-sky-500/10 border-sky-500/10', emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/10' };
  return (
    <div className={`flex flex-col items-center px-2 py-1.5 rounded-lg border ${cMap[color]}`}>
       <span className="text-[8px] font-black opacity-60 uppercase">{pill}</span>
       <span className="text-[9px] font-black uppercase leading-tight mb-0.5">{rate}</span>
       <span className="font-mono text-[10px] font-bold">${net.toFixed(1)}</span>
    </div>
  );
};

const AdjItem = ({ label, val, type }: any) => (
  <div className="flex items-center justify-between">
     <span className="text-slate-500 font-bold text-[10px] uppercase tracking-widest">{label}</span>
     <span className={`font-mono font-bold text-base ${type === 'plus' ? 'text-emerald-400' : 'text-rose-400'}`}>{type === 'plus' ? '+' : '-'}${val.toFixed(1)}</span>
  </div>
);

const PlatStat = ({ label, val, color }: any) => {
  const cMap: any = { blue: 'text-blue-400', sky: 'text-sky-400', emerald: 'text-emerald-400' };
  return (
    <div className="flex items-center justify-between">
       <span className="text-slate-500 font-bold text-[10px] uppercase tracking-widest">{label}</span>
       <span className={`font-mono font-black text-lg ${cMap[color]}`}>${val.toFixed(2)}</span>
    </div>
  );
};

const RateField = ({ label, val, onChange, color }: any) => {
  const colorMap: any = { blue: 'focus:ring-blue-500 text-blue-400', sky: 'focus:ring-sky-500 text-sky-400', emerald: 'focus:ring-emerald-500 text-emerald-400', indigo: 'focus:ring-indigo-500 text-indigo-400', amber: 'focus:ring-amber-500 text-amber-500' };
  return (
    <div className="space-y-1">
      <label className="text-[10px] text-slate-600 font-black uppercase tracking-widest ml-1">{label}</label>
      <input 
        type="number" 
        className={`w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-lg font-mono outline-none transition-all ${colorMap[color] || ''}`}
        value={val}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  );
};

export default Reports;