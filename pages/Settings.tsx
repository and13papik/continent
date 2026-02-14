
import React, { useState, useEffect, useMemo } from 'react';
import { AppState, CloudSnapshot, AccountingPeriod, IncomeRecord, OperationRecord } from '../types';
import { ICONS } from '../constants';
import { fetchFromCloud, testDatabaseConnection, listCloudSnapshots, createEmergencyBackup, restoreEmergencyBackup } from '../store';

interface SettingsProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const Settings: React.FC<SettingsProps> = ({ state, updateState }) => {
  const [newOp, setNewOp] = useState('');
  const [newModel, setNewModel] = useState('');
  
  const [editOp, setEditOp] = useState<{ old: string; current: string } | null>(null);
  const [editModel, setEditModel] = useState<{ old: string; current: string } | null>(null);

  const [syncUrlInput, setSyncUrlInput] = useState(state.syncUrl || '');
  const [syncKeyInput, setSyncKeyInput] = useState(state.syncKey || '');
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  
  const [snapshots, setSnapshots] = useState<CloudSnapshot[]>([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);

  // --- УЛУЧШЕННЫЙ МАСТЕР ИСПРАВЛЕНИЯ ---
  const issueReport = useMemo(() => {
    const periodIds = new Set(state.accountingPeriods.map(p => p.id));
    const periodsMap = new Map<string, string>(); // ID -> YYYY-MM
    state.accountingPeriods.forEach(p => {
      const d = new Date(p.startAt);
      periodsMap.set(p.id, `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    });

    const homelessCount = [
      ...state.incomeData.filter(i => !periodIds.has(i.periodId)),
      ...state.operationsData.filter(o => !periodIds.has(o.periodId))
    ].length;

    const misplacedCount = [
      ...state.incomeData.filter(i => {
        const pMonthStr = periodsMap.get(i.periodId);
        return pMonthStr && !i.date.startsWith(pMonthStr);
      }),
      ...state.operationsData.filter(o => {
        const pMonthStr = periodsMap.get(o.periodId);
        return pMonthStr && !o.date.startsWith(pMonthStr);
      })
    ].length;

    return { total: homelessCount + misplacedCount, homelessCount, misplacedCount };
  }, [state.incomeData, state.operationsData, state.accountingPeriods]);

  const repairDataStructure = () => {
    if (!confirm(`Будет выполнен Капитальный ремонт:\n1. Период "Январь" станет строго январским.\n2. Период "Февраль" станет строго февральским.\n3. Записи февраля (25к) уйдут из января (50к).\n\nПродолжить?`)) return;

    updateState(prev => {
      const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
      
      // 1. Исправляем даты начала периодов по их именам
      let nextPeriods = prev.accountingPeriods.map(p => {
        const lowerLabel = p.label.toLowerCase();
        const monthIdx = months.findIndex(m => lowerLabel.includes(m.toLowerCase()));
        
        if (monthIdx !== -1) {
            const yearMatch = p.label.match(/\d{4}/);
            const year = yearMatch ? parseInt(yearMatch[0]) : 2025;
            // Устанавливаем 1-е число месяца в полдень, чтобы избежать проблем с таймзонами
            return {
                ...p,
                startAt: new Date(year, monthIdx, 1, 12, 0, 0).toISOString()
            };
        }
        return p;
      });
      
      // 2. Функция распределения
      const getOrCreatePeriod = (dateStr: string) => {
        const d = new Date(dateStr);
        const m = d.getMonth();
        const y = d.getFullYear();
        
        let found = nextPeriods.find(p => {
          const pd = new Date(p.startAt);
          return pd.getMonth() === m && pd.getFullYear() === y;
        });

        if (!found) {
          found = {
            id: `auto-${y}-${m}-${Date.now()}`,
            label: `${months[m]} ${y}`,
            startAt: new Date(y, m, 1, 12, 0, 0).toISOString(),
            endAt: null,
            status: 'open'
          };
          nextPeriods.push(found);
        }
        return found.id;
      };

      // 3. Перепривязываем все записи по их фактической дате
      const nextIncomes = prev.incomeData.map(i => ({
        ...i, 
        periodId: getOrCreatePeriod(i.date),
        updatedAt: new Date().toISOString()
      }));

      const nextOps = prev.operationsData.map(o => ({
        ...o, 
        periodId: getOrCreatePeriod(o.date),
        updatedAt: new Date().toISOString()
      }));

      const nextManualIncomes = (prev.ownerManualIncomes || []).map(i => ({
        ...i,
        periodId: getOrCreatePeriod(i.date)
      }));

      const nextExpenses = prev.ownerExpenses.map(e => ({
        ...e,
        periodId: getOrCreatePeriod(e.date)
      }));

      return {
        ...prev,
        version: prev.version + 100, // Форсируем синхронизацию
        accountingPeriods: nextPeriods,
        incomeData: nextIncomes,
        operationsData: nextOps,
        ownerManualIncomes: nextManualIncomes,
        ownerExpenses: nextExpenses
      };
    });

    alert('Готово! Теперь Январь и Февраль разделены корректно.');
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
      modelDefaultGoals: {
        ...(prev.modelDefaultGoals || {}),
        [modelName]: {
          ...(prev.modelDefaultGoals?.[modelName] || { night: 60, morning: 60, day: 60, evening: 60 }),
          [shift]: val
        }
      }
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
    if (!confirm('Удалить ВСЕ финансовые данные?')) return;
    createEmergencyBackup(state); 
    updateState(prev => ({
      ...prev,
      incomeData: [],
      operationsData: [],
      ownerExpenses: [],
      ownerManualIncomes: [],
      ownerAdvances: [],
      modelBonuses: [],
      paidStatuses: [],
      lastUpdated: Date.now(),
      version: prev.version + 1
    }));
  };

  const handleApplySettings = () => {
    updateState(p => ({ ...p, syncUrl: syncUrlInput, syncKey: syncKeyInput }));
    alert('Настройки сохранены.');
  };

  const forcePull = async () => {
     if (!syncUrlInput || !syncKeyInput) return;
     setIsManualSyncing(true);
     const remote = await fetchFromCloud(syncUrlInput, syncKeyInput);
     if (remote) {
        updateState(() => ({ ...remote, syncUrl: syncUrlInput, syncKey: syncKeyInput }));
        alert('Данные загружены.');
     }
     setIsManualSyncing(false);
  };

  const restoreFromSnapshot = (snap: CloudSnapshot) => {
    if (!confirm(`Откатить систему к ${new Date(snap.updated_at).toLocaleString()}?`)) return;
    createEmergencyBackup(state); 
    updateState(() => ({ ...snap.state, syncUrl: state.syncUrl, syncKey: state.syncKey }));
  };

  const saveRenameOperator = () => {
    if (!editOp || !editOp.current.trim() || editOp.old === editOp.current) { setEditOp(null); return; }
    updateState(prev => ({
      ...prev,
      operators: prev.operators.map(o => o === editOp.old ? editOp.current : o),
      incomeData: prev.incomeData.map(r => r.operator === editOp.old ? { ...r, operator: editOp.current } : r),
      operationsData: prev.operationsData.map(o => o.operator === editOp.old ? { ...o, operator: editOp.current } : o)
    }));
    setEditOp(null);
  };

  const saveRenameModel = () => {
    if (!editModel || !editModel.current.trim() || editModel.old === editModel.current) { setEditModel(null); return; }
    updateState(prev => ({
      ...prev,
      models: prev.models.map(m => m === editModel.old ? editModel.current : m),
      incomeData: prev.incomeData.map(r => r.model === editModel.old ? { ...r, model: editModel.current } : r),
      modelBonuses: (prev.modelBonuses || []).map(b => b.model === editModel.old ? { ...b, model: editModel.current } : b)
    }));
    setEditModel(null);
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-outfit text-white">Настройки</h1>
          <p className="text-slate-400">Конфигурация системы и разделение данных</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => { const b = restoreEmergencyBackup(); if(b) updateState(() => b); }} className="bg-rose-600/20 text-rose-400 border border-rose-500/30 px-4 py-2 rounded-xl text-xs font-bold hover:bg-rose-600/30 transition-all">Черный ящик</button>
          <label className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all">
            Импорт
            <input type="file" className="hidden" accept=".json" onChange={importData} />
          </label>
          <button onClick={exportData} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all">Экспорт</button>
        </div>
      </header>

      {/* КНОПКА ГЕНЕРАЛЬНОЙ ПОЧИНКИ */}
      <div className="bg-indigo-600/10 border border-indigo-500/40 p-8 rounded-[2.5rem] flex flex-col md:flex-row items-center justify-between gap-8 shadow-2xl">
         <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-3xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
               <ICONS.AlertTriangle size={32} />
            </div>
            <div>
               <h3 className="text-xl font-bold text-white font-outfit">Исправить за 1 клик</h3>
               <p className="text-sm text-slate-400 mt-1">
                 Нажмите, чтобы разделить Январь (50к) и Февраль (25к). Система автоматически перенесет записи в правильные месяцы.
               </p>
            </div>
         </div>
         <button onClick={repairDataStructure} className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl active:scale-95">Запустить ремонт</button>
      </div>

      <div className="glass-card p-8 rounded-[32px] border-amber-500/20 shadow-2xl space-y-6">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <ICONS.Crown size={20} className="text-amber-400" /> Цели анкет по умолчанию
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-500 uppercase font-black tracking-widest border-b border-slate-800">
                <th className="py-3 px-4">Анкета</th>
                <th className="py-3 px-4 text-center">Ночь 🌙</th>
                <th className="py-3 px-4 text-center">Утро 🌅</th>
                <th className="py-3 px-4 text-center">День ☀️</th>
                <th className="py-3 px-4 text-center">Вечер 🌇</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {state.models.map(m => {
                const goals = state.modelDefaultGoals?.[m] || { night: 60, morning: 60, day: 60, evening: 60 };
                return (
                  <tr key={m} className="hover:bg-white/5 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-300">{m}</td>
                    {(['night', 'morning', 'day', 'evening'] as const).map(shift => (
                      <td key={shift} className="py-2 px-2">
                        <input type="number" className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-2 text-center text-white font-mono outline-none focus:border-amber-500/50" value={goals[shift]} onChange={e => handleUpdateDefaultGoal(m, shift, e.target.value)} />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        <div className="xl:col-span-1 glass-card p-8 rounded-[32px] border-indigo-500/20 shadow-2xl space-y-6">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ICONS.Dashboard size={20} className="text-indigo-400" /> Supabase Config
          </h2>
          <div className="space-y-4">
            <input className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-5 py-3 text-sm text-white outline-none" value={syncUrlInput} onChange={e => setSyncUrlInput(e.target.value)} placeholder="URL" />
            <input type="password" className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-5 py-3 text-sm text-white outline-none" value={syncKeyInput} onChange={e => setSyncKeyInput(e.target.value)} placeholder="Key" />
          </div>
          <div className="flex flex-col gap-3">
            <button onClick={handleApplySettings} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-2xl font-bold text-sm shadow-lg transition-all active:scale-95">Применить</button>
            <button onClick={forcePull} disabled={isManualSyncing} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-3 rounded-2xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50">Загрузить из облака</button>
            <button onClick={handleWipeData} className="w-full bg-rose-600/20 hover:bg-rose-600/40 text-rose-500 border border-rose-500/30 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all">Сбросить доходы</button>
          </div>
        </div>

        <div className="xl:col-span-2 glass-card p-8 rounded-[32px] border-slate-800 shadow-2xl space-y-6">
           <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <ICONS.Calendar size={20} className="text-emerald-400" /> Снапшоты
              </h2>
              <button onClick={loadSnapshots} className="text-indigo-400 hover:text-white transition-all"><ICONS.RotateCcw size={18} className={isLoadingSnapshots ? 'animate-spin' : ''}/></button>
           </div>
           <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {snapshots.map(snap => (
                <div key={snap.id} className="bg-slate-900/40 p-4 rounded-2xl border border-slate-800 flex items-center justify-between group hover:border-indigo-500/30 transition-all">
                  <div>
                    <p className="text-sm font-bold text-white">{new Date(snap.updated_at).toLocaleString()}</p>
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">v.{snap.state.version}</p>
                  </div>
                  <button onClick={() => restoreFromSnapshot(snap)} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all">Восстановить</button>
                </div>
              ))}
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-6 rounded-[24px] border-slate-800 space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ICONS.Reports size={18} className="text-sky-400" /> Штат операторов
          </h2>
          <div className="flex gap-2">
             <input className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="Имя..." value={newOp} onChange={e => setNewOp(e.target.value)}/>
             <button onClick={() => { if(newOp) { updateState(p => ({...p, operators: [...p.operators, newOp]})); setNewOp(''); }}} className="bg-sky-600 px-3 rounded-lg"><ICONS.Plus size={18}/></button>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
             {state.operators.map(o => (
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
                        <button onClick={() => updateState(p => ({...p, operators: p.operators.filter(x => x !== o)}))} className="text-slate-500 hover:text-rose-500"><ICONS.Trash size={14}/></button>
                     </div>
                   </>
                 )}
               </div>
             ))}
          </div>
        </div>

        <div className="glass-card p-6 rounded-[24px] border-slate-800 space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ICONS.Models size={18} className="text-indigo-400" /> Модели
          </h2>
          <div className="flex gap-2">
             <input className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="Название..." value={newModel} onChange={e => setNewModel(e.target.value)}/>
             <button onClick={() => { if(newModel) { updateState(p => ({...p, models: [...p.models, newModel]})); setNewModel(''); }}} className="bg-indigo-600 px-3 rounded-lg"><ICONS.Plus size={18}/></button>
          </div>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
             {state.models.map(m => (
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
                        <button onClick={() => updateState(p => ({...p, models: p.models.filter(x => x !== m)}))} className="text-slate-500 hover:text-rose-500"><ICONS.Trash size={14}/></button>
                     </div>
                   </>
                 )}
               </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
