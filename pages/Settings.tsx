import React, { useState } from 'react';
import { AppState } from '../types';
import { ICONS } from '../constants';
import { fetchFromCloud } from '../store';

interface SettingsProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const Settings: React.FC<SettingsProps> = ({ state, updateState }) => {
  // Local inputs state
  const [newOp, setNewOp] = useState('');
  const [newModel, setNewModel] = useState('');
  const [syncUrlInput, setSyncUrlInput] = useState(state.syncUrl || '');
  const [syncKeyInput, setSyncKeyInput] = useState(state.syncKey || '');
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  const exportData = () => {
    const dataStr = JSON.stringify(state, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `continental_backup_${new Date().toISOString().split('T')[0]}.json`;
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
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
          alert('Данные импортированы!');
        }
      } catch (err) {
        alert('Ошибка файла.');
      }
    };
    reader.readAsText(file);
  };

  const forcePull = async () => {
     if (!syncUrlInput || !syncKeyInput) {
       alert('Заполните настройки синхронизации');
       return;
     }
     setIsManualSyncing(true);
     try {
       const remote = await fetchFromCloud(syncUrlInput, syncKeyInput);
       if (remote) {
          updateState(() => remote);
          alert('Синхронизировано успешно!');
       } else {
          alert('Данные не найдены или ошибка ключа.');
       }
     } catch (e) {
       alert('Ошибка сети.');
     } finally {
       setIsManualSyncing(false);
     }
  };

  const saveSync = () => {
    updateState(prev => ({ ...prev, syncUrl: syncUrlInput, syncKey: syncKeyInput }));
    alert('Настройки сохранены');
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-outfit text-white">Настройки</h1>
          <p className="text-slate-400">Управление базой данных и параметрами системы</p>
        </div>
        <div className="flex gap-2">
          <label className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer">
            Импорт JSON
            <input type="file" className="hidden" accept=".json" onChange={importData} />
          </label>
          <button onClick={exportData} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all">
            Экспорт JSON
          </button>
        </div>
      </header>

      {/* Cloud Sync */}
      <div className="glass-card p-8 rounded-[32px] border-indigo-500/20 shadow-2xl">
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-indigo-500/10 text-indigo-400 rounded-xl flex items-center justify-center">
             <ICONS.Dashboard size={24} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Supabase Cloud</h2>
            <p className="text-sm text-slate-500">Настройки синхронизации (Project Settings - API)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Supabase URL</label>
            <input 
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white font-mono outline-none" 
              placeholder="https://abc.supabase.co"
              value={syncUrlInput}
              onChange={e => setSyncUrlInput(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Anon Key / API Key</label>
            <input 
              type="password"
              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white font-mono outline-none" 
              placeholder="eyJ..."
              value={syncKeyInput}
              onChange={e => setSyncKeyInput(e.target.value)}
            />
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={saveSync} className="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all shadow-lg shadow-indigo-600/20">
            Сохранить настройки
          </button>
          <button onClick={forcePull} disabled={isManualSyncing} className="bg-slate-800 hover:bg-slate-700 text-white px-6 py-3 rounded-xl font-bold text-sm transition-all flex items-center gap-2">
            {isManualSyncing ? 'Загрузка...' : 'Загрузить из облака'}
          </button>
        </div>
      </div>

      {/* Basic Management */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-6 rounded-[24px] border-slate-800 space-y-6">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ICONS.Reports size={18} className="text-sky-400" /> Штат операторов
          </h2>
          <div className="flex gap-2">
             <input className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white" placeholder="Имя..." value={newOp} onChange={e => setNewOp(e.target.value)}/>
             <button onClick={() => { if(newOp) { updateState(p => ({...p, operators: [...p.operators, newOp]})); setNewOp(''); }}} className="bg-sky-600 px-3 rounded-lg"><ICONS.Plus size={18}/></button>
          </div>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
             {state.operators.map(o => (
               <div key={o} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
                 <span className="text-sm">{o}</span>
                 <button onClick={() => updateState(p => ({...p, operators: p.operators.filter(x => x !== o)}))} className="text-slate-500 hover:text-rose-500"><ICONS.Trash size={14}/></button>
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
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
             {state.models.map(m => (
               <div key={m} className="flex justify-between items-center p-3 bg-slate-900/50 rounded-lg">
                 <span className="text-sm">{m}</span>
                 <button onClick={() => updateState(p => ({...p, models: p.models.filter(x => x !== m)}))} className="text-slate-500 hover:text-rose-500"><ICONS.Trash size={14}/></button>
               </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;