import React, { useState } from 'react';
import { AppState, Admin } from '../types';
import { ICONS } from '../constants';
import { fetchFromCloud, syncToCloud, saveLocal } from '../store';

interface SettingsProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const Settings: React.FC<SettingsProps> = ({ state, updateState }) => {
  const [newOp, setNewOp] = useState('');
  const [editingOp, setEditingOp] = useState<{ oldName: string; newName: string } | null>(null);
  const [newModel, setNewModel] = useState('');
  const [editingModel, setEditingModel] = useState<{ oldName: string; newName: string } | null>(null);
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
        if (confirm('Это полностью заменит все текущие данные. Вы уверены?')) {
          updateState(() => json);
          alert('Данные успешно импортированы!');
        }
      } catch (err) {
        alert('Ошибка при чтении файла бэкапа.');
      }
    };
    reader.readAsText(file);
  };

  const forcePull = async () => {
     if (!syncUrlInput || !syncKeyInput) {
       alert('Введите URL и Anon Key');
       return;
     }
     if (!confirm('Загрузить последнюю версию из облака? Локальные несохраненные изменения будут потеряны.')) return;
     setIsManualSyncing(true);
     const remote = await fetchFromCloud(syncUrlInput, syncKeyInput);
     if (remote) {
        updateState(() => remote);
        alert('Данные успешно синхронизированы из облака!');
     } else {
        alert('Ошибка при загрузке. Проверьте URL, ключ и создана ли таблица app_storage.');
     }
     setIsManualSyncing(false);
  };

  const saveUrls = () => {
    updateState(prev => ({ ...prev, syncUrl: syncUrlInput, syncKey: syncKeyInput }));
    alert('Настройки сохранены. Приложение начнет синхронизацию.');
  };

  const addOperator = () => {
    if (!newOp || state.operators.includes(newOp)) return;
    updateState(prev => ({ ...prev, operators: [...prev.operators, newOp] }));
    setNewOp('');
  };

  const renameOperator = () => {
    if (!editingOp || !editingOp.newName) { setEditingOp(null); return; }
    const { oldName, newName } = editingOp;
    updateState(prev => ({
      ...prev,
      operators: prev.operators.map(o => o === oldName ? newName : o),
      incomeData: prev.incomeData.map(r => r.operator === oldName ? { ...r, operator: newName } : r),
      operationsData: prev.operationsData.map(o => o.operator === oldName ? { ...o, operator: newName } : o)
    }));
    setEditingOp(null);
  };

  const removeOperator = (name: string) => {
    if (!confirm(`Удалить оператора "${name}"?`)) return;
    updateState(prev => ({ ...prev, operators: prev.operators.filter(o => o !== name) }));
  };

  const addModel = () => {
    if (!newModel || state.models.includes(newModel)) return;
    updateState(prev => ({ ...prev, models: [...prev.models, newModel] }));
    setNewModel('');
  };

  const renameModel = () => {
    if (!editingModel || !editingModel.newName) { setEditingModel(null); return; }
    const { oldName, newName } = editingModel;
    updateState(prev => ({
      ...prev,
      models: prev.models.map(m => m === oldName ? newName : m),
      incomeData: prev.incomeData.map(r => r.model === oldName ? { ...r, model: newName } : r)
    }));
    setEditingModel(null);
  };

  const removeModel = (name: string) => {
    if (!confirm(`Удалить анкету "${name}"?`)) return;
    updateState(prev => ({ ...prev, models: prev.models.filter(m => m !== name) }));
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-outfit text-white">Управление данными</h1>
          <p className="text-slate-400">Конфигурация Supabase Cloud и локальных бэкапов</p>
        </div>
        <div className="flex gap-3">
          <label className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-2 transition-all">
            <ICONS.Plus size={14} /> Импорт JSON
            <input type="file" className="hidden" accept=".json" onChange={importData} />
          </label>
          <button onClick={exportData} className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-600/20">
            <ICONS.Salary size={14} /> Экспорт JSON (Бэкап)
          </button>
        </div>
      </header>

      <div className="glass-card p-8 rounded-[40px] border-indigo-500/20 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8">
           <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${state.syncUrl ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${state.syncUrl ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></div>
              {state.syncUrl ? 'Supabase Connected' : 'Local Mode'}
           </div>
        </div>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center border border-indigo-500/20">
             <ICONS.Dashboard size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-bold font-outfit text-white">Supabase Cloud Sync</h2>
            <p className="text-sm text-slate-400">Введите данные из раздела Project Settings &rarr; API</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Project URL</label>
            <input type="text" className="w-full bg-slate-900/80 border border-slate-700 rounded-2xl px-5 py-4 text-sm font-mono text-indigo-400 outline-none" placeholder="https://xyz.supabase.co" value={syncUrlInput} onChange={(e) => setSyncUrlInput(e.target.value)} />
          </div>
          <div className="space-y-3">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Anon Public Key</label>
            <input type="password" className="w-full bg-slate-900/80 border border-slate-700 rounded-2xl px-5 py-4 text-sm font-mono text-emerald-400 outline-none" placeholder="eyJhbGciOiJIUzI1NiIsInR..." value={syncKeyInput} onChange={(e) => setSyncKeyInput(e.target.value)} />
          </div>
        </div>

        <div className="flex gap-4">
            <button onClick={saveUrls} className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-4 rounded-2xl font-bold text-sm transition-all shadow-xl shadow-indigo-600/20 active:scale-95">Сохранить и Синхронизировать</button>
            <button onClick={forcePull} disabled={isManualSyncing} className="bg-slate-800 hover:bg-slate-700 text-white px-10 py-4 rounded-2xl font-bold text-sm transition-all flex items-center gap-2">
                {isManualSyncing ? 'Загрузка...' : 'Загрузить из облака (Pull)'}
                <ICONS.RotateCcw size={16} className={isManualSyncing ? 'animate-spin' : ''} />
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="glass-card p-8 rounded-[32px] border-slate-800 shadow-xl space-y-6">
            <h2 className="text-xl font-bold font-outfit text-white flex items-center gap-3">
               <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400"><ICONS.Reports size={20} /></div>
               Штат Операторов
            </h2>
            <div className="flex gap-2">
              <input value={newOp} onChange={e => setNewOp(e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none" placeholder="Имя нового оператора..."/>
              <button onClick={addOperator} className="bg-sky-600 hover:bg-sky-500 text-white px-5 rounded-xl transition-all shadow-lg active:scale-90"><ICONS.Plus size={20}/></button>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {state.operators.map(o => (
                <div key={o} className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl flex items-center justify-between group">
                  {editingOp?.oldName === o ? (
                    <div className="flex-1 flex gap-2">
                      <input className="flex-1 bg-slate-800 border border-sky-500 rounded-lg px-3 py-1 text-sm text-white" value={editingOp.newName} onChange={e => setEditingOp({...editingOp, newName: e.target.value})} />
                      <button onClick={renameOperator} className="text-emerald-400"><ICONS.Lock size={16}/></button>
                    </div>
                  ) : (
                    <>
                      <span className="text-slate-200 font-bold">{o}</span>
                      <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditingOp({ oldName: o, newName: o })} className="text-slate-500 hover:text-sky-400"><ICONS.Edit size={16}/></button>
                        <button onClick={() => removeOperator(o)} className="text-slate-500 hover:text-rose-500"><ICONS.Trash size={16}/></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-8 rounded-[32px] border-slate-800 shadow-xl space-y-6">
            <h2 className="text-xl font-bold font-outfit text-white flex items-center gap-3">
               <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400"><ICONS.Models size={20} /></div>
               Список Анкет (Models)
            </h2>
            <div className="flex gap-2">
               <input value={newModel} onChange={e => setNewModel(e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none" placeholder="Название анкеты..."/>
               <button onClick={addModel} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 rounded-xl shadow-lg active:scale-90 transition-all"><ICONS.Plus size={20}/></button>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
               {state.models.map(m => (
                 <div key={m} className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl flex items-center justify-between group">
                   {editingModel?.oldName === m ? (
                     <div className="flex-1 flex gap-2">
                       <input className="flex-1 bg-slate-800 border border-indigo-500 rounded-lg px-3 py-1 text-sm text-white" value={editingModel.newName} onChange={e => setEditingModel({...editingModel, newName: e.target.value})} />
                       <button onClick={renameModel} className="text-emerald-400"><ICONS.Lock size={16}/></button>
                     </div>
                   ) : (
                     <>
                       <span className="text-slate-200 font-bold">{m}</span>
                       <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => setEditingModel({ oldName: m, newName: m })} className="text-slate-500 hover:text-indigo-400"><ICONS.Edit size={16}/></button>
                         <button onClick={() => removeModel(m)} className="text-slate-500 hover:text-rose-500"><ICONS.Trash size={16}/></button>
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