import React, { useState, useEffect } from 'react';
import { 
  RefreshCw, 
  AlertCircle, 
  Search, 
  Users, 
  User,
  XCircle, 
  Lock,
  UserCheck,
  MessageSquare,
  Award,
  Clock,
  Flame,
  DollarSign,
  ArrowUp,
  ArrowDown,
  X
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
  earnings_label?: string;
  earnings_breakdown?: { 1: number; 2: number; 3: number; 4: number } | null;
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
  earnings?: number;
  reply_time_avg?: number | null;
  creator_ids?: string[];
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
  const [accountsEarningsDay, setAccountsEarningsDay] = useState<'today' | 'yesterday'>('today');
  const [showShiftBreakdown, setShowShiftBreakdown] = useState<boolean>(false);

  // Shift Operator Metrics state
  const getClientKyivShiftIndex = (): 1 | 2 | 3 | 4 => {
    try {
      const hourFormatter = new Intl.DateTimeFormat("en-US", {
        timeZone: "Europe/Kyiv",
        hour: "numeric",
        hour12: false
      });
      const hour = parseInt(hourFormatter.format(new Date()), 10) || 0;
      if (hour >= 2 && hour < 8) return 1;
      if (hour >= 8 && hour < 14) return 2;
      if (hour >= 14 && hour < 20) return 3;
      return 4;
    } catch (e) {
      return 1;
    }
  };

  const currentKyivShiftIndex = getClientKyivShiftIndex();

  const [periodMode, setPeriodMode] = useState<'today' | 'yesterday' | 'week' | 'month'>('today');
  const [selectedShiftIndex, setSelectedShiftIndex] = useState<1 | 2 | 3 | 4>(currentKyivShiftIndex);

  // Sorting state
  const [sortBy, setSortBy] = useState<'messages' | 'reply_time' | 'ppv_sent' | 'ppv_sold' | 'earnings'>('messages');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Shift Comparison state
  const [shiftCompMode, setShiftCompMode] = useState<'today' | 'yesterday' | 'week'>('today');
  const [shiftCompData, setShiftCompData] = useState<{
    shifts: any[];
    strongestIndex: number | null;
    weakestIndex: number | null;
    partial?: boolean;
  } | null>(null);
  const [isShiftCompLoading, setIsShiftCompLoading] = useState(false);
  const [shiftCompError, setShiftCompError] = useState<string | null>(null);

  // Model breakdown popover state
  const [activeBreakdown, setActiveBreakdown] = useState<{
    userId: string;
    operatorName: string;
    creatorId: string;
    modelName: string;
    avatarUrl?: string;
  } | null>(null);
  const [breakdownCache, setBreakdownCache] = useState<Record<string, { loading: boolean; error?: string; metrics?: any }>>({});

  const [shiftInfo, setShiftInfo] = useState<{ label: string; start: string; end: string } | null>(null);
  const [operators, setOperators] = useState<ShiftOperator[]>([]);
  const [isOperatorsLoading, setIsOperatorsLoading] = useState(false);
  const [operatorsError, setOperatorsError] = useState<string | null>(null);
  const [hasLoadedOperators, setHasLoadedOperators] = useState(false);

  // Fetch operator metrics for current shift/period
  const fetchShiftOperators = async (
    pMode: 'today' | 'yesterday' | 'week' | 'month' = periodMode,
    sIndex: 1 | 2 | 3 | 4 = selectedShiftIndex,
    sb: 'messages' | 'reply_time' | 'ppv_sent' | 'ppv_sold' | 'earnings' = sortBy,
    sd: 'asc' | 'desc' = sortDir
  ) => {
    setIsOperatorsLoading(true);
    setOperatorsError(null);
    try {
      const params = new URLSearchParams();
      if (pMode === 'today' || pMode === 'yesterday') {
        params.append('period', 'shift');
        params.append('day', pMode);
        params.append('shift', String(sIndex));
      } else if (pMode === 'week') {
        params.append('period', 'week');
      } else if (pMode === 'month') {
        params.append('period', 'month');
      }

      params.append('sortBy', sb);
      params.append('sortDir', sd);

      const url = `/api/onlymonster/shift-operators?${params.toString()}`;
      const res = await fetch(url);
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

  const handleSortChange = (newSortBy: 'messages' | 'reply_time' | 'ppv_sent' | 'ppv_sold' | 'earnings') => {
    let nextSortDir: 'asc' | 'desc' = sortDir;
    if (sortBy === newSortBy) {
      nextSortDir = sortDir === 'desc' ? 'asc' : 'desc';
    } else {
      nextSortDir = newSortBy === 'reply_time' ? 'asc' : 'desc';
    }
    setSortBy(newSortBy);
    setSortDir(nextSortDir);
    fetchShiftOperators(periodMode, selectedShiftIndex, newSortBy, nextSortDir);
  };

  const handlePeriodChange = (mode: 'today' | 'yesterday' | 'week' | 'month') => {
    setPeriodMode(mode);
    fetchShiftOperators(mode, selectedShiftIndex, sortBy, sortDir);
  };

  const handleShiftChange = (shiftIdx: 1 | 2 | 3 | 4) => {
    setSelectedShiftIndex(shiftIdx);
    fetchShiftOperators(periodMode, shiftIdx, sortBy, sortDir);
  };

  // Fetch shift comparison data
  const fetchShiftComparison = async (mode: 'today' | 'yesterday' | 'week' = shiftCompMode) => {
    setIsShiftCompLoading(true);
    setShiftCompError(null);
    try {
      const params = new URLSearchParams();
      if (mode === 'week') {
        params.append('scope', 'week');
      } else {
        params.append('scope', 'day');
        params.append('day', mode);
      }

      const res = await fetch(`/api/onlymonster/shift-comparison?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setShiftCompData(data);
        } else {
          setShiftCompError(data.error || 'Не удалось загрузить сравнение смен');
        }
      } else {
        setShiftCompError(`Ошибка сервера (${res.status})`);
      }
    } catch (e: any) {
      setShiftCompError('Ошибка соединения при запросе сравнения смен');
    } finally {
      setIsShiftCompLoading(false);
    }
  };

  const handleShiftCompModeChange = (mode: 'today' | 'yesterday' | 'week') => {
    setShiftCompMode(mode);
    fetchShiftComparison(mode);
  };

  // Model breakdown click handler
  const handleModelAvatarClick = async (
    e: React.MouseEvent,
    userId: string,
    operatorName: string,
    creatorId: string,
    modelName: string,
    avatarUrl?: string
  ) => {
    e.stopPropagation();

    if (activeBreakdown && activeBreakdown.userId === userId && activeBreakdown.creatorId === creatorId) {
      setActiveBreakdown(null);
      return;
    }

    setActiveBreakdown({ userId, operatorName, creatorId, modelName, avatarUrl });

    if (!shiftInfo?.start || !shiftInfo?.end) return;

    const cacheKey = `${userId}_${creatorId}_${shiftInfo.start}_${shiftInfo.end}`;
    if (breakdownCache[cacheKey]) return;

    setBreakdownCache(prev => ({
      ...prev,
      [cacheKey]: { loading: true }
    }));

    try {
      const params = new URLSearchParams();
      params.append('user_id', userId);
      params.append('creator_id', creatorId);
      params.append('start', shiftInfo.start);
      params.append('end', shiftInfo.end);

      const res = await fetch(`/api/onlymonster/operator-model-breakdown?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setBreakdownCache(prev => ({
            ...prev,
            [cacheKey]: { loading: false, metrics: data.metrics }
          }));
        } else {
          setBreakdownCache(prev => ({
            ...prev,
            [cacheKey]: { loading: false, error: data.error || 'Не удалось загрузить данные' }
          }));
        }
      } else {
        setBreakdownCache(prev => ({
          ...prev,
          [cacheKey]: { loading: false, error: `Ошибка API (${res.status})` }
        }));
      }
    } catch (err: any) {
      setBreakdownCache(prev => ({
        ...prev,
        [cacheKey]: { loading: false, error: 'Ошибка сети' }
      }));
    }
  };

  const handleSubTabChange = (tab: 'accounts' | 'operator_metrics') => {
    setActiveSubTab(tab);
    if (tab === 'operator_metrics') {
      if (accounts.length === 0 && !isLoading) {
        fetchAccounts();
      }
      if (!hasLoadedOperators) {
        fetchShiftOperators(periodMode, selectedShiftIndex, sortBy, sortDir);
      }
      if (!shiftCompData) {
        fetchShiftComparison(shiftCompMode);
      }
    }
  };

  // Fetch earnings for all accounts with operational day range and shift breakdown
  const fetchEarnings = async (
    accountsList: OnlyMonsterAccount[] = accounts,
    dayMode: 'today' | 'yesterday' = accountsEarningsDay,
    breakdownMode: boolean = showShiftBreakdown
  ) => {
    const ids = accountsList.map(a => a.platform_account_id).filter(Boolean);
    if (ids.length === 0) return;

    setIsEarningsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('accounts', ids.join(','));
      params.append('day', dayMode);
      if (breakdownMode) {
        params.append('breakdown', 'true');
      }

      const res = await fetch(`/api/onlymonster/earnings?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.earnings) {
          setAccounts(prev => prev.map(acc => {
            const entry = data.earnings[acc.platform_account_id] || data.earnings[acc.id];
            if (!entry) {
              return {
                ...acc,
                today_earnings: null,
                earnings_label: dayMode === 'today' ? 'Сегодня' : 'Вчера',
                earnings_breakdown: null
              };
            }

            const rawTotal = typeof entry.total === 'number' ? entry.total : (typeof entry.today === 'number' ? entry.today : null);
            return {
              ...acc,
              today_earnings: rawTotal !== null ? Math.round(rawTotal * 100) / 100 : null,
              earnings_label: entry.label || (dayMode === 'today' ? 'Сегодня' : 'Вчера'),
              earnings_breakdown: entry.breakdown || null
            };
          }));
        } else {
          setAccounts(prev => prev.map(acc => ({ ...acc, today_earnings: null, earnings_breakdown: null })));
        }
      } else {
        setAccounts(prev => prev.map(acc => ({ ...acc, today_earnings: null, earnings_breakdown: null })));
      }
    } catch (e) {
      setAccounts(prev => prev.map(acc => ({ ...acc, today_earnings: null, earnings_breakdown: null })));
    } finally {
      setIsEarningsLoading(false);
    }
  };

  const handleEarningsDayChange = (day: 'today' | 'yesterday') => {
    setAccountsEarningsDay(day);
    fetchEarnings(accounts, day, showShiftBreakdown);
  };

  const handleToggleShiftBreakdown = () => {
    const next = !showShiftBreakdown;
    setShowShiftBreakdown(next);
    fetchEarnings(accounts, accountsEarningsDay, next);
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
              today_earnings: undefined,
              avatar_url: acc.avatar || acc.avatar_url || acc.photo || acc.image || ''
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
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-base font-black uppercase text-white tracking-wider font-mono flex items-center gap-2.5">
                  <Users size={18} className="text-emerald-400" />
                  Подключенные Аккаунты Моделей
                </h3>

                {/* TODAY / YESTERDAY PERIOD SWITCHER */}
                <div className="flex items-center p-0.5 bg-slate-900 border border-white/10 rounded-xl font-mono text-[10px]">
                  <button
                    onClick={() => handleEarningsDayChange('today')}
                    className={`px-2.5 py-1 rounded-lg font-bold uppercase transition-all ${
                      accountsEarningsDay === 'today'
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Сегодня
                  </button>
                  <button
                    onClick={() => handleEarningsDayChange('yesterday')}
                    className={`px-2.5 py-1 rounded-lg font-bold uppercase transition-all ${
                      accountsEarningsDay === 'yesterday'
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    Вчера
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                Прямой список аккаунтов, синхронизированных из вашей панели OnlyMonster Browser
              </p>
            </div>

            {/* CONTROLS: SEARCH, SHIFT BREAKDOWN TOGGLE & REFRESH */}
            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input 
                  type="text" 
                  placeholder="Поиск модели..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-900/90 border border-white/10 rounded-xl pl-9.5 pr-3 py-2 text-xs text-white outline-none focus:border-violet-500/50 w-full font-mono placeholder-slate-600 transition-colors"
                />
              </div>

              {/* TOGGLE SHIFT BREAKDOWN */}
              <button
                onClick={handleToggleShiftBreakdown}
                className={`px-3 py-2 border rounded-xl transition-all flex items-center gap-1.5 text-xs font-mono font-bold uppercase ${
                  showShiftBreakdown
                    ? 'bg-violet-600/20 text-violet-300 border-violet-500/50 shadow-md'
                    : 'bg-slate-900 border-white/10 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
                title="Показать или скрыть разбивку дохода по 4 сменам"
              >
                <Clock size={13} className={showShiftBreakdown ? 'text-violet-400' : 'text-slate-400'} />
                <span>По сменам</span>
              </button>

              <button
                onClick={() => fetchAccounts()}
                disabled={isLoading || isEarningsLoading}
                className="px-3.5 py-2 bg-slate-900 border border-white/10 hover:border-violet-500/40 hover:bg-slate-800 text-xs font-mono font-bold uppercase text-slate-200 rounded-xl transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shrink-0"
                title="Обновить список моделей из OnlyMonster API"
              >
                <RefreshCw size={14} className={(isLoading || isEarningsLoading) ? "animate-spin text-violet-400" : ""} />
                {isLoading || isEarningsLoading ? 'Загрузка...' : 'Обновить'}
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
                      <span className="text-[8px] uppercase text-slate-500 font-bold block truncate">
                        Доход {acc.earnings_label ? acc.earnings_label.toLowerCase() : (accountsEarningsDay === 'today' ? 'сегодня' : 'вчера')}
                      </span>
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

                  {/* OPTIONAL 4-SHIFT BREAKDOWN GRID */}
                  {showShiftBreakdown && (
                    <div className="pt-2 border-t border-white/10 space-y-1.5 font-mono">
                      <div className="flex items-center justify-between text-[9px] uppercase font-bold text-slate-400 px-0.5">
                        <span className="flex items-center gap-1 text-slate-300">
                          <Clock size={11} className="text-violet-400" />
                          Разбивка по сменам ({acc.earnings_label || (accountsEarningsDay === 'today' ? 'Сегодня' : 'Вчера')}):
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5 text-center">
                        {[
                          { idx: 1 as const, label: '02–08' },
                          { idx: 2 as const, label: '08–14' },
                          { idx: 3 as const, label: '14–20' },
                          { idx: 4 as const, label: '20–02' },
                        ].map(({ idx, label }) => {
                          const isCurrentActive = accountsEarningsDay === 'today' && currentKyivShiftIndex === idx;
                          const isFutureShift = accountsEarningsDay === 'today' && idx > currentKyivShiftIndex;
                          const val = acc.earnings_breakdown ? acc.earnings_breakdown[idx] : undefined;

                          return (
                            <div
                              key={idx}
                              className={`p-1.5 rounded-lg border transition-all ${
                                isCurrentActive
                                  ? 'bg-violet-500/15 border-violet-500/40 shadow-sm'
                                  : 'bg-slate-950/60 border-white/[0.03]'
                              }`}
                            >
                              <div className="flex items-center justify-center gap-1 text-[8px] text-slate-400 font-bold uppercase">
                                {isCurrentActive && (
                                  <span className="relative flex h-1.5 w-1.5 shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                                  </span>
                                )}
                                <span>{label}</span>
                              </div>

                              <div className="text-[11px] font-black mt-0.5">
                                {isEarningsLoading && val === undefined ? (
                                  <RefreshCw size={10} className="animate-spin text-violet-400 mx-auto mt-0.5" />
                                ) : isFutureShift ? (
                                  <span className="text-slate-600 font-normal">—</span>
                                ) : typeof val === 'number' ? (
                                  <span className={val > 0 ? 'text-emerald-400' : 'text-slate-400'}>
                                    ${val}
                                  </span>
                                ) : (
                                  <span className="text-slate-500">—</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: OPERATOR METRICS */}
      {activeSubTab === 'operator_metrics' && (
        <div className="glass-card p-6 rounded-3xl border border-white/15 bg-slate-900/60 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h3 className="text-base font-black uppercase text-white tracking-wider font-mono flex items-center gap-2.5">
                  <UserCheck size={18} className="text-violet-400" />
                  Метрики Операторов
                </h3>
                {shiftInfo && (
                  <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 border border-violet-500/30 flex items-center gap-1.5">
                    <Clock size={11} className="text-violet-400" />
                    {shiftInfo.label.includes('неделя') || shiftInfo.label.includes('месяц') ? shiftInfo.label : `Смена: ${shiftInfo.label}`} (Kyiv)
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 font-mono mt-1">
                {periodMode === 'today' || periodMode === 'yesterday'
                  ? `Активность и объём отправленных сообщений операторов за ${periodMode === 'today' ? 'текущую' : 'выбранную'} смену`
                  : `Активность и объём отправленных сообщений операторов за ${shiftInfo?.label.toLowerCase() || 'выбранный период'}`
                }
              </p>
            </div>

            <button
              onClick={() => {
                fetchShiftOperators(periodMode, selectedShiftIndex, sortBy, sortDir);
                fetchShiftComparison(shiftCompMode);
              }}
              disabled={isOperatorsLoading || isShiftCompLoading}
              className="px-3.5 py-2 bg-slate-900 border border-white/15 hover:border-violet-500/40 hover:bg-slate-800 text-xs font-mono font-bold uppercase text-slate-200 rounded-xl transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-md shrink-0"
              title="Обновить метрики операторов и сравнение смен"
            >
              <RefreshCw size={14} className={(isOperatorsLoading || isShiftCompLoading) ? "animate-spin text-violet-400" : ""} />
              {(isOperatorsLoading || isShiftCompLoading) ? 'Загрузка...' : 'Обновить'}
            </button>
          </div>

          {/* SUB-BLOCK: SHIFT COMPARISON */}
          <div className="p-4 bg-slate-950/60 rounded-2xl border border-white/10 space-y-3 font-mono">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Clock size={15} className="text-violet-400" />
                <h4 className="text-xs font-black uppercase text-slate-200 tracking-wider">
                  Сравнение Смен
                </h4>
              </div>

              <div className="flex items-center p-0.5 bg-slate-900 border border-white/10 rounded-xl text-[10px]">
                {[
                  { id: 'today', label: 'Сегодня' },
                  { id: 'yesterday', label: 'Вчера' },
                  { id: 'week', label: 'За неделю' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleShiftCompModeChange(item.id as any)}
                    className={`px-2.5 py-1 rounded-lg font-bold uppercase transition-all ${
                      shiftCompMode === item.id
                        ? 'bg-violet-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {isShiftCompLoading ? (
              <div className="p-4 text-center">
                <RefreshCw size={16} className="animate-spin text-violet-400 mx-auto" />
                <span className="text-[10px] text-slate-400 mt-1 block">Расчёт данных по сменам...</span>
              </div>
            ) : shiftCompError ? (
              <div className="p-3 bg-rose-950/30 border border-rose-500/20 text-rose-300 text-[11px] rounded-xl">
                {shiftCompError}
              </div>
            ) : shiftCompData?.shifts ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                {shiftCompData.shifts.map((s: any) => {
                  const isStrongest = shiftCompData.strongestIndex === s.index;
                  const isWeakest = shiftCompData.weakestIndex === s.index && !isStrongest;

                  return (
                    <div
                      key={s.index}
                      className={`p-3 rounded-xl border transition-all relative overflow-hidden ${
                        s.isFuture
                          ? 'bg-slate-950/40 border-white/5 opacity-50'
                          : isStrongest
                          ? 'bg-emerald-950/30 border-emerald-500/50 shadow-md shadow-emerald-950/40'
                          : isWeakest
                          ? 'bg-rose-950/30 border-rose-500/40'
                          : 'bg-slate-900/70 border-white/10'
                      }`}
                    >
                      {isStrongest && (
                        <div className="absolute top-1 right-2 flex items-center gap-0.5 text-[8px] font-black uppercase text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded-full border border-emerald-500/30">
                          <Flame size={10} className="text-emerald-400 fill-emerald-400" />
                          <span>Сильнее всех</span>
                        </div>
                      )}
                      {isWeakest && (
                        <div className="absolute top-1 right-2 flex items-center gap-0.5 text-[8px] font-black uppercase text-rose-400 bg-rose-500/20 px-1.5 py-0.5 rounded-full border border-rose-500/30">
                          <span>Слабее всех</span>
                        </div>
                      )}

                      <div className="text-[10px] font-bold text-slate-400 uppercase">
                        {s.label}
                      </div>

                      <div className="mt-1.5 flex items-baseline justify-between">
                        <div>
                          <span className="text-[9px] uppercase text-slate-500 block font-bold">Доход</span>
                          <span className={`text-sm font-black ${s.isFuture ? 'text-slate-600' : isStrongest ? 'text-emerald-300' : 'text-emerald-400'}`}>
                            {s.isFuture
                              ? '—'
                              : shiftCompMode === 'week'
                              ? `$${s.avgEarningsPerDay}/д`
                              : `$${s.totalEarnings ?? 0}`}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[9px] uppercase text-slate-500 block font-bold">Сообщения</span>
                          <span className="text-xs font-bold text-slate-200">
                            {s.isFuture ? '—' : s.totalMessages ?? 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>

          {/* PERIOD & SHIFT SELECTORS */}
          <div className="space-y-3 pb-2 border-b border-white/10 font-mono">
            {/* ROW 1: PERIOD BUTTONS */}
            <div className="flex flex-wrap items-center gap-2">
              {[
                { id: 'today', label: 'Сегодня' },
                { id: 'yesterday', label: 'Вчера' },
                { id: 'week', label: 'Неделя' },
                { id: 'month', label: 'Месяц' },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => handlePeriodChange(p.id as any)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold uppercase transition-all ${
                    periodMode === p.id
                      ? 'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-950/50 border border-violet-400/30'
                      : 'bg-slate-900/80 text-slate-400 border border-white/10 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {/* ROW 2: SHIFT BUTTONS (ONLY IF TODAY OR YESTERDAY) */}
            {(periodMode === 'today' || periodMode === 'yesterday') && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                {[
                  { index: 1, label: '02:00–08:00' },
                  { index: 2, label: '08:00–14:00' },
                  { index: 3, label: '14:00–20:00' },
                  { index: 4, label: '20:00–02:00' },
                ].map((s) => {
                  const isCurrentActive = periodMode === 'today' && currentKyivShiftIndex === s.index;
                  const isDisabled = periodMode === 'today' && s.index > currentKyivShiftIndex;

                  return (
                    <button
                      key={s.index}
                      onClick={() => !isDisabled && handleShiftChange(s.index as any)}
                      disabled={isDisabled}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                        isDisabled
                          ? 'bg-slate-950/40 text-slate-600 border border-white/5 cursor-not-allowed opacity-50'
                          : selectedShiftIndex === s.index
                          ? 'bg-violet-500/20 text-violet-300 border border-violet-500/50 shadow-md'
                          : 'bg-slate-900/70 text-slate-400 border border-white/10 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {isCurrentActive && (
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                        </span>
                      )}
                      <span>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* SORTING CONTROLS */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-white/10">
              <span className="text-[10px] uppercase font-bold text-slate-400">
                Сортировка по:
              </span>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                {[
                  { id: 'messages', label: 'Сообщения' },
                  { id: 'reply_time', label: 'Время ответа' },
                  { id: 'ppv_sent', label: 'PPV отправлено' },
                  { id: 'ppv_sold', label: 'PPV продано' },
                  { id: 'earnings', label: 'Доход' },
                ].map((sortItem) => {
                  const isActive = sortBy === sortItem.id;
                  return (
                    <button
                      key={sortItem.id}
                      onClick={() => handleSortChange(sortItem.id as any)}
                      className={`px-3 py-1.5 rounded-xl font-bold uppercase transition-all flex items-center gap-1 ${
                        isActive
                          ? 'bg-violet-600 text-white shadow-md border border-violet-400/40'
                          : 'bg-slate-900 border border-white/10 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <span>{sortItem.label}</span>
                      {isActive && (
                        <span className="text-[10px]">
                          {sortDir === 'asc' ? '▲' : '▼'}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* CONTENT */}
          {isOperatorsLoading && operators.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <RefreshCw size={24} className="animate-spin text-violet-400 mx-auto" />
              <p className="text-xs font-mono text-slate-400">Загрузка метрик операторов за выбранный период...</p>
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
            <div className="p-10 bg-slate-900/40 rounded-2xl border border-dashed border-white/15 text-center space-y-2 font-mono">
              <UserCheck size={32} className="text-slate-500 mx-auto mb-1" />
              <p className="text-sm font-bold text-slate-300">
                {periodMode === 'today' ? 'Нет активных операторов в текущую смену' : 'Нет данных за выбранный период'}
              </p>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {periodMode === 'today'
                  ? `В текущую смену (${shiftInfo?.label || 'текущее время'}) операторы пока не отправляли сообщений.`
                  : `За период (${shiftInfo?.label || 'выбранный период'}) активные сообщения операторов не зафиксированы.`
                }
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
                          ? 'bg-slate-900/90 border border-amber-500/50 shadow-lg shadow-amber-500/10 hover:border-amber-400/70 hover:bg-slate-900'
                          : rank === 2
                          ? 'bg-slate-900/85 border border-slate-300/40 shadow-md shadow-slate-400/5 hover:border-slate-300/60 hover:bg-slate-900'
                          : rank === 3
                          ? 'bg-slate-900/85 border border-orange-600/40 shadow-md shadow-orange-700/5 hover:border-orange-500/60 hover:bg-slate-900'
                          : 'bg-slate-900/80 border border-white/15 hover:border-violet-500/40 hover:bg-slate-800/90'
                      }`}
                    >
                      {/* TOP SECTION: RANK, MODEL AVATARS STACK, NAME, ID */}
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 shadow-md ${
                          rank === 1 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
                          rank === 2 ? 'bg-slate-400/20 text-slate-300 border border-slate-400/40' :
                          rank === 3 ? 'bg-amber-700/20 text-amber-500 border border-amber-700/40' :
                          'bg-slate-950 text-slate-400 border border-white/10'
                        }`}>
                          {rank === 1 ? <Award size={16} /> : `#${rank}`}
                        </div>

                        {/* MODEL AVATARS STACK */}
                        {(() => {
                          const matchedAccounts = (op.creator_ids || [])
                            .map(id => accounts.find(a => String(a.id) === String(id)))
                            .filter(Boolean) as OnlyMonsterAccount[];

                          if (matchedAccounts.length === 0) {
                            return (
                              <div 
                                title="Нет привязанных моделей"
                                className="w-10 h-10 rounded-full bg-slate-950 border border-white/10 flex items-center justify-center text-slate-500 shrink-0 shadow-sm"
                              >
                                <User size={18} className="text-slate-500" />
                              </div>
                            );
                          }

                          const MAX_DISPLAY = 4;
                          const showOverflow = matchedAccounts.length > MAX_DISPLAY;
                          const visibleAccounts = showOverflow ? matchedAccounts.slice(0, MAX_DISPLAY - 1) : matchedAccounts;
                          const remainingCount = matchedAccounts.length - visibleAccounts.length;

                          return (
                            <div className="flex items-center -space-x-3 shrink-0 py-0.5">
                              {visibleAccounts.map((acc) => (
                                <div
                                  key={acc.id}
                                  onClick={(e) => handleModelAvatarClick(e, op.user_id, op.name, acc.id, acc.name, acc.avatar_url)}
                                  title={`Кликни для метрик по модели: ${acc.name}`}
                                  className="relative w-10 h-10 rounded-full bg-gradient-to-br from-violet-700 to-indigo-900 border-2 border-slate-900 flex items-center justify-center text-white font-black text-xs shadow-md shrink-0 overflow-hidden cursor-pointer hover:scale-105 hover:border-violet-400 transition-all"
                                >
                                  <span className="absolute inset-0 flex items-center justify-center text-white font-black text-xs">
                                    {acc.name.charAt(0).toUpperCase()}
                                  </span>
                                  {acc.avatar_url && (
                                    <img
                                      src={acc.avatar_url}
                                      alt={acc.name}
                                      className="absolute inset-0 w-full h-full object-cover"
                                      onError={(e) => {
                                        (e.target as HTMLElement).style.display = 'none';
                                      }}
                                    />
                                  )}
                                </div>
                              ))}
                              {showOverflow && (
                                <div
                                  title={`Еще ${remainingCount} моделей: ${matchedAccounts.slice(MAX_DISPLAY - 1).map(a => a.name).join(', ')}`}
                                  className="w-10 h-10 rounded-full bg-slate-800 border-2 border-slate-900 flex items-center justify-center text-slate-300 font-bold text-xs shadow-md shrink-0 cursor-pointer"
                                >
                                  +{remainingCount}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        <div className="min-w-0 flex-1">
                          <h4 className="text-sm font-black text-white truncate group-hover:text-violet-300 transition-colors">
                            {op.name}
                          </h4>
                          <span className="text-[10px] text-slate-400 block truncate">
                            ID: {op.user_id || '—'}
                          </span>
                        </div>
                      </div>

                      {/* BOTTOM SECTION: 5 METRICS GRID */}
                      <div className="space-y-2 pt-3 border-t border-white/15">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-center">
                          <div className="p-2.5 bg-slate-800/60 rounded-2xl border border-white/10 shadow-inner">
                            <span className="text-[8px] uppercase text-slate-400 font-bold block">Сообщения</span>
                            <span className="text-xs font-black text-slate-200 block mt-0.5">
                              {op.messages_count}
                            </span>
                          </div>

                          <div className="p-2.5 bg-slate-800/60 rounded-2xl border border-white/10 shadow-inner">
                            <span className="text-[8px] uppercase text-slate-400 font-bold block">Ср. время</span>
                            <span className={`text-xs font-black block mt-0.5 ${getReplyTimeColorClass(op.reply_time_avg)}`}>
                              {formatDuration(op.reply_time_avg)}
                            </span>
                          </div>

                          <div className="p-2.5 bg-slate-800/60 rounded-2xl border border-white/10 shadow-inner">
                            <span className="text-[8px] uppercase text-slate-400 font-bold block">PPV Отпр.</span>
                            <span className="text-xs font-black text-violet-300 block mt-0.5">
                              {op.paid_messages_count}
                            </span>
                          </div>

                          <div className="p-2.5 bg-slate-800/60 rounded-2xl border border-white/10 shadow-inner">
                            <span className="text-[8px] uppercase text-slate-400 font-bold block">PPV Прод.</span>
                            <span className="text-xs font-black text-emerald-400 block mt-0.5">
                              {op.sold_messages_count}
                            </span>
                          </div>

                          <div className="p-2.5 bg-slate-800/60 rounded-2xl border border-white/10 shadow-inner">
                            <span className="text-[8px] uppercase text-slate-400 font-bold block">Доход</span>
                            <span className="text-xs font-black text-emerald-300 block mt-0.5">
                              ${op.earnings ?? 0}
                            </span>
                          </div>
                        </div>

                        {ppvConversion !== null && (
                          <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-300 pt-1 px-1">
                            <span className="text-slate-400 uppercase text-[8px]">Конверсия PPV:</span>
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

          {/* MODEL BREAKDOWN POPOVER MODAL */}
          {activeBreakdown && (
            <div
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 font-mono"
              onClick={() => setActiveBreakdown(null)}
            >
              <div
                className="glass-card p-5 rounded-2xl border border-white/20 bg-slate-900 text-white max-w-sm w-full space-y-4 shadow-2xl relative"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  onClick={() => setActiveBreakdown(null)}
                  className="absolute top-3 right-3 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800/60 transition-colors"
                >
                  <X size={16} />
                </button>

                <div className="flex items-center gap-3 pr-6">
                  {activeBreakdown.avatarUrl ? (
                    <img src={activeBreakdown.avatarUrl} alt={activeBreakdown.modelName} className="w-10 h-10 rounded-full object-cover border border-white/20 shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-violet-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {activeBreakdown.modelName.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <h4 className="text-sm font-black text-white truncate">{activeBreakdown.modelName}</h4>
                    <span className="text-[10px] text-slate-400 block truncate">
                      Оператор: <strong className="text-violet-300">{activeBreakdown.operatorName}</strong>
                    </span>
                  </div>
                </div>

                {(() => {
                  const cacheKey = `${activeBreakdown.userId}_${activeBreakdown.creatorId}_${shiftInfo?.start || ''}_${shiftInfo?.end || ''}`;
                  const bState = breakdownCache[cacheKey];

                  if (!bState || bState.loading) {
                    return (
                      <div className="p-6 text-center space-y-2">
                        <RefreshCw size={20} className="animate-spin text-violet-400 mx-auto" />
                        <span className="text-xs text-slate-400 block">Загрузка данных по модели...</span>
                      </div>
                    );
                  }

                  if (bState.error) {
                    return (
                      <div className="p-3 bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs rounded-xl">
                        {bState.error}
                      </div>
                    );
                  }

                  const m = bState.metrics;
                  return (
                    <div className="space-y-3 pt-2 border-t border-white/10">
                      <span className="text-[10px] font-bold text-violet-400 uppercase block">
                        За период ({shiftInfo?.label || 'выбранный период'}):
                      </span>

                      <div className="grid grid-cols-2 gap-2 text-center text-xs">
                        <div className="p-2.5 bg-slate-800/60 rounded-xl border border-white/10">
                          <span className="text-[8px] uppercase text-slate-400 block font-bold">Сообщения</span>
                          <span className="font-black text-slate-100 text-sm mt-0.5 block">{m?.messages_count ?? 0}</span>
                        </div>

                        <div className="p-2.5 bg-slate-800/60 rounded-xl border border-white/10">
                          <span className="text-[8px] uppercase text-slate-400 block font-bold">Ср. время ответа</span>
                          <span className="font-black text-violet-300 text-sm mt-0.5 block">{formatDuration(m?.reply_time_avg)}</span>
                        </div>

                        <div className="p-2.5 bg-slate-800/60 rounded-xl border border-white/10">
                          <span className="text-[8px] uppercase text-slate-400 block font-bold">PPV Отправлено</span>
                          <span className="font-black text-violet-300 text-sm mt-0.5 block">{m?.paid_messages_count ?? 0}</span>
                        </div>

                        <div className="p-2.5 bg-slate-800/60 rounded-xl border border-white/10">
                          <span className="text-[8px] uppercase text-slate-400 block font-bold">PPV Продано</span>
                          <span className="font-black text-emerald-400 text-sm mt-0.5 block">{m?.sold_messages_count ?? 0}</span>
                        </div>
                      </div>

                      <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-center">
                        <span className="text-[9px] uppercase text-emerald-400 font-bold block">Доход на модели</span>
                        <span className="text-lg font-black text-emerald-300 mt-0.5 block">${m?.earnings ?? 0}</span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

