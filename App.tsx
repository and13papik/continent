
import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { ICONS } from './constants';
import { createInitialState, saveLocal, syncToCloud, fetchFromCloud } from './store';
import { AppState } from './types';
import Dashboard from './pages/Dashboard';
import AddIncome from './pages/AddIncome';
import Operations from './pages/Operations';
import Reports from './pages/Reports';
import Models from './pages/Models';
import Owner from './pages/Owner';
import OwnerTable from './pages/OwnerTable';
import AdminTable from './pages/AdminTable';
import TotalTable from './pages/TotalTable';
import Settings from './pages/Settings';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(createInitialState());
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'conflict'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isCloudReady, setIsCloudReady] = useState(false);

  // 1. Первоначальная загрузка
  useEffect(() => {
    const initCloud = async () => {
      if (state.syncUrl && state.syncKey) {
        setCloudStatus('loading');
        try {
          const remoteData = await fetchFromCloud(state.syncUrl, state.syncKey);
          if (remoteData && (remoteData.version > state.version || remoteData.lastUpdated > state.lastUpdated)) {
            setState(prev => ({ 
              ...remoteData, 
              syncUrl: prev.syncUrl, 
              syncKey: prev.syncKey 
            }));
            setCloudStatus('success');
            setLastSyncTime(new Date().toLocaleTimeString());
          } else {
            setCloudStatus('idle');
          }
        } catch (e) {
          setCloudStatus('error');
        } finally {
          setIsCloudReady(true);
        }
      } else {
        setIsCloudReady(true);
      }
    };
    initCloud();
  }, []);

  // 2. Фоновый опрос для обнаружения изменений от других пользователей
  useEffect(() => {
    if (!state.syncUrl || !state.syncKey || !isCloudReady) return;

    const pollInterval = setInterval(async () => {
      try {
        const remoteData = await fetchFromCloud(state.syncUrl!, state.syncKey!);
        if (remoteData && remoteData.version > state.version) {
          setState(prev => ({ ...prev, remoteVersion: remoteData.version }));
          setCloudStatus('conflict');
        }
      } catch (e) {
        console.warn("Polling error", e);
      }
    }, 30000);

    return () => clearInterval(pollInterval);
  }, [state.version, state.syncUrl, state.syncKey, isCloudReady]);

  // 3. Авто-синхронизация с защитой от перезаписи
  useEffect(() => {
    saveLocal(state);
    
    if (state.syncUrl && state.syncKey && isCloudReady && !isSyncing) {
      const timer = setTimeout(async () => {
        const versionAtStart = state.version; 
        
        setIsSyncing(true);
        setCloudStatus('loading');
        
        const result = await syncToCloud(state);
        
        if (result.success && result.newState) {
          setState(current => {
            if (current.version === versionAtStart) {
               setCloudStatus('success');
               setLastSyncTime(new Date().toLocaleTimeString());
               return result.newState;
            }
            console.log("Sync result discarded: local state changed during request");
            return current;
          });
        } else {
          setCloudStatus('error');
        }
        setIsSyncing(false);
      }, 5000); 
      return () => clearTimeout(timer);
    }
  }, [state.version, state.syncUrl, state.syncKey, isCloudReady]);

  const updateState = useCallback((updater: (prev: AppState) => AppState) => {
    setState(prev => {
      const newState = updater(prev);
      return { 
        ...newState, 
        lastUpdated: Date.now(),
        version: (prev.version || 0) + 1,
        remoteVersion: undefined 
      };
    });
  }, []);

  const forcePull = async () => {
    if (!state.syncUrl || !state.syncKey) return;
    setCloudStatus('loading');
    const remoteData = await fetchFromCloud(state.syncUrl, state.syncKey);
    if (remoteData) {
      updateState(() => ({ ...remoteData, syncUrl: state.syncUrl, syncKey: state.syncKey }));
      setCloudStatus('success');
      alert('Данные обновлены до последней версии из облака.');
    }
  };

  return (
    <HashRouter>
      <div className="flex flex-col md:flex-row min-h-screen bg-slate-950 text-slate-200">
        <nav className="w-full md:w-64 glass-card border-r border-slate-800/50 p-6 flex flex-col gap-8 sticky top-0 h-auto md:h-screen z-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <span className="text-white font-outfit text-xl font-bold">C</span>
            </div>
            <span className="font-outfit text-xl font-bold tracking-tight text-white leading-none">Continental<br/><span className="text-xs text-indigo-400 font-normal text-[10px]">Cloud Vault</span></span>
          </div>

          <div className="flex flex-col gap-2">
            <NavLink to="/" icon={<ICONS.Dashboard size={18} />} label="Dashboard" />
            <NavLink to="/add-income" icon={<ICONS.Income size={18} />} label="Добавить доход" />
            <NavLink to="/operations" icon={<ICONS.Operations size={18} />} label="Операции" />
            <NavLink to="/reports" icon={<ICONS.Reports size={18} />} label="Отчеты" />
            <NavLink to="/models" icon={<ICONS.Models size={18} />} label="Модели" />
            <NavLink to="/total-table" icon={<ICONS.Transfer size={18} />} label="Total Table" admin />
            <NavLink to="/admin-table" icon={<ICONS.Internship size={18} />} label="Admin Table" admin />
            <NavLink to="/owner-table" icon={<ICONS.Calendar size={18} />} label="Core Table" premium />
            <NavLink to="/owner" icon={<ICONS.Owner size={18} />} label="Core Finance" premium />
            <NavLink to="/settings" icon={<ICONS.Settings size={18} />} label="Настройки" />
          </div>

          <div className="mt-auto pt-6 border-t border-slate-800 space-y-4">
            {cloudStatus === 'conflict' && (
              <div className="p-3 bg-rose-500/20 border border-rose-500 rounded-xl animate-pulse cursor-pointer" onClick={forcePull}>
                <p className="text-[10px] font-black text-rose-500 uppercase mb-1 flex items-center gap-1">
                  <ICONS.AlertTriangle size={10} /> Конфликт версий!
                </p>
                <p className="text-[9px] text-slate-300">Напарник внес изменения. Нажми сюда, чтобы загрузить их.</p>
              </div>
            )}

            <div className="p-3 bg-slate-900/40 rounded-2xl border border-slate-800/50">
              <div className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-2 flex items-center justify-between">
                Cloud Sync (v.{state.version})
                <div className={`w-2 h-2 rounded-full shadow-sm ${cloudStatus === 'success' ? 'bg-emerald-500 shadow-emerald-500/20' : cloudStatus === 'loading' ? 'bg-amber-500 animate-pulse' : cloudStatus === 'conflict' ? 'bg-rose-500' : 'bg-slate-700'}`}></div>
              </div>
              <div className="flex items-center gap-2">
                 {cloudStatus === 'loading' ? (
                   <div className="animate-spin text-indigo-400"><ICONS.RotateCcw size={12} /></div>
                 ) : cloudStatus === 'success' ? (
                   <div className="text-emerald-500"><ICONS.Lock size={12} /></div>
                 ) : cloudStatus === 'conflict' ? (
                   <div className="text-rose-500"><ICONS.AlertTriangle size={12} /></div>
                 ) : (
                   <div className="text-slate-500"><ICONS.Unlock size={12} /></div>
                 )}
                 <div className="flex flex-col">
                    <span className="text-[11px] font-bold text-slate-300">
                      {cloudStatus === 'conflict' ? 'В облаке новее!' : !state.syncUrl ? 'Локальный режим' : 'Облако активно'}
                    </span>
                    {lastSyncTime && <span className="text-[9px] text-slate-500">{lastSyncTime}</span>}
                 </div>
              </div>
            </div>
          </div>
        </nav>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
          <div className="max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard state={state} updateState={updateState} />} />
              <Route path="/add-income" element={<AddIncome state={state} updateState={updateState} />} />
              <Route path="/operations" element={<Operations state={state} updateState={updateState} />} />
              <Route path="/reports" element={<Reports state={state} updateState={updateState} />} />
              <Route path="/models" element={<Models state={state} updateState={updateState} />} />
              <Route path="/owner" element={<Owner state={state} updateState={updateState} />} />
              <Route path="/owner-table" element={<OwnerTable state={state} updateState={updateState} />} />
              <Route path="/admin-table" element={<AdminTable state={state} updateState={updateState} />} />
              <Route path="/total-table" element={<TotalTable state={state} updateState={updateState} />} />
              <Route path="/settings" element={<Settings state={state} updateState={updateState} />} />
            </Routes>
          </div>
        </main>
      </div>
    </HashRouter>
  );
};

const NavLink: React.FC<{ to: string; icon: React.ReactNode; label: string; premium?: boolean; admin?: boolean }> = ({ to, icon, label, premium, admin }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  let activeClass = 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30';
  let hoverClass = 'text-slate-500 hover:bg-slate-900 hover:text-slate-100';
  let iconClass = 'text-slate-600 group-hover:text-indigo-400';

  if (premium) {
    activeClass = 'bg-amber-600 text-white shadow-lg shadow-amber-600/30';
    hoverClass = 'text-amber-500/70 hover:bg-amber-500/10 hover:text-amber-400';
    iconClass = 'text-amber-500/50';
  }

  if (admin) {
    activeClass = 'bg-sky-600 text-white shadow-lg shadow-sky-600/30';
    hoverClass = 'text-sky-500/70 hover:bg-sky-500/10 hover:text-sky-400';
    iconClass = 'text-sky-500/50';
  }

  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 group ${
        isActive ? activeClass : hoverClass
      }`}
    >
      <span className={`transition-all duration-300 ${isActive ? 'text-white scale-110' : iconClass + ' group-hover:scale-110'}`}>
        {icon}
      </span>
      <span className={`font-semibold text-sm tracking-tight ${isActive ? 'text-white' : ''}`}>{label}</span>
    </Link>
  );
};

export default App;
