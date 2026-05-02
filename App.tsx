
import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ICONS } from './constants';
import { createInitialState, saveLocal, syncToCloud, fetchFromCloud } from './store';
import { AppState } from './types';
import Dashboard from './pages/Dashboard';
import AddIncome from './pages/AddIncome';
import Operations from './pages/Operations';
import Reports from './pages/Reports';
import Models from './pages/Models';
import Roster from './pages/Roster';
import Owner from './pages/Owner';
import OwnerTable from './pages/OwnerTable';
import AdminTable from './pages/AdminTable';
import TotalTable from './pages/TotalTable';
import Settings from './pages/Settings';
import Metrics from './pages/Metrics';
import AdvanceRequest from './pages/AdvanceRequest';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>(createInitialState());
  const [isSyncing, setIsSyncing] = useState(false);
  const [cloudStatus, setCloudStatus] = useState<'idle' | 'loading' | 'success' | 'error' | 'conflict'>('idle');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [isCloudReady, setIsCloudReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('continental_auth') === 'true';
  });
  const [userRole, setUserRole] = useState<'user' | 'owner' | null>(() => {
    return localStorage.getItem('continental_role') as 'user' | 'owner' | null;
  });
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === '6690') {
      setIsAuthenticated(true);
      setUserRole('user');
      localStorage.setItem('continental_auth', 'true');
      localStorage.setItem('continental_role', 'user');
    } else if (password === '1123') {
      setIsAuthenticated(true);
      setUserRole('owner');
      localStorage.setItem('continental_auth', 'true');
      localStorage.setItem('continental_role', 'owner');
    } else {
      setError(true);
      setPassword('');
    }
  };

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
            // If already in success, keep it. Otherwise idle.
            setCloudStatus(prev => prev === 'success' ? 'success' : 'success');
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
        // Don't set cloudStatus to 'loading' for routine background syncs 
        // if we are already in a success state to prevent flickering
        if (cloudStatus !== 'success') {
          setCloudStatus('loading');
        }
        
        const result = await syncToCloud(state);
        
        if (result.success && result.newState) {
          setState(current => {
            if (current.version === versionAtStart) {
               // Only update if success was achieved
               setCloudStatus('success');
               setLastSyncTime(new Date().toLocaleTimeString());
               return result.newState!;
            }
            return current;
          });
        } else {
          setCloudStatus('error');
        }
        setIsSyncing(false);
      }, 10000); 
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

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="w-full max-w-md glass-card p-8 border border-slate-800/50 rounded-3xl shadow-2xl">
          <div className="flex flex-col items-center gap-6">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <ICONS.Lock className="text-white" size={32} />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-white mb-2">Continental Vault</h1>
              <p className="text-slate-400 text-sm">Введите пароль для доступа к системе</p>
            </div>
            <form onSubmit={handleLogin} className="w-full space-y-4">
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError(false);
                  }}
                  placeholder="Пароль"
                  className={`w-full bg-slate-900/50 border ${error ? 'border-rose-500' : 'border-slate-800'} text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all text-center text-xl tracking-[0.5em] font-mono`}
                  autoFocus
                />
                {error && <p className="text-rose-500 text-xs mt-2 text-center">Неверный пароль</p>}
              </div>
              <button
                type="submit"
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
              >
                Войти
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

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
            <NavLink to="/metrics" icon={<ICONS.Reports size={18} />} label="Метрика" />
            <NavLink to="/add-income" icon={<ICONS.Income size={18} />} label="Добавить доход" />
            <NavLink to="/advance-request" icon={<ICONS.HandCoins size={18} />} label="Запрос аванса" />
            <NavLink to="/operations" icon={<ICONS.Operations size={18} />} label="Операции" />
            <NavLink to="/reports" icon={<ICONS.Reports size={18} />} label="Отчеты" />
            <NavLink to="/models" icon={<ICONS.Models size={18} />} label="Модели" />
            <NavLink to="/roster" icon={<ICONS.Reports size={18} />} label="Состав" />
            <NavLink to="/total-table" icon={<ICONS.Transfer size={18} />} label="Total Table" admin />
            <NavLink to="/admin-table" icon={<ICONS.Internship size={18} />} label="Admin Table" admin />
            {userRole === 'owner' && (
              <>
                <NavLink to="/owner-table" icon={<ICONS.Calendar size={18} />} label="Core Table" premium />
                <NavLink to="/owner" icon={<ICONS.Owner size={18} />} label="Core Finance" premium />
              </>
            )}
            <NavLink to="/settings" icon={<ICONS.Settings size={18} />} label="Настройки" />
          </div>

          <div className="mt-auto pt-6 border-t border-slate-800 space-y-4">
            <button 
              onClick={() => {
                localStorage.removeItem('continental_auth');
                localStorage.removeItem('continental_role');
                window.location.reload();
              }}
              className="w-full flex items-center gap-3 px-4 py-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition-all text-xs font-bold group"
            >
              <ICONS.Unlock size={14} className="group-hover:scale-110 transition-transform" /> 
              Выйти из системы
            </button>

            {cloudStatus === 'conflict' && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.02 }}
                onClick={forcePull}
                className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl cursor-pointer shadow-[0_0_15px_rgba(244,63,94,0.1)] group transition-all"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></div>
                  <p className="text-[10px] font-black text-rose-500 uppercase tracking-wider">КОНФЛИКТ ДАННЫХ</p>
                </div>
                <p className="text-[10px] leading-relaxed text-slate-300 transition-colors group-hover:text-white">Напарник внес изменения. <span className="text-rose-400 font-bold underline underline-offset-2">Загрузить сейчас</span></p>
              </motion.div>
            )}

            <motion.div 
               layout
               className={`relative p-4 rounded-2xl border transition-all duration-500 overflow-hidden ${
                 cloudStatus === 'success' ? 'bg-emerald-500/[0.03] border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.05)]' : 
                 cloudStatus === 'loading' ? 'bg-amber-500/[0.03] border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.05)]' :
                 cloudStatus === 'conflict' ? 'bg-rose-500/[0.03] border-rose-500/20' : 
                 'bg-slate-900/40 border-white/[0.05]'
               }`}
            >
              {/* Background Glow */}
              <AnimatePresence mode="wait">
                <motion.div 
                  key={cloudStatus}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className={`absolute -right-4 -bottom-4 w-16 h-16 blur-2xl rounded-full opacity-20 pointer-events-none ${
                    cloudStatus === 'success' ? 'bg-emerald-500' :
                    cloudStatus === 'loading' ? 'bg-amber-500' :
                    cloudStatus === 'conflict' ? 'bg-rose-500' :
                    'bg-slate-500'
                  }`}
                />
              </AnimatePresence>

              <div className="relative flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-slate-500 uppercase font-black tracking-[0.2em] opacity-60">System Cloud</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[8px] font-mono text-slate-600 bg-white/[0.03] px-1.5 py-0.5 rounded border border-white/[0.05]">v.{state.version}</span>
                    <motion.div 
                      animate={cloudStatus === 'loading' ? { scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] } : {}}
                      transition={{ duration: 1.5, repeat: Infinity }}
                      className={`w-2 h-2 rounded-full shadow-[0_0_8px_rgba(0,0,0,0.5)] ${
                        cloudStatus === 'success' ? 'bg-emerald-500 shadow-emerald-500/40' : 
                        cloudStatus === 'loading' ? 'bg-amber-500 shadow-amber-500/40' : 
                        cloudStatus === 'conflict' ? 'bg-rose-500 shadow-rose-500/40' : 
                        'bg-slate-700'
                      }`}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-500 ${
                    cloudStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.1)]' :
                    cloudStatus === 'loading' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.1)]' :
                    cloudStatus === 'conflict' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.1)]' :
                    'bg-slate-800/50 border-white/[0.05] text-slate-500'
                  }`}>
                    {isSyncing || cloudStatus === 'loading' ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                        <ICONS.RotateCcw size={16} />
                      </motion.div>
                    ) : cloudStatus === 'success' ? (
                      <ICONS.Check size={18} />
                    ) : cloudStatus === 'conflict' ? (
                      <ICONS.AlertTriangle size={18} />
                    ) : (
                      <ICONS.Unlock size={16} />
                    )}
                  </div>
                  
                  <div className="flex flex-col min-w-0">
                    <span className={`text-[11px] font-black tracking-tight transition-colors duration-500 whitespace-nowrap overflow-hidden text-ellipsis ${
                      cloudStatus === 'success' ? 'text-emerald-400' :
                      cloudStatus === 'loading' ? 'text-amber-400' :
                      cloudStatus === 'conflict' ? 'text-rose-400' :
                      'text-slate-400'
                    }`}>
                      {cloudStatus === 'conflict' ? 'В ОБЛАКЕ НОВЕЕ!' : 
                       !state.syncUrl ? 'ЛОКАЛЬНЫЙ РЕЖИМ' : 
                       cloudStatus === 'success' ? 'СИНХРОНИЗИРОВАНО' :
                       cloudStatus === 'loading' ? 'ОБНОВЛЕНИЕ...' :
                       'ОЖИДАНИЕ...'}
                    </span>
                    <div className="flex items-center gap-1 opacity-50">
                       <ICONS.History size={8} className="text-slate-500" />
                       <span className="text-[9px] font-bold text-slate-500 uppercase">
                         {lastSyncTime || 'No history'}
                       </span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </nav>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
          <div className="max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard state={state} updateState={updateState} />} />
              <Route path="/metrics" element={<Metrics state={state} updateState={updateState} />} />
              <Route path="/add-income" element={<AddIncome state={state} updateState={updateState} />} />
              <Route path="/advance-request" element={<AdvanceRequest state={state} updateState={updateState} />} />
              <Route path="/operations" element={<Operations state={state} updateState={updateState} />} />
              <Route path="/reports" element={<Reports state={state} updateState={updateState} />} />
              <Route path="/models" element={<Models state={state} updateState={updateState} />} />
              <Route path="/roster" element={<Roster state={state} updateState={updateState} />} />
              {userRole === 'owner' && (
                <>
                  <Route path="/owner" element={<Owner state={state} updateState={updateState} />} />
                  <Route path="/owner-table" element={<OwnerTable state={state} updateState={updateState} />} />
                </>
              )}
              <Route path="/admin-table" element={<AdminTable state={state} updateState={updateState} />} />
              <Route path="/total-table" element={<TotalTable state={state} updateState={updateState} />} />
              <Route path="/settings" element={<Settings state={state} updateState={updateState} userRole={userRole} />} />
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
