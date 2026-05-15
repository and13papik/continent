
import React, { useState, useEffect, useCallback } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ICONS } from './constants';
import { createInitialState, saveLocal, syncToCloud, fetchFromCloud } from './store';
import { AppState } from './types';
import PeriodSelector from './components/PeriodSelector';
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
        <nav className="w-full md:w-56 bg-slate-950/80 backdrop-blur-xl border-r border-white/5 p-3 flex flex-col gap-1 sticky top-0 h-auto md:h-screen overflow-y-auto custom-scrollbar z-50">
          <div className="flex items-center gap-2.5 px-2 py-3 mb-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center shadow-[0_5px_15px_-5px_rgba(79,70,229,0.5)] shrink-0 group hover:rotate-12 transition-transform">
              <span className="text-white font-outfit text-base font-black">C</span>
            </div>
            <div className="flex flex-col min-w-0">
               <span className="font-outfit text-lg font-black tracking-tight text-white leading-none truncate">Continental</span>
               <span className="text-[7px] font-black uppercase tracking-[0.2em] text-slate-500 mt-1">Management Hub</span>
            </div>
          </div>

          <PeriodSelector state={state} updateState={updateState} />

          {cloudStatus === 'conflict' && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={forcePull}
              className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl cursor-pointer group transition-all mb-2"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></div>
                <p className="text-[8px] font-black text-rose-500 uppercase tracking-widest">Update Required</p>
              </div>
              <p className="text-[9px] font-bold text-slate-400 group-hover:text-white transition-colors">Sync conflict detected. <span className="text-rose-400 underline underline-offset-2">Fix now</span></p>
            </motion.div>
          )}

          <div 
             className={`relative p-2.5 rounded-2xl border transition-all duration-700 overflow-hidden mb-4 ${
               cloudStatus === 'success' ? 'bg-emerald-500/[0.03] border-emerald-500/20 shadow-[0_0_20px_-10px_rgba(16,185,129,0.2)]' : 
               cloudStatus === 'loading' ? 'bg-amber-500/[0.03] border-amber-500/20' :
               cloudStatus === 'conflict' ? 'bg-rose-500/[0.03] border-rose-500/20' : 
               'bg-slate-900/40 border-white/5'
             }`}
          >
            <div className="relative flex items-center gap-3">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border transition-all duration-500 ${
                cloudStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-inner' :
                cloudStatus === 'loading' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                cloudStatus === 'conflict' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                'bg-slate-800/50 border-white/5 text-slate-500'
              }`}>
                {isSyncing || cloudStatus === 'loading' ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                    <ICONS.RotateCcw size={12} />
                  </motion.div>
                ) : cloudStatus === 'success' ? (
                  <ICONS.Check size={14} />
                ) : cloudStatus === 'conflict' ? (
                  <ICONS.AlertTriangle size={14} />
                ) : (
                  <ICONS.Unlock size={12} />
                )}
              </div>
              
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-[7.5px] text-slate-500 uppercase font-black tracking-widest opacity-60">Status</span>
                  <div className={`w-1 h-1 rounded-full ${
                    cloudStatus === 'success' ? 'bg-emerald-500' : 
                    cloudStatus === 'loading' ? 'bg-amber-500' : 
                    cloudStatus === 'conflict' ? 'bg-rose-500' : 
                    'bg-slate-700'
                  }`} />
                </div>
                <span className={`text-[8.5px] font-black tracking-wider transition-colors duration-500 truncate uppercase ${
                  cloudStatus === 'success' ? 'text-emerald-400' :
                  cloudStatus === 'loading' ? 'text-amber-400' :
                  cloudStatus === 'conflict' ? 'text-rose-400 font-bold' :
                  'text-slate-400'
                }`}>
                  {cloudStatus === 'conflict' ? 'CONFLICT' : 
                   !state.syncUrl ? 'OFFLINE' : 
                   cloudStatus === 'success' ? 'SYNCED' :
                   isSyncing || cloudStatus === 'loading' ? 'PENDING' :
                   'WAITING'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 flex-1">
            <div className="my-2 px-3 py-1">
               <div className="text-[7px] font-black uppercase tracking-[0.2em] text-slate-600 mb-3 ml-1">Главные действия</div>
               <div className="space-y-3">
                  <NavLink 
                    to="/add-income" 
                    icon={<ICONS.Plus size={16} />} 
                    label="Добавить доход" 
                    action 
                  />
                  <NavLink 
                    to="/advance-request" 
                    icon={<ICONS.HandCoins size={16} />} 
                    label="Запрос аванса" 
                    action
                    variant="amber"
                  />
               </div>
            </div>

            <div className="mt-4 mb-2 px-3 flex items-center gap-2 opacity-30">
               <div className="h-[1px] flex-1 bg-slate-800" />
               <span className="text-[7px] font-bold uppercase tracking-widest text-slate-400">Навигация</span>
               <div className="h-[1px] flex-1 bg-slate-800" />
            </div>

            <NavLink to="/" icon={<ICONS.Dashboard size={14} />} label="Dashboard" />
            <NavLink to="/metrics" icon={<ICONS.Reports size={14} />} label="Метрика" />
            <NavLink to="/operations" icon={<ICONS.Operations size={14} />} label="Операции" />
            <NavLink to="/reports" icon={<ICONS.Reports size={14} />} label="Отчеты" />
            <NavLink to="/models" icon={<ICONS.Models size={14} />} label="Модели" />
            <NavLink to="/roster" icon={<ICONS.Reports size={14} />} label="Состав" />
            
            <div className="mt-4 mb-2 px-3 flex items-center gap-2 opacity-30">
               <div className="h-[1px] flex-1 bg-slate-800" />
               <span className="text-[7px] font-bold uppercase tracking-widest text-slate-400">Admin Area</span>
               <div className="h-[1px] flex-1 bg-slate-800" />
            </div>

            <NavLink to="/total-table" icon={<ICONS.Transfer size={14} />} label="Total Table" admin />
            <NavLink to="/admin-table" icon={<ICONS.Internship size={14} />} label="Admin Table" admin />
            
            {userRole === 'owner' && (
              <>
                <NavLink to="/owner-table" icon={<ICONS.Calendar size={14} />} label="Core Table" premium />
                <NavLink to="/owner" icon={<ICONS.Owner size={14} />} label="Core Finance" premium />
              </>
            )}
            <NavLink to="/settings" icon={<ICONS.Settings size={14} />} label="Настройки" />
          </div>

          <div className="mt-auto pt-4 border-t border-white/5 pb-2">
            <button 
              onClick={() => {
                localStorage.removeItem('continental_auth');
                localStorage.removeItem('continental_role');
                window.location.reload();
              }}
              className="w-full flex items-center justify-center gap-2.5 px-3 py-3 text-slate-500 hover:text-white hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-2xl transition-all text-[9px] font-black uppercase tracking-[0.2em] group"
            >
              <ICONS.Unlock size={12} className="group-hover:rotate-12 transition-transform" /> 
              <span>Выйти из HUB</span>
            </button>
          </div>
        </nav>

        <main className="flex-1 p-4 md:p-8 overflow-y-auto bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950">
          <div className="max-w-7xl mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard state={state} updateState={updateState} userRole={userRole} />} />
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

const NavLink: React.FC<{ 
  to: string; 
  icon: React.ReactNode; 
  label: string; 
  premium?: boolean; 
  admin?: boolean;
  action?: boolean;
  variant?: 'indigo' | 'amber' | 'emerald';
}> = ({ to, icon, label, premium, admin, action, variant = 'indigo' }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  if (action) {
    const isAmber = variant === 'amber';
    
    // Premium color palettes
    const shadowColor = isAmber ? 'rgba(245, 158, 11, 0.4)' : 'rgba(99, 102, 241, 0.4)';
    const accentColor = isAmber ? 'from-amber-400 via-amber-500 to-orange-600' : 'from-indigo-400 via-indigo-500 to-blue-600';
    const borderActive = isAmber ? 'border-amber-400/50' : 'border-indigo-400/50';
    const borderHover = isAmber ? 'border-white/10' : 'border-white/10';
    const lightText = isAmber ? 'text-amber-400' : 'text-indigo-400';

    return (
      <Link
        to={to}
        className="relative group block"
      >
        <motion.div
          whileHover={{ y: -1, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className={`relative flex items-center gap-3 px-4 py-3 rounded-2xl border transition-all duration-500 backdrop-blur-xl overflow-hidden
            ${isActive 
              ? `bg-gradient-to-br ${accentColor} ${borderActive} shadow-[0_10px_25px_-5px_${shadowColor}]` 
              : `bg-slate-950/40 border-white/5 ${borderHover} hover:bg-white/5`
            }`}
        >
          {/* Subtle Shine */}
          <motion.div 
            animate={isActive ? { x: ['-100%', '200%'] } : {}}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'linear', repeatDelay: 2 }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -rotate-45 pointer-events-none"
          />

          {/* Icon Container - Smaller and more refined */}
          <div className={`relative z-10 w-8 h-8 rounded-xl flex items-center justify-center transition-all duration-500 shadow-inner
            ${isActive 
              ? 'bg-white/20 text-white shadow-xl' 
              : `bg-slate-900 ${lightText} group-hover:scale-105 group-hover:rotate-3`
            }`}
          >
            {React.cloneElement(icon as React.ReactElement, { size: 14 })}
          </div>

          {/* Text - Compact spacing */}
          <div className="relative z-10 flex flex-col -space-y-0.5">
            <span className={`font-black text-[9px] uppercase tracking-[0.15em] transition-colors duration-300
              ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'}`}
            >
              {label}
            </span>
            <span className={`text-[6px] font-bold uppercase tracking-widest
              ${isActive ? 'text-white/50' : 'text-slate-600'}`}
            >
              {isAmber ? 'Fast Transfer' : 'Instant Protocol'}
            </span>
          </div>

          {/* Minimal Arrow indicator */}
          {!isActive && (
            <div className={`ml-auto opacity-0 group-hover:opacity-100 transition-all duration-500 translate-x-2 group-hover:translate-x-0 text-white/40`}>
               <ICONS.ChevronRight size={10} />
            </div>
          )}
          
          {isActive && (
             <div className="ml-auto w-1 h-1 rounded-full bg-white shadow-[0_0_8px_white] animate-pulse" />
          )}
        </motion.div>
      </Link>
    );
  }

  let activeBg = 'bg-indigo-500 shadow-[0_0_20px_-5px_rgba(99,102,241,0.5)]';
  let activeText = 'text-white';
  let inactiveText = 'text-slate-500 hover:text-slate-300';
  let iconActiveColor = 'text-white';
  let iconInactiveColor = 'text-slate-600 group-hover:text-indigo-400';
  let indicatorColor = 'bg-indigo-400';

  if (premium) {
    activeBg = 'bg-amber-500 shadow-[0_0_20px_-5px_rgba(245,158,11,0.5)]';
    inactiveText = 'text-amber-500/70 hover:text-amber-400';
    iconInactiveColor = 'text-amber-600/50 group-hover:text-amber-400';
    indicatorColor = 'bg-amber-400';
  }

  if (admin) {
    activeBg = 'bg-sky-500 shadow-[0_0_20px_-5px_rgba(14,165,233,0.5)]';
    inactiveText = 'text-sky-500/70 hover:text-sky-400';
    iconInactiveColor = 'text-sky-600/50 group-hover:text-sky-400';
    indicatorColor = 'bg-sky-400';
  }

  return (
    <Link
      to={to}
      className={`relative flex items-center gap-3 px-3 py-1.5 rounded-xl transition-all duration-500 group overflow-hidden ${
        isActive ? activeBg + ' ' + activeText : inactiveText
      }`}
    >
      {/* Active Indicator Bar */}
      {isActive && (
        <motion.div 
          layoutId="active-nav-indicator"
          className={`absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full ${indicatorColor}`}
        />
      )}

      {/* Hover Background Glow */}
      <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      <span className={`transition-all duration-500 shrink-0 relative z-10 ${isActive ? iconActiveColor + ' scale-110' : iconInactiveColor + ' group-hover:scale-110'}`}>
        {icon}
      </span>
      
      <span className={`font-black text-[9.5px] uppercase tracking-[0.1em] truncate relative z-10 ${isActive ? 'text-white' : ''}`}>
        {label}
      </span>

      {/* Shine Effect Animation */}
      {isActive && (
        <motion.div 
          animate={{ x: ['-100%', '200%'] }} 
          transition={{ duration: 1.5, repeat: Infinity, ease: 'linear', repeatDelay: 3 }}
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -rotate-45 pointer-events-none"
        />
      )}
    </Link>
  );
};

export default App;
