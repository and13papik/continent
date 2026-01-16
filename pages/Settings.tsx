
import React, { useState, useEffect } from 'react';
import { AppState, CloudSnapshot } from '../types';
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
  const [dbTestResult, setDbTestResult] = useState<{ success: boolean; message: string } | null>(null);
  
  const [snapshots, setSnapshots] = useState<CloudSnapshot[]>([]);
  const [isLoadingSnapshots, setIsLoadingSnapshots] = useState(false);

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

  const handleTestConnection = async () => {
    setDbTestResult(null);
    const result = await testDatabaseConnection(syncUrlInput, syncKeyInput);
    setDbTestResult(result);
  };

  const handleApplySettings = () => {
    updateState(p => ({ ...p, syncUrl: syncUrlInput, syncKey: syncKeyInput }));
    alert('Настройки сохранены локально.');
  };

  const forcePull = async () => {
     if (!syncUrlInput || !syncKeyInput) return alert('Сначала введите URL и Ключ');
     if (!confirm('Внимание: это ЗАМЕНИТ ваши текущие данные данными из облака (main). Продолжить?')) return;
     
     setIsManualSyncing(true);
     createEmergencyBackup(state); // Сохраняем текущее в "черный ящик" перед загрузкой
     
     const remote = await fetchFromCloud(syncUrlInput, syncKeyInput);
     if (remote && remote.accountingPeriods) {
        updateState(() => ({ ...remote, syncUrl: syncUrlInput, syncKey: syncKeyInput }));
        alert('Данные успешно загружены!');
     } else {
        alert('Данные не найдены.');
     }
     setIsManualSyncing(false);
  };

  const restoreFromSnapshot = (snap: CloudSnapshot) => {
    const dateStr = new Date(snap.updated_at).toLocaleString();
    if (!confirm(`Вы действительно хотите откатить ВСЮ систему к состоянию на ${dateStr}? Текущие данные будут стерты.`)) return;
    
    createEmergencyBackup(state); // На всякий случай
    updateState(() => ({
      ...snap.state,
      syncUrl: state.syncUrl,
      syncKey: state.syncKey
    }));
    alert('Система успешно восстановлена из снапшота!');
  };

  const handleEmergencyRestore = () => {
    const backup = restoreEmergencyBackup();
    if (!backup) return alert('Локальных бекапов не найдено.');
    if (confirm('Восстановить данные из последнего "черного ящика" (локального авто-бекапа)?')) {
      updateState(() => backup);
      alert('Данные восстановлены!');
    }
  };

  const saveRenameOperator = () => {
    if (!editOp || !editOp.current.trim() || editOp.old === editOp.current) {
      setEditOp(null);
      return;
    }
    updateState(prev => ({
      ...prev,
      operators: prev.operators.map(o => o === editOp.old ? editOp.current : o),
      incomeData: prev.incomeData.map(r => r.operator === editOp.old ? { ...r, operator: editOp.current } : r),
      operationsData: prev.operationsData.map(o => o.operator === editOp.old ? { ...o, operator: editOp.current } : o)
    }));
    setEditOp(null);
  };

  const saveRenameModel = () => {
    if (!editModel || !editModel.current.trim() || editModel.old === editModel.current) {
      setEditModel(null);
      return;
    }
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
          <p className="text-slate-400">Конфигурация системы и защита данных</p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleEmergencyRestore} className="bg-rose-600/20 text-rose-400 border border-rose-500/30 px-4 py-2 rounded-xl text-xs font-bold hover:bg-rose-600/30 transition-all">Черный ящик</button>
          <label className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all">
            Импорт
            <input type="file" className="hidden" accept=".json" onChange={importData} />
          </label>
          <button onClick={exportData} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all">Экспорт</button>
        </div>
      </header>

      {/* Cloud Sync & Snapshots */}
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
            <button onClick={handleTestConnection} className="w-full text-slate-500 hover:text-white text-xs font-bold transition-all py-2">Проверить связь</button>
          </div>
          
          {dbTestResult && (
            <div className={`p-4 rounded-2xl border flex items-center gap-3 ${dbTestResult.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
              <span className="text-sm font-bold">{dbTestResult.message}</span>
            </div>
          )}
        </div>

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
           <p className="text-[10px] text-slate-500 italic">Приложение сохраняет до 20 последних версий в облаке автоматически.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Operators Management */}
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

        {/* Models Management */}
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
