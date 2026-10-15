import React, { lazy, Suspense, useState } from 'react';
import { HashRouter, Routes, Route, Link, NavLink, Navigate, useLocation } from 'react-router-dom';
import { LayoutDashboard, ChartNoAxesCombined, ArrowLeftRight, Headphones, UserRound, UsersRound, Table2, CalendarDays, Landmark, Settings2, Wallet, Banknote, Plus, LogOut, Check, RefreshCw, AlertTriangle, Menu, X, Sun, Moon } from 'lucide-react';
import { useCloudState } from './useCloudState';
import AuthGate, { SignedInUser } from './AuthGate';
import AccountMenu from './components/AccountMenu';
import PeriodSelector from './components/PeriodSelector';
import SyncRecovery from './components/SyncRecovery';
import SyncStatus from './components/SyncStatus';
import { useTheme, Theme } from './useTheme';
import './refined.css';
import './legacy-theme.css';
const Dashboard = lazy(() => import('./pages/Dashboard'));
const OperatorPayroll = lazy(() => import('./pages/OperatorPayroll'));
const AddIncome = lazy(() => import('./pages/AddIncome'));
const Operations = lazy(() => import('./pages/Operations'));
const Models = lazy(() => import('./pages/Models'));
const Roster = lazy(() => import('./pages/Roster'));
const Owner = lazy(() => import('./pages/Owner'));
const OwnerTable = lazy(() => import('./pages/OwnerTable'));
const AdminTable = lazy(() => import('./pages/AdminTable'));
const TotalTable = lazy(() => import('./pages/TotalTable'));
const Settings = lazy(() => import('./pages/Settings'));
const Metrics = lazy(() => import('./pages/Metrics'));
const AdvanceRequest = lazy(() => import('./pages/AdvanceRequest'));

export default function App() {
  const appearance = useTheme();
  return <AuthGate>{user => <HashRouter><DashboardApp key={`${user.id}:${user.role}`} user={user} {...appearance} /></HashRouter>}</AuthGate>;
}

function DashboardApp({ user, theme, setTheme }: { user: SignedInUser; theme: Theme; setTheme: (theme: Theme) => void }) {
  const { state, updateState, isSyncing, cloudStatus, lastSyncTime, refreshCloudStatus, recoveries, resolveRecovery, mutationError } = useCloudState({ syncUrl: user.cloudUrl, syncKey: 'server-session' }, user.role);
  const userRole = user.role === 'owner' ? 'owner' : 'user';
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const refinedPage = ['/', '/operator-payroll', '/operations', '/models', '/roster', '/total-table', '/metrics'].includes(location.pathname);
  const sectionTitle: Record<string, string> = { '/': 'Обзор', '/operator-payroll': 'ЗП операторов', '/metrics': 'Метрика', '/operations': 'Операции', '/reports': 'ЗП операторов', '/models': 'Модели', '/roster': 'Состав', '/owner': 'Owners', '/owner-table': 'Core Table', '/total-table': 'Total Table', '/admin-table': 'Admin Table', '/settings': 'Настройки', '/add-income': 'Доход', '/advance-request': 'Аванс' };
  const themeToggle = <div className="ct-theme-toggle" role="group" aria-label="Цветовая тема"><button aria-pressed={theme === 'light'} onClick={() => setTheme('light')}><Sun size={15} />Светлая</button><button aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}><Moon size={15} />Тёмная</button></div>;
  const headerControls = <div className="ct-header-controls">{themeToggle}<AccountMenu user={user} /></div>;
  return <div className="ct-shell">
    <nav className="ct-sidebar" aria-label="Основное меню">
      <div className="ct-sidebar-top"><div className="ct-brand-block"><Link to="/" className="ct-brand" onClick={() => setMenuOpen(false)}><span className="ct-logo">C</span>Continental</Link><PeriodSelector state={state} updateState={updateState} compact /></div><button className="ct-menu-toggle ct-button" aria-label={menuOpen ? 'Закрыть меню' : 'Открыть меню'} aria-expanded={menuOpen} aria-controls="ct-navigation" onClick={() => setMenuOpen(value => !value)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button></div>
      <div className={`ct-sidebar-body ${menuOpen ? 'is-open' : ''}`} id="ct-navigation">
        <div className="ct-sidebar-quick"><Link className="ct-quick-action ct-quick-income" to="/add-income" onClick={() => setMenuOpen(false)}><span aria-hidden="true"><Plus size={16} /></span>Доход</Link><Link className="ct-quick-action ct-quick-advance" to="/advance-request" onClick={() => setMenuOpen(false)}><span aria-hidden="true"><Wallet size={16} /></span>Аванс</Link></div>
        {cloudStatus === 'conflict' && <button className="ct-notice" onClick={refreshCloudStatus}><AlertTriangle size={18} /><span>Спорные правки сохранены на устройстве. Проверить синхронизацию.</span></button>}
        <SyncRecovery state={state} notices={recoveries} owner={user.role === 'owner'} resolve={resolveRecovery} />
        <div className="ct-nav-group"><p>Рабочее пространство</p>
          <MenuLink to="/" icon={<LayoutDashboard />} label="Dashboard" close={() => setMenuOpen(false)} />
          <MenuLink to="/metrics" icon={<ChartNoAxesCombined />} label="Метрика" close={() => setMenuOpen(false)} />
          <MenuLink to="/operations" icon={<ArrowLeftRight />} label="Операции" close={() => setMenuOpen(false)} />
          <MenuLink to="/operator-payroll" icon={<Banknote />} label="ЗП операторов" close={() => setMenuOpen(false)} />
          {userRole === 'owner' && <MenuLink to="/models" icon={<UserRound />} label="Модели" close={() => setMenuOpen(false)} />}
          <MenuLink to="/roster" icon={<UsersRound />} label="Состав" close={() => setMenuOpen(false)} />
        </div>
        <div className="ct-nav-group"><p>Управление</p>
          <MenuLink to="/total-table" icon={<Table2 />} label="Total Table" close={() => setMenuOpen(false)} />
          <MenuLink to="/admin-table" icon={<Table2 />} label="Admin Table" close={() => setMenuOpen(false)} />
          {userRole === 'owner' && <><MenuLink to="/owner-table" icon={<CalendarDays />} label="Core Table" close={() => setMenuOpen(false)} /><MenuLink to="/owner" icon={<Landmark />} label="Owners" close={() => setMenuOpen(false)} /></>}
          <MenuLink to="/settings" icon={<Settings2 />} label="Настройки" close={() => setMenuOpen(false)} />
        </div>
      </div>
      <div className={`ct-sidebar-footer ${menuOpen ? 'is-open' : ''}`}><SyncStatus status={cloudStatus} syncing={isSyncing} connected={!!state.syncUrl} needsReview={recoveries.length > 0} lastCheck={lastSyncTime} refresh={refreshCloudStatus} /></div>
    </nav>
    <main className="ct-main">{location.pathname !== '/' && <div className="ct-toolbar"><p className="ct-breadcrumb">Рабочее пространство <span>/</span> <strong>{sectionTitle[location.pathname] || 'Обзор'}</strong></p>{headerControls}</div>}
      {mutationError && <p role="alert" className="ct-notice">{mutationError}</p>}
      <div className={refinedPage ? 'ct-content' : 'ct-content ct-legacy'}>
        <Suspense fallback={<p role="status" className="ct-loading">Загрузка раздела…</p>}>
        <Routes>
              <Route path="/" element={<Dashboard state={state} updateState={updateState} headerControls={headerControls} />} />
              <Route path="/operator-payroll" element={<OperatorPayroll state={state} updateState={updateState} />} />
              <Route path="/metrics" element={<Metrics state={state} updateState={updateState} userRole={userRole} />} />
              <Route path="/add-income" element={<AddIncome state={state} updateState={updateState} />} />
              <Route path="/advance-request" element={<AdvanceRequest state={state} updateState={updateState} />} />
              <Route path="/operations" element={<Operations state={state} updateState={updateState} />} />
              <Route path="/reports" element={<LegacyOperatorReport />} />
              <Route path="/models" element={userRole === 'owner' ? <Models state={state} updateState={updateState} /> : <Navigate to="/" replace />} />
              <Route path="/roster" element={<Roster state={state} updateState={updateState} />} />
              <Route path="/owner" element={userRole === 'owner' ? <Owner state={state} updateState={updateState} /> : <Navigate to="/" replace />} />
              <Route path="/owner-table" element={userRole === 'owner' ? <OwnerTable state={state} updateState={updateState} /> : <Navigate to="/" replace />} />
              <Route path="/admin-table" element={<AdminTable state={state} updateState={updateState} />} />
              <Route path="/total-table" element={<TotalTable state={state} updateState={updateState} />} />
              <Route path="/settings" element={<Settings state={state} updateState={updateState} userRole={userRole} />} />
            </Routes>
        </Suspense>
      </div>
    </main>
  </div>;
}

function MenuLink({ to, label, icon, close }: { to: string; label: string; icon: React.ReactNode; close: () => void }) {
  return <NavLink to={to} end={to === '/'} onClick={close} className={({ isActive }) => `ct-nav-link ${isActive ? 'is-active' : ''}`}>{icon}<span>{label}</span></NavLink>;
}

function LegacyOperatorReport() {
  const location = useLocation();
  const operator = (location.state as { operator?: string } | null)?.operator || new URLSearchParams(location.search).get('operator');
  return <Navigate replace to={operator ? '/operator-payroll?operator=' + encodeURIComponent(operator) : '/operator-payroll'} />;
}
