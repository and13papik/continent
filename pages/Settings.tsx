
import React, { useState, useEffect, useMemo } from 'react';
import { AppState, CloudSnapshot, AccountingPeriod } from '../types';
import { ICONS } from '../constants';
import { fetchFromCloud, testDatabaseConnection, listCloudSnapshots, createEmergencyBackup, restoreEmergencyBackup, reindexAllDataByDate, forcePushToCloud } from '../store';
import PeriodBadge from '../components/PeriodBadge';
import { runMigrationDryRun, MigrationDryRunResult } from '../scripts/dry_run_migration';

interface SettingsProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
  userRole?: 'user' | 'owner' | null;
}

const Settings: React.FC<SettingsProps> = ({ state, updateState, userRole }) => {
  const [newOp, setNewOp] = useState('');
  const [newModel, setNewModel] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminRate, setNewAdminRate] = useState('8');
  
  const [editOp, setEditOp] = useState<{ old: string; current: string } | null>(null);
  const [editModel, setEditModel] = useState<{ old: string; current: string } | null>(null);
  const [editPeriod, setEditPeriod] = useState<{ id: string; label: string } | null>(null);

  const activePeriodId = state.selectedPeriodId;
  const activePeriod = state.accountingPeriods.find(p => p.id === activePeriodId);
  const currentOperators = (activePeriod?.operators && activePeriod.operators.length > 0) ? activePeriod.operators : state.operators;
  const currentModels = (activePeriod?.models && activePeriod.models.length > 0) ? activePeriod.models : state.models;
  const currentAdmins = activePeriod?.admins || state.admins;
  const currentGoals = activePeriod?.modelDefaultGoals || state.modelDefaultGoals || {};
  const currentPlans = activePeriod?.modelMonthlyPlans || state.modelMonthlyPlans || {};

  const handleAddAdmin = () => {
    if (!newAdminName) return;
    const rate = parseFloat(newAdminRate) || 0;
    updateState(p => ({
      ...p,
      accountingPeriods: p.accountingPeriods.map(ap => ap.id === p.selectedPeriodId ? { 
        ...ap, 
        admins: [...(ap.admins || p.admins), { id: String(Date.now()), name: newAdminName, rate }],
        updatedAt: new Date().toISOString()
      } : ap)
    }));
    setNewAdminName('');
    setNewAdminRate('8');
  };

  const [syncUrlInput, setSyncUrlInput] = useState(state.syncUrl || '');
  const [syncKeyInput, setSyncKeyInput] = useState(state.syncKey || '');
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  const [snapshots, setSnapshots] = useState<CloudSnapshot[]>([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);
  const [dryRunResult, setDryRunResult] = useState<MigrationDryRunResult | null>(null);
  const [bundleResult, setBundleResult] = useState<{
    success: boolean;
    targetSqlFile: string;
    fileSizeKb: string;
    lineCount: number;
    fingerprint: {
      snapshotUpdatedAt: string;
      sourceRecordCount: number;
      deterministicHash: string;
    };
    targetRowCounts: Record<string, number>;
    sqlContent?: string;
  } | null>(null);
  const [isGeneratingBundle, setIsGeneratingBundle] = useState(false);
  const [bundleError, setBundleError] = useState<string | null>(null);

  const handleRunDryRun = () => {
    const res = runMigrationDryRun(state);
    setDryRunResult(res);
  };

  const handleGenerateProductionBundle = async () => {
    setIsGeneratingBundle(true);
    setBundleError(null);
    try {
      // Pass sync credentials so the server fetches app_storage.main directly from Supabase.
      // If no credentials, fallback to sending state.
      const payloadBody = (state.syncUrl && state.syncKey)
        ? {
            syncUrl: state.syncUrl,
            syncKey: state.syncKey
          }
        : {
            state,
            updatedAt: new Date().toISOString()
          };

      const response = await fetch('/api/admin/generate-bundle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadBody)
      });

      const contentType = response.headers.get('content-type') || '';
      let result: any = null;
      if (contentType.includes('application/json')) {
        result = await response.json();
      } else {
        const rawText = await response.text();
        throw new Error(rawText || `Сервер вернул ошибку с HTTP статусом ${response.status}`);
      }

      if (!response.ok || !result.success) {
        let msg = result.error || 'Ошибка при формировании бандла миграции';
        if (result.reconciliation?.financialDiscrepancies?.length > 0) {
          const details = result.reconciliation.financialDiscrepancies
            .map((d: any) => `${d.periodName}: net_diff=$${d.netProfitDiff.toFixed(2)}, staff_diff=$${d.staffPoolDiff.toFixed(2)}`)
            .join('; ');
          msg += ` [Расхождения: ${details}]`;
        }
        throw new Error(msg);
      }

      setBundleResult(result);
    } catch (err: any) {
      console.error('Bundle Generation Error:', err);
      setBundleError(err.message || 'Ошибка генерации бандла миграции');
    } finally {
      setIsGeneratingBundle(false);
    }
  };

  const handleDownloadBundleDirectly = () => {
    if (bundleResult?.sqlContent) {
      const blob = new Blob([bundleResult.sqlContent], { type: 'text/sql;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'production_migration_bundle.sql';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      window.location.href = '/api/admin/download-bundle';
    }
  };

  // Инструмент починки данных
  const homelessCount = useMemo(() => {
    const periodIds = new Set(state.accountingPeriods.map(p => p.id));
    const badIncomes = state.incomeData.filter(i => !periodIds.has(i.periodId)).length;
    const badOps = state.operationsData.filter(o => !periodIds.has(o.periodId)).length;
    return badIncomes + badOps;
  }, [state.incomeData, state.operationsData, state.accountingPeriods]);

  const repairData = () => {
    if (!confirm('Это перераспределит все записи (доходы, операции, задачи) по правильным месяцам на основе их даты. Продолжить?')) return;
    updateState(prev => reindexAllDataByDate(prev));
    alert('Данные перераспределены!');
  };

  const loadSnapshots = async () => {
    if (!state.syncUrl || !state.syncKey) return;
    setIsLoadingSnapshots(true);
    const list = await listCloudSnapshots(state.syncUrl, state.syncKey);
    setSnapshots(list);
    setIsLoadingSnapshots(false);
  };

  useEffect(() => {
    loadSnapshots();
  }, [state.syncUrl, state.syncKey]);

  const handleUpdateDefaultGoal = (modelName: string, shift: 'night' | 'morning' | 'day' | 'evening', value: string) => {
    const val = parseFloat(value) || 0;
    updateState(prev => ({
      ...prev,
      accountingPeriods: prev.accountingPeriods.map(p => p.id === activePeriodId ? {
        ...p,
        updatedAt: new Date().toISOString(),
        modelDefaultGoals: {
          ...(p.modelDefaultGoals || prev.modelDefaultGoals || {}),
          [modelName]: {
            ...(p.modelDefaultGoals?.[modelName] || prev.modelDefaultGoals?.[modelName] || { night: 60, morning: 60, day: 60, evening: 60 }),
            [shift]: val
          }
        }
      } : p)
    }));
  };

  const exportData = () => {
    const dataStr = JSON.stringify(state, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', `backup_${new Date().toISOString().split('T')[0]}.json`);
    linkElement.click();
  };

  const importData = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (confirm('Это заменит все текущие данные. Продолжить?')) {
          updateState(() => json);
        }
      } catch (err) {
        alert('Ошибка файла.');
      }
    };
    reader.readAsText(file);
  };

  const handleWipeData = () => {
    if (!confirm('ВНИМАНИЕ! Это удалит ВСЕ доходы, операции, авансы и бонусы за все время. Имена операторов и моделей останутся. Продолжить?')) return;
    if (!confirm('ПОСЛЕДНЕЕ ПРЕДУПРЕЖДЕНИЕ: Все финансовые данные будут обнулены. Это необратимо.')) return;
    
    createEmergencyBackup(state); 

    const allIds = [
      ...state.incomeData.map(i => i.id),
      ...state.operationsData.map(o => o.id),
      ...state.ownerExpenses.map(e => e.id),
      ...(state.ownerManualIncomes || []).map(i => i.id),
      ...state.ownerAdvances.map(a => a.id),
      ...(state.modelBonuses || []).map(b => b.id),
      ...state.paidStatuses.map(s => s.id),
      ...(state.ownerTasks || []).map(t => t.id),
      ...(state.totalTableEntries || []).map(e => e.id)
    ];

    updateState(prev => ({
      ...prev,
      incomeData: [],
      operationsData: [],
      ownerExpenses: [],
      ownerManualIncomes: [],
      ownerAdvances: [],
      modelBonuses: [],
      paidStatuses: [],
      ownerTasks: [],
      totalTableEntries: [],
      deletedIds: Array.from(new Set([...(prev.deletedIds || []), ...allIds])),
      lastUpdated: Date.now(),
      version: prev.version + 1
    }));
    
    alert('Все финансовые данные успешно удалены. Операторы и модели сохранены.');
  };

  const handleApplySettings = () => {
    updateState(p => ({ ...p, syncUrl: syncUrlInput, syncKey: syncKeyInput }));
    alert('Настройки сохранены локально.');
  };

  const forcePull = async () => {
     if (!syncUrlInput || !syncKeyInput) return alert('Сначала введите URL и Ключ');
     if (!confirm('Внимание: это ЗАМЕНИТ ваши текущие данные данными из облака (main). Продолжить?')) return;
     
     setIsManualSyncing(true);
     createEmergencyBackup(state); 
     
     const remote = await fetchFromCloud(syncUrlInput, syncKeyInput);
     if (remote && remote.accountingPeriods) {
        updateState(() => ({ ...remote, syncUrl: syncUrlInput, syncKey: syncKeyInput }));
        alert('Данные успешно загружены!');
     } else {
        alert('Данные не найдены.');
     }
     setIsManualSyncing(false);
  };

  const forcePush = async () => {
    if (!syncUrlInput || !syncKeyInput) return alert('Сначала введите URL и Ключ');
    if (!confirm('ВНИМАНИЕ: Это ЗАМЕНИТ данные в облаке вашими текущими локальными данными. Это действие нельзя отменить. Продолжить?')) return;
    
    setIsManualSyncing(true);
    const success = await forcePushToCloud(state);
    if (success) {
      alert('Данные успешно отправлены в облако и заменили старые!');
    } else {
      alert('Ошибка при отправке данных.');
    }
    setIsManualSyncing(false);
  };

  const restoreFromSnapshot = (snap: CloudSnapshot) => {
    const dateStr = new Date(snap.updated_at).toLocaleString();
    if (!confirm(`Вы действительно хотите откатить ВСЮ систему к состоянию на ${dateStr}? Текущие данные будут стерты.`)) return;
    
    createEmergencyBackup(state); 
    updateState(() => ({
      ...snap.state,
      syncUrl: state.syncUrl,
      syncKey: state.syncKey
    }));
    alert('Система успешно восстановлена из снапшота!');
  };

  const saveRenameOperator = () => {
    if (!editOp || !editOp.current.trim() || editOp.old === editOp.current) {
      setEditOp(null);
      return;
    }
    updateState(prev => {
      const activeP = prev.accountingPeriods.find(p => p.id === prev.selectedPeriodId);
      const updatedPeriods = prev.accountingPeriods.map(p => {
        if (p.id === prev.selectedPeriodId) {
          const ops = p.operators || prev.operators;
          return { ...p, operators: ops.map(o => o === editOp.old ? editOp.current : o), updatedAt: new Date().toISOString() };
        }
        return p;
      });

      return {
        ...prev,
        accountingPeriods: updatedPeriods,
        incomeData: prev.incomeData.map(r => (r.operator === editOp.old && r.periodId === prev.selectedPeriodId) ? { ...r, operator: editOp.current } : r),
        operationsData: prev.operationsData.map(o => (o.operator === editOp.old && o.periodId === prev.selectedPeriodId) ? { ...o, operator: editOp.current } : o)
      };
    });
    setEditOp(null);
  };

  const saveRenameModel = () => {
    if (!editModel || !editModel.current.trim() || editModel.old === editModel.current) {
      setEditModel(null);
      return;
    }
    updateState(prev => {
      const updatedPeriods = prev.accountingPeriods.map(p => {
        if (p.id === prev.selectedPeriodId) {
          const mods = p.models || prev.models;
          return { ...p, models: mods.map(m => m === editModel.old ? editModel.current : m), updatedAt: new Date().toISOString() };
        }
        return p;
      });

      return {
        ...prev,
        accountingPeriods: updatedPeriods,
        incomeData: prev.incomeData.map(r => (r.model === editModel.old && r.periodId === prev.selectedPeriodId) ? { ...r, model: editModel.current } : r),
        modelBonuses: (prev.modelBonuses || []).map(b => (b.model === editModel.old && b.periodId === prev.selectedPeriodId) ? { ...b, model: editModel.current } : b)
      };
    });
    setEditModel(null);
  };

  const saveRenamePeriod = () => {
    if (!editPeriod || !editPeriod.label.trim()) {
      setEditPeriod(null);
      return;
    }
    updateState(prev => ({
      ...prev,
      accountingPeriods: prev.accountingPeriods.map(p => p.id === editPeriod.id ? { ...p, label: editPeriod.label, updatedAt: new Date().toISOString() } : p)
    }));
    setEditPeriod(null);
  };

  const deletePeriod = (id: string) => {
    const period = state.accountingPeriods.find(p => p.id === id);
    if (!period) return;

    const hasData = state.incomeData.some(i => i.periodId === id) || 
                    state.operationsData.some(o => o.periodId === id) ||
                    (state.totalTableEntries || []).some(e => e.periodId === id);

    if (hasData) {
      if (!confirm(`В периоде "${period.label}" есть данные! Если вы удалите период, эти данные станут "бездомными". Продолжить?`)) return;
    } else {
      if (!confirm(`Удалить пустой период "${period.label}"?`)) return;
    }

    updateState(prev => ({
      ...prev,
      accountingPeriods: prev.accountingPeriods.filter(p => p.id !== id),
      deletedIds: Array.from(new Set([...(prev.deletedIds || []), id])),
      selectedPeriodId: prev.selectedPeriodId === id ? (prev.accountingPeriods[0]?.id || '') : prev.selectedPeriodId,
      lastUpdated: Date.now(),
      version: prev.version + 1
    }));
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-outfit text-white">Настройки</h1>
          <div className="flex items-center gap-3 mt-1">
             <PeriodBadge state={state} />
             <p className="text-slate-400">Конфигурация системы и защита данных</p>
          </div>
        </div>
        <div className="flex gap-2">
          {userRole === 'owner' && (
            <button onClick={() => { const b = restoreEmergencyBackup(); if(b) updateState(() => b); }} className="bg-rose-600/20 text-rose-400 border border-rose-500/30 px-4 py-2 rounded-xl text-xs font-bold hover:bg-rose-600/30 transition-all">Черный ящик</button>
          )}
          <label className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all">
            Импорт
            <input type="file" className="hidden" accept=".json" onChange={importData} />
          </label>
          <button onClick={exportData} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all">Экспорт</button>
        </div>
      </header>

      {homelessCount > 0 && (
         <div className="bg-amber-600/10 border border-amber-500/40 p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
            <div className="flex items-center gap-5">
               <div className="w-16 h-16 rounded-3xl bg-amber-500/20 flex items-center justify-center text-amber-500">
                  <ICONS.AlertTriangle size={32} />
               </div>
               <div>
                  <h3 className="text-xl font-bold text-white font-outfit">Инструмент восстановления</h3>
                  <p className="text-sm text-slate-400 mt-1">Обнаружено {homelessCount} записей без периода. Нажмите для восстановления структуры.</p>
               </div>
            </div>
            <button onClick={repairData} className="bg-amber-600 hover:bg-amber-500 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95">Восстановить</button>
         </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-1 glass-card p-8 rounded-[32px] border-indigo-500/20 shadow-2xl space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ICONS.Dashboard size={20} className="text-indigo-400" /> Supabase Config
          </h2>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Project URL</label>
              <input className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-5 py-3 text-sm text-white outline-none focus:border-indigo-500 transition-all" value={syncUrlInput} onChange={e => setSyncUrlInput(e.target.value)} placeholder="https://xxxx.supabase.co" />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Anon Key</label>
              <input type="password" className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-5 py-3 text-sm text-white outline-none focus:border-indigo-500 transition-all" value={syncKeyInput} onChange={e => setSyncKeyInput(e.target.value)} placeholder="eyJhb..." />
            </div>
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <button onClick={handleApplySettings} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-600/20 transition-all active:scale-95">Применить</button>
            <button onClick={forcePull} disabled={isManualSyncing} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50">Загрузить "main"</button>
            {userRole === 'owner' && (
              <button onClick={handleWipeData} className="w-full bg-rose-600/20 hover:bg-rose-600/40 text-rose-500 border border-rose-500/30 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Сбросить доходы</button>
            )}
          </div>
        </div>

        {userRole === 'owner' && (
          <div className="xl:col-span-2 glass-card p-8 rounded-[32px] border-slate-800 shadow-2xl space-y-6">
             <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <ICONS.Calendar size={20} className="text-emerald-400" /> Облачные снапшоты (Бекапы)
                </h2>
                <button onClick={loadSnapshots} className="text-indigo-400 hover:text-white transition-all"><ICONS.RotateCcw size={18} className={isLoadingSnapshots ? 'animate-spin' : ''}/></button>
             </div>

             <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                {snapshots.length === 0 && !isLoadingSnapshots ? (
                  <div className="p-10 text-center border-2 border-dashed border-slate-800 rounded-3xl text-slate-600">
                    История изменений пуста или облако не подключено
                  </div>
                ) : (
                  snapshots.map(snap => (
                    <div key={snap.id} className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800 flex items-center justify-between group hover:border-indigo-500/30 transition-all">
                      <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-xl bg-slate-950 flex items-center justify-center text-emerald-500 font-bold border border-slate-800">
                           {snap.state.version || '?'}
                         </div>
                         <div>
                            <p className="text-sm font-bold text-white">{new Date(snap.updated_at).toLocaleString()}</p>
                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">
                              {snap.state.incomeData.length} записей дохода • {snap.state.operationsData.length} операций
                            </p>
                         </div>
                      </div>
                      <button 
                        onClick={() => restoreFromSnapshot(snap)}
                        className="opacity-0 group-hover:opacity-100 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all"
                      >
                        Восстановить
                      </button>
                    </div>
                  ))
                )}
             </div>
          </div>
        )}

        {userRole === 'owner' && (
          <div className="xl:col-span-3 glass-card p-8 rounded-[32px] border-slate-800 shadow-2xl space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <ICONS.Database size={20} className="text-indigo-400" /> Dry-Run Migration Audit (Phase 2 Read-Only)
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  100% безопасная проверка текущего состояния CRM без внесения изменений в базу данных.
                </p>
              </div>
              <button 
                onClick={handleRunDryRun} 
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-2xl font-bold text-xs shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-2"
              >
                <ICONS.Activity size={16} /> Запустить Dry-Run Аудит
              </button>
            </div>

            {dryRunResult && (
              <div className="space-y-6 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-900/60 border border-slate-800">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                      dryRunResult.isPassed ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                    }`}>
                      {dryRunResult.isPassed ? 'DRY RUN RESULT: PASS' : 'DRY RUN RESULT: FAIL'}
                    </span>
                    <span className="text-xs text-slate-400">
                      Всего записей дохода и операций: {dryRunResult.sourceCounts.incomeData + dryRunResult.sourceCounts.operationsData}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-slate-400">
                    Ошибок / Конфликтов: {dryRunResult.issues.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Source Counts */}
                  <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <ICONS.FileText size={14} className="text-indigo-400" /> Исходные записи (Source: app_storage.main)
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">accountingPeriods:</span>
                        <span className="font-bold text-white">{dryRunResult.sourceCounts.accountingPeriods}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">operators:</span>
                        <span className="font-bold text-white">{dryRunResult.sourceCounts.operators}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">models:</span>
                        <span className="font-bold text-white">{dryRunResult.sourceCounts.models}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">admins:</span>
                        <span className="font-bold text-white">{dryRunResult.sourceCounts.admins}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">incomeData:</span>
                        <span className="font-bold text-emerald-400">{dryRunResult.sourceCounts.incomeData}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">operationsData:</span>
                        <span className="font-bold text-indigo-400">{dryRunResult.sourceCounts.operationsData}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">ownerExpenses:</span>
                        <span className="font-bold text-white">{dryRunResult.sourceCounts.ownerExpenses}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">ownerManualIncomes:</span>
                        <span className="font-bold text-white">{dryRunResult.sourceCounts.ownerManualIncomes}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">ownerAdvances:</span>
                        <span className="font-bold text-white">{dryRunResult.sourceCounts.ownerAdvances}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">modelBonuses:</span>
                        <span className="font-bold text-white">{dryRunResult.sourceCounts.modelBonuses}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">paidStatuses:</span>
                        <span className="font-bold text-white">{dryRunResult.sourceCounts.paidStatuses}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">modelMonthlyPlans:</span>
                        <span className="font-bold text-white">{dryRunResult.sourceCounts.modelMonthlyPlans}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">totalTableEntries:</span>
                        <span className="font-bold text-white">{dryRunResult.sourceCounts.totalTableEntries}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">rosterData:</span>
                        <span className="font-bold text-white">{dryRunResult.sourceCounts.rosterData}</span>
                      </div>
                    </div>
                  </div>

                  {/* Target Relational Row Counts */}
                  <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                      <ICONS.Layers size={14} className="text-emerald-400" /> Целевые таблицы (Target Relational Schema)
                    </h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">accounting_periods rows:</span>
                        <span className="font-bold text-white">{dryRunResult.targetRowCounts.accounting_periods}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">operators rows:</span>
                        <span className="font-bold text-white">{dryRunResult.targetRowCounts.operators}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">models rows:</span>
                        <span className="font-bold text-white">{dryRunResult.targetRowCounts.models}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">admins rows:</span>
                        <span className="font-bold text-white">{dryRunResult.targetRowCounts.admins}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">owner_period_shares rows:</span>
                        <span className="font-bold text-white">{dryRunResult.targetRowCounts.owner_period_shares}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">model_period_rates rows:</span>
                        <span className="font-bold text-white">{dryRunResult.targetRowCounts.model_period_rates}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">admin_period_rates rows:</span>
                        <span className="font-bold text-white">{dryRunResult.targetRowCounts.admin_period_rates}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">income_records rows:</span>
                        <span className="font-bold text-emerald-400">{dryRunResult.targetRowCounts.income_records}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">financial_operations rows:</span>
                        <span className="font-bold text-indigo-400">{dryRunResult.targetRowCounts.financial_operations}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">agency_transactions rows:</span>
                        <span className="font-bold text-white">{dryRunResult.targetRowCounts.agency_transactions}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">owner_draws rows:</span>
                        <span className="font-bold text-white">{dryRunResult.targetRowCounts.owner_draws}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">model_period_bonuses rows:</span>
                        <span className="font-bold text-white">{dryRunResult.targetRowCounts.model_period_bonuses}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">payout_settlement_flags:</span>
                        <span className="font-bold text-white">{dryRunResult.targetRowCounts.payout_settlement_flags}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">model_monthly_plans rows:</span>
                        <span className="font-bold text-white">{dryRunResult.targetRowCounts.model_monthly_plans}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">shift_balance_entries rows:</span>
                        <span className="font-bold text-white">{dryRunResult.targetRowCounts.shift_balance_entries}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">roster_shifts rows:</span>
                        <span className="font-bold text-white">{dryRunResult.targetRowCounts.roster_shifts}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-slate-800/60">
                        <span className="text-slate-400">roster_shift_models rows:</span>
                        <span className="font-bold text-white">{dryRunResult.targetRowCounts.roster_shift_models}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Diagnostics Breakdown */}
                <div className="p-5 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-3">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <ICONS.CheckCircle size={14} className="text-emerald-400" /> Диагностика целостности и ограничений
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">orphan records count:</span>
                      <span className={`font-bold ${dryRunResult.diagnostics.orphanRecordsCount === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {dryRunResult.diagnostics.orphanRecordsCount}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">unresolved operator references:</span>
                      <span className={`font-bold ${dryRunResult.diagnostics.unresolvedOperatorRefs === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {dryRunResult.diagnostics.unresolvedOperatorRefs}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">unresolved model references:</span>
                      <span className={`font-bold ${dryRunResult.diagnostics.unresolvedModelRefs === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {dryRunResult.diagnostics.unresolvedModelRefs}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">unresolved admin references:</span>
                      <span className={`font-bold ${dryRunResult.diagnostics.unresolvedAdminRefs === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {dryRunResult.diagnostics.unresolvedAdminRefs}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">unresolved owner references:</span>
                      <span className={`font-bold ${dryRunResult.diagnostics.unresolvedOwnerRefs === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {dryRunResult.diagnostics.unresolvedOwnerRefs}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">invalid/missing period_id:</span>
                      <span className={`font-bold ${dryRunResult.diagnostics.invalidOrMissingPeriodId === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {dryRunResult.diagnostics.invalidOrMissingPeriodId}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">UNIQUE constraint conflicts:</span>
                      <span className={`font-bold ${dryRunResult.diagnostics.uniqueConstraintConflicts === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {dryRunResult.diagnostics.uniqueConstraintConflicts}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">duplicate business keys:</span>
                      <span className={`font-bold ${dryRunResult.diagnostics.duplicateBusinessKeys === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {dryRunResult.diagnostics.duplicateBusinessKeys}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">invalid monetary values:</span>
                      <span className={`font-bold ${dryRunResult.diagnostics.invalidMonetaryValues === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {dryRunResult.diagnostics.invalidMonetaryValues}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/60">
                      <span className="text-slate-400">unrepresentable records:</span>
                      <span className={`font-bold ${dryRunResult.diagnostics.unrepresentableRecords === 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {dryRunResult.diagnostics.unrepresentableRecords}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Issues List if any */}
                {dryRunResult.issues.length > 0 && (
                  <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl space-y-2">
                    <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider">Список обнаруженных проблем ({dryRunResult.issues.length}):</h4>
                    <ul className="text-xs text-rose-300/80 space-y-1 max-h-40 overflow-y-auto pl-4 list-disc">
                      {dryRunResult.issues.map((iss, idx) => (
                        <li key={idx}>{iss}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* Production SQL Bundle Generator Section */}
            <div className="pt-6 border-t border-slate-800/80 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <ICONS.Download size={16} className="text-emerald-400" /> Генератор Production Migration Bundle (.sql)
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Формирует атомарный SQL-бандл с PostgreSQL-side JSONB hash guard, row-level FOR UPDATE lock (15s) и 10min timeout.
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleGenerateProductionBundle}
                    disabled={isGeneratingBundle}
                    className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white px-5 py-2.5 rounded-2xl font-bold text-xs shadow-lg shadow-emerald-600/20 transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap"
                  >
                    {isGeneratingBundle ? (
                      <>
                        <ICONS.RefreshCw size={14} className="animate-spin" /> Генерация...
                      </>
                    ) : (
                      <>
                        <ICONS.FileText size={14} /> Сгенерировать Bundle
                      </>
                    )}
                  </button>

                  {bundleResult && (
                    <button
                      onClick={handleDownloadBundleDirectly}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-2xl font-bold text-xs shadow-lg shadow-indigo-600/20 transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap"
                    >
                      <ICONS.Download size={14} /> Скачать .SQL ({bundleResult.fileSizeKb} KB)
                    </button>
                  )}
                </div>
              </div>

              {bundleError && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-300">
                  {bundleError}
                </div>
              )}

              {bundleResult && (
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-emerald-500/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                      <ICONS.CheckCircle size={14} /> Bundle готов: {bundleResult.targetSqlFile}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {bundleResult.lineCount} строк • {bundleResult.fileSizeKb} KB
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                    <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1">
                      <div className="text-slate-500 text-[10px] uppercase tracking-wider">Source Fingerprint</div>
                      <div className="text-slate-300">Updated At: <span className="text-white font-bold">{bundleResult.fingerprint.snapshotUpdatedAt}</span></div>
                      <div className="text-slate-300">Source Count: <span className="text-white font-bold">{bundleResult.fingerprint.sourceRecordCount}</span></div>
                      <div className="text-slate-400 truncate text-[10px]">Hash: {bundleResult.fingerprint.deterministicHash}</div>
                    </div>

                    <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-1">
                      <div className="text-slate-500 text-[10px] uppercase tracking-wider">Target Rows (18 tables)</div>
                      <div className="grid grid-cols-2 gap-x-2 text-[11px]">
                        <span className="text-slate-400">income_records: <strong className="text-emerald-400">{bundleResult.targetRowCounts.income_records}</strong></span>
                        <span className="text-slate-400">financial_ops: <strong className="text-emerald-400">{bundleResult.targetRowCounts.financial_operations}</strong></span>
                        <span className="text-slate-400">model_rates: <strong className="text-emerald-400">{bundleResult.targetRowCounts.model_period_rates}</strong></span>
                        <span className="text-slate-400">roster_shifts: <strong className="text-emerald-400">{bundleResult.targetRowCounts.roster_shifts}</strong></span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {userRole === 'owner' && (
          <div className="glass-card p-6 rounded-[24px] border-slate-800 space-y-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ICONS.Calendar size={18} className="text-indigo-400" /> Управление периодами
            </h2>
            <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl space-y-3">
               <p className="text-[10px] text-slate-400 leading-relaxed">
                 Если данные отображаются не в тех месяцах, используйте этот инструмент для автоматического перераспределения всех записей по датам.
               </p>
               <button onClick={repairData} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all">
                 Перераспределить данные
               </button>
               <button 
                  onClick={forcePush} 
                  disabled={isManualSyncing}
                  className="w-full bg-rose-600/20 hover:bg-rose-600 text-rose-500 hover:text-white py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all border border-rose-500/30"
                >
                  {isManualSyncing ? 'Синхронизация...' : 'Force Push (Заменить облако)'}
                </button>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
               {state.accountingPeriods.slice().reverse().map(p => (
                 <div key={p.id} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg group">
                   {editPeriod?.id === p.id ? (
                     <div className="flex-1 flex gap-2">
                       <input autoFocus className="flex-1 bg-slate-950 border border-indigo-500 rounded px-2 py-1 text-sm text-white outline-none" value={editPeriod.label} onChange={e => setEditPeriod({ ...editPeriod, label: e.target.value })} onKeyDown={e => e.key === 'Enter' && saveRenamePeriod()}/>
                       <button onClick={saveRenamePeriod} className="text-emerald-400"><ICONS.Lock size={16}/></button>
                     </div>
                   ) : (
                     <>
                       <div className="flex flex-col">
                          <span className="text-sm font-bold text-slate-200">{p.label}</span>
                          <span className="text-[8px] text-slate-500 uppercase font-black">{p.status === 'closed' ? 'Закрыт 🔒' : 'Открыт 🟢'}</span>
                       </div>
                       <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => setEditPeriod({ id: p.id, label: p.label })} className="text-slate-500 hover:text-indigo-400"><ICONS.Edit size={14}/></button>
                          <button onClick={() => deletePeriod(p.id)} className="text-slate-500 hover:text-rose-500"><ICONS.Trash size={14}/></button>
                       </div>
                     </>
                   )}
                 </div>
               ))}
            </div>
            <p className="text-[9px] text-slate-500 italic">Здесь вы можете переименовать "Восстановленные" периоды в нормальные названия месяцев.</p>
          </div>
        )}

        <div className="glass-card p-6 rounded-[24px] border-slate-800 space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ICONS.Reports size={18} className="text-sky-400" /> Штат операторов ({activePeriod?.label})
          </h2>
          <div className="flex gap-2">
             <input className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="Имя..." value={newOp} onChange={e => setNewOp(e.target.value)}/>
             <button onClick={() => { 
               if(newOp) { 
                 updateState(p => {
                    const activeP = p.accountingPeriods.find(ap => ap.id === p.selectedPeriodId);
                    const currentOps = activeP?.operators || p.operators;
                    if (currentOps.includes(newOp)) return p;
                    
                    let newGlobalOps = p.operators;
                    if (!newGlobalOps.includes(newOp)) {
                       newGlobalOps = [...newGlobalOps, newOp];
                    }

                    return {
                      ...p,
                      operators: newGlobalOps,
                      accountingPeriods: p.accountingPeriods.map(ap => ap.id === p.selectedPeriodId ? { ...ap, operators: [...currentOps, newOp], updatedAt: new Date().toISOString() } : ap)
                    };
                 }); 
                 setNewOp(''); 
               } 
             }} className="bg-sky-600 px-3 rounded-lg"><ICONS.Plus size={18}/></button>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
             {currentOperators.map(o => (
               <div key={o} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg group">
                 {editOp?.old === o ? (
                   <div className="flex-1 flex gap-2">
                     <input autoFocus className="flex-1 bg-slate-950 border border-sky-500 rounded px-2 py-1 text-sm text-white outline-none" value={editOp.current} onChange={e => setEditOp({ ...editOp, current: e.target.value })} onKeyDown={e => e.key === 'Enter' && saveRenameOperator()}/>
                     <button onClick={saveRenameOperator} className="text-emerald-400"><ICONS.Lock size={16}/></button>
                   </div>
                 ) : (
                   <>
                     <span className="text-sm font-bold text-slate-200">{o}</span>
                     <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditOp({ old: o, current: o })} className="text-slate-500 hover:text-sky-400"><ICONS.Edit size={14}/></button>
                        <button onClick={() => updateState(p => ({
                          ...p, 
                          accountingPeriods: p.accountingPeriods.map(ap => ap.id === p.selectedPeriodId ? { ...ap, operators: (ap.operators || p.operators).filter(x => x !== o), updatedAt: new Date().toISOString() } : ap)
                        }))} className="text-slate-500 hover:text-rose-500"><ICONS.Trash size={14}/></button>
                     </div>
                   </>
                 )}
               </div>
             ))}
          </div>
        </div>

        <div className="glass-card p-6 rounded-[24px] border-slate-800 space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ICONS.Models size={18} className="text-indigo-400" /> Модели ({activePeriod?.label})
          </h2>
          <div className="flex gap-2">
             <input className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="Название..." value={newModel} onChange={e => setNewModel(e.target.value)}/>
             <button onClick={() => { 
               if(newModel) { 
                 updateState(p => {
                    const activeP = p.accountingPeriods.find(ap => ap.id === p.selectedPeriodId);
                    const currentMods = activeP?.models || p.models;
                    if (currentMods.includes(newModel)) return p;

                    let newGlobalModels = p.models;
                    if (!newGlobalModels.includes(newModel)) {
                       newGlobalModels = [...newGlobalModels, newModel];
                    }

                    return {
                      ...p,
                      models: newGlobalModels,
                      accountingPeriods: p.accountingPeriods.map(ap => ap.id === p.selectedPeriodId ? { ...ap, models: [...currentMods, newModel], updatedAt: new Date().toISOString() } : ap)
                    };
                 }); 
                 setNewModel(''); 
               } 
             }} className="bg-indigo-600 px-3 rounded-lg"><ICONS.Plus size={18}/></button>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
             {currentModels.map(m => (
               <div key={m} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg group">
                 {editModel?.old === m ? (
                    <div className="flex-1 flex gap-2">
                      <input autoFocus className="flex-1 bg-slate-950 border border-indigo-500 rounded px-2 py-1 text-sm text-white outline-none" value={editModel.current} onChange={e => setEditModel({ ...editModel, current: e.target.value })} onKeyDown={e => e.key === 'Enter' && saveRenameModel()}/>
                      <button onClick={saveRenameModel} className="text-emerald-400"><ICONS.Lock size={16}/></button>
                    </div>
                 ) : (
                   <>
                     <span className="text-sm font-bold text-slate-200">{m}</span>
                     <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditModel({ old: m, current: m })} className="text-slate-500 hover:text-indigo-400"><ICONS.Edit size={14}/></button>
                        <button onClick={() => updateState(p => ({
                          ...p, 
                          accountingPeriods: p.accountingPeriods.map(ap => ap.id === p.selectedPeriodId ? { ...ap, models: (ap.models || p.models).filter(x => x !== m), updatedAt: new Date().toISOString() } : ap)
                        }))} className="text-slate-500 hover:text-rose-500"><ICONS.Trash size={14}/></button>
                     </div>
                   </>
                 )}
               </div>
             ))}
          </div>
        </div>
        {userRole === 'owner' && (
          <div className="glass-card p-6 rounded-[24px] border-slate-800 space-y-6">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <ICONS.Crown size={18} className="text-amber-400" /> Состав админов ({activePeriod?.label})
            </h2>
            <div className="space-y-4">
              <div className="flex gap-2">
                 <input className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="Имя..." value={newAdminName} onChange={e => setNewAdminName(e.target.value)}/>
                 <input className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="%" type="number" value={newAdminRate} onChange={e => setNewAdminRate(e.target.value)}/>
                 <button onClick={handleAddAdmin} className="bg-amber-600 px-3 rounded-lg"><ICONS.Plus size={18}/></button>
              </div>
              <p className="text-[9px] text-slate-500 italic">Админы получают процент от общего оборота (Gross) за месяц.</p>
            </div>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
               {currentAdmins.map(a => (
                 <div key={a.id} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg group">
                   <div className="flex flex-col">
                      <span className="text-sm font-bold text-slate-200">{a.name}</span>
                      <span className="text-[10px] text-amber-500 font-bold">{a.rate}% от оборота</span>
                   </div>
                   <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => {
                        const newRate = prompt(`Новая ставка для ${a.name} (%):`, String(a.rate));
                        if (newRate !== null) {
                          const rate = parseFloat(newRate) || 0;
                          updateState(p => ({
                            ...p,
                            accountingPeriods: p.accountingPeriods.map(ap => ap.id === p.selectedPeriodId ? { ...ap, admins: (ap.admins || p.admins).map(x => x.id === a.id ? { ...x, rate } : x), updatedAt: new Date().toISOString() } : ap)
                          }));
                        }
                      }} className="text-slate-500 hover:text-amber-400"><ICONS.Edit size={14}/></button>
                      <button onClick={() => updateState(p => ({
                        ...p, 
                        accountingPeriods: p.accountingPeriods.map(ap => ap.id === p.selectedPeriodId ? { ...ap, admins: (ap.admins || p.admins).filter(x => x.id !== a.id), updatedAt: new Date().toISOString() } : ap)
                      }))} className="text-slate-500 hover:text-rose-500"><ICONS.Trash size={14}/></button>
                   </div>
                 </div>
               ))}
            </div>
          </div>
        )}

        <div className="glass-card p-6 rounded-[24px] border-slate-800 space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ICONS.Models size={18} className="text-rose-400" /> Скрытые анкеты
          </h2>
          <p className="text-[9px] text-slate-500 italic">Эти анкеты не отображаются в Total Table. Нажмите "Восстановить", чтобы вернуть их в список.</p>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
             {(!state.inactiveModels || state.inactiveModels.length === 0) ? (
               <p className="text-[10px] text-slate-600 text-center py-4">Нет скрытых анкет</p>
             ) : (
               state.inactiveModels.map(m => (
                 <div key={m} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg group">
                   <span className="text-sm font-bold text-slate-400 line-through decoration-rose-500/50">{m}</span>
                   <button 
                     onClick={() => updateState(p => ({
                       ...p,
                       inactiveModels: (p.inactiveModels || []).filter(x => x !== m)
                     }))}
                     className="bg-emerald-600/20 hover:bg-emerald-600 text-emerald-400 hover:text-white px-3 py-1 rounded-lg text-[9px] font-black uppercase transition-all"
                   >
                     Восстановить
                   </button>
                 </div>
               ))
             )}
          </div>
        </div>

        <div className="glass-card p-6 rounded-[24px] border-slate-800 space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ICONS.Income size={18} className="text-emerald-400" /> Месячные планы ({activePeriod?.label})
          </h2>
          <p className="text-[9px] text-slate-500 italic">Установите цель на месяц. Система будет автоматически рассчитывать ежедневные цели в Total Table.</p>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
             {currentModels.map(m => (
               <div key={m} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg group">
                 <span className="text-sm font-bold text-slate-200">{m}</span>
                 <div className="flex items-center gap-2">
                    <input 
                      type="number" 
                      className="w-24 bg-slate-950 border border-slate-800 rounded px-2 py-1 text-sm text-white text-right outline-none focus:border-emerald-500/50"
                      placeholder="0"
                      value={currentPlans[m] || ''}
                      onChange={e => {
                        const val = parseFloat(e.target.value) || 0;
                        updateState(p => ({
                          ...p,
                          accountingPeriods: p.accountingPeriods.map(ap => ap.id === p.selectedPeriodId ? {
                            ...ap,
                            modelMonthlyPlans: { ...(ap.modelMonthlyPlans || {}), [m]: val },
                            updatedAt: new Date().toISOString()
                          } : ap)
                        }));
                      }}
                    />
                    <span className="text-xs text-slate-500">$</span>
                 </div>
               </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
