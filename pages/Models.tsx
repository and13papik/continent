
import React, { useMemo, useState } from 'react';
import { AppState, ModelBonus, PaidStatus, OperationRecord } from '../types';
import { ICONS } from '../constants';

interface ModelsProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const Models: React.FC<ModelsProps> = ({ state, updateState }) => {
  const activePeriodId = state.selectedPeriodId;
  const activePeriod = state.accountingPeriods.find(p => p.id === activePeriodId)!;
  const [bonusInputs, setBonusInputs] = useState<Record<string, string>>({});
  const [advanceInputs, setAdvanceInputs] = useState<Record<string, string>>({});

  const modelStats = useMemo(() => {
    return state.models.map(model => {
      const records = state.incomeData.filter(r => r.model === model && r.periodId === activePeriodId);
      const bonuses = (state.modelBonuses || []).filter(b => b.model === model && b.periodId === activePeriodId);
      const modelOps = state.operationsData.filter(o => o.model === model && o.periodId === activePeriodId);
      
      const refunds = modelOps.filter(o => o.type === 'refund');
      const totalRefunds = refunds.reduce((sum, o) => sum + o.amount, 0);
      
      // Авансы конкретно для модели
      const advances = modelOps.filter(o => o.type === 'advance');
      const totalAdvances = advances.reduce((sum, o) => sum + o.amount, 0);

      const grossOF = records.reduce((sum, r) => sum + r.onlyFans, 0);
      const grossPP = records.reduce((sum, r) => sum + r.paypal, 0);
      const grossCR = records.reduce((sum, r) => sum + r.crypto, 0);
      
      const totalGrossRaw = grossOF + grossPP + grossCR;
      const totalGross = totalGrossRaw - totalRefunds;

      const earnOF = Math.max(0, grossOF - refunds.filter(r => r.platform === 'onlyFans').reduce((s,o) => s+o.amount, 0)) * (state.modelRates.of / 100);
      const earnPP = Math.max(0, grossPP - refunds.filter(r => r.platform === 'paypal').reduce((s,o) => s+o.amount, 0)) * (state.modelRates.pp / 100);
      const earnCR = Math.max(0, grossCR - refunds.filter(r => r.platform === 'crypto').reduce((s,o) => s+o.amount, 0)) * (state.modelRates.cr / 100);
      
      const genericRefunds = refunds.filter(r => !r.platform).reduce((s,o) => s+o.amount, 0);
      const avgModelRate = totalGrossRaw > 0 ? (earnOF + earnPP + earnCR) / totalGrossRaw : (state.modelRates.of / 100);
      
      const bonusTotal = bonuses.reduce((sum, b) => sum + b.amount, 0);
      
      // Начислено (грязная ЗП модели)
      const accruedSalary = (earnOF + earnPP + earnCR + bonusTotal) - (genericRefunds * avgModelRate);
      
      // К выплате (за вычетом авансов)
      const totalEarn = accruedSalary - totalAdvances;
      
      const isPaid = state.paidStatuses.some(s => s.entityName === model && s.entityType === 'model' && s.periodId === activePeriodId);

      return {
        model,
        grossOF, grossPP, grossCR, totalGross,
        earnOF, earnPP, earnCR, bonusTotal,
        totalRefunds,
        totalAdvances,
        advances,
        accruedSalary,
        totalEarn, isPaid, bonuses
      };
    }).sort((a, b) => b.totalGross - a.totalGross);
  }, [state.incomeData, state.models, activePeriodId, state.modelRates, state.modelBonuses, state.paidStatuses, state.operationsData]);

  const addBonus = (model: string) => {
    const val = parseFloat(bonusInputs[model]) || 0;
    if (val <= 0) return;

    const newBonus: ModelBonus = {
      id: String(Date.now() + Math.random()),
      model,
      periodId: activePeriodId,
      amount: val,
      comment: 'Бонус',
      createdAt: new Date().toISOString()
    };

    updateState(prev => ({ ...prev, modelBonuses: [...(prev.modelBonuses || []), newBonus] }));
    setBonusInputs(prev => ({ ...prev, [model]: '' }));
  };

  const addAdvance = (model: string) => {
    const val = parseFloat(advanceInputs[model]) || 0;
    if (val <= 0) return;

    const newOp: OperationRecord = {
      id: String(Date.now() + Math.random()),
      type: 'advance',
      operator: 'SYSTEM', // Автоматическая пометка
      model: model,
      amount: val,
      comment: 'Аванс модели',
      date: new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
      periodId: activePeriodId
    };

    updateState(prev => ({ ...prev, operationsData: [newOp, ...prev.operationsData] }));
    setAdvanceInputs(prev => ({ ...prev, [model]: '' }));
  };

  const removeBonus = (bonusId: string) => {
    if (!confirm('Удалить этот бонус?')) return;
    updateState(prev => ({
      ...prev,
      deletedIds: [...prev.deletedIds, bonusId],
      modelBonuses: (prev.modelBonuses || []).filter(b => b.id !== bonusId)
    }));
  };

  const removeOperation = (id: string) => {
    if (!confirm('Удалить эту операцию?')) return;
    updateState(prev => ({
      ...prev,
      deletedIds: [...prev.deletedIds, id],
      operationsData: prev.operationsData.filter(o => o.id !== id)
    }));
  };

  const toggleModelPaid = (model: string) => {
    updateState(prev => {
      const existing = prev.paidStatuses.find(s => s.entityName === model && s.entityType === 'model' && s.periodId === activePeriodId);
      if (existing) {
        return { 
          ...prev, 
          deletedIds: [...prev.deletedIds, existing.id],
          paidStatuses: prev.paidStatuses.filter(s => s.id !== existing.id) 
        };
      } else {
        const newPaid: PaidStatus = {
          id: `paid-model-${model}-${activePeriodId}`,
          entityName: model,
          entityType: 'model',
          periodId: activePeriodId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        return { ...prev, paidStatuses: [...prev.paidStatuses, newPaid] };
      }
    });
  };

  const updateGlobalRate = (val: string) => {
    const rate = parseFloat(val) || 0;
    updateState(prev => ({
      ...prev,
      modelRates: { of: rate, pp: rate, cr: rate }
    }));
  };

  const updateSpecificRate = (field: keyof typeof state.modelRates, val: string) => {
    const rate = parseFloat(val) || 0;
    updateState(prev => ({
      ...prev,
      modelRates: { ...prev.modelRates, [field]: rate }
    }));
  };

  const isUniform = state.modelRates.of === state.modelRates.pp && state.modelRates.pp === state.modelRates.cr;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold font-outfit text-white">Модели</h1>
          <p className="text-slate-400">Ведомость анкет за <span className="text-indigo-400 font-bold">{activePeriod.label}</span></p>
        </div>

        <div className="bg-slate-900/60 p-4 rounded-3xl border border-slate-800 flex flex-wrap items-center gap-6">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Общая выплата (%)</label>
            <div className="relative">
              <input 
                type="number" 
                className="w-24 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-indigo-400 font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                value={isUniform ? state.modelRates.of : ''}
                placeholder="MIX"
                onChange={(e) => updateGlobalRate(e.target.value)}
              />
              <span className="absolute right-3 top-2.5 text-slate-600 text-xs">%</span>
            </div>
          </div>
          <div className="h-10 w-px bg-slate-800 hidden md:block" />
          <div className="flex gap-4">
            <RateInput label="OF Rate" value={state.modelRates.of} color="blue" onChange={(v) => updateSpecificRate('of', v)} />
            <RateInput label="PP Rate" value={state.modelRates.pp} color="sky" onChange={(v) => updateSpecificRate('pp', v)} />
            <RateInput label="CR Rate" value={state.modelRates.cr} color="emerald" onChange={(v) => updateSpecificRate('cr', v)} />
          </div>
        </div>
      </header>

      <div className="glass-card rounded-[2.5rem] overflow-hidden shadow-2xl border-slate-800">
        <div className="p-8 border-b border-slate-800 bg-slate-900/30 flex flex-col md:flex-row justify-between items-center gap-4">
           <h2 className="text-xl font-bold font-outfit">Выплаты анкет</h2>
           <div className="flex gap-6">
              <div className="text-center">
                 <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Общий Brutto (Clean)</p>
                 <p className="text-xl font-black text-white font-mono">${modelStats.reduce((s,m) => s + m.totalGross, 0).toLocaleString()}</p>
              </div>
              <div className="text-center">
                 <p className="text-[10px] text-amber-500 font-black uppercase mb-1">Выдано авансов</p>
                 <p className="text-xl font-black text-amber-400 font-mono">-${modelStats.reduce((s,m) => s + m.totalAdvances, 0).toLocaleString()}</p>
              </div>
              <div className="text-center">
                 <p className="text-[10px] text-indigo-500 font-black uppercase mb-1">Остаток к выплате</p>
                 <p className="text-xl font-black text-indigo-400 font-mono">${modelStats.reduce((s,m) => s + m.totalEarn, 0).toLocaleString()}</p>
              </div>
           </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-slate-900/50 text-slate-500 font-bold text-[10px] uppercase tracking-widest border-b border-slate-800">
                <th className="px-8 py-6">Анкета</th>
                <th className="px-6 py-6 text-center">Платформы (Gross)</th>
                <th className="px-6 py-6 text-center">Корректировки (Бонус / Аванс)</th>
                <th className="px-6 py-6 text-right">Начислено / Остаток</th>
                <th className="px-8 py-6 text-right">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {modelStats.map((m) => (
                <tr key={m.model} className="hover:bg-indigo-500/5 transition-all group">
                  <td className="px-8 py-5">
                    <div className="font-bold text-white text-base">{m.model}</div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="flex justify-center gap-4 text-[10px] font-mono">
                       <span className="text-blue-400">OF: ${m.grossOF.toFixed(0)}</span>
                       <span className="text-sky-400">PP: ${m.grossPP.toFixed(0)}</span>
                       <span className="text-emerald-400">CR: ${m.grossCR.toFixed(0)}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-center">
                    <div className="flex flex-col items-center gap-2">
                       <div className="flex flex-wrap justify-center gap-1">
                          {/* БОНУСЫ */}
                          {m.bonuses.map(b => (
                            <div key={b.id} className="flex items-center gap-1 bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded text-[9px] font-black border border-emerald-500/20">
                               B: +{b.amount}
                               <button onClick={() => removeBonus(b.id)} className="hover:text-rose-500 ml-1"><ICONS.Trash size={10}/></button>
                            </div>
                          ))}
                          {/* АВАНСЫ */}
                          {m.advances.map(a => (
                            <div key={a.id} className="flex items-center gap-1 bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded text-[9px] font-black border border-amber-500/20">
                               A: -{a.amount}
                               <button onClick={() => removeOperation(a.id)} className="hover:text-rose-500 ml-1"><ICONS.Trash size={10}/></button>
                            </div>
                          ))}
                       </div>
                       
                       <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="flex items-center gap-1">
                            <input 
                              type="number" 
                              className="w-14 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[9px] text-emerald-400 outline-none focus:border-emerald-500" 
                              placeholder="Бонус"
                              value={bonusInputs[m.model] || ''}
                              onChange={(e) => setBonusInputs(p => ({ ...p, [m.model]: e.target.value }))}
                            />
                            <button onClick={() => addBonus(m.model)} className="text-emerald-500 hover:text-white transition-colors"><ICONS.Plus size={12}/></button>
                          </div>
                          <div className="w-px h-4 bg-slate-800"></div>
                          <div className="flex items-center gap-1">
                            <input 
                              type="number" 
                              className="w-14 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[9px] text-amber-400 outline-none focus:border-amber-500" 
                              placeholder="Аванс"
                              value={advanceInputs[m.model] || ''}
                              onChange={(e) => setAdvanceInputs(p => ({ ...p, [m.model]: e.target.value }))}
                            />
                            <button onClick={() => addAdvance(m.model)} className="text-amber-500 hover:text-white transition-colors"><ICONS.Plus size={12}/></button>
                          </div>
                       </div>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-right">
                    <div className={`font-black font-mono text-xl group-hover:scale-105 transition-transform origin-right ${m.totalEarn >= 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
                      ${m.totalEarn.toFixed(2)}
                    </div>
                    <div className="text-[8px] text-slate-500 font-black uppercase">Начислено: ${m.accruedSalary.toFixed(1)}</div>
                  </td>
                  <td className="px-8 py-5 text-right">
                    <button 
                      onClick={() => toggleModelPaid(m.model)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${m.isPaid ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}
                    >
                      {m.isPaid ? 'Выплачено' : 'Ожидает'}
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

const RateInput: React.FC<{ label: string; value: number; color: string; onChange: (v: string) => void }> = ({ label, value, color, onChange }) => (
  <div className="space-y-1">
    <label className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">{label}</label>
    <div className="relative">
      <input 
        type="number" 
        className={`w-20 bg-slate-950 border rounded-xl px-3 py-1 text-xs font-mono focus:ring-1 focus:ring-indigo-500 outline-none ${color === 'blue' ? 'text-blue-400 border-blue-500/20' : color === 'sky' ? 'text-sky-400 border-sky-500/20' : 'text-emerald-400 border-emerald-500/20'}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="absolute right-2 top-1 text-slate-600 text-[10px]">%</span>
    </div>
  </div>
);

export default Models;
