import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Settings, 
  RefreshCw, 
  AlertCircle, 
  Lock, 
  Eye, 
  EyeOff, 
  Check, 
  Search, 
  Users, 
  CheckCircle2, 
  XCircle, 
  ExternalLink,
  HelpCircle,
  Copy,
  ChevronDown,
  ChevronUp,
  Globe,
  Sparkles,
  Layers
} from 'lucide-react';

interface OnlyMonsterTabProps {
  agencyModels: string[];
}

interface OnlyMonsterAccount {
  id: string;
  name: string;
  platform: string;
  status: 'active' | 'inactive' | 'online' | string;
  unread_chats: number;
  active_operators: number;
  today_earnings: number;
  handle?: string;
  avatar_url?: string;
}

export const OnlyMonsterTab: React.FC<OnlyMonsterTabProps> = ({ agencyModels }) => {
  // Config state
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Accounts & API state
  const [accounts, setAccounts] = useState<OnlyMonsterAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [connStatus, setConnStatus] = useState<'idle' | 'testing' | 'live' | 'not_configured' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showHelp, setShowHelp] = useState(true);
  const [copiedUrl, setCopiedUrl] = useState(false);

  // Webhook URL
  const webhookUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/api/webhook`;

  // Load current configuration from server
  const loadConfig = async () => {
    try {
      const res = await fetch('/api/onlymonster/config');
      if (res.ok) {
        const data = await res.json();
        if (data.token && !data.token.startsWith('om_token_fc269e0')) {
          setApiKey(data.token);
          if (data.apiKeyConfigured) {
            fetchAccounts(data.token);
          } else {
            setConnStatus('not_configured');
            setStatusMessage('API-ключ не настроен. Введите токен из вашего кабинета OnlyMonster.');
          }
        } else {
          setConnStatus('not_configured');
          setStatusMessage('API-ключ не настроен. Введите токен из вашего кабинета OnlyMonster.');
        }
      }
    } catch (e) {
      console.error('Error loading OnlyMonster config:', e);
      setConnStatus('not_configured');
    }
  };

  // Fetch real accounts from OnlyMonster API
  const fetchAccounts = async (keyOverride?: string) => {
    const keyToUse = keyOverride || apiKey;
    if (!keyToUse || keyToUse.trim().length < 5 || keyToUse.startsWith('om_token_fc269e0')) {
      setConnStatus('not_configured');
      setStatusMessage('Введите действующий API-ключ OnlyMonster.');
      setAccounts([]);
      return;
    }

    setIsLoading(true);
    setConnStatus('testing');
    setStatusMessage('Запрос к OnlyMonster Browser API (https://omapi.onlymonster.ai/api/v0/accounts)...');

    try {
      const res = await fetch('/api/onlymonster/proxy?path=accounts');
      if (res.ok) {
        const data = await res.json();

        if (data && (data.not_configured || data.success === false && data.error)) {
          setConnStatus('error');
          setStatusMessage(data.error || 'Ошибка авторизации. Проверьте ваш API-ключ.');
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
          const parsedAccounts: OnlyMonsterAccount[] = rawList.map((acc: any, index: number) => ({
            id: String(acc.id || acc.account_id || `acc_${index + 1}`),
            name: acc.name || acc.title || acc.model_name || agencyModels[index] || `Модель ${index + 1}`,
            handle: acc.username || acc.handle || acc.of_handle || '',
            platform: acc.platform || 'OnlyFans',
            status: acc.status === 'inactive' ? 'inactive' : 'active',
            unread_chats: typeof acc.unread_chats === 'number' ? acc.unread_chats : (acc.unread_count || 0),
            active_operators: typeof acc.active_operators === 'number' ? acc.active_operators : (acc.operators_count || 1),
            today_earnings: typeof acc.today_earnings === 'number' ? acc.today_earnings : (acc.earnings_today || 0)
          }));

          setAccounts(parsedAccounts);
          setConnStatus('live');
          setStatusMessage(`Успешно подключено! Синхронизировано моделей из OnlyMonster: ${parsedAccounts.length}`);
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

  // Save config and immediately test connection
  const handleSaveAndConnect = async () => {
    const cleanKey = apiKey.trim();
    if (!cleanKey || cleanKey.length < 5) {
      setSaveMessage({ type: 'error', text: 'Пожалуйста, введите корректный API-ключ OnlyMonster' });
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);

    try {
      const res = await fetch('/api/onlymonster/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: cleanKey })
      });

      if (res.ok) {
        setSaveMessage({ type: 'success', text: 'Ключ сохранён! Проверяем подключение...' });
        await fetchAccounts(cleanKey);
      } else {
        setSaveMessage({ type: 'error', text: 'Ошибка сохранения настроек на сервере' });
      }
    } catch (e) {
      setSaveMessage({ type: 'error', text: 'Ошибка сети при сохранении настроек' });
    } finally {
      setIsSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
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
      {/* INTEGRATION STATUS & HEADER */}
      <div className="glass-card p-5 rounded-3xl border border-violet-500/20 bg-slate-950/70 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 border border-violet-400/30 flex items-center justify-center text-white shadow-lg shadow-violet-950/50">
            <Zap size={22} className="animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-base font-black uppercase text-white font-mono tracking-wider">Синхронизация OnlyMonster Browser</h2>
              {connStatus === 'live' ? (
                <span className="text-[9px] font-mono font-black uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  ПОДКЛЮЧЕНО (LIVE)
                </span>
              ) : connStatus === 'testing' ? (
                <span className="text-[9px] font-mono font-black uppercase px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                  <RefreshCw size={10} className="animate-spin text-indigo-400" />
                  ПРОВЕРКА...
                </span>
              ) : connStatus === 'error' ? (
                <span className="text-[9px] font-mono font-black uppercase px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center gap-1.5">
                  <XCircle size={10} />
                  ОШИБКА
                </span>
              ) : (
                <span className="text-[9px] font-mono font-black uppercase px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
                  <AlertCircle size={10} />
                  КЛЮЧ НЕ ВВЕДЕН
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              {connStatus === 'live' ? (
                <>Подключенные модели: <span className="text-violet-300 font-bold">{accounts.length}</span> • Прямой режим (без симуляции)</>
              ) : (
                <>Настройте Ваш API-ключ ниже для прямой загрузки моделей из OnlyMonster</>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchAccounts()}
            disabled={isLoading || !apiKey}
            className="px-4 py-2.5 bg-slate-900 border border-white/10 hover:border-violet-500/40 hover:bg-slate-800 text-xs font-mono font-bold uppercase text-slate-200 rounded-xl transition-all flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed shadow-md"
            title="Обновить список моделей из OnlyMonster API"
          >
            <RefreshCw size={14} className={isLoading ? "animate-spin text-violet-400" : ""} />
            {isLoading ? 'Загрузка...' : 'Обновить данные'}
          </button>
        </div>
      </div>

      {/* SECTION 1: API KEY & CONFIGURATION PANEL */}
      <div className="glass-card p-6 rounded-3xl border border-white/10 bg-slate-950/60 space-y-5">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div className="flex items-center gap-2.5">
            <Settings size={18} className="text-violet-400" />
            <h3 className="text-sm font-black uppercase text-white font-mono tracking-wider">
              Настройка API-Ключа OnlyMonster
            </h3>
          </div>
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="text-xs font-mono text-violet-400 hover:text-violet-300 flex items-center gap-1 bg-violet-500/10 hover:bg-violet-500/20 px-3 py-1.5 rounded-xl border border-violet-500/20 transition-all"
          >
            <HelpCircle size={14} />
            {showHelp ? 'Скрыть инструкцию' : 'Как получить ключ?'}
          </button>
        </div>

        {/* STEP BY STEP INSTRUCTION BANNER */}
        <AnimatePresence>
          {showHelp && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="p-4 bg-violet-950/20 border border-violet-500/25 rounded-2xl space-y-3 font-mono text-xs">
                <div className="flex items-center gap-2 text-violet-300 font-bold uppercase tracking-wider text-[11px]">
                  <Sparkles size={14} className="text-violet-400" />
                  Пошаговая инструкция для подключения вашей агенции:
                </div>
                <ol className="list-decimal list-inside space-y-2 text-slate-300 leading-relaxed text-[11px]">
                  <li>
                    Откройте панель управления <strong className="text-white">OnlyMonster Browser / Dashboard</strong>.
                  </li>
                  <li>
                    Перейдите в раздел <strong className="text-white">Settings (Настройки) → API & Webhooks</strong>.
                  </li>
                  <li>
                    Скопируйте ваш персональный <strong className="text-violet-300">API Key / Token</strong> и вставьте его в поле ниже.
                  </li>
                  <li>
                    (Опционально) Скопируйте ссылку Webhook и укажите её в OnlyMonster для мгновенного получения уведомлений.
                  </li>
                </ol>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* INPUT FORM */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-end">
          <div className="lg:col-span-8 space-y-2">
            <label className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <Lock size={13} className="text-violet-400" />
              API Key OnlyMonster (Bearer Token)
            </label>
            <div className="relative flex items-center bg-slate-900/90 border border-white/10 rounded-2xl px-3.5 py-3 focus-within:border-violet-500/50 transition-all">
              <input 
                type={showApiKey ? "text" : "password"} 
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Вставьте ваш API токен (например: om_token_... или om_key_...)" 
                className="bg-transparent border-none text-xs text-white focus:outline-none focus:ring-0 w-full font-mono placeholder-slate-600"
              />
              <button 
                onClick={() => setShowApiKey(!showApiKey)}
                className="p-1.5 hover:bg-white/[0.08] rounded-xl text-slate-400 transition-all shrink-0"
                title={showApiKey ? "Скрыть ключ" : "Показать ключ"}
              >
                {showApiKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="lg:col-span-4">
            <button 
              onClick={handleSaveAndConnect}
              disabled={isSaving || !apiKey.trim()}
              className="w-full py-3 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-xs font-mono font-bold uppercase text-white rounded-2xl shadow-lg shadow-violet-950/50 transition-all flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <RefreshCw size={14} className="animate-spin" />
                  Сохранение...
                </>
              ) : (
                <>
                  <Check size={14} />
                  Сохранить и подключить API
                </>
              )}
            </button>
          </div>
        </div>

        {/* STATUS & FEEDBACK NOTIFICATION */}
        {saveMessage && (
          <p className={`text-xs font-mono font-bold ${saveMessage.type === 'success' ? 'text-emerald-400' : 'text-rose-400'}`}>
            {saveMessage.text}
          </p>
        )}

        {statusMessage && (
          <div className={`p-3.5 rounded-2xl border flex gap-3 items-start ${
            connStatus === 'live' 
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300' 
              : connStatus === 'error'
              ? 'bg-rose-950/20 border-rose-500/30 text-rose-300'
              : 'bg-slate-900/60 border-white/10 text-slate-300'
          }`}>
            {connStatus === 'live' ? (
              <CheckCircle2 size={16} className="text-emerald-400 shrink-0 mt-0.5" />
            ) : connStatus === 'error' ? (
              <XCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle size={16} className="text-amber-400 shrink-0 mt-0.5" />
            )}
            <p className="text-xs leading-relaxed font-mono font-medium">{statusMessage}</p>
          </div>
        )}

        {/* WEBHOOK LINK CARD */}
        <div className="pt-2">
          <div className="p-3.5 bg-slate-900/40 rounded-2xl border border-white/5 flex flex-wrap items-center justify-between gap-3 font-mono text-xs">
            <div className="flex items-center gap-2 text-slate-400">
              <Globe size={14} className="text-indigo-400" />
              <span>Webhook URL для синхронизации транзакций:</span>
              <code className="text-indigo-300 bg-slate-950 px-2 py-0.5 rounded border border-white/5 text-[11px]">
                {webhookUrl}
              </code>
            </div>
            <button
              onClick={() => copyToClipboard(webhookUrl)}
              className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-xl text-[10px] uppercase font-bold flex items-center gap-1.5 transition-all"
            >
              {copiedUrl ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              {copiedUrl ? 'Скопировано' : 'Копировать Ссылку'}
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: CONNECTED MODEL ACCOUNTS LIST */}
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

          {/* SEARCH FILTER */}
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
        </div>

        {/* ACCOUNTS GRID / LIST */}
        {connStatus === 'not_configured' ? (
          <div className="p-8 bg-slate-900/30 rounded-2xl border border-dashed border-white/10 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
              <Lock size={20} />
            </div>
            <h4 className="text-sm font-black text-slate-200 font-mono uppercase">API-Ключ не введён</h4>
            <p className="text-xs font-mono text-slate-400 max-w-md mx-auto leading-relaxed">
              Для отображения ваших подключенных аккаунтов из OnlyMonster Browser, пожалуйста, укажите ваш API-ключ в поле выше и нажмите <strong className="text-white">Сохранить и подключить API</strong>.
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
                    <span className="text-xs font-black text-emerald-400 block mt-0.5">
                      +${acc.today_earnings}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
