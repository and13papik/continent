import React, { useMemo, useState } from 'react';
import { AppState, ModelBonus, PaidStatus, OperationRecord } from '../types';
import { ICONS } from '../constants';
import PeriodBadge from '../components/PeriodBadge';

interface ModelsProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const Models: React.FC<ModelsProps> = ({ state, updateState }) => {
  const activePeriodId = state.selectedPeriodId;
  const activePeriod = state.accountingPeriods.find(p => p.id === activePeriodId)!;
  
  // Show models that have any data in this period, plus those designated for this period
  const currentModels = useMemo(() => {
    const periodModels = (activePeriod.models && activePeriod.models.length > 0) ? activePeriod.models : state.models;
    const modelsWithIncome = state.incomeData.filter(r => r.periodId === activePeriodId).map(r => r.model);
    const modelsWithBonuses = (state.modelBonuses || []).filter(b => b.periodId === activePeriodId).map(b => b.model);
    const modelsWithOps = state.operationsData.filter(o => o.periodId === activePeriodId).map(o => o.model);
    
    return Array.from(new Set([
      ...periodModels,
      ...modelsWithIncome,
      ...modelsWithBonuses,
      ...modelsWithOps
    ])).filter((m): m is string => Boolean(m));
  }, [activePeriod.models, state.models, state.incomeData, state.modelBonuses, state.operationsData, activePeriodId]);

  // Combine state.models and currentModels to ensure EVERY single model in the system is available to be linked
  const allAvailableModels = useMemo(() => {
    return Array.from(new Set([
      ...(state.models || []),
      ...currentModels
    ])).filter((m): m is string => Boolean(m)).sort((a, b) => a.localeCompare(b));
  }, [state.models, currentModels]);

  const currentRates = activePeriod.modelRates || state.modelRates;

  const [bonusInputs, setBonusInputs] = useState<Record<string, string>>({});
  const [advanceInputs, setAdvanceInputs] = useState<Record<string, string>>({});

  // Grouping & connection states
  const [isGrouped, setIsGrouped] = useState<boolean>(true);
  const [showManageGroups, setShowManageGroups] = useState<boolean>(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Form states for modal
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState<string>('');
  const [selectedGroupMembers, setSelectedGroupMembers] = useState<string[]>([]);

  const modelStats = useMemo(() => {
    return currentModels.map(model => {
      const records = state.incomeData.filter(r => r.model === model && r.periodId === activePeriodId);
      const bonuses = (state.modelBonuses || []).filter(b => b.model === model && b.periodId === activePeriodId);
      const modelOps = state.operationsData.filter(o => o.model === model && o.periodId === activePeriodId);
      
      const refunds = modelOps.filter(o => o.type === 'refund');
      const totalRefunds = refunds.reduce((sum, o) => sum + o.amount, 0);
      
      // Авансы
      const advances = modelOps.filter(o => o.type === 'advance');
      const totalAdvances = advances.reduce((sum, o) => sum + o.amount, 0);

      // Выплаты (ЗП)
      const salaryPayments = modelOps.filter(o => o.type === 'salary_payment');
      const totalSalaries = salaryPayments.reduce((sum, o) => sum + o.amount, 0);

      const grossOF = records.reduce((sum, r) => sum + r.onlyFans, 0);
      const grossPP = records.reduce((sum, r) => sum + r.paypal, 0);
      const grossCR = records.reduce((sum, r) => sum + r.crypto, 0);
      
      const totalGrossRaw = grossOF + grossPP + grossCR;
      const totalGross = totalGrossRaw - totalRefunds;

      const earnOF = Math.max(0, grossOF - refunds.filter(r => r.platform === 'onlyFans').reduce((s,o) => s+o.amount, 0)) * (currentRates.of / 100);
      const earnPP = Math.max(0, grossPP - refunds.filter(r => r.platform === 'paypal').reduce((s,o) => s+o.amount, 0)) * (currentRates.pp / 100);
      const earnCR = Math.max(0, grossCR - refunds.filter(r => r.platform === 'crypto').reduce((s,o) => s+o.amount, 0)) * (currentRates.cr / 100);
      
      const genericRefunds = refunds.filter(r => !r.platform).reduce((s,o) => s+o.amount, 0);
      const avgModelRate = totalGrossRaw > 0 ? (earnOF + earnPP + earnCR) / totalGrossRaw : (currentRates.of / 100);
      
      const bonusTotal = bonuses.reduce((sum, b) => sum + b.amount, 0);
      const accruedSalary = (earnOF + earnPP + earnCR + bonusTotal) - (genericRefunds * avgModelRate);
      
      // ИСПРАВЛЕНИЕ: Теперь вычитаем и авансы, и уже проведенные выплаты
      const totalEarn = accruedSalary - totalAdvances - totalSalaries;
      
      const isPaid = state.paidStatuses.some(s => s.entityName === model && s.entityType === 'model' && s.periodId === activePeriodId);

      return {
        model,
        grossOF, grossPP, grossCR, totalGross,
        earnOF, earnPP, earnCR, bonusTotal,
        totalRefunds,
        totalAdvances,
        totalSalaries,
        advances,
        salaryPayments,
        accruedSalary,
        totalEarn, isPaid, bonuses
      };
    }).sort((a, b) => b.totalGross - a.totalGross);
  }, [state.incomeData, currentModels, activePeriodId, currentRates, state.modelBonuses, state.paidStatuses, state.operationsData]);

  // Combine grouped models and single models into visual records list
  const displayRecords = useMemo(() => {
    if (!isGrouped || !state.modelGroups || state.modelGroups.length === 0) {
      return modelStats.map(ms => ({ ...ms, isGroup: false as const, groupId: undefined, members: [] as string[], isPartiallyPaid: false, membersStats: [] as typeof modelStats }));
    }

    const groupedModelNames = new Set(
      state.modelGroups.flatMap(g => g.members)
    );

    // 1. Calculate combined stats for groups
    const groupRecords = state.modelGroups.map(group => {
      const membersStats = modelStats.filter(ms => group.members.includes(ms.model));
      
      const grossOF = membersStats.reduce((s, ms) => s + ms.grossOF, 0);
      const grossPP = membersStats.reduce((s, ms) => s + ms.grossPP, 0);
      const grossCR = membersStats.reduce((s, ms) => s + ms.grossCR, 0);
      const totalGross = membersStats.reduce((s, ms) => s + ms.totalGross, 0);
      const earnOF = membersStats.reduce((s, ms) => s + ms.earnOF, 0);
      const earnPP = membersStats.reduce((s, ms) => s + ms.earnPP, 0);
      const earnCR = membersStats.reduce((s, ms) => s + ms.earnCR, 0);
      const bonusTotal = membersStats.reduce((s, ms) => s + ms.bonusTotal, 0);
      const totalRefunds = membersStats.reduce((s, ms) => s + ms.totalRefunds, 0);
      const totalAdvances = membersStats.reduce((s, ms) => s + ms.totalAdvances, 0);
      const totalSalaries = membersStats.reduce((s, ms) => s + ms.totalSalaries, 0);
      const accruedSalary = membersStats.reduce((s, ms) => s + ms.accruedSalary, 0);
      const totalEarn = membersStats.reduce((s, ms) => s + ms.totalEarn, 0);
      
      const isPaid = membersStats.length > 0 && membersStats.every(ms => ms.isPaid);
      const isPartiallyPaid = !isPaid && membersStats.some(ms => ms.isPaid);

      return {
        isGroup: true as const,
        groupId: group.id,
        model: group.name,
        members: group.members,
        grossOF, grossPP, grossCR, totalGross,
        earnOF, earnPP, earnCR, bonusTotal,
        totalRefunds, totalAdvances, totalSalaries,
        accruedSalary, totalEarn, isPaid, isPartiallyPaid,
        membersStats
      };
    });

    // 2. Individual models not associated with any group
    const individualRecords = modelStats
      .filter(ms => !groupedModelNames.has(ms.model))
      .map(ms => ({ 
        ...ms, 
        isGroup: false as const, 
        groupId: undefined, 
        members: [] as string[], 
        isPartiallyPaid: false, 
        membersStats: [] as typeof modelStats 
      }));

    // Return combined records, sorted by gross revenue
    return [...groupRecords, ...individualRecords].sort((a, b) => b.totalGross - a.totalGross);
  }, [modelStats, isGrouped, state.modelGroups]);

  const addBonus = (model: string) => {
    const val = parseFloat(bonusInputs[model]) || 0;
    if (val <= 0) return;
    const newBonus: ModelBonus = {
      id: String(Date.now() + Math.random()),
      model,
      periodId: activePeriodId,
      amount: val,
      comment: 'Бонус',
      date: new Date().toISOString().split('T')[0],
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
      operator: 'SYSTEM',
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

  const toggleModelPaid = (model: string, currentRemainder: number) => {
    updateState(prev => {
      const existing = prev.paidStatuses.find(s => 
        s.entityName === model && 
        s.entityType === 'model' && 
        s.periodId === activePeriodId
      );
      
      const targetId = `paid-model-${model}-${activePeriodId}`;

      if (existing) {
        return { 
          ...prev, 
          deletedIds: [...(prev.deletedIds || []), existing.id],
          paidStatuses: prev.paidStatuses.filter(s => s.id !== existing.id) 
        };
      } else {
        let newOperations = [...prev.operationsData];
        if (currentRemainder > 0) {
          const autoPayment: OperationRecord = {
            id: `auto-sal-model-${model}-${Date.now()}`,
            type: 'salary_payment',
            operator: 'SYSTEM',
            model: model,
            amount: currentRemainder,
            comment: 'Авто-выплата (Модели)',
            date: new Date().toISOString().split('T')[0],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            periodId: activePeriodId
          };
          newOperations = [autoPayment, ...newOperations];
        }

        const newPaid: PaidStatus = {
          id: `${targetId}-${Date.now()}`,
          entityName: model,
          entityType: 'model',
          periodId: activePeriodId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        return { 
          ...prev, 
          deletedIds: (prev.deletedIds || []).filter(id => id !== targetId),
          operationsData: newOperations,
          paidStatuses: [...prev.paidStatuses, newPaid] 
        };
      }
    });
  };

  const toggleGroupPaid = (groupModelName: string, membersStats: typeof modelStats) => {
    const allPaid = membersStats.every(ms => ms.isPaid);
    
    updateState(prev => {
      let nextPaidStatuses = [...prev.paidStatuses];
      let nextOperations = [...prev.operationsData];
      let nextDeletedIds = [...(prev.deletedIds || [])];

      membersStats.forEach(ms => {
        const existing = nextPaidStatuses.find(s => 
          s.entityName === ms.model && 
          s.entityType === 'model' && 
          s.periodId === activePeriodId
        );
        const targetId = `paid-model-${ms.model}-${activePeriodId}`;

        if (allPaid) {
          // If all were paid, un-pay them all
          if (existing) {
            nextDeletedIds.push(existing.id);
            nextPaidStatuses = nextPaidStatuses.filter(s => s.id !== existing.id);
          }
        } else {
          // Mark all unpaid as paid
          if (!existing) {
            if (ms.totalEarn > 0.01) {
              const autoPayment: OperationRecord = {
                id: `auto-sal-model-${ms.model}-${Date.now() + Math.random()}`,
                type: 'salary_payment',
                operator: 'SYSTEM',
                model: ms.model,
                amount: ms.totalEarn,
                comment: `Авто-выплата (Модели) (Связка: ${groupModelName})`,
                date: new Date().toISOString().split('T')[0],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                periodId: activePeriodId
              };
              nextOperations = [autoPayment, ...nextOperations];
            }

            const newPaid: PaidStatus = {
              id: `${targetId}-${Date.now() + Math.random()}`,
              entityName: ms.model,
              entityType: 'model',
              periodId: activePeriodId,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            nextPaidStatuses.push(newPaid);
            nextDeletedIds = nextDeletedIds.filter(id => id !== targetId);
          }
        }
      });

      return {
        ...prev,
        paidStatuses: nextPaidStatuses,
        operationsData: nextOperations,
        deletedIds: nextDeletedIds,
        lastUpdated: Date.now(),
        version: (prev.version || 0) + 1
      };
    });
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

  const handleSaveGroup = (name: string, members: string[], existingId: string | null) => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      alert('Укажите название группы!');
      return;
    }
    if (members.length === 0) {
      alert('Импортируйте/выберите хотя бы одну анкету для связки!');
      return;
    }

    updateState(prev => {
      const groups = prev.modelGroups || [];
      const updatedGroups = existingId
        ? groups.map(g => g.id === existingId ? { ...g, name: trimmedName, members } : g)
        : [...groups, { id: 'group-' + Date.now(), name: trimmedName, members }];

      return {
        ...prev,
        modelGroups: updatedGroups,
        lastUpdated: Date.now(),
        version: (prev.version || 0) + 1
      };
    });
  };

  const handleDeleteGroup = (id: string) => {
    if (!confirm('Вы уверены, что хотите убрать связку этих анкет? Анкеты останутся в системе как отдельные строки.')) return;
    updateState(prev => ({
      ...prev,
      modelGroups: (prev.modelGroups || []).filter(g => g.id !== id),
      lastUpdated: Date.now(),
      version: (prev.version || 0) + 1
    }));
  };

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroups(p => ({ ...p, [groupId]: !p[groupId] }));
  };

  const updateGlobalRate = (val: string) => {
    const rate = parseFloat(val) || 0;
    updateState(prev => ({ 
      ...prev, 
      accountingPeriods: prev.accountingPeriods.map(p => p.id === activePeriodId ? { ...p, modelRates: { of: rate, pp: rate, cr: rate } } : p)
    }));
  };

  const updateSpecificRate = (field: keyof typeof state.modelRates, val: string) => {
    const rate = parseFloat(val) || 0;
    updateState(prev => ({ 
      ...prev, 
      accountingPeriods: prev.accountingPeriods.map(p => p.id === activePeriodId ? { ...p, modelRates: { ...(p.modelRates || prev.modelRates), [field]: rate } } : p)
    }));
  };

  const isUniform = currentRates.of === currentRates.pp && currentRates.pp === currentRates.cr;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold font-outfit text-white">Модели</h1>
          <div className="flex items-center gap-3 mt-1">
            <PeriodBadge state={state} />
            <p className="text-slate-400">Ведомость анкет и начислений</p>
          </div>
        </div>
        <div className="bg-slate-900/60 p-4 rounded-3xl border border-slate-800 flex flex-wrap items-center gap-6">
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Общая выплата (%)</label>
            <div className="relative">
              <input type="number" className="w-24 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-indigo-400 font-bold focus:ring-2 focus:ring-indigo-500 outline-none" value={isUniform ? currentRates.of : ''} placeholder="MIX" onChange={(e) => updateGlobalRate(e.target.value)} />
              <span className="absolute right-3 top-2.5 text-slate-600 text-xs">%</span>
            </div>
          </div>
          <div className="h-10 w-px bg-slate-800 hidden md:block" />
          <div className="flex gap-4">
            <RateInput label="OF Rate" value={currentRates.of} color="blue" onChange={(v) => updateSpecificRate('of', v)} />
            <RateInput label="PP Rate" value={currentRates.pp} color="sky" onChange={(v) => updateSpecificRate('pp', v)} />
            <RateInput label="CR Rate" value={currentRates.cr} color="emerald" onChange={(v) => updateSpecificRate('cr', v)} />
          </div>
        </div>
      </header>

      {/* Model Group Linker Interface */}
      {showManageGroups && (
        <div className="glass-card p-6 rounded-[2rem] border-slate-800 space-y-6 animate-in slide-in-from-top duration-300">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <ICONS.Users size={18} className="text-indigo-400" />
                Связанные анкеты (Группы моделей)
              </h3>
              <p className="text-[10px] text-slate-500">Свяжите несколько анкет одного человека, чтобы следить за общим доходом в одну строку.</p>
            </div>
            <button 
              onClick={() => {
                setShowManageGroups(false);
                setEditingGroupId(null);
                setNewGroupName('');
                setSelectedGroupMembers([]);
              }}
              className="p-2 bg-slate-800 hover:bg-slate-700 hover:text-white rounded-full text-slate-400 transition-colors"
            >
              <ICONS.Close size={14} />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Left Column: Existing groups */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Текущие связи анкет</h4>
              {(!state.modelGroups || state.modelGroups.length === 0) ? (
                <div className="text-center py-8 bg-slate-900/40 rounded-2xl border border-dashed border-slate-800 space-y-1">
                  <p className="text-xs text-slate-500 font-medium">Нет настроенных связей</p>
                  <p className="text-[10px] text-slate-600">Создайте группу справа, выделив связанные анкеты</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                  {state.modelGroups.map(group => (
                    <div key={group.id} className="p-4 bg-slate-900/50 rounded-2xl border border-slate-800 flex items-center justify-between gap-4 group hover:border-indigo-500/30 transition-all">
                      <div className="space-y-1">
                        <div className="font-bold text-white text-sm flex items-center gap-2">
                          <span className="text-indigo-400 font-outfit">{group.name}</span>
                          <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[8px] font-black uppercase px-2 py-0.5 rounded">
                            {group.members.length} анкет(ы)
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {group.members.map(m => (
                            <span key={m} className="bg-slate-950 text-slate-400 text-[9px] px-2 py-0.5 rounded-lg border border-slate-850">
                              {m}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setEditingGroupId(group.id);
                            setNewGroupName(group.name);
                            setSelectedGroupMembers(group.members);
                          }}
                          className="p-1.5 bg-slate-800 hover:bg-indigo-600/20 text-slate-400 hover:text-indigo-400 rounded-lg transition-all"
                        >
                          <ICONS.Edit size={12} />
                        </button>
                        <button 
                          onClick={() => handleDeleteGroup(group.id)}
                          className="p-1.5 bg-slate-800 hover:bg-rose-600/20 text-slate-400 hover:text-rose-400 rounded-lg transition-all"
                        >
                          <ICONS.Trash size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Column: Manage creation or edit */}
            <div className="p-5 bg-slate-900/30 rounded-2xl border border-slate-800 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                {editingGroupId ? 'Редактировать связь' : 'Создать новую связь'}
              </h4>
              <div className="space-y-2">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Имя модели (Основное название)</label>
                <input 
                  type="text" 
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none" 
                  value={newGroupName} 
                  placeholder="Пример: Stacy (3 анкеты)" 
                  onChange={(e) => setNewGroupName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Выберите анкеты для объединения</label>
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 h-[150px] overflow-y-auto space-y-1.5 label-scroller">
                  {allAvailableModels.length === 0 ? (
                    <p className="text-[10px] text-slate-600 italic text-center py-4">В системе нет анкет</p>
                  ) : (
                    allAvailableModels.map(modelName => {
                      // Check if already in another group
                      const otherGroup = (state.modelGroups || []).find(g => g.id !== editingGroupId && g.members.includes(modelName));
                      
                      return (
                        <label key={modelName} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${otherGroup ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-900/50'}`}>
                          <input 
                            type="checkbox"
                            disabled={!!otherGroup}
                            checked={selectedGroupMembers.includes(modelName)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedGroupMembers(p => [...p, modelName]);
                              } else {
                                setSelectedGroupMembers(p => p.filter(m => m !== modelName));
                              }
                            }}
                            className="rounded border-slate-700 bg-slate-900 text-indigo-600 focus:ring-indigo-500 w-4.5 h-4.5"
                          />
                          <div className="text-xs flex justify-between items-center w-full select-none">
                            <span className="font-medium text-slate-200">{modelName}</span>
                            {otherGroup && (
                              <span className="text-[8px] text-slate-500 font-bold uppercase">В группе Name: {otherGroup.name}</span>
                            )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex gap-3 justify-end pt-2">
                {(editingGroupId || newGroupName || selectedGroupMembers.length > 0) && (
                  <button 
                    onClick={() => {
                      setEditingGroupId(null);
                      setNewGroupName('');
                      setSelectedGroupMembers([]);
                    }}
                    className="px-4 py-2 text-[10px] bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl font-bold uppercase tracking-wider transition-colors"
                  >
                    Сбросить
                  </button>
                )}
                <button 
                  onClick={() => {
                    handleSaveGroup(newGroupName, selectedGroupMembers, editingGroupId);
                    setEditingGroupId(null);
                    setNewGroupName('');
                    setSelectedGroupMembers([]);
                  }}
                  className="px-5 py-2 text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold uppercase tracking-wider transition-colors"
                >
                  {editingGroupId ? 'Сохранить изменения' : 'Связать анкеты'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Stats and Table Card */}
      <div className="glass-card rounded-[2.5rem] overflow-hidden shadow-2xl border-slate-800">
        <div className="p-8 border-b border-slate-800 bg-slate-900/30 flex flex-col md:flex-row justify-between items-center gap-6">
           <div>
             <h2 className="text-xl font-bold font-outfit text-white">Выплаты анкет</h2>
             <div className="flex items-center gap-3 mt-2">
               <button 
                 onClick={() => setIsGrouped(!isGrouped)}
                 className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-2 border ${isGrouped ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20' : 'bg-slate-800 text-slate-500 border-slate-700 hover:bg-slate-700'}`}
               >
                 <ICONS.Users size={12} />
                 {isGrouped ? 'Отображение: Объединять связи' : 'Отображение: По раздельности'}
               </button>
               <button 
                 onClick={() => setShowManageGroups(!showManageGroups)}
                 className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border hover:bg-slate-800 border-slate-700 ${showManageGroups ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-300'}`}
               >
                 <ICONS.Edit size={10} />
                 Настройка связей
               </button>
             </div>
           </div>
           
           <div className="flex gap-6">
              <div className="text-center">
                 <p className="text-[10px] text-slate-500 font-black uppercase mb-1">Общий Brutto (Clean)</p>
                 <p className="text-xl font-black text-white font-mono">${modelStats.reduce((s,m) => s + m.totalGross, 0).toLocaleString()}</p>
              </div>
              <div className="text-center">
                 <p className="text-[10px] text-amber-500 font-black uppercase mb-1">Выдано авансов/ЗП</p>
                 <p className="text-xl font-black text-amber-400 font-mono">-${modelStats.reduce((s,m) => s + m.totalAdvances + m.totalSalaries, 0).toLocaleString()}</p>
              </div>
              <div className="text-center">
                 <p className="text-[10px] text-indigo-500 font-black uppercase mb-1">Остаток к выплате</p>
                 <p className="text-xl font-black text-indigo-400 font-mono">${Math.max(0, modelStats.reduce((s,m) => s + m.totalEarn, 0)).toLocaleString()}</p>
              </div>
           </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-slate-900/50 text-slate-500 font-bold text-[10px] uppercase tracking-widest border-b border-slate-800">
                <th className="px-8 py-6">Анкета</th>
                <th className="px-6 py-6 text-center">Платформы (Gross)</th>
                <th className="px-6 py-6 text-center">Корректировки (Бонус / Аванс / ЗП)</th>
                <th className="px-6 py-6 text-right">Начислено / Остаток</th>
                <th className="px-8 py-6 text-right">Статус</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {displayRecords.map((r) => {
                if (r.isGroup) {
                  const isExpanded = !!expandedGroups[r.groupId!];
                  return (
                    <React.Fragment key={r.groupId}>
                      {/* Master Group Row */}
                      <tr className="bg-indigo-950/20 hover:bg-indigo-900/10 border-indigo-500/10 transition-all select-none group border-b border-slate-850">
                        {/* Name Column with Accordion Expansion Trigger */}
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => toggleGroupExpand(r.groupId!)}
                              className="p-1 hover:bg-slate-800 rounded transition-colors text-slate-400 hover:text-white"
                            >
                              {isExpanded ? (
                                <ICONS.ChevronDown size={14} />
                              ) : (
                                <ICONS.ChevronRight size={14} />
                              )}
                            </button>
                            <div className="flex items-center gap-2">
                              <div className="font-bold text-white text-base font-outfit">{r.model}</div>
                              <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[8px] font-black uppercase px-2 py-0.5 rounded flex items-center gap-1">
                                <ICONS.Users size={10} />
                                Связка ({r.members.length} анкет)
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Combined Platform Profits */}
                        <td className="px-6 py-5 text-center">
                          <div className="flex justify-center gap-4 text-[10px] font-mono">
                             <span className="text-blue-400 font-bold">OF: ${r.grossOF.toFixed(0)}</span>
                             <span className="text-sky-400 font-bold">PP: ${r.grossPP.toFixed(0)}</span>
                             <span className="text-emerald-400 font-bold">CR: ${r.grossCR.toFixed(0)}</span>
                          </div>
                        </td>

                        {/* Aggregated Corrections List */}
                        <td className="px-6 py-5 text-center">
                          <div className="flex flex-col items-center gap-1 text-[8px] font-mono">
                            {(() => {
                              const allBonuses = r.membersStats.flatMap(ms => ms.bonuses.map(b => ({ ...b, model: ms.model })));
                              const allAdvances = r.membersStats.flatMap(ms => ms.advances.map(a => ({ ...a, model: ms.model })));
                              const allSalaries = r.membersStats.flatMap(ms => ms.salaryPayments.map(s => ({ ...s, model: ms.model })));
                              
                              if (allBonuses.length === 0 && allAdvances.length === 0 && allSalaries.length === 0) {
                                return <span className="text-[10px] text-slate-500 italic">Нет корректировок</span>;
                              }
                              
                              return (
                                <div className="flex flex-wrap justify-center gap-1 max-w-[320px]">
                                  {allBonuses.map(b => (
                                    <span key={b.id} className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 flex items-center gap-0.5">
                                      {b.model}: +{b.amount}
                                    </span>
                                  ))}
                                  {allAdvances.map(a => (
                                    <span key={a.id} className="bg-amber-500/10 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/20 flex items-center gap-0.5">
                                      {a.model}: -{a.amount}
                                    </span>
                                  ))}
                                  {allSalaries.map(s => (
                                    <span key={s.id} className="bg-indigo-500/15 text-indigo-400 px-1.5 py-0.5 rounded border border-indigo-500/20 flex items-center gap-0.5">
                                      {s.model}: -{s.amount.toFixed(0)}
                                    </span>
                                  ))}
                                </div>
                              );
                            })()}
                            <div className="text-[8px] text-slate-600 italic font-sans mt-1">Раскройте связку, чтобы детализировать балансы</div>
                          </div>
                        </td>

                        {/* Accumulated Remainder */}
                        <td className="px-6 py-5 text-right">
                          <div className={`font-black font-mono text-xl ${r.totalEarn > 0.01 ? 'text-indigo-400' : 'text-slate-500'}`}>${Math.max(0, r.totalEarn).toFixed(2)}</div>
                          <div className="text-[8px] text-slate-500 font-black uppercase">Весь оклад: ${r.accruedSalary.toFixed(1)}</div>
                        </td>

                        {/* Combined payment button */}
                        <td className="px-8 py-5 text-right">
                          <button 
                            onClick={() => toggleGroupPaid(r.model, r.membersStats)} 
                            className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${r.isPaid ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : r.isPartiallyPaid ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}
                          >
                            {r.isPaid ? 'Выплачено все' : r.isPartiallyPaid ? 'Частично' : 'Ожидает'}
                          </button>
                        </td>
                      </tr>

                      {/* Render Expanded members individually */}
                      {isExpanded && r.membersStats.map((ms) => (
                        <tr key={ms.model} className="bg-slate-950/40 hover:bg-slate-900/30 transition-all group/sub select-none">
                          {/* Indented Sub account model name */}
                          <td className="px-8 py-4 pl-14">
                            <div className="flex items-center gap-2">
                              <span className="text-slate-600 font-mono text-xs">└─</span>
                              <div className="font-bold text-slate-300 text-sm">{ms.model}</div>
                            </div>
                          </td>

                          {/* Member specific platforms */}
                          <td className="px-6 py-4 text-center">
                            <div className="flex justify-center gap-4 text-[9px] font-mono opacity-80">
                               <span className="text-blue-400/80">OF: ${ms.grossOF.toFixed(0)}</span>
                               <span className="text-sky-400/80">PP: ${ms.grossPP.toFixed(0)}</span>
                               <span className="text-emerald-400/80">CR: ${ms.grossCR.toFixed(0)}</span>
                            </div>
                          </td>

                          {/* Individual corrections manager in expanded view */}
                          <td className="px-6 py-4 text-center">
                            <div className="flex flex-col items-center gap-2">
                               <div className="flex flex-wrap justify-center gap-1">
                                  {ms.bonuses.map(b => (
                                    <div key={b.id} className="flex items-center gap-1 bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded text-[8px] font-black border border-emerald-500/20">
                                       B: +{b.amount} <button onClick={() => removeBonus(b.id)} className="hover:text-rose-500 ml-1"><ICONS.Trash size={10}/></button>
                                    </div>
                                  ))}
                                  {ms.advances.map(a => (
                                    <div key={a.id} className="flex items-center gap-1 bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded text-[8px] font-black border border-amber-500/20">
                                       A: -{a.amount} <button onClick={() => removeOperation(a.id)} className="hover:text-rose-500 ml-1"><ICONS.Trash size={10}/></button>
                                    </div>
                                  ))}
                                  {ms.salaryPayments.map(s => (
                                    <div key={s.id} className="flex items-center gap-1 bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded text-[8px] font-black border border-indigo-500/20">
                                       S: -{s.amount.toFixed(0)} <button onClick={() => removeOperation(s.id)} className="hover:text-rose-500 ml-1"><ICONS.Trash size={10}/></button>
                                    </div>
                                  ))}
                               </div>
                               <div className="flex items-center gap-2 opacity-0 group-hover/sub:opacity-100 transition-opacity">
                                  <div className="flex items-center gap-1">
                                    <input type="number" className="w-12 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[8px] text-emerald-400 outline-none" placeholder="Бонус" value={bonusInputs[ms.model] || ''} onChange={(e) => setBonusInputs(p => ({ ...p, [ms.model]: e.target.value }))} />
                                    <button onClick={() => addBonus(ms.model)} className="text-emerald-500 hover:text-white transition-colors"><ICONS.Plus size={10}/></button>
                                  </div>
                                  <div className="w-px h-3 bg-slate-800"></div>
                                  <div className="flex items-center gap-1">
                                    <input type="number" className="w-12 bg-slate-900 border border-slate-800 rounded px-1.5 py-0.5 text-[8px] text-amber-400 outline-none" placeholder="Аванс" value={advanceInputs[ms.model] || ''} onChange={(e) => setAdvanceInputs(p => ({ ...p, [ms.model]: e.target.value }))} />
                                    <button onClick={() => addAdvance(ms.model)} className="text-amber-500 hover:text-white transition-colors"><ICONS.Plus size={10}/></button>
                                  </div>
                               </div>
                            </div>
                          </td>

                          {/* Member specific amount */}
                          <td className="px-6 py-4 text-right">
                            <div className={`font-black font-mono text-sm ${ms.totalEarn > 0.01 ? 'text-indigo-400' : 'text-slate-500'}`}>${Math.max(0, ms.totalEarn).toFixed(2)}</div>
                            <div className="text-[7px] text-slate-500 font-black uppercase font-mono">Начислено: ${ms.accruedSalary.toFixed(1)}</div>
                          </td>

                          {/* Member specific paid check */}
                          <td className="px-8 py-4 text-right">
                            <button onClick={() => toggleModelPaid(ms.model, ms.totalEarn)} className={`px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all ${ms.isPaid ? 'bg-emerald-500/80 text-white' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}>
                              {ms.isPaid ? 'Выплачено' : 'Ожидает'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                } else {
                  // Individual Model Row (Unlinked)
                  return (
                    <tr key={r.model} className="hover:bg-indigo-500/5 transition-all group">
                      <td className="px-8 py-5"><div className="font-bold text-white text-base font-outfit">{r.model}</div></td>
                      <td className="px-6 py-5 text-center">
                        <div className="flex justify-center gap-4 text-[10px] font-mono">
                           <span className="text-blue-400">OF: ${r.grossOF.toFixed(0)}</span>
                           <span className="text-sky-400">PP: ${r.grossPP.toFixed(0)}</span>
                           <span className="text-emerald-400">CR: ${r.grossCR.toFixed(0)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-center">
                        <div className="flex flex-col items-center gap-2">
                           <div className="flex flex-wrap justify-center gap-1">
                              {r.bonuses.map(b => (
                                <div key={b.id} className="flex items-center gap-1 bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded text-[9px] font-black border border-emerald-500/20">
                                   B: +{b.amount} <button onClick={() => removeBonus(b.id)} className="hover:text-rose-500 ml-1"><ICONS.Trash size={10}/></button>
                                </div>
                              ))}
                              {r.advances.map(a => (
                                <div key={a.id} className="flex items-center gap-1 bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded text-[9px] font-black border border-amber-500/20">
                                   A: -{a.amount} <button onClick={() => removeOperation(a.id)} className="hover:text-rose-500 ml-1"><ICONS.Trash size={10}/></button>
                                </div>
                              ))}
                              {r.salaryPayments.map(s => (
                                <div key={s.id} className="flex items-center gap-1 bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded text-[9px] font-black border border-indigo-500/20">
                                   S: -{s.amount.toFixed(0)} <button onClick={() => removeOperation(s.id)} className="hover:text-rose-500 ml-1"><ICONS.Trash size={10}/></button>
                                </div>
                              ))}
                           </div>
                           <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <div className="flex items-center gap-1">
                                <input type="number" className="w-14 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[9px] text-emerald-400 outline-none" placeholder="Бонус" value={bonusInputs[r.model] || ''} onChange={(e) => setBonusInputs(p => ({ ...p, [r.model]: e.target.value }))} />
                                <button onClick={() => addBonus(r.model)} className="text-emerald-500 hover:text-white transition-colors"><ICONS.Plus size={12}/></button>
                              </div>
                              <div className="w-px h-4 bg-slate-800"></div>
                              <div className="flex items-center gap-1">
                                <input type="number" className="w-14 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[9px] text-amber-400 outline-none" placeholder="Аванс" value={advanceInputs[r.model] || ''} onChange={(e) => setAdvanceInputs(p => ({ ...p, [r.model]: e.target.value }))} />
                                <button onClick={() => addAdvance(r.model)} className="text-amber-500 hover:text-white transition-colors"><ICONS.Plus size={12}/></button>
                              </div>
                           </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <div className={`font-black font-mono text-xl group-hover:scale-105 transition-transform origin-right ${r.totalEarn > 0.01 ? 'text-indigo-400' : 'text-slate-500'}`}>${Math.max(0, r.totalEarn).toFixed(2)}</div>
                        <div className="text-[8px] text-slate-500 font-black uppercase">Начислено: ${r.accruedSalary.toFixed(1)}</div>
                      </td>
                      <td className="px-8 py-5 text-right">
                        <button onClick={() => toggleModelPaid(r.model, r.totalEarn)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${r.isPaid ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/20' : 'bg-slate-800 text-slate-500 hover:bg-slate-700'}`}>
                          {r.isPaid ? 'Выплачено' : 'Ожидает'}
                        </button>
                      </td>
                    </tr>
                  );
                }
              })}
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
      <input type="number" className={`w-20 bg-slate-950 border rounded-xl px-3 py-1 text-xs font-mono outline-none ${color === 'blue' ? 'text-blue-400 border-blue-500/20' : color === 'sky' ? 'text-sky-400 border-sky-500/20' : 'text-emerald-400 border-emerald-500/20'}`} value={value} onChange={(e) => onChange(e.target.value)} />
      <span className="absolute right-2 top-1 text-slate-600 text-[10px]">%</span>
    </div>
  </div>
);

export default Models;
