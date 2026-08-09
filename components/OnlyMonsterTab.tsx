import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  AlertCircle, 
  Search, 
  Users, 
  XCircle, 
  Lock,
  UserCheck,
  MessageSquare,
  Award,
  Clock
} from 'lucide-react';

interface OnlyMonsterTabProps {
  agencyModels: string[];
}

interface OnlyMonsterAccount {
  id: string;
  platform_account_id: string;
  name: string;
  platform: string;
  status: 'active' | 'inactive' | 'online' | string;
  unread_chats: number;
  active_operators: number;
  today_earnings?: number | null;
  handle?: string;
  avatar_url?: string;
}

interface ShiftOperator {
  user_id: string;
  name: string;
  avatar: string;
  messages_count: number;
  paid_messages_count: number;
  sold_messages_count: number;
  reply_time_avg?: number | null;
}

function formatDuration(seconds?: number | null): string {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds <= 0) {
    return '—';
  }
  const s = Math.round(seconds);
  if (s < 60) {
    return `${s}с`;
  }
  if (s < 3600) {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return secs > 0 ? `${mins}м ${secs}с` : `${mins}м`;
  }
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  return mins > 0 ? `${hours}ч ${mins}м` : `${hours}ч`;
}

function getReplyTimeColorClass(seconds?: number | null): string {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds <= 0) {
    return 'text-slate-500';
  }
  if (seconds < 120) {
    return 'text-emerald-400';
  }
  if (seconds <= 300) {
    return 'text-amber-400';
  }
  return 'text-rose-400';
}

function decodeHtmlEntities(str: string): string {
  if (!str) return '';
  return str
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

export const OnlyMonsterTab: React.FC<OnlyMonsterTabProps> = ({ agencyModels }) => {
  // Sub-tabs state
  const [activeSubTab, setActiveSubTab] = useState<'accounts' | 'operator_metrics'>('accounts');

  // Accounts & API state
  const [accounts, setAccounts] = useState<OnlyMonsterAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEarningsLoading, setIsEarningsLoading] = useState(false);
  const [connStatus, setConnStatus] = useState<'idle' | 'testing' | 'live' | 'not_configured' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Shift Operator Metrics state
  const [shiftInfo, setShiftInfo] = useState<{ label: string; start: string; end: string } | null>(null);
  const [operators, setOperators] = useState<ShiftOperator[]>([]);
  const [isOperatorsLoading, setIsOperatorsLoading] = useState(false);
  const [operatorsError, setOperatorsError] = useState<string | null>(null);
  const [hasLoadedOperators, setHasLoadedOperators] = useState(false);

  // Fetch operator metrics for current shift
  const fetchShiftOperators = async () => {
    setIsOperatorsLoading(true);
    setOperatorsError(null);
    try {
      const res = await fetch('/api/onlymonster/shift-operators');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setShiftInfo(data.shift || null);
          setOperators(data.operators || []);
          setHasLoadedOperators(true);
        } else {
          setOperatorsError(data.error || 'Не удалось загрузить метрики операторов');
        }
      } else {
        setOperatorsError(`Ошибка сервера (${res.status})`);
      }
    } catch (e: any) {
      setOperatorsError('Ошибка сети при загрузке метрик операторов');
    } finally {
      setIsOperatorsLoading(false);
    }
  };

  const handleSubTabChange = (tab: 'accounts' | 'operator_metrics') => {
    setActiveSubTab(tab);
    if (tab === 'operator_metrics' && !hasLoadedOperators) {
      fetchShiftOperators();
    }
  };

  // Fetch today's earnings for all accounts
  const fetchEarnings = async (accountsList: OnlyMonsterAccount[]) => {
    const ids = accountsList.map(a => a.platform_account_id).filter(Boolean);
    if (ids.length === 0) return;

    setIsEarningsLoading(true);
    try {
      const res = await fetch(`/api/onlymonster/earnings?accounts=${encodeURIComponent(ids.join(','))}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.earnings) {
          setAccounts(prev => prev.map(acc => {
            const entry = data.earnings[acc.platform_account_id] || data.earnings[acc.id];
            return {
              ...acc,
              today_earnings: (entry && typeof entry.today === 'number') ? Math.round(entry.today * 100) / 100 : null
            };
          }));
        } else {
          setAccounts(prev => prev.map(acc => ({ ...acc, today_earnings: null })));
        }
      } else {
        setAccounts(prev => prev.map(acc => ({ ...acc, today_earnings: null })));
      }
    } catch (e) {
      setAccounts(prev => prev.map(acc => ({ ...acc, today_earnings: null })));
    } finally {
      setIsEarningsLoading(false);
    }
  };

  // Load current configuration from server
  const loadConfig = async () => {
    try {
      const res = await fetch('/api/onlymonster/config');
      if (res.ok) {
        const data = await res.json();
        const activeToken = data.token || (data.apiKeyConfigured ? 'env_configured' : '');
        if (data.apiKeyConfigured || (activeToken && !activeToken.startsWith('om_token_fc269e0'))) {
          fetchAccounts(activeToken || 'env_configured');
        } else {
          setConnStatus('not_configured');
          setStatusMessage('API-ключ не настроен. Укажите переменную ONLYMONSTER_API_KEY в Vercel Dashboard.');
        }
      }
    } catch (e) {
      console.error('Error loading OnlyMonster config:', e);
      setConnStatus('not_configured');
    }
  };

  // Fetch real accounts from OnlyMonster API
  const fetchAccounts = async (keyOverride?: string) => {
    setIsLoading(true);
    setConnStatus('testing');
    setStatusMessage('Запрос к OnlyMonster Browser API...');

    try {
      const res = await fetch('/api/onlymonster/proxy?path=accounts');
      if (res.ok) {
        const data = await res.json();

        if (data && (data.not_configured || (data.success === false && data.error))) {
          setConnStatus('error');
          setStatusMessage(data.error || 'Ошибка авторизации. Проверьте ваш API-ключ в Vercel.');
          setAccounts([]);
          return;
        }

        // Parse accounts array from API response
        let rawList: any[] = [];
        if (Array.isArray(data)) {
          rawList = data;
        } else if (Array.isArray(data.accounts)) {
          rawList = data.accounts;
        } else if (Array.isArray(data.data)) {
          rawList = data.data;
        } else if (Array.isArray(data.results)) {
          rawList = data.results;
        }

        if (rawList.length > 0) {
          const parsedAccounts: OnlyMonsterAccount[] = rawList.map((acc: any, index: number) => {
            const rawName = acc.name || acc.title || acc.model_name || agencyModels[index] || `Модель ${index + 1}`;
            const platformAccId = String(acc.platform_account_id || acc.id || acc.account_id || `acc_${index + 1}`);
            return {
              id: String(acc.id || acc.account_id || `acc_${index + 1}`),
              platform_account_id: platformAccId,
              name: decodeHtmlEntities(String(rawName)),
              handle: acc.username || acc.handle || acc.of_handle || '',
              platform: acc.platform || 'OnlyFans',
              status: acc.status === 'inactive' ? 'inactive' : 'active',
              unread_chats: typeof acc.unread_chats === 'number' ? acc.unread_chats : (acc.unread_count || 0),
              active_operators: typeof acc.active_operators === 'number' ? acc.active_operators : (acc.operators_count || 1),
              today_earnings: undefined
            };
          });

          setAccounts(parsedAccounts);
          setConnStatus('live');
          setStatusMessage(`Успешно подключено! Синхронизировано моделей из OnlyMonster: ${parsedAccounts.length}`);
          fetchEarnings(parsedAccounts);
        } else {
          setAccounts([]);
          setConnStatus('live');
          setStatusMessage('Авторизация успешна! В подключенном аккаунте OnlyMonster пока нет активных профилей моделей.');
        }
      } else {
        const errorData = await res.json().catch(() => ({}));
        setConnStatus('error');
        setStatusMessage(errorData.error || `Ошибка соединения с API OnlyMonster (${res.status}).`);
        setAccounts([]);
      }
    } catch (e: any) {
      setConnStatus('error');
      setStatusMessage('Сбой сетевого запроса к серверу.');
      setAccounts([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadConfig();
  }, []);

  // Filter accounts by search query
  const filteredAccounts = accounts.filter(acc => 
    acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (acc.handle && acc.handle.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* SUB-TABS NAVIGATION */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        <button
          onClick={() => handleSubTabChange('accounts')}
          className={`px-4 py-2.5 rounded-xl font-mono text-xs font-bold uppercase transition-all flex items-center gap-2 ${
            activeSubTab === 'accounts'
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-950/50 border border-violet-400/30'
              : 'bg-slate-900/60 text-slate-400 border border-white/5 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <Users size={15} />
          Подключенные Аккаунты
        </button>

        <button
          onClick={() => handleSubTabChange('operator_metrics')}
          className={`px-4 py-2.5 rounded-xl font-mono text-xs font-bold uppercase transition-all flex items-center gap-2 ${
            activeSubTab === 'operator_metrics'
              ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-950/50 border border-violet-400/30'
              : 'bg-slate-900/60 text-slate-400 border border-white/5 hover:bg-slate-800 hover:text-slate-200'
          }`}
        >
          <UserCheck size={15} />
          Метрики Оператора
        </button>
      </div>

      {/* STATUS & FEEDBACK NOTIFICATION FOR ACCOUNTS TAB */}
      {activeSubTab === 'accounts' && statusMessage && connStatus !== 'live' && (
        <div className={`p-4 rounded-2xl border flex gap-3 items-start font-mono text-xs ${
          connStatus === 'error'
            ? 'bg-rose-950/30 border-rose-500/30 text-rose-300'
            : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
        }`}>
          {connStatus === 'error' ? (
            <XCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
          )}
          <p className="leading-relaxed font-medium">{statusMessage}</p>
        </div>
      )}

      {/* SUB-TAB 1: CONNECTED MODEL ACCOUNTS LIST */}
      {activeSubTab === 'accounts' && (
        <div className="glass-card p-6 rounded-3xl border border-white/10 bg-slate-950/60 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div>
              <h3 className="text-base font-black uppercase text-white tracking-wider font-mono flex items-center gap-2.5">
                <Users size={18} className="text-emerald-400" />
                Подключенные Аккаунты Моделей
              </h3>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Прямой список аккаунтов, синхронизированных из вашей панели OnlyMonster Browser
              </p>
            </div>

            {/* CONTROLS: SEARCH & REFRESH */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative w-full sm:w-64">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Поиск модели..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-900/90 border border-white/10 rounded-xl pl-9.5 pr-3 py-2 text-xs text-white outline-none focus:border-violet-500/50 w-full font-mono placeholder-slate-600 transition-colors"
                />
              </div>

              <button
                onClick={() => fetchAccounts()}
                disabled={isLoading}
                className="px-3.5 py-2 bg-slate-900 border border-white/10 hover:border-violet-500/40 hover:bg-slate-800 text-xs font-mono font-bold uppercase text-slate-200 rounded-xl transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shrink-0"
                title="Обновить список моделей из OnlyMonster API"
              >
                <RefreshCw size={14} className={isLoading ? "animate-spin text-violet-400" : ""} />
                {isLoading ? 'Загрузка...' : 'Обновить'}
              </button>
            </div>
          </div>

          {/* ACCOUNTS GRID / LIST */}
          {connStatus === 'not_configured' ? (
            <div className="p-8 bg-slate-900/30 rounded-2xl border border-dashed border-white/10 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
                <Lock size={20} />
              </div>
              <h4 className="text-sm font-black text-slate-200 font-mono uppercase">API-Ключ не настроен</h4>
              <p className="text-xs font-mono text-slate-400 max-w-md mx-auto leading-relaxed">
                Укажите переменную окружения <strong className="text-white">ONLYMONSTER_API_KEY</strong> в настройках проекта Vercel.
              </p>
            </div>
          ) : isLoading ? (
            <div className="p-10 text-center space-y-3">
              <RefreshCw size={24} className="animate-spin text-violet-400 mx-auto" />
              <p className="text-xs font-mono text-slate-400">Синхронизация списков моделей с OnlyMonster API...</p>
            </div>
          ) : filteredAccounts.length === 0 ? (
            <div className="p-8 bg-slate-900/30 rounded-2xl border border-dashed border-white/10 text-center space-y-2">
              <p className="text-sm font-mono font-bold text-slate-300">Аккаунты не найдены</p>
              <p className="text-xs font-mono text-slate-500">
                {searchQuery ? 'По вашему поисковому запросу ничего не найдено.' : 'В вашем аккаунте OnlyMonster пока нет подключенных профилей.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredAccounts.map((acc) => (
                <div 
                  key={acc.id} 
                  className="p-4 bg-slate-900/60 rounded-2xl border border-white/5 hover:border-violet-500/30 hover:bg-slate-900/90 transition-all flex flex-col justify-between space-y-4 group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-900 to-indigo-950 border border-violet-500/30 flex items-center justify-center text-white font-black text-sm font-mono shadow-md">
                        {acc.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-black text-white font-mono group-hover:text-violet-300 transition-colors">
                          {acc.name}
                        </h4>
                        {acc.handle && (
                          <p className="text-[10px] font-mono text-slate-400">@{acc.handle}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[8px] font-mono font-black uppercase bg-violet-500/15 text-violet-300 border border-violet-500/20 px-2 py-0.5 rounded">
                            {acc.platform}
                          </span>
                          <span className="flex items-center gap-1 text-[9px] font-mono text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {acc.status === 'active' ? 'Активен' : 'Онлайн'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-3 border-t border-white/5 font-mono text-center">
                    <div className="p-2 bg-slate-950/60 rounded-xl border border-white/[0.02]">
                      <span className="text-[8px] uppercase text-slate-500 font-bold block">Непрочитано</span>
                      <span className={`text-xs font-black block mt-0.5 ${acc.unread_chats > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                        {acc.unread_chats}
                      </span>
                    </div>

                    <div className="p-2 bg-slate-950/60 rounded-xl border border-white/[0.02]">
                      <span className="text-[8px] uppercase text-slate-500 font-bold block">Операторов</span>
                      <span className="text-xs font-black text-slate-200 block mt-0.5">
                        {acc.active_operators}
                      </span>
                    </div>

                    <div className="p-2 bg-slate-950/60 rounded-xl border border-white/[0.02]">
                      <span className="text-[8px] uppercase text-slate-500 font-bold block">Доход сегодня</span>
                      {isEarningsLoading && acc.today_earnings === undefined ? (
                        <span className="flex items-center justify-center mt-1">
                          <RefreshCw size={12} className="animate-spin text-violet-400" />
                        </span>
                      ) : typeof acc.today_earnings === 'number' ? (
                        <span className="text-xs font-black text-emerald-400 block mt-0.5">
                          +${acc.today_earnings}
                        </span>
                      ) : (
                        <span className="text-xs font-black text-slate-500 block mt-0.5">
                          —
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: OPERATOR METRICS */}
      {activeSubTab === 'operator_metrics' && (
        <div className="glass-card p-6 rounded-3xl border border-white/10 bg-slate-950/60 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 pb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-black uppercase text-white tracking-wider font-mono flex items-center gap-2.5">
                  <UserCheck size={18} className="text-violet-400" />
                  Метрики Операторов
                </h3>
                {shiftInfo && (
                  <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-1.5">
                    <Clock size={11} className="text-violet-400" />
                    Смена: {shiftInfo.label} (Kyiv)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 font-mono mt-1">
                Активность и объём отправленных сообщений операторов за текущую смену
              </p>
            </div>

            <button
              onClick={() => fetchShiftOperators()}
              disabled={isOperatorsLoading}
              className="px-3.5 py-2 bg-slate-900 border border-white/10 hover:border-violet-500/40 hover:bg-slate-800 text-xs font-mono font-bold uppercase text-slate-200 rounded-xl transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shrink-0"
              title="Обновить метрики операторов"
            >
              <RefreshCw size={14} className={isOperatorsLoading ? "animate-spin text-violet-400" : ""} />
              {isOperatorsLoading ? 'Загрузка...' : 'Обновить'}
            </button>
          </div>

          {/* CONTENT */}
          {isOperatorsLoading && operators.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <RefreshCw size={24} className="animate-spin text-violet-400 mx-auto" />
              <p className="text-xs font-mono text-slate-400">Загрузка метрик операторов за текущую смену...</p>
            </div>
          ) : operatorsError ? (
            <div className="p-6 bg-rose-950/30 border border-rose-500/30 text-rose-300 rounded-2xl flex items-start gap-3 font-mono text-xs">
              <XCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h4 className="font-bold uppercase text-rose-200">Ошибка загрузки</h4>
                <p className="mt-1 leading-relaxed">{operatorsError}</p>
              </div>
            </div>
          ) : operators.length === 0 ? (
            <div className="p-10 bg-slate-900/30 rounded-2xl border border-dashed border-white/10 text-center space-y-2">
              <UserCheck size={32} className="text-slate-600 mx-auto mb-1" />
              <p className="text-sm font-mono font-bold text-slate-300">Нет активных операторов в текущую смену</p>
              <p className="text-xs font-mono text-slate-500 max-w-md mx-auto">
                В текущую смену ({shiftInfo?.label || 'текущее время'}) операторы пока не отправляли сообщений.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {operators.map((op, index) => {
                  const rank = index + 1;
                  const ppvConversion = op.paid_messages_count > 0 
                    ? Math.round((op.sold_messages_count / op.paid_messages_count) * 100)
                    : null;

                  return (
                    <div 
                      key={op.user_id || index}
                      className={`p-4 rounded-2xl transition-all flex flex-col justify-between space-y-4 font-mono group ${
                        rank === 1
                          ? 'bg-slate-900/80 border border-amber-500/40 shadow-lg shadow-amber-500/10 hover:border-amber-400/60 hover:bg-slate-900'
                          : rank === 2
                          ? 'bg-slate-900/70 border border-slate-300/30 shadow-md shadow-slate-400/5 hover:border-slate-300/50 hover:bg-slate-900'
                          : rank === 3
                          ? 'bg-slate-900/70 border border-orange-700/30 shadow-md shadow-orange-700/5 hover:border-orange-600/50 hover:bg-slate-900'
                          : 'bg-slate-900/60 border border-white/5 hover:border-violet-500/30 hover:bg-slate-900/90'
                      }`}
                    >
                      {/* TOP SECTION: RANK, AVATAR, NAME, ID */}
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 shadow-md ${
                          rank === 1 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                          rank === 2 ? 'bg-slate-400/20 text-slate-300 border border-slate-400/40' :
                          rank === 3 ? 'bg-amber-700/20 text-amber-500 border border-amber-700/40' :
                          'bg-slate-950 text-slate-400 border border-white/5'
                        }`}>
                          {rank === 1 ? <Award size={16} /> : `#${rank}`}
                        </div>

                        {op.avatar ? (
                          <img 
                            src={op.avatar} 
                            alt={op.name}
                            className="w-10 h-10 rounded-xl object-cover border border-white/10 shrink-0"
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-900 to-violet-950 border border-indigo-500/30 flex items-center justify-center text-white font-black text-sm shrink-0 shadow-md">
                            {op.name.charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-black text-white truncate group-hover:text-violet-300 transition-colors">
                            {op.name}
                          </h4>
                          <span className="text-[10px] text-slate-500 block truncate">
                            ID: {op.user_id || '—'}
                          </span>
                        </div>
                      </div>

                      {/* BOTTOM SECTION: 4 METRICS GRID */}
                      <div className="space-y-2 pt-3 border-t border-white/10">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                          <div className="p-2 bg-slate-950/60 rounded-xl border border-white/[0.02]">
                            <span className="text-[8px] uppercase text-slate-500 font-bold block">Сообщения</span>
                            <span className="text-xs font-black text-slate-200 block mt-0.5">
                              {op.messages_count}
                            </span>
                          </div>

                          <div className="p-2 bg-slate-950/60 rounded-xl border border-white/[0.02]">
                            <span className="text-[8px] uppercase text-slate-500 font-bold block">Ср. время ответа</span>
                            <span className={`text-xs font-black block mt-0.5 ${getReplyTimeColorClass(op.reply_time_avg)}`}>
                              {formatDuration(op.reply_time_avg)}
                            </span>
                          </div>

                          <div className="p-2 bg-slate-950/60 rounded-xl border border-white/[0.02]">
                            <span className="text-[8px] uppercase text-slate-500 font-bold block">PPV Отправлено</span>
                            <span className="text-xs font-black text-violet-300 block mt-0.5">
                              {op.paid_messages_count}
                            </span>
                          </div>

                          <div className="p-2 bg-slate-950/60 rounded-xl border border-white/[0.02]">
                            <span className="text-[8px] uppercase text-slate-500 font-bold block">PPV Продано</span>
                            <span className="text-xs font-black text-emerald-400 block mt-0.5">
                              {op.sold_messages_count}
                            </span>
                          </div>
                        </div>

                        {ppvConversion !== null && (
                          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-400 pt-1 px-1">
                            <span className="text-slate-500 uppercase text-[8px]">Конверсия PPV:</span>
                            <span className={`font-black ${
                              ppvConversion >= 25 ? 'text-emerald-400' : ppvConversion >= 10 ? 'text-amber-400' : 'text-slate-300'
                            }`}>
                              {ppvConversion}%
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

