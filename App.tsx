
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
        <nav className="w-full md:w-64 bg-slate-950/80 backdrop-blur-3xl border-r border-white/5 flex flex-col sticky top-0 h-auto md:h-screen z-50 overflow-hidden">
          {/* Header Section */}
          <div className="p-6 shrink-0">
            <div className="flex items-center gap-3.5 mb-8">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-blue-700 rounded-xl flex items-center justify-center shadow-[0_8px_20px_-5px_rgba(79,70,229,0.5)] shrink-0 group hover:rotate-12 transition-transform cursor-pointer">
                <span className="text-white font-outfit text-xl font-black">C</span>
              </div>
              <div className="flex flex-col min-w-0">
                 <span className="font-outfit text-xl font-black tracking-tighter text-white leading-none truncate">Continental</span>
                 <span className="text-[8px] font-black uppercase tracking-[0.3em] text-slate-500 mt-1.5 opacity-80">Management Hub</span>
              </div>
            </div>

            {location.pathname !== '/reports' && <PeriodSelector state={state} updateState={updateState} />}

            {cloudStatus === 'conflict' && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={forcePull}
                className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl cursor-pointer group transition-all mt-4 hover:bg-rose-500/20"
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse"></div>
                  <p className="text-[9px] font-black text-rose-500 uppercase tracking-widest leading-none">Sync Conflict</p>
                </div>
                <p className="text-[10px] font-bold text-slate-400 group-hover:text-white transition-colors">Manual override required.</p>
              </motion.div>
            )}
          </div>

          {/* Scrollable Navigation Section */}
          <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-2 space-y-8">
            <div className="space-y-4">
               <div className="flex items-center justify-between px-1">
                  <div className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-400/60">Fast Access</div>
                  <div className="w-1 h-1 rounded-full bg-indigo-500/40" />
               </div>
               
               <div className="grid grid-cols-2 gap-3">
                  <NavLink 
                    to="/add-income" 
                    icon={<ICONS.Plus size={18} />} 
                    label="Доход" 
                    action 
                    subLabel="NEW"
                  />
                  <NavLink 
                    to="/advance-request" 
                    icon={<ICONS.HandCoins size={18} />} 
                    label="Аванс" 
                    action
                    variant="amber"
                    subLabel="REQ"
                  />
               </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-3 mb-4 px-1">
                 <span className="text-[7.5px] font-black uppercase tracking-[0.3em] text-slate-700 whitespace-nowrap">Main Navigation</span>
                 <div className="h-[1px] flex-1 bg-slate-900" />
              </div>
              <NavLink to="/" icon={<ICONS.Dashboard size={14} />} label="Dashboard" primary />
              <NavLink to="/metrics" icon={<ICONS.Reports size={14} />} label="Метрика" />
              <NavLink to="/operations" icon={<ICONS.Operations size={14} />} label="Операции" />
              <NavLink to="/reports" icon={<ICONS.Reports size={14} />} label="Операторская" />
              <NavLink to="/models" icon={<ICONS.Models size={14} />} label="Модели" />
              <NavLink to="/roster" icon={<ICONS.Reports size={14} />} label="Состав" />
            </div>
            
            <div className="space-y-1">
              <div className="flex items-center gap-2 mb-3 px-1">
                 <span className="text-[7px] font-bold uppercase tracking-[0.3em] text-slate-700 whitespace-nowrap">Admin Area</span>
                 <div className="h-[1px] flex-1 bg-slate-900" />
              </div>
              <NavLink to="/total-table" icon={<ICONS.Transfer size={14} />} label="Total Table" admin />
              <NavLink to="/admin-table" icon={<ICONS.Internship size={14} />} label="Admin Table" admin />
              
              {userRole === 'owner' && (
                <>
                  <NavLink to="/owner-table" icon={<ICONS.Calendar size={14} />} label="Core Table" premium />
                  <NavLink to="/owner" icon={<ICONS.Owner size={14} />} label="Core Finance" premium />
                </>
              )}
            </div>

            <div className="pb-6">
              <NavLink to="/settings" icon={<ICONS.Settings size={14} />} label="Настройки" />
            </div>
          </div>

          {/* Fixed Status Footer Area */}
          <div className="p-4 shrink-0 bg-slate-950/90 backdrop-blur-xl border-t border-white/5 space-y-3">
            <div 
              className={`relative p-3 rounded-2xl border transition-all duration-700 overflow-hidden ${
                cloudStatus === 'success' ? 'bg-emerald-500/[0.03] border-emerald-500/20 shadow-[0_0_20px_-10px_rgba(16,185,129,0.2)]' : 
                cloudStatus === 'loading' ? 'bg-amber-500/[0.03] border-amber-500/20' :
                cloudStatus === 'conflict' ? 'bg-rose-500/[0.03] border-rose-500/20' : 
                'bg-slate-900/40 border-white/5'
              }`}
            >
              <div className="relative flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border transition-all duration-500 ${
                  cloudStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 shadow-inner' :
                  cloudStatus === 'loading' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                  cloudStatus === 'conflict' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                  'bg-slate-800/50 border-white/5 text-slate-500'
                }`}>
                  {isSyncing || cloudStatus === 'loading' ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                      <ICONS.RotateCcw size={14} />
                    </motion.div>
                  ) : cloudStatus === 'success' ? (
                    <ICONS.Check size={16} />
                  ) : cloudStatus === 'conflict' ? (
                    <ICONS.AlertTriangle size={16} />
                  ) : (
                    <ICONS.Unlock size={14} />
                  )}
                </div>
                
                <div className="flex flex-col min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[7.5px] text-slate-500 uppercase font-black tracking-widest opacity-60">Database Hub</span>
                    <div className={`w-1 h-1 rounded-full ${
                      cloudStatus === 'success' ? 'bg-emerald-500' : 
                      cloudStatus === 'loading' ? 'bg-amber-500' : 
                      cloudStatus === 'conflict' ? 'bg-rose-500' : 
                      'bg-slate-700'
                    }`} />
                  </div>
                  <span className={`text-[9px] font-black tracking-wider transition-colors duration-500 truncate uppercase ${
                    cloudStatus === 'success' ? 'text-emerald-400' :
                    cloudStatus === 'loading' ? 'text-amber-400' :
                    cloudStatus === 'conflict' ? 'text-rose-400 font-bold' :
                    'text-slate-400'
                  }`}>
                    {cloudStatus === 'conflict' ? 'SYNC CONFLICT' : 
                     !state.syncUrl ? 'CLOUD OFFLINE' : 
                     cloudStatus === 'success' ? 'SYSTEM ONLINE' :
                     isSyncing || cloudStatus === 'loading' ? 'SYNCING...' :
                     'HUB STANDBY'}
                  </span>
                </div>
              </div>
            </div>

            <button 
              onClick={() => {
                localStorage.removeItem('continental_auth');
                localStorage.removeItem('continental_role');
                window.location.reload();
              }}
              className="w-full flex items-center justify-center gap-3 px-3 py-3.5 text-slate-500 hover:text-white hover:bg-rose-500/10 border border-transparent hover:border-rose-500/20 rounded-2xl transition-all text-[9.5px] font-black uppercase tracking-[0.2em] group"
            >
              <ICONS.Unlock size={14} className="group-hover:rotate-12 transition-transform" /> 
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
  subLabel?: string;
  primary?: boolean;
}> = ({ to, icon, label, premium, admin, action, variant = 'indigo', subLabel, primary }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  if (action) {
    const isAmber = variant === 'amber';
    
    // Sophisticated color palette
    const shadowColor = isAmber ? 'rgba(217, 119, 6, 0.4)' : 'rgba(79, 70, 229, 0.4)';
    const accentColor = isAmber ? 'from-amber-400 via-amber-500 to-orange-600' : 'from-indigo-400 via-indigo-500 to-blue-700';
    const borderActive = isAmber ? 'border-amber-400/40' : 'border-indigo-400/40';
    const borderHover = isAmber ? 'border-amber-500/20' : 'border-indigo-500/20';
    const lightText = isAmber ? 'text-amber-500' : 'text-indigo-400';

    return (
      <Link
        to={to}
        className="relative group block"
      >
        <motion.div
          whileHover={{ y: -2, scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          className={`relative flex flex-col items-center justify-center py-4 px-2 rounded-[1.75rem] border transition-all duration-500 backdrop-blur-2xl overflow-hidden
            ${isActive 
              ? `bg-gradient-to-br ${accentColor} ${borderActive} shadow-[0_15px_30px_-8px_${shadowColor}]` 
              : `bg-slate-900/40 border-white/5 ${borderHover} hover:bg-slate-900`
            }`}
        >
          {/* Internal Glow */}
          {isActive && (
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_0%,white,transparent_70%)]" />
            </div>
          )}

          {/* Luxury Shine Effect */}
          <motion.div 
            animate={isActive ? { x: ['-100%', '250%'] } : {}}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -rotate-45 pointer-events-none"
          />

          {/* Refined Icon Stage */}
          <div className={`relative z-10 w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-700 shadow-xl mb-2
            ${isActive 
              ? 'bg-white/10 text-white backdrop-blur-md border border-white/20' 
              : `bg-slate-950 ${lightText} border border-white/5 group-hover:scale-110`
            }`}
          >
            {React.cloneElement(icon as React.ReactElement, { size: 18 })}
          </div>

          {/* Typography */}
          <div className="relative z-10 flex flex-col items-center -space-y-0.5">
            <span className={`font-black text-[9px] uppercase tracking-[0.15em] transition-colors duration-500
              ${isActive ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}
            >
              {label}
            </span>
            <span className={`text-[6px] font-black uppercase tracking-[0.2em] opacity-40 transition-all duration-500
              ${isActive ? 'text-white translate-y-0' : 'text-slate-500 translate-y-0.5 group-hover:translate-y-0 group-hover:opacity-80'}`}
            >
              {subLabel || 'SELECT'}
            </span>
          </div>

          {/* Small Indicator */}
          {isActive && (
             <div className="absolute top-1.5 right-1.5 w-1 h-1 rounded-full bg-white shadow-[0_0_8px_white] animate-pulse" />
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

  if (primary) {
    activeBg = 'bg-indigo-600/30 border border-indigo-400/40 shadow-[0_15px_40px_-10px_rgba(79,70,229,0.4)] backdrop-blur-2xl px-5 py-4 mb-6 rounded-2xl';
    activeText = 'text-white font-black';
    inactiveText = 'text-slate-400 hover:text-white border border-white/5 mb-6 py-4 px-5 bg-slate-950/40 hover:bg-slate-900 shadow-xl rounded-2xl transition-all';
    iconActiveColor = 'text-indigo-400';
    iconInactiveColor = 'text-slate-600 group-hover:text-indigo-400 group-hover:scale-110';
    indicatorColor = 'bg-indigo-400';
  }

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
      className={`relative flex items-center gap-3 transition-all duration-500 group overflow-hidden ${
        primary ? '' : 'px-3 py-1.5 rounded-xl '
      }${isActive ? activeBg + ' ' + activeText : inactiveText}`}
    >
      {/* Active Indicator Bar */}
      {isActive && !primary && (
        <motion.div 
          layoutId="active-nav-indicator"
          className={`absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full ${indicatorColor}`}
        />
      )}

      {/* Hover Background Glow */}
      {!isActive && !primary && (
        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
      )}

      <span className={`transition-all duration-500 shrink-0 relative z-10 ${isActive ? iconActiveColor + ' scale-110' : iconInactiveColor}`}>
        {React.cloneElement(icon as React.ReactElement, { size: primary ? 18 : 14 })}
      </span>
      
      <span className={`font-black uppercase tracking-[0.1em] truncate relative z-10 ${primary ? 'text-[11px]' : 'text-[9.5px]'} ${isActive ? activeText : ''}`}>
        {label}
      </span>

      {/* Primary Badge */}
      {primary && !isActive && (
        <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.5)]" />
      )}

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
