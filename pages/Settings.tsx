import React, { useState } from 'react';
import { AppState } from '../types';
import { ICONS } from '../constants';
import { fetchFromCloud, testDatabaseConnection } from '../store';

interface SettingsProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const Settings: React.FC<SettingsProps> = ({ state, updateState }) => {
  const [newOp, setNewOp] = useState('');
  const [newModel, setNewModel] = useState('');
  
  // Состояние для редактирования
  const [editOp, setEditOp] = useState<{ old: string; current: string } | null>(null);
  const [editModel, setEditModel] = useState<{ old: string; current: string } | null>(null);

  const [syncUrlInput, setSyncUrlInput] = useState(state.syncUrl || '');
  const [syncKeyInput, setSyncKeyInput] = useState(state.syncKey || '');
  const [isManualSyncing, setIsManualSyncing] = useState(false);
  const [dbTestResult, setDbTestResult] = useState<{ success: boolean; message: string } | null>(null);

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

  const forcePull = async () => {
     if (!syncUrlInput || !syncKeyInput) return alert('Заполните настройки');
     setIsManualSyncing(true);
     const remote = await fetchFromCloud(syncUrlInput, syncKeyInput);
     if (remote) {
        updateState(() => remote);
        alert('Успешно загружено!');
     } else {
        alert('В облаке пока нет сохраненных данных или ошибка доступа.');
     }
     setIsManualSyncing(false);
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
          <p className="text-slate-400">Конфигурация системы и облака</p>
        </div>
        <div className="flex gap-2">
          <label className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer transition-all">
            Импорт
            <input type="file" className="hidden" accept=".json" onChange={importData} />
          </label>
          <button onClick={exportData} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all">Экспорт</button>
        </div>
      </header>

      {/* Cloud Sync */}
      <div className="glass-card p-8 rounded-[32px] border-indigo-500/20 shadow-2xl relative overflow-hidden">
        <div className="flex items-center justify-between mb-6">
           <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <ICONS.Dashboard size={20} className="text-indigo-400" /> Supabase Синхронизация
          </h2>
          <div className="px-3 py-1 bg-slate-900 rounded-full text-[9px] font-black uppercase tracking-widest text-slate-500 border border-slate-800">
             Centralized Storage
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Supabase URL</label>
            <input className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-5 py-3.5 text-sm text-white outline-none focus:border-indigo-500 transition-all" value={syncUrlInput} onChange={e => setSyncUrlInput(e.target.value)} placeholder="https://xxxx.supabase.co" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Anon Key (API Key)</label>
            <input type="password" className="w-full bg-slate-900 border border-slate-700 rounded-2xl px-5 py-3.5 text-sm text-white outline-none focus:border-indigo-500 transition-all" value={syncKeyInput} onChange={e => setSyncKeyInput(e.target.value)} placeholder="eyJhb..." />
          </div>
        </div>

        {dbTestResult && (
          <div className={`mb-6 p-4 rounded-2xl border flex items-center gap-3 animate-in slide-in-from-left-2 ${dbTestResult.success ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'}`}>
            {dbTestResult.success ? <ICONS.Lock size={18} /> : <ICONS.Penalty size={18} />}
            <span className="text-sm font-bold">{dbTestResult.message}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          <button 
            onClick={() => updateState(p => ({ ...p, syncUrl: syncUrlInput, syncKey: syncKeyInput }))} 
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-3.5 rounded-2xl font-bold text-sm shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
          >
            Применить и Сохранить
          </button>
          <button 
            onClick={handleTestConnection} 
            className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95"
          >
            Проверить базу
          </button>
          <button 
            onClick={forcePull} 
            disabled={isManualSyncing} 
            className="bg-slate-800 hover:bg-slate-700 text-white px-8 py-3.5 rounded-2xl font-bold text-sm transition-all active:scale-95 disabled:opacity-50"
          >
            {isManualSyncing ? 'Загрузка...' : 'Загрузить из облака'}
          </button>
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
                     <input 
                       autoFocus
                       className="flex-1 bg-slate-950 border border-sky-500 rounded px-2 py-1 text-sm text-white outline-none"
                       value={editOp.current}
                       onChange={e => setEditOp({ ...editOp, current: e.target.value })}
                       onKeyDown={e => e.key === 'Enter' && saveRenameOperator()}
                     />
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
                      <input 
                        autoFocus
                        className="flex-1 bg-slate-950 border border-indigo-500 rounded px-2 py-1 text-sm text-white outline-none"
                        value={editModel.current}
                        onChange={e => setEditModel({ ...editModel, current: e.target.value })}
                        onKeyDown={e => e.key === 'Enter' && saveRenameModel()}
                      />
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