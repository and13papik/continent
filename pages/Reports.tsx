
import React, { useState, useMemo, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { AppState, IncomeRecord, OperationType, OperationRecord, Platform, OperatorWallet } from '../types';
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
  const currentOperators = activePeriod?.operators || state.operators;
  const currentModels = activePeriod?.models || state.models;

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

    const rawBrutto = platformStats.of.gross + platformStats.pp.gross + platformStats.cr.gross;
    const rawNetto = platformStats.of.net + platformStats.pp.net + platformStats.cr.net;
    
    // Считаем возвраты
    const totalRefundAmount = ops.filter(o => o.type === 'refund').reduce((s, o) => s + o.amount, 0);
    const avgRate = rawBrutto > 0 ? rawNetto / rawBrutto : 0.20;
    const lostCommission = totalRefundAmount * avgRate;

    // Очищенные показатели
    const totalBrutto = rawBrutto - totalRefundAmount;
    const totalNetto = rawNetto - lostCommission;

    const adjustmentGroups = {
      advance: ops.filter(o => o.type === 'advance').reduce((s,o) => s + o.amount, 0),
      salary: ops.filter(o => o.type === 'salary_payment').reduce((s,o) => s + o.amount, 0),
      bonus: ops.filter(o => o.type === 'bonus').reduce((s,o) => s + o.amount, 0),
      internship: ops.filter(o => o.type === 'internship').reduce((s,o) => s + o.amount, 0),
      penalty: ops.filter(o => o.type === 'penalty').reduce((s,o) => s + o.amount, 0),
      refund: totalRefundAmount,
    };

    // Refund не вычитается flat суммой, так как он уже уменьшил totalNetto
    const deductions = adjustmentGroups.advance + adjustmentGroups.salary + adjustmentGroups.penalty + adjustmentGroups.internship;
    const additions = adjustmentGroups.bonus;
    const finalBalance = totalNetto + additions - deductions;

    const activeModels = Array.from(new Set(incomes.map(i => i.model)));

    const dailyData: Record<string, { 
      date: string,
      totalGross: number,
      totalNet: number,
      models: Record<string, {
        gross: number, net: number, 
        ofG: number, ofN: number, ppG: number, ppN: number, crG: number, crN: number,
        ratesOF: Set<number>, ratesPP: Set<number>, ratesCR: Set<number> 
      }>
    }> = {};

    incomes.forEach(i => {
      if (!dailyData[i.date]) dailyData[i.date] = { date: i.date, totalGross: 0, totalNet: 0, models: {} };
      const d = dailyData[i.date];
      if (!d.models[i.model]) d.models[i.model] = { gross: 0, net: 0, ofG: 0, ofN: 0, ppG: 0, ppN: 0, crG: 0, crN: 0, ratesOF: new Set(), ratesPP: new Set(), ratesCR: new Set() };
      const m = d.models[i.model];
      
      d.totalGross += i.total;
      d.totalNet += (i.nettoOF + i.nettoPP + i.nettoCrypto);
      
      m.gross += i.total;
      m.net += (i.nettoOF + i.nettoPP + i.nettoCrypto);
      m.ofG += i.onlyFans; m.ofN += i.nettoOF;
      m.ppG += i.paypal; m.ppN += i.nettoPP;
      m.crG += i.crypto; m.crN += i.nettoCrypto;
      if (i.onlyFans > 0) m.ratesOF.add(i.percentOF);
      if (i.paypal > 0) m.ratesPP.add(i.percentPP);
      if (i.crypto > 0) m.ratesCR.add(i.percentCrypto);
    });

    const dailyHistory = Object.values(dailyData).map((d) => {
      const getRate = (rates: Set<number>) => rates.size > 1 ? 'MIX %' : rates.size === 1 ? `${Array.from(rates)[0]}%` : '—';
      const modelBreakdown = Object.entries(d.models).map(([name, m]) => ({
        name,
        gross: m.gross,
        net: m.net,
        ofR: getRate(m.ratesOF),
        ppR: getRate(m.ratesPP),
        crR: getRate(m.ratesCR),
        ofN: m.ofN,
        ppN: m.ppN,
        crN: m.crN,
        ofG: m.ofG,
        ppG: m.ppG,
        crG: m.crG
      }));
      return {
        date: d.date,
        totalGross: d.totalGross,
        totalNet: d.totalNet,
        modelBreakdown
      };
    }).sort((a, b) => b.date.localeCompare(a.date));

    const fullHistory = [
      ...incomes.map(i => ({ type: 'income', date: i.date, id: i.id, label: `Earnings: ${i.model}`, amount: (i.nettoOF + i.nettoPP + i.nettoCrypto), raw: i })),
      ...ops.map(o => ({ type: 'op', date: o.date, id: o.id, label: OPERATION_META[o.type].label, amount: o.amount, opType: o.type, raw: o }))
    ].sort((a, b) => b.date.localeCompare(a.date));

    const wallet = state.operatorWallets?.find(w => w.operator === selectedOperator);

    return { totalBrutto, totalNetto, finalBalance, adjustmentGroups, dailyHistory, fullHistory, platformStats, activeModels, wallet };
  }, [selectedOperator, state.incomeData, state.operationsData, state.selectedPeriodId, state.operatorWallets]);

  const updateWallet = (address: string, method: 'usdt_trc20' | 'card') => {
    updateState(prev => {
      const wallets = [...(prev.operatorWallets || [])];
      const idx = wallets.findIndex(w => w.operator === selectedOperator);
      const newWallet: OperatorWallet = {
        id: `wallet-${selectedOperator}`,
        operator: selectedOperator,
        address,
        method,
        updatedAt: new Date().toISOString()
      };
      
      if (idx >= 0) wallets[idx] = newWallet;
      else wallets.push(newWallet);
      
      return { ...prev, operatorWallets: wallets };
    });
  };

  const addQuickOp = () => {
    if (!qAmount || parseFloat(qAmount) <= 0) return;
    const op: OperationRecord = {
      id: String(Date.now()), type: qType, operator: selectedOperator,
      amount: parseFloat(qAmount), comment: qComment, date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), 
      periodId: state.selectedPeriodId,
      platform: qPlatform === 'all' ? undefined : qPlatform
    };
    updateState(prev => ({ ...prev, operationsData: [op, ...prev.operationsData] }));
    setQAmount(''); setQComment(''); setShowQuickOp(false);
  };

  const updateInc = () => {
    if (!editingIncome) return;
    const i = editingIncome;
    const updated: IncomeRecord = {
      ...i, 
      total: i.onlyFans + i.paypal + i.crypto,
      nettoOF: i.onlyFans * (i.percentOF / 100), 
      nettoPP: i.paypal * (i.percentPP / 100), 
      nettoCrypto: i.crypto * (i.percentCrypto / 100),
      updatedAt: new Date().toISOString()
    };
    updateState(prev => ({ ...prev, incomeData: prev.incomeData.map(x => x.id === i.id ? updated : x) }));
    setEditingIncome(null);
  };

  const updateOp = () => {
    if (!editingOperation) return;
    const updated = { ...editingOperation, updatedAt: new Date().toISOString() };
    updateState(prev => ({ ...prev, operationsData: prev.operationsData.map(x => x.id === editingOperation.id ? updated : x) }));
    setEditingOperation(null);
  };

  const deleteRecord = (item: { type: string; id: string }) => {
     if(!confirm('Удалить запись безвозвратно?')) return;
     updateState(prev => ({
       ...prev, 
       deletedIds: [...prev.deletedIds, item.id],
       incomeData: item.type === 'income' ? prev.incomeData.filter(x => x.id !== item.id) : prev.incomeData, 
       operationsData: item.type === 'op' ? prev.operationsData.filter(x => x.id !== item.id) : prev.operationsData
     }));
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-24">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-outfit text-white">Аналитика Оператора</h1>
          <p className="text-slate-400">Детализация за <span className="text-indigo-400 font-bold">{activePeriod?.label}</span></p>
        </div>
        <div className="flex gap-3">
          <select className="bg-slate-900 border border-slate-700 rounded-2xl px-6 py-3 font-bold text-white shadow-xl outline-none min-w-[280px]" value={selectedOperator} onChange={(e) => setSelectedOperator(e.target.value)}>
            <option value="">Выберите сотрудника</option>
            {currentOperators.map(op => <option key={op} value={op}>{op}</option>)}
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
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <InfoBox title="Общий Брутто (Clean)" value={report.totalBrutto} color="slate" />
            <InfoBox title="Общий Нетто (Staff)" value={report.totalNetto} color="emerald" highlighted />
            <div className="glass-card p-6 rounded-3xl border-blue-500/20 bg-blue-500/5">
               <p className="text-[10px] font-black uppercase text-blue-500 tracking-widest mb-1">OnlyFans (B/H)</p>
               <div className="flex flex-col">
                  <span className="text-xs text-slate-500 font-mono">${report.platformStats.of.gross.toFixed(1)}</span>
                  <span className="text-lg font-black text-white font-mono">${report.platformStats.of.net.toFixed(1)}</span>
               </div>
            </div>
            <div className="glass-card p-6 rounded-3xl border-sky-500/20 bg-sky-500/5">
               <p className="text-[10px] font-black uppercase text-sky-500 tracking-widest mb-1">PayPal (B/H)</p>
               <div className="flex flex-col">
                  <span className="text-xs text-slate-500 font-mono">${report.platformStats.pp.gross.toFixed(1)}</span>
                  <span className="text-lg font-black text-white font-mono">${report.platformStats.pp.net.toFixed(1)}</span>
               </div>
            </div>
            <div className="glass-card p-6 rounded-3xl border-emerald-500/20 bg-emerald-500/5">
               <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest mb-1">Crypto (B/H)</p>
               <div className="flex flex-col">
                  <span className="text-xs text-slate-500 font-mono">${report.platformStats.cr.gross.toFixed(1)}</span>
                  <span className="text-lg font-black text-white font-mono">${report.platformStats.cr.net.toFixed(1)}</span>
               </div>
            </div>
          </section>

          <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
             <div className="lg:col-span-2 space-y-6">
                <div className="glass-card rounded-[2.5rem] overflow-hidden shadow-xl border-slate-800">
                   <div className="p-8 border-b border-slate-800 bg-slate-900/40 flex justify-between items-center">
                      <h2 className="font-bold font-outfit text-xl text-white">Статистика по дням</h2>
                      <div className="flex gap-2">
                        {report.activeModels.map(m => <span key={m} className="bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded text-[10px] font-bold border border-indigo-500/10">{m}</span>)}
                      </div>
                   </div>
                   <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                         <thead>
                            <tr className="bg-slate-900/50 text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-slate-800">
                               <th className="px-8 py-5">Дата</th>
                               <th className="px-6 py-5">Детализация по моделям</th>
                               <th className="px-6 py-5 text-right">Общий Gross</th>
                               <th className="px-8 py-5 text-right">Общий Net</th>
                            </tr>
                         </thead>
                         <tbody className="divide-y divide-slate-800">
                            {report.dailyHistory.map((d) => (
                               <tr key={d.date} className="hover:bg-indigo-500/5 transition-colors align-top">
                                  <td className="px-8 py-6">
                                     <div className="font-mono text-slate-400 text-xs">{d.date}</div>
                                  </td>
                                  <td className="px-6 py-6">
                                     <div className="space-y-4">
                                        {d.modelBreakdown.map((m, mIdx) => (
                                          <div key={mIdx} className="flex flex-col gap-2 bg-slate-900/40 p-3 rounded-2xl border border-slate-800">
                                             <div className="flex justify-between items-center px-1">
                                                <span className="text-white font-bold text-xs">{m.name}</span>
                                                <span className="text-[10px] font-mono text-slate-500">${m.gross.toFixed(2)} Gross</span>
                                             </div>
                                             <div className="flex gap-2">
                                                <DailyMini pill="OF" rate={m.ofR} val={m.ofG} color="blue" />
                                                <DailyMini pill="PP" rate={m.ppR} val={m.ppG} color="sky" />
                                                <DailyMini pill="CR" rate={m.crR} val={m.crG} color="emerald" />
                                             </div>
                                          </div>
                                        ))}
                                     </div>
                                  </td>
                                  <td className="px-6 py-6 text-right font-mono text-slate-500 whitespace-nowrap pt-8">${d.totalGross.toFixed(0)}</td>
                                  <td className="px-8 py-6 text-right font-black text-emerald-400 text-lg font-mono whitespace-nowrap pt-7">${d.totalNet.toFixed(2)}</td>
                               </tr>
                            ))}
                         </tbody>
                      </table>
                   </div>
                </div>
             </div>

             <div className="space-y-6">
                <div className="glass-card p-8 rounded-[2.5rem] border-indigo-500/20 bg-indigo-500/5 shadow-2xl space-y-6">
                   <div className="flex justify-between items-center">
                      <h3 className="text-xl font-bold font-outfit text-white">Финальный итог</h3>
                      <ICONS.Salary className="text-indigo-400" size={20} />
                   </div>
                   <div className="space-y-4">
                      <div className="flex justify-between border-b border-slate-800/50 pb-2">
                        <span className="text-slate-500 font-bold text-[10px] uppercase">Чистая ЗП (Staff Net)</span>
                        <span className="font-mono font-bold text-white text-base">${report.totalNetto.toFixed(1)}</span>
                      </div>
                      <AdjItem label="Авансы/Выплаты" val={report.adjustmentGroups.advance + report.adjustmentGroups.salary} type="minus" />
                      <AdjItem label="Штрафы" val={report.adjustmentGroups.penalty} type="minus" />
                      <AdjItem label="Бонусы" val={report.adjustmentGroups.bonus} type="plus" />
                      <AdjItem label="Стажировочные" val={report.adjustmentGroups.internship} type="minus" />
                      <div className="pt-2">
                         <p className="text-[9px] text-slate-500 font-bold italic">*Возвраты (${report.adjustmentGroups.refund.toFixed(0)}) учтены в Net</p>
                      </div>
                      <div className="pt-4 border-t border-indigo-500/20">
                         <div className="flex justify-between items-center">
                            <span className="text-indigo-400 font-black text-[12px] uppercase tracking-widest">К выплате на руки</span>
                            <span className="text-2xl font-black font-mono text-indigo-400">${report.finalBalance.toFixed(1)}</span>
                         </div>
                      </div>
                   </div>
                </div>

                <div className="glass-card p-8 rounded-[2.5rem] border-slate-800 bg-slate-900/40 shadow-xl space-y-4 text-left">
                   <div className="flex justify-between items-center">
                      <h3 className="text-lg font-bold font-outfit text-white">Реквизиты для оплаты</h3>
                      <ICONS.Lock className="text-slate-600" size={16} />
                   </div>
                   <div className="space-y-4">
                      <div className="flex gap-2 p-1 bg-slate-950 rounded-xl border border-slate-800">
                         <button 
                           onClick={() => updateWallet(report.wallet?.address || '', 'usdt_trc20')}
                           className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase transition-all ${(!report.wallet || report.wallet.method === 'usdt_trc20') ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
                         >
                           USDT TRC20
                         </button>
                         <button 
                           onClick={() => updateWallet(report.wallet?.address || '', 'card')}
                           className={`flex-1 py-3 rounded-lg text-[10px] font-black uppercase transition-all ${report.wallet?.method === 'card' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20' : 'text-slate-500 hover:text-slate-300'}`}
                         >
                           Карта
                         </button>
                      </div>
                      <div className="space-y-1">
                         <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Адрес / Номер карты</label>
                         <div className="relative group">
                           <input 
                              type="text" 
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs text-white font-mono outline-none focus:border-indigo-500/50 transition-all pr-12"
                              placeholder={report.wallet?.method === 'card' ? '0000 0000 0000 0000' : 'T...'}
                              value={report.wallet?.address || ''}
                              onChange={e => updateWallet(e.target.value, report.wallet?.method || 'usdt_trc20')}
                           />
                           {report.wallet?.address && (
                             <button 
                               onClick={() => { navigator.clipboard.writeText(report.wallet!.address); alert('Скопировано!'); }}
                               className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 hover:text-indigo-400 p-1 transition-colors"
                               title="Скопировать"
                             >
                               <ICONS.Plus size={14} className="rotate-45" /> 
                             </button>
                           )}
                         </div>
                         {report.wallet?.updatedAt && (
                           <p className="text-[8px] text-slate-600 italic text-right mt-1">Обновлено: {new Date(report.wallet.updatedAt).toLocaleDateString()}</p>
                         )}
                      </div>
                   </div>
                </div>
             </div>
          </section>

          <section className="glass-card rounded-[2.5rem] overflow-hidden border-slate-800 shadow-2xl">
             <div className="p-8 border-b border-slate-800 bg-slate-900/40 font-bold font-outfit text-lg flex justify-between items-center">
                <span>Полная история операций</span>
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em]">Audited Trails</span>
             </div>
             <div className="overflow-x-auto max-h-[500px]">
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
                                     <button onClick={() => deleteRecord({type: item.type, id: item.id})} className="text-slate-500 hover:text-rose-500 p-2 rounded-xl transition-all active:scale-90"><ICONS.Trash size={16}/></button>
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

const InfoBox = ({ title, value, color, highlighted }: { title: string, value: number, color: string, highlighted?: boolean }) => (
  <div className={`glass-card p-6 rounded-3xl border ${highlighted ? 'border-indigo-500/40 bg-indigo-500/10 shadow-2xl' : 'border-slate-800'}`}>
    <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest mb-1">{title}</p>
    <p className={`text-2xl font-black font-outfit ${highlighted ? 'text-white' : `text-${color}-400`}`}>${value.toLocaleString(undefined, { minimumFractionDigits: 1 })}</p>
  </div>
);

const DailyMini = ({ pill, rate, val, color }: { pill: string, rate: string, val: number, color: string }) => {
  const cMap: any = { blue: 'text-blue-400 bg-blue-500/10 border-blue-500/10', sky: 'text-sky-400 bg-sky-500/10 border-sky-500/10', emerald: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/10' };
  return (
    <div className={`flex flex-col items-center px-2 py-1.5 rounded-lg border ${cMap[color]}`}>
       <span className="text-[8px] font-black opacity-60 uppercase">{pill}</span>
       <span className="text-[9px] font-black uppercase leading-tight mb-0.5">{rate}</span>
       <span className="font-mono text-[10px] font-bold">${val.toFixed(1)}</span>
    </div>
  );
};

const AdjItem = ({ label, val, type }: { label: string, val: number, type: 'plus' | 'minus' }) => (
  <div className="flex items-center justify-between">
     <span className="text-slate-500 font-bold text-[10px] uppercase tracking-widest">{label}</span>
     <span className={`font-mono font-bold text-base ${type === 'plus' ? 'text-emerald-400' : 'text-rose-400'}`}>{type === 'plus' ? '+' : '-'}${val.toFixed(1)}</span>
  </div>
);

const RateField = ({ label, val, onChange, color }: { label: string, val: number, onChange: (v: number) => void, color: string }) => {
  const colorMap: any = { blue: 'focus:ring-blue-500 text-blue-400', sky: 'focus:ring-sky-500 text-sky-400', emerald: 'focus:ring-emerald-500 text-emerald-400', indigo: 'focus:ring-indigo-500 text-indigo-400', amber: 'focus:ring-amber-500 text-amber-500' };
  return (
    <div className="space-y-1">
      <label className="text-[10px] text-slate-600 font-black uppercase tracking-widest ml-1">{label}</label>
      <input type="number" className={`w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-lg font-mono outline-none transition-all ${colorMap[color] || ''}`} value={val} onChange={e => onChange(parseFloat(e.target.value) || 0)} />
    </div>
  );
};

export default Reports;
