import { calculateModelEarnings } from '../financialCalculations';
import React, { useMemo, useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AppState, ModelBonus, PaidStatus, OperationRecord } from '../types';
import { ICONS } from '../constants';
import { OnlyFansLogo, PayPalLogo } from '../components/ServiceLogos';
import './Models.css';

const money = (value: number) => '$' + value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

interface ModelsProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => boolean | void;
}

const Models: React.FC<ModelsProps> = ({ state, updateState }) => {
  const [search, setSearch] = useState('');
  const [showRates, setShowRates] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
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
      
      const advances = modelOps.filter(o => o.type === 'advance');
      const totalAdvances = advances.reduce((sum, o) => sum + o.amount, 0);
      const salaryPayments = modelOps.filter(o => o.type === 'salary_payment');
      const totalSalaries = salaryPayments.reduce((sum, o) => sum + o.amount, 0);
      const bonusTotal = bonuses.reduce((sum, b) => sum + b.amount, 0);
      const { grossOF, grossPP, grossCR, totalGross, totalRefunds, earnOF, earnPP, earnCR, accruedSalary } = calculateModelEarnings(records, modelOps, currentRates, bonusTotal);

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
    if (updateState(prev => ({ ...prev, modelBonuses: [...(prev.modelBonuses || []), newBonus] })) === false) return;
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
    if (updateState(prev => ({ ...prev, operationsData: [newOp, ...prev.operationsData] })) === false) return;
    setAdvanceInputs(prev => ({ ...prev, [model]: '' }));
  };

  const toggleModelPaid = (model: string, currentRemainder: number) => {
    if (updateState(prev => {
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
    }) === false) return;
  };

  const toggleGroupPaid = (groupModelName: string, membersStats: typeof modelStats) => {
    const allPaid = membersStats.every(ms => ms.isPaid);
    
    if (updateState(prev => {
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
    }) === false) return;
  };

  const removeBonus = (bonusId: string) => {
    if (!confirm('Удалить этот бонус?')) return;
    if (updateState(prev => ({
      ...prev,
      deletedIds: [...prev.deletedIds, bonusId],
      modelBonuses: (prev.modelBonuses || []).filter(b => b.id !== bonusId)
    })) === false) return;
  };

  const removeOperation = (id: string) => {
    if (!confirm('Удалить эту операцию?')) return;
    if (updateState(prev => ({
      ...prev,
      deletedIds: [...prev.deletedIds, id],
      operationsData: prev.operationsData.filter(o => o.id !== id)
    })) === false) return;
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

    if (updateState(prev => {
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
    }) === false) return;
    setEditingGroupId(null);
    setNewGroupName('');
    setSelectedGroupMembers([]);
  };

  const handleDeleteGroup = (id: string) => {
    if (!confirm('Вы уверены, что хотите убрать связку этих анкет? Анкеты останутся в системе как отдельные строки.')) return;
    if (updateState(prev => ({
      ...prev,
      modelGroups: (prev.modelGroups || []).filter(g => g.id !== id),
      lastUpdated: Date.now(),
      version: (prev.version || 0) + 1
    })) === false) return;
    if (editingGroupId === id) {
      setEditingGroupId(null);
      setNewGroupName('');
      setSelectedGroupMembers([]);
    }
  };

  const toggleGroupExpand = (groupId: string) => {
    setExpandedGroups(p => ({ ...p, [groupId]: !p[groupId] }));
  };

  const updateGlobalRate = (val: string) => {
    const rate = parseFloat(val) || 0;
    if (updateState(prev => ({
      ...prev, 
      accountingPeriods: prev.accountingPeriods.map(p => p.id === activePeriodId ? { ...p, modelRates: { of: rate, pp: rate, cr: rate } } : p)
    })) === false) return;
  };

  const updateSpecificRate = (field: keyof typeof state.modelRates, val: string) => {
    const rate = parseFloat(val) || 0;
    if (updateState(prev => ({
      ...prev, 
      accountingPeriods: prev.accountingPeriods.map(p => p.id === activePeriodId ? { ...p, modelRates: { ...(p.modelRates || prev.modelRates), [field]: rate } } : p)
    })) === false) return;
  };

  const isUniform = currentRates.of === currentRates.pp && currentRates.pp === currentRates.cr;

  const locked = activePeriod.status !== 'open';
  useEffect(() => { setSelectedModel(null); setBonusInputs({}); setAdvanceInputs({}); }, [activePeriodId]);
  const selected = modelStats.find(row => row.model === selectedModel);
  const query = search.trim().toLocaleLowerCase();
  const visibleRecords = displayRecords.filter(row => [row.model, ...row.members].some(name => name.toLocaleLowerCase().includes(query)));
  const summary = modelStats.reduce((sum, row) => ({ accrued: sum.accrued + row.accruedSalary, paid: sum.paid + row.totalAdvances + row.totalSalaries, remainder: sum.remainder + Math.max(0, row.totalEarn) }), { accrued: 0, paid: 0, remainder: 0 });
  const resetGroupForm = () => { setEditingGroupId(null); setNewGroupName(''); setSelectedGroupMembers([]); };
  const closeGroups = () => { setShowManageGroups(false); resetGroupForm(); };

  const adjustments = (row: typeof modelStats[number] | typeof displayRecords[number]) => <div className="ct-model-adjustments">
    {row.bonusTotal !== 0 && <span className="is-bonus">Бонус +{money(row.bonusTotal)}</span>}
    {row.totalAdvances !== 0 && <span className="is-advance">Аванс {money(row.totalAdvances)}</span>}
    {row.totalSalaries !== 0 && <span className="is-salary">ЗП {money(row.totalSalaries)}</span>}
    {row.totalRefunds !== 0 && <span className="is-refund">Возврат {money(row.totalRefunds)}</span>}
    {![row.bonusTotal, row.totalAdvances, row.totalSalaries, row.totalRefunds].some(Boolean) && <span className="ct-model-no-adjustments">—</span>}
  </div>;

  const renderRow = (row: typeof displayRecords[number] | typeof modelStats[number], child = false) => {
    const group = 'isGroup' in row && row.isGroup ? row : null;
    const expanded = group ? !!expandedGroups[group.groupId!] : false;
    const partial = !!group?.isPartiallyPaid;
    const status = row.isPaid ? 'Выплачено' : partial ? 'Частично' : 'Ожидает';
    return <tr key={group ? `group:${group.groupId}` : `model:${row.model}`} className={`ct-model-row${group ? ' is-group' : ''}${child ? ' is-child' : ''}`} data-model={row.model} data-group={!!group}>
      <td><div className="ct-model-identity">
        <span className="ct-model-avatar">{group ? <ICONS.Users size={17} /> : row.model.slice(0,2).toUpperCase()}</span>
        <button className="ct-model-name" aria-label={group ? `Связка ${row.model}` : `Расчёт ${row.model}`} aria-expanded={group ? expanded : undefined} onClick={() => group ? toggleGroupExpand(group.groupId!) : setSelectedModel(row.model)}><strong>{row.model}</strong><small>{group ? `${group.members.length} анкет · связка` : 'Открыть расчёт'}</small></button>
        {group && <ICONS.ChevronDown size={16} className={expanded ? 'ct-model-chevron is-open' : 'ct-model-chevron'} />}
      </div></td>
      <td><div className="ct-model-platforms"><span title="OnlyFans"><OnlyFansLogo /><strong>{money(row.grossOF)}</strong></span><span title="PayPal"><PayPalLogo /><strong>{money(row.grossPP)}</strong></span><span title="Crypto"><ICONS.Income size={14} /><strong>{money(row.grossCR)}</strong></span></div></td>
      <td>{adjustments(row)}{!group && <button className="ct-model-detail-link" onClick={() => setSelectedModel(row.model)} aria-label={`Корректировки ${row.model}`}>Подробнее<ICONS.ChevronRight size={12} /></button>}</td>
      <td className="ct-model-balance"><strong>{money(Math.max(0, row.totalEarn))}</strong><small>Начислено {money(row.accruedSalary)}</small></td>
      <td><div className="ct-model-status-actions"><span className={`ct-model-status${row.isPaid ? ' is-paid' : partial ? ' is-partial' : ''}`}>{status}</span><button className="ct-model-pay" disabled={locked || !!group && !group.membersStats.length} aria-label={`${row.isPaid ? 'Снять отметку' : 'Выплатить'}: ${row.model}`} title={row.isPaid ? 'Снять отметку; записи выплат сохранятся' : 'Записать выплату остатка'} onClick={() => group ? toggleGroupPaid(group.model, group.membersStats) : toggleModelPaid(row.model, row.totalEarn)}>{row.isPaid ? 'Снять отметку' : 'Выплатить'}{!row.isPaid && <ICONS.ArrowRight size={13} />}</button></div></td>
    </tr>;
  };

  return <div className="ct-page ct-models">
    <header className="ct-page-heading"><div><h1>Модели</h1><p className="ct-muted">Анкеты, связки и расчёты за месяц</p></div><div className="ct-actions"><button className="ct-button" aria-expanded={showRates} onClick={() => setShowRates(!showRates)}><ICONS.Settings size={16} />Проценты</button><button className="ct-button ct-button-primary" onClick={() => setShowManageGroups(true)}><ICONS.Users size={16} />Связки анкет</button></div></header>
    <section className="ct-model-summary" aria-label="Итоги моделей за месяц">
      <div role="region" aria-label="Начислено моделям"><span><ICONS.Models size={17} />Начислено моделям</span><strong>{money(summary.accrued)}</strong><small>{modelStats.length} анкет · {activePeriod.label}</small></div>
      <div role="region" aria-label="Выплачено моделям"><span><ICONS.Check size={17} />Выплачено</span><strong>{money(summary.paid)}</strong><small>Зарплата и выданные авансы</small></div>
      <div role="region" aria-label="Осталось выплатить моделям"><span><ICONS.Wallet size={17} />Осталось выплатить</span><strong>{money(summary.remainder)}</strong><small>Сумма положительных остатков анкет</small></div>
    </section>
    {showRates && <section className="ct-model-rates" aria-label="Проценты моделей"><div><h2>Проценты начисления</h2><p>Для {activePeriod.label.toLocaleLowerCase()}. Изменения сохраняются сразу.</p></div><div className="ct-model-rate-fields">
      <label>Общий процент<input aria-label="Общий процент" disabled={locked} type="number" value={isUniform ? currentRates.of : ''} placeholder="Разные" onChange={e => updateGlobalRate(e.target.value)} /></label>
      <label><span><OnlyFansLogo />OnlyFans, %</span><input aria-label="Процент OnlyFans" disabled={locked} type="number" value={currentRates.of} onChange={e => updateSpecificRate('of', e.target.value)} /></label>
      <label><span><PayPalLogo />PayPal, %</span><input aria-label="Процент PayPal" disabled={locked} type="number" value={currentRates.pp} onChange={e => updateSpecificRate('pp', e.target.value)} /></label>
      <label><span><ICONS.Income size={14} />Crypto, %</span><input aria-label="Процент Crypto" disabled={locked} type="number" value={currentRates.cr} onChange={e => updateSpecificRate('cr', e.target.value)} /></label>
    </div></section>}
    <section className="ct-model-ledger" aria-labelledby="models-ledger-title">
      <header><div><h2 id="models-ledger-title">Ведомость моделей</h2><p>Итоги сверху — за весь месяц. Связки раскрываются по нажатию на название.</p></div><label className="ct-model-search"><ICONS.Search size={17} /><input aria-label="Найти модель или связку" placeholder="Найти модель или связку" value={search} onChange={e => setSearch(e.target.value)} /></label></header>
      <div className="ct-model-ledger-tools"><div role="group" aria-label="Отображение анкет"><button aria-pressed={isGrouped} onClick={() => setIsGrouped(true)}><ICONS.Users size={14} />По связкам</button><button aria-pressed={!isGrouped} onClick={() => setIsGrouped(false)}><ICONS.List size={14} />Все анкеты</button></div><span>{locked ? <><ICONS.Lock size={13} />Период закрыт · только просмотр</> : `${visibleRecords.length} ${isGrouped ? 'строк' : 'анкет'}`}</span></div>
      <div className="ct-model-table-wrap"><table className="ct-model-table"><caption className="sr-only">Начисления и выплаты моделей</caption><thead><tr><th scope="col">Анкета</th><th scope="col">Доход по платформам</th><th scope="col">Выплаты и правки</th><th scope="col" className="ct-model-balance">К выплате</th><th scope="col">Статус</th></tr></thead><tbody>{visibleRecords.map(row => <React.Fragment key={row.isGroup ? `group:${row.groupId}` : `model:${row.model}`}>{renderRow(row)}{row.isGroup && expandedGroups[row.groupId!] && row.membersStats.map(member => renderRow(member, true))}</React.Fragment>)}</tbody></table></div>
      {!visibleRecords.length && <div className="ct-model-empty"><ICONS.Search size={25} /><h3>Анкеты не найдены</h3><p>Попробуйте другое имя.</p><button className="ct-button" onClick={() => setSearch('')}>Сбросить поиск</button></div>}
    </section>

    {selected && <ModelDialog title={selected.model} close={() => setSelectedModel(null)}>
      <p className="ct-model-dialog-subtitle">Расчёт анкеты · {activePeriod.label}</p>
      <div className="ct-model-calculation"><div><span>Начислено</span><strong>{money(selected.accruedSalary)}</strong></div><div><span>Выплачено с авансами</span><strong>{money(selected.totalAdvances + selected.totalSalaries)}</strong></div><div><span>К выплате</span><strong>{money(Math.max(0, selected.totalEarn))}</strong></div></div>
      {selected.totalEarn < 0 && <p className="ct-model-note">Выплачено сверх начисленного: {money(-selected.totalEarn)}</p>}
      <div className="ct-model-platform-breakdown">{[{name:'OnlyFans',icon:<OnlyFansLogo />,gross:selected.grossOF,earn:selected.earnOF},{name:'PayPal',icon:<PayPalLogo />,gross:selected.grossPP,earn:selected.earnPP},{name:'Crypto',icon:<ICONS.Income size={15} />,gross:selected.grossCR,earn:selected.earnCR}].map(p => <div key={p.name}><span>{p.icon}{p.name}</span><small>Доход {money(p.gross)}</small><strong>{money(p.earn)}<small>начислено</small></strong></div>)}</div>
      {selected.totalRefunds !== 0 && <p className="ct-model-note">Возвраты: {money(selected.totalRefunds)}. Их влияние учтено в начислении.</p>}
      <section className="ct-model-adjustment-editor"><h3>Добавить корректировку</h3><div>
        <form onSubmit={e => { e.preventDefault(); addBonus(selected.model); }}><label>Бонус, USD<input aria-label="Бонус, USD" required type="number" step="any" min="0.000001" disabled={locked} placeholder="0,00" value={bonusInputs[selected.model] || ''} onChange={e => setBonusInputs(p => ({ ...p, [selected.model]: e.target.value }))} /></label><button disabled={locked} type="submit" className="ct-button" aria-label="Добавить бонус"><ICONS.Plus size={15} /></button></form>
        <form onSubmit={e => { e.preventDefault(); addAdvance(selected.model); }}><label>Аванс, USD<input aria-label="Аванс, USD" required type="number" step="any" min="0.000001" disabled={locked} placeholder="0,00" value={advanceInputs[selected.model] || ''} onChange={e => setAdvanceInputs(p => ({ ...p, [selected.model]: e.target.value }))} /></label><button disabled={locked} type="submit" className="ct-button" aria-label="Добавить аванс"><ICONS.Plus size={15} /></button></form>
      </div></section>
      <section className="ct-model-history"><h3>История выплат и бонусов</h3>{[
        ...selected.bonuses.map(record => ({record,label:'Бонус',positive:true,remove:()=>removeBonus(record.id)})),
        ...selected.advances.map(record => ({record,label:'Аванс',positive:false,remove:()=>removeOperation(record.id)})),
        ...selected.salaryPayments.map(record => ({record,label:'Выплата ЗП',positive:false,remove:()=>removeOperation(record.id)})),
      ].sort((a,b)=>b.record.date.localeCompare(a.record.date)||b.record.createdAt.localeCompare(a.record.createdAt)).map(({record,label,positive,remove}) => <div key={`${label}:${record.id}`} className="ct-model-history-row"><span><b>{label}</b><small>{record.date.split('-').reverse().join('.')} · {record.comment || 'Без комментария'}</small></span><strong className={positive ? 'is-positive' : ''}>{positive ? '+' : '−'}{money(record.amount)}</strong><button disabled={locked} aria-label={`Удалить ${label.toLocaleLowerCase()} ${record.id}`} title="Удалить запись" onClick={remove}><ICONS.Trash size={15} /></button></div>)}{!selected.bonuses.length && !selected.advances.length && !selected.salaryPayments.length && <p>Бонусов и выплат пока нет.</p>}</section>
      {locked && <p className="ct-model-note">Период закрыт. Изменения недоступны.</p>}
      <footer><button className="ct-button" onClick={() => setSelectedModel(null)}>Закрыть</button><button className="ct-button ct-button-primary" disabled={locked} onClick={() => toggleModelPaid(selected.model, selected.totalEarn)}>{selected.isPaid ? 'Снять отметку выплаты' : `Выплатить ${money(Math.max(0,selected.totalEarn))}`}</button></footer>
    </ModelDialog>}

    {showManageGroups && <ModelDialog title="Связки анкет" close={closeGroups} wide>
      <p className="ct-model-dialog-subtitle">Объединяйте анкеты одной модели для просмотра общего расчёта.</p>
      <div className="ct-model-group-manager"><section><h3>Текущие связки</h3>{!(state.modelGroups || []).length && <p className="ct-muted">Связок пока нет.</p>}{(state.modelGroups || []).map(group => <div key={group.id} className="ct-model-group-item"><div><strong>{group.name}</strong><small>{group.members.join(' · ')}</small></div><button aria-label={`Редактировать связку ${group.name}`} onClick={() => {setEditingGroupId(group.id);setNewGroupName(group.name);setSelectedGroupMembers(group.members);}}><ICONS.Edit size={15} /></button><button aria-label={`Удалить связку ${group.name}`} onClick={() => handleDeleteGroup(group.id)}><ICONS.Trash size={15} /></button></div>)}</section>
      <form onSubmit={e => { e.preventDefault(); handleSaveGroup(newGroupName, selectedGroupMembers, editingGroupId); }}><h3>{editingGroupId ? 'Редактирование связки' : 'Новая связка'}</h3><label className="ct-model-group-name">Название связки<input required value={newGroupName} onChange={e => setNewGroupName(e.target.value)} placeholder="Имя модели" /></label><fieldset><legend>Анкеты · выбрано {selectedGroupMembers.length}</legend><div className="ct-model-member-list">{allAvailableModels.map(name => {const otherGroup=(state.modelGroups||[]).find(group => group.id!==editingGroupId && group.members.includes(name));return <label key={name}><input type="checkbox" aria-label={name} disabled={!!otherGroup} checked={selectedGroupMembers.includes(name)} onChange={e => setSelectedGroupMembers(p => e.target.checked ? [...p,name] : p.filter(item=>item!==name))} /><span>{name}{otherGroup && <small>В связке {otherGroup.name}</small>}</span></label>;})}</div></fieldset><div className="ct-actions"><button type="button" className="ct-button" onClick={resetGroupForm}>Новая связка</button><button type="submit" disabled={!newGroupName.trim() || !selectedGroupMembers.length} className="ct-button ct-button-primary">{editingGroupId ? 'Сохранить связку' : 'Связать анкеты'}</button></div></form></div>
      <footer><button className="ct-button" onClick={closeGroups}>Готово</button></footer>
    </ModelDialog>}
  </div>;
};

function ModelDialog({title, close, children, wide = false}: {title:string;close:()=>void;children:React.ReactNode;wide?:boolean}) {
  const ref=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const dialog=ref.current!,previous=document.activeElement as HTMLElement|null;dialog.showModal();return()=>{dialog.close();previous?.focus();};},[]);
  return createPortal(<dialog ref={ref} className={`ct-model-dialog${wide ? ' is-wide' : ''}`} aria-labelledby="model-dialog-title" onCancel={close}><header><h2 id="model-dialog-title">{title}</h2><button aria-label="Закрыть окно" onClick={close}><ICONS.Close size={20} /></button></header>{children}</dialog>,document.body);
}

export default Models;
