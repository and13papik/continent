
import React, { useState } from 'react';
import { AppState, Admin } from '../types';
import { ICONS } from '../constants';
import { fetchFromCloud, syncToCloud } from '../store';

interface SettingsProps {
  state: AppState;
  updateState: (updater: (prev: AppState) => AppState) => void;
}

const Settings: React.FC<SettingsProps> = ({ state, updateState }) => {
  const [newOp, setNewOp] = useState('');
  const [editingOp, setEditingOp] = useState<{ oldName: string; newName: string } | null>(null);
  const [newModel, setNewModel] = useState('');
  const [editingModel, setEditingModel] = useState<{ oldName: string; newName: string } | null>(null);
  const [newAdmin, setNewAdmin] = useState({ name: '', rate: '8' });
  const [syncUrlInput, setSyncUrlInput] = useState(state.syncUrl || '');
  const [dbUrlInput, setDbUrlInput] = useState(state.dbUrl || '');
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  const addOperator = () => {
    if (!newOp || state.operators.includes(newOp)) return;
    updateState(prev => ({ ...prev, operators: [...prev.operators, newOp] }));
    setNewOp('');
  };

  const renameOperator = () => {
    if (!editingOp || !editingOp.newName || (state.operators.includes(editingOp.newName) && editingOp.newName !== editingOp.oldName)) {
      setEditingOp(null);
      return;
    }
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

  const addAdmin = () => {
    if (!newAdmin.name) return;
    const admin: Admin = { id: String(Date.now()), name: newAdmin.name, rate: parseFloat(newAdmin.rate) || 0 };
    updateState(prev => ({ ...prev, admins: [...prev.admins, admin] }));
    setNewAdmin({ name: '', rate: '8' });
  };

  const removeAdmin = (id: string) => {
    if (!confirm('Удалить админа?')) return;
    updateState(prev => ({ ...prev, admins: prev.admins.filter(a => a.id !== id) }));
  };

  const saveUrls = () => {
    updateState(prev => ({ ...prev, syncUrl: syncUrlInput, dbUrl: dbUrlInput }));
    alert('Настройки подключения сохранены. Синхронизация активирована.');
  };

  const manualSync = async () => {
    if (!state.syncUrl) {
      alert('Сначала укажите Google Sync URL');
      return;
    }
    setIsManualSyncing(true);
    const success = await syncToCloud(state);
    setIsManualSyncing(false);
    alert(success ? 'Данные синхронизированы! Таблица в Google Sheets обновлена.' : 'Ошибка синхронизации. Проверьте URL скрипта.');
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold font-outfit text-white">Настройки</h1>
          <p className="text-slate-400">Управление базами данных и синхронизацией</p>
        </div>
      </header>

      {/* Cloud & Double DB Setup */}
      <div className="glass-card p-8 rounded-[40px] border-indigo-500/20 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8">
           <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${state.syncUrl ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'}`}>
              <div className={`w-1.5 h-1.5 rounded-full ${state.syncUrl ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
              {state.syncUrl ? 'Cloud Ready' : 'Local Only'}
           </div>
        </div>

        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 bg-indigo-500/10 text-indigo-400 rounded-2xl flex items-center justify-center border border-indigo-500/20 shadow-inner">
             <ICONS.Income size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-bold font-outfit text-white leading-tight">Синхронизация и Бэкапы</h2>
            <p className="text-sm text-slate-400">Двойное хранение данных (Google Sheets + JSON Backup)</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          <div className="space-y-3">
            <div className="flex items-center justify-between ml-1">
               <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Основной Google Sync URL (Sheets)</label>
               <span className="text-[9px] text-indigo-400 font-bold italic">Отчеты + БД</span>
            </div>
            <input 
              type="text"
              className="w-full bg-slate-900/80 border border-slate-700 rounded-2xl px-5 py-4 text-sm font-mono text-indigo-400 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
              placeholder="https://script.google.com/macros/s/.../exec"
              value={syncUrlInput}
              onChange={(e) => setSyncUrlInput(e.target.value)}
            />
          </div>
          <div className="space-y-3">
             <div className="flex items-center justify-between ml-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Insurance DB URL (Доп. зеркало)</label>
                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter">Опционально</span>
             </div>
            <input 
              type="text"
              className="w-full bg-slate-900/80 border border-slate-700 rounded-2xl px-5 py-4 text-sm font-mono text-emerald-400 focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              placeholder="Второй URL для дублирования всех данных..."
              value={dbUrlInput}
              onChange={(e) => setDbUrlInput(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
           <button onClick={saveUrls} className="bg-indigo-600 hover:bg-indigo-500 text-white px-10 py-4 rounded-2xl font-bold text-sm transition-all shadow-xl shadow-indigo-600/20 active:scale-95">
             Сохранить и подключить
           </button>
           <button onClick={manualSync} disabled={!state.syncUrl || isManualSyncing} className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-10 py-4 rounded-2xl font-bold text-sm transition-all flex items-center gap-3">
             {isManualSyncing ? <div className="animate-spin"><ICONS.Plus size={16}/></div> : <ICONS.Income size={16}/>}
             {isManualSyncing ? 'Синхронизация...' : 'Выгрузить данные сейчас'}
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Управление операторами */}
          <div className="glass-card p-8 rounded-[32px] border-slate-800 shadow-xl space-y-6">
            <h2 className="text-xl font-bold font-outfit text-white flex items-center gap-3">
               <div className="p-2 rounded-lg bg-sky-500/10 text-sky-400"><ICONS.Reports size={20} /></div>
               Операторы
            </h2>
            <div className="flex gap-2">
              <input value={newOp} onChange={e => setNewOp(e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-sky-500 transition-all" placeholder="Добавить оператора..."/>
              <button onClick={addOperator} className="bg-sky-600 hover:bg-sky-500 text-white px-5 rounded-xl transition-all shadow-lg active:scale-90"><ICONS.Plus size={20}/></button>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {state.operators.map(o => (
                <div key={o} className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl flex items-center justify-between group hover:border-sky-500/30 transition-all">
                  {editingOp?.oldName === o ? (
                    <div className="flex-1 flex gap-2">
                      <input className="flex-1 bg-slate-800 border border-sky-500 rounded-lg px-3 py-1 text-sm text-white" value={editingOp.newName} onChange={e => setEditingOp({...editingOp, newName: e.target.value})} onKeyDown={e => e.key === 'Enter' && renameOperator()}/>
                      <button onClick={renameOperator} className="text-emerald-400"><ICONS.Lock size={16}/></button>
                    </div>
                  ) : (
                    <>
                      <span className="text-slate-200 font-bold">{o}</span>
                      <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => setEditingOp({ oldName: o, newName: o })} className="text-slate-500 hover:text-sky-400 transition-colors"><ICONS.Edit size={16}/></button>
                        <button onClick={() => removeOperator(o)} className="text-slate-500 hover:text-rose-500 transition-colors"><ICONS.Trash size={16}/></button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Управление анкет */}
          <div className="glass-card p-8 rounded-[32px] border-slate-800 shadow-xl space-y-6">
            <h2 className="text-xl font-bold font-outfit text-white flex items-center gap-3">
               <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400"><ICONS.Models size={20} /></div>
               Анкеты (Модели)
            </h2>
            <div className="flex gap-2">
               <input value={newModel} onChange={e => setNewModel(e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500 transition-all" placeholder="Название анкеты..."/>
               <button onClick={addModel} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 rounded-xl shadow-lg active:scale-90 transition-all"><ICONS.Plus size={20}/></button>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
               {state.models.map(m => (
                 <div key={m} className="bg-slate-900/50 border border-slate-800 p-4 rounded-2xl flex items-center justify-between group hover:border-indigo-500/30 transition-all">
                   {editingModel?.oldName === m ? (
                     <div className="flex-1 flex gap-2">
                       <input className="flex-1 bg-slate-800 border border-indigo-500 rounded-lg px-3 py-1 text-sm text-white" value={editingModel.newName} onChange={e => setEditingModel({...editingModel, newName: e.target.value})} onKeyDown={e => e.key === 'Enter' && renameModel()}/>
                       <button onClick={renameModel} className="text-emerald-400"><ICONS.Lock size={16}/></button>
                     </div>
                   ) : (
                     <>
                       <span className="text-slate-200 font-bold">{m}</span>
                       <div className="flex items-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                         <button onClick={() => setEditingModel({ oldName: m, newName: m })} className="text-slate-500 hover:text-indigo-400 transition-colors"><ICONS.Edit size={16}/></button>
                         <button onClick={() => removeModel(m)} className="text-slate-500 hover:text-rose-500 transition-colors"><ICONS.Trash size={16}/></button>
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
