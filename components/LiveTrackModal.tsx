import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  RefreshCw, 
  Clock, 
  Crown, 
  Eye, 
  EyeOff, 
  Info, 
  Check, 
  Award, 
  Users,
  Flame,
  Zap
} from 'lucide-react';

interface OnlyMonsterAccount {
  id: string;
  platform_account_id: string;
  name: string;
  platform: string;
  status: 'active' | 'inactive' | 'online' | string;
  avatar_url?: string;
}

interface ShiftOperator {
  user_id: string;
  name: string;
  avatar: string;
  messages_count: number;
  paid_messages_count: number;
  sold_messages_count: number;
  fans_count?: number;
  earnings?: number;
  reply_time_avg?: number | null;
  creator_ids?: string[];
}

interface LiveTrackModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialOperators: ShiftOperator[];
  initialShiftInfo: { label: string; start: string; end: string } | null;
  periodMode: 'today' | 'yesterday' | 'week' | 'month';
  selectedShiftIndex: 1 | 2 | 3 | 4;
  sortBy: 'messages' | 'reply_time' | 'ppv_sent' | 'ppv_sold' | 'earnings';
  sortDir: 'asc' | 'desc';
  accounts: OnlyMonsterAccount[];
  currentKyivShiftIndex: number;
}

function formatDuration(seconds?: number | null): string {
  if (seconds === null || seconds === undefined || isNaN(seconds) || seconds <= 0) {
    return '—';
  }
  const s = Math.round(seconds);
  if (s < 60) return `${s}с`;
  if (s < 3600) {
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    return secs > 0 ? `${mins}м ${secs}с` : `${mins}м`;
  }
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  return mins > 0 ? `${hours}ч ${mins}м` : `${hours}ч`;
}

export const LiveTrackModal: React.FC<LiveTrackModalProps> = ({
  isOpen,
  onClose,
  initialOperators,
  initialShiftInfo,
  periodMode,
  selectedShiftIndex,
  sortBy,
  sortDir,
  accounts,
  currentKyivShiftIndex
}) => {
  const [operators, setOperators] = useState<ShiftOperator[]>(initialOperators);
  const [shiftInfo, setShiftInfo] = useState<{ label: string; start: string; end: string } | null>(initialShiftInfo);
  const [hiddenOperatorIds, setHiddenOperatorIds] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [secondsAgo, setSecondsAgo] = useState<number>(0);
  const [remainingTimeText, setRemainingTimeText] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState<boolean>(true);

  // Sync initial props when modal opens
  useEffect(() => {
    if (isOpen) {
      setOperators(initialOperators);
      setShiftInfo(initialShiftInfo);
      setHiddenOperatorIds(new Set());
      setLastUpdated(new Date());
      setSecondsAgo(0);
    }
  }, [isOpen, initialOperators, initialShiftInfo]);

  // Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Fetch updated data for track
  const fetchTrackData = async () => {
    setIsRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (periodMode === 'today' || periodMode === 'yesterday') {
        params.append('period', 'shift');
        params.append('day', periodMode);
        params.append('shift', String(selectedShiftIndex));
      } else if (periodMode === 'week') {
        params.append('period', 'week');
      } else if (periodMode === 'month') {
        params.append('period', 'month');
      }
      params.append('sortBy', sortBy);
      params.append('sortDir', sortDir);

      const url = `/api/onlymonster/shift-operators?${params.toString()}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          if (data.operators) setOperators(data.operators);
          if (data.shift) setShiftInfo(data.shift);
          setLastUpdated(new Date());
          setSecondsAgo(0);
        }
      }
    } catch (e) {
      console.error('Failed to auto-refresh track data', e);
    } finally {
      setIsRefreshing(false);
    }
  };

  // 15-second polling timer with tab visibility handling
  useEffect(() => {
    if (!isOpen) return;

    let pollInterval: NodeJS.Timeout | null = null;

    const startPolling = () => {
      if (!pollInterval) {
        pollInterval = setInterval(() => {
          if (!document.hidden) {
            fetchTrackData();
          }
        }, 15000);
      }
    };

    const stopPolling = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    startPolling();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchTrackData();
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isOpen, periodMode, selectedShiftIndex, sortBy, sortDir]);

  // "Seconds ago" ticker
  useEffect(() => {
    if (!isOpen) return;
    const ticker = setInterval(() => {
      const diff = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
      setSecondsAgo(diff);
    }, 1000);
    return () => clearInterval(ticker);
  }, [isOpen, lastUpdated]);

  // Countdown timer until end of shift
  const isCurrentActiveShift = periodMode === 'today' && selectedShiftIndex === currentKyivShiftIndex;
  
  useEffect(() => {
    if (!isOpen || !isCurrentActiveShift || !shiftInfo?.end) {
      setRemainingTimeText(null);
      return;
    }

    const updateCountdown = () => {
      const endMs = new Date(shiftInfo.end).getTime();
      const nowMs = Date.now();
      const diffMs = endMs - nowMs;

      if (diffMs <= 0) {
        setRemainingTimeText('Смена завершена');
      } else {
        const totalSecs = Math.floor(diffMs / 1000);
        const hours = Math.floor(totalSecs / 3600);
        const mins = Math.floor((totalSecs % 3600) / 60);
        const secs = totalSecs % 60;
        
        const hStr = hours > 0 ? `${hours}ч ` : '';
        const mStr = `${mins.toString().padStart(2, '0')}м `;
        const sStr = `${secs.toString().padStart(2, '0')}с`;
        setRemainingTimeText(`${hStr}${mStr}${sStr}`);
      }
    };

    updateCountdown();
    const countdownTimer = setInterval(updateCountdown, 1000);
    return () => clearInterval(countdownTimer);
  }, [isOpen, isCurrentActiveShift, shiftInfo?.end]);

  if (!isOpen) return null;

  // Toggle hiding an operator
  const toggleOperatorHide = (userId: string) => {
    setHiddenOperatorIds(prev => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const showAllOperators = () => setHiddenOperatorIds(new Set());
  const hideAllOperators = () => setHiddenOperatorIds(new Set(operators.map(o => o.user_id)));

  // Filter visible operators
  const visibleOperators = operators.filter(op => !hiddenOperatorIds.has(op.user_id));

  // Sort label & extraction helpers
  const sortLabels: Record<string, string> = {
    messages: 'Сообщения',
    reply_time: 'Время ответа',
    ppv_sent: 'PPV отправлено',
    ppv_sold: 'PPV продано',
    earnings: 'Доход ($)'
  };

  const getMetricRawValue = (op: ShiftOperator): number | null => {
    if (sortBy === 'messages') return op.messages_count;
    if (sortBy === 'reply_time') return op.reply_time_avg ?? null;
    if (sortBy === 'ppv_sent') return op.paid_messages_count;
    if (sortBy === 'ppv_sold') return op.sold_messages_count;
    if (sortBy === 'earnings') return op.earnings ?? 0;
    return op.messages_count;
  };

  const getMetricDisplayValue = (op: ShiftOperator): string => {
    if (sortBy === 'messages') return `${op.messages_count}`;
    if (sortBy === 'reply_time') return formatDuration(op.reply_time_avg);
    if (sortBy === 'ppv_sent') return `${op.paid_messages_count}`;
    if (sortBy === 'ppv_sold') {
      const pct = op.paid_messages_count > 0 
        ? Math.round((op.sold_messages_count / op.paid_messages_count) * 100) 
        : 0;
      return `${op.sold_messages_count} (${pct}%)`;
    }
    if (sortBy === 'earnings') return `$${(op.earnings ?? 0).toLocaleString()}`;
    return String(op.messages_count);
  };

  // Calculate track position percentage (0 - 100%) for each visible operator
  // Relative to max/min among VISIBLE operators
  const calculatePositionPercentage = (op: ShiftOperator): number => {
    if (visibleOperators.length <= 1) return 90; // If only 1, place near finish

    if (sortBy === 'reply_time') {
      // Lower time is better
      const validTimes = visibleOperators
        .map(o => o.reply_time_avg)
        .filter((t): t is number => t !== null && t !== undefined && !isNaN(t));

      if (validTimes.length === 0) return 10;
      const minTime = Math.min(...validTimes); // Best time
      const maxTime = Math.max(...validTimes); // Worst time

      const val = op.reply_time_avg;
      if (val === null || val === undefined) return 5; // Start line if no replies

      if (sortDir === 'asc') {
        // Lower time = closer to finish line (100)
        if (maxTime === minTime) return 90;
        const normalized = (maxTime - val) / (maxTime - minTime);
        return Math.round(normalized * 85 + 8);
      } else {
        if (maxTime === minTime) return 90;
        const normalized = (val - minTime) / (maxTime - minTime);
        return Math.round(normalized * 85 + 8);
      }
    } else {
      // Normal metric: higher is better (unless asc)
      const values = visibleOperators.map(o => getMetricRawValue(o) ?? 0);
      const maxVal = Math.max(...values, 0);
      const minVal = Math.min(...values, 0);

      const val = getMetricRawValue(op) ?? 0;

      if (sortDir === 'asc') {
        if (maxVal === minVal) return 90;
        const normalized = (maxVal - val) / (maxVal - minVal);
        return Math.round(normalized * 85 + 8);
      } else {
        if (maxVal === 0) return 5;
        const normalized = val / maxVal;
        return Math.round(normalized * 85 + 8);
      }
    }
  };

  // Identify Leader (operator with highest position)
  let leaderUserId: string | null = null;
  if (visibleOperators.length > 0) {
    let bestPct = -1;
    visibleOperators.forEach(op => {
      const pct = calculatePositionPercentage(op);
      if (pct > bestPct) {
        bestPct = pct;
        leaderUserId = op.user_id;
      }
    });
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4 md:p-6 transition-all duration-300"
      onClick={onClose}
    >
      <div 
        className="w-full max-w-7xl h-[92vh] bg-slate-950 border border-cyan-500/30 rounded-3xl shadow-[0_0_60px_rgba(6,182,212,0.2)] flex flex-col overflow-hidden text-slate-100 font-mono relative"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-slate-900 via-blue-950/80 to-slate-900 border-b border-white/10 flex flex-wrap items-center justify-between gap-3 shrink-0 relative z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(6,182,212,0.5)] animate-pulse">
              🏎️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-black uppercase tracking-wider text-cyan-300 flex items-center gap-2">
                  ГОНОЧНЫЙ ТРЭК
                </h3>
                <span className="text-[10px] uppercase font-bold text-slate-400 bg-white/10 px-2 py-0.5 rounded-lg border border-white/15">
                  {shiftInfo?.label || 'Текущая смена'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-bold flex items-center gap-1.5 mt-0.5">
                <span>Сортировка:</span>
                <span className="text-cyan-400 uppercase font-black">
                  {sortLabels[sortBy] || sortBy} ({sortDir === 'asc' ? '▲' : '▼'})
                </span>
              </p>
            </div>
          </div>

          {/* TIMER & LIVE STATUS */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Shift Countdown Timer */}
            {isCurrentActiveShift && remainingTimeText && (
              <div className="px-3.5 py-1.5 bg-emerald-950/60 border border-emerald-500/40 rounded-xl flex items-center gap-2 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                <Clock size={14} className="text-emerald-400 animate-pulse" />
                <div className="text-left">
                  <span className="text-[9px] text-emerald-400 uppercase font-bold block leading-none">
                    До конца смены
                  </span>
                  <span className="text-xs font-black text-emerald-300 tracking-wider">
                    {remainingTimeText}
                  </span>
                </div>
              </div>
            )}

            {/* Live Data Status Indicator */}
            <div className="px-3 py-1.5 bg-slate-900 border border-white/10 rounded-xl flex items-center gap-2 text-xs">
              <span className="relative flex h-2.5 w-2.5">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${isRefreshing ? 'bg-cyan-400' : 'bg-emerald-400'} opacity-75`}></span>
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isRefreshing ? 'bg-cyan-500' : 'bg-emerald-500'}`}></span>
              </span>
              <span className="text-[11px] text-slate-300 font-bold">
                {isRefreshing ? 'Обновление...' : secondsAgo === 0 ? 'Обновлено только что' : `Обновлено ${secondsAgo}с назад`}
              </span>
              <button 
                onClick={fetchTrackData}
                disabled={isRefreshing}
                title="Обновить вручную"
                className="p-1 text-slate-400 hover:text-cyan-300 transition-colors disabled:opacity-50"
              >
                <RefreshCw size={12} className={isRefreshing ? 'animate-spin text-cyan-400' : ''} />
              </button>
            </div>

            {/* Participants Panel Toggle */}
            <button
              onClick={() => setShowSidebar(!showSidebar)}
              className={`px-3 py-1.5 rounded-xl border text-xs font-bold uppercase transition-all flex items-center gap-2 ${
                showSidebar 
                  ? 'bg-violet-600/30 border-violet-500/50 text-violet-300' 
                  : 'bg-slate-900 border-white/15 text-slate-400 hover:text-slate-200'
              }`}
            >
              {showSidebar ? <Eye size={14} /> : <EyeOff size={14} />}
              <span>Участники ({visibleOperators.length}/{operators.length})</span>
            </button>

            {/* Close Button */}
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-xl bg-slate-900 border border-white/15 hover:border-rose-500/50 hover:bg-rose-950/50 text-slate-400 hover:text-rose-300 transition-all flex items-center justify-center shrink-0"
              title="Закрыть трэк (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* MAIN BODY: TRACK + PARTICIPANTS SIDEBAR */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* TRACK AREA */}
          <div className="flex-1 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 p-4 sm:p-6 overflow-y-auto flex flex-col justify-between relative">
            
            {/* START / FINISH MARKERS IN BACKGROUND */}
            <div className="absolute inset-x-4 sm:inset-x-6 top-4 bottom-4 pointer-events-none flex justify-between z-0 opacity-40">
              {/* Start Line */}
              <div className="w-8 border-r-2 border-dashed border-red-500/60 flex flex-col items-center justify-between py-2 text-[9px] font-black text-red-400 uppercase tracking-widest select-none">
                <span className="rotate-90 origin-center whitespace-nowrap mt-4">🚩 СТАРТ</span>
                <span className="rotate-90 origin-center whitespace-nowrap mb-4">START</span>
              </div>

              {/* Finish Line Checkered Pattern */}
              <div className="w-10 border-l-2 border-cyan-400/80 bg-[repeating-linear-gradient(45deg,#000,#000_8px,#fff_8px,#fff_16px)] opacity-30 flex flex-col items-center justify-between py-2 text-[9px] font-black text-cyan-300 uppercase tracking-widest select-none">
                <span className="rotate-90 origin-center whitespace-nowrap mt-4 text-black bg-cyan-400 px-1 font-extrabold rounded">🏁 ФИНИШ</span>
                <span className="rotate-90 origin-center whitespace-nowrap mb-4 text-black bg-cyan-400 px-1 font-extrabold rounded">FINISH</span>
              </div>
            </div>

            {/* TRACK LANES */}
            {visibleOperators.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-8 z-10 space-y-3">
                <Users size={48} className="text-slate-600 animate-bounce" />
                <h4 className="text-base font-bold text-slate-300">Все участники скрыты</h4>
                <p className="text-xs text-slate-500 max-w-sm">
                  Включите хотя бы одного оператора в панели участников справа, чтобы отобразить гонку.
                </p>
                <button
                  onClick={showAllOperators}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold text-xs uppercase shadow-md transition-all"
                >
                  Показать всех участников
                </button>
              </div>
            ) : (
              <div className="space-y-3 z-10 my-auto py-4">
                {visibleOperators.map((op, index) => {
                  const isLeader = op.user_id === leaderUserId;
                  const posPct = calculatePositionPercentage(op);
                  const displayValue = getMetricDisplayValue(op);

                  // Model avatars stack
                  const matchedAccounts = (op.creator_ids || [])
                    .map(id => accounts.find(a => String(a.id) === String(id)))
                    .filter(Boolean) as OnlyMonsterAccount[];

                  return (
                    <div 
                      key={op.user_id}
                      className={`relative h-20 sm:h-22 rounded-2xl border transition-all duration-500 flex items-center px-3 sm:px-4 ${
                        isLeader 
                          ? 'bg-gradient-to-r from-amber-950/40 via-blue-950/40 to-slate-900/80 border-amber-500/60 shadow-[0_0_25px_rgba(245,158,11,0.25)]' 
                          : 'bg-slate-900/60 border-white/10 hover:border-cyan-500/30 hover:bg-slate-900/80'
                      }`}
                    >
                      {/* LANE BACKGROUND LINES */}
                      <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px)] bg-[size:5%_100%] pointer-events-none rounded-2xl"></div>

                      {/* FIXED LEFT BADGE: OPERATOR INFO */}
                      <div className="w-36 sm:w-48 shrink-0 flex items-center gap-2.5 z-20 bg-slate-950/80 p-2 rounded-xl border border-white/10 shadow-lg backdrop-blur-sm">
                        <div className={`w-6 h-6 rounded-lg font-black text-[10px] flex items-center justify-center shrink-0 ${
                          isLeader 
                            ? 'bg-amber-500 text-black shadow-[0_0_10px_rgba(245,158,11,0.8)]' 
                            : 'bg-slate-800 text-slate-300 border border-white/10'
                        }`}>
                          {isLeader ? <Crown size={12} className="fill-black" /> : `#${index + 1}`}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-bold truncate ${isLeader ? 'text-amber-300 font-extrabold' : 'text-slate-200'}`}>
                            {op.name}
                          </p>
                          <p className="text-[10px] font-extrabold text-cyan-400">
                            {displayValue}
                          </p>
                        </div>
                      </div>

                      {/* HORIZONTAL MOVING TRACK AREA */}
                      <div className="flex-1 h-full relative mx-4 sm:mx-8">
                        {/* SPEED TRAIL BEHIND CAR */}
                        <div 
                          className={`absolute top-1/2 -translate-y-1/2 h-1.5 rounded-full transition-all duration-1000 ${
                            isLeader 
                              ? 'bg-gradient-to-r from-red-500 via-amber-400 to-cyan-400 shadow-[0_0_12px_rgba(245,158,11,0.8)]' 
                              : 'bg-gradient-to-r from-slate-800 via-blue-600 to-cyan-500 opacity-60'
                          }`}
                          style={{
                            left: '0%',
                            width: `${posPct}%`
                          }}
                        />

                        {/* CAR / OPERATOR AVATAR NODE */}
                        <div 
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex items-center gap-1 z-30 transition-all duration-1000 ease-out"
                          style={{ left: `${posPct}%` }}
                        >
                          {/* Crown for Leader */}
                          {isLeader && (
                            <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-amber-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded-md flex items-center gap-1 shadow-[0_0_10px_rgba(245,158,11,0.8)] animate-bounce">
                              <Crown size={10} className="fill-black" />
                              <span>ЛИДЕР</span>
                            </div>
                          )}

                          {/* RACING CAR + AVATAR CONTAINER */}
                          <div className={`flex items-center gap-1.5 p-1 rounded-full backdrop-blur-md border transition-all ${
                            isLeader 
                              ? 'bg-amber-950/80 border-amber-400 shadow-[0_0_20px_rgba(245,158,11,0.6)] scale-110' 
                              : 'bg-slate-950/90 border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.3)]'
                          }`}>
                            <span className="text-base sm:text-lg leading-none shrink-0">🏎️</span>

                            {op.avatar ? (
                              <img 
                                src={op.avatar} 
                                alt={op.name} 
                                className="w-8 h-8 rounded-full object-cover border border-white/20 shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-300 border border-white/20 shrink-0">
                                {op.name.charAt(0).toUpperCase()}
                              </div>
                            )}

                            <span className="text-[11px] font-black text-white px-2 py-0.5 bg-slate-900/90 rounded-full border border-white/10 shrink-0 whitespace-nowrap">
                              {displayValue}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* BOTTOM TRACK FOOTER LEGEND */}
            <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 z-10">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>Корона = Лидер смены</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                  <span>Позиция пропорциональна {sortLabels[sortBy]}</span>
                </span>
              </div>
              <p className="text-slate-500">
                Автообновление каждые 15 сек • Плавная анимация обгона
              </p>
            </div>
          </div>

          {/* PARTICIPANTS HIDING SIDEBAR PANEL */}
          {showSidebar && (
            <div className="w-72 sm:w-80 border-l border-white/10 bg-slate-900/80 p-4 overflow-y-auto shrink-0 flex flex-col space-y-4 z-20 backdrop-blur-md">
              <div className="flex items-center justify-between pb-2 border-b border-white/10">
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-200 tracking-wider flex items-center gap-1.5">
                    <Users size={14} className="text-cyan-400" />
                    Участники ({visibleOperators.length}/{operators.length})
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Управление видимостью
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={showAllOperators}
                    className="px-2 py-1 text-[9px] font-bold uppercase bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-white/10 transition-colors"
                    title="Включить всех"
                  >
                    Все
                  </button>
                  <button
                    onClick={hideAllOperators}
                    className="px-2 py-1 text-[9px] font-bold uppercase bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-white/10 transition-colors"
                    title="Скрыть всех"
                  >
                    Скрыть
                  </button>
                </div>
              </div>

              {/* TOOLTIP / HINT BOX */}
              <div className="p-2.5 bg-blue-950/40 border border-cyan-500/30 rounded-xl text-[10px] text-cyan-200 leading-relaxed flex items-start gap-2">
                <Info size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                <span>
                  Скройте оператора, если он попал в статистику случайно (например, задержался в чате после смены).
                </span>
              </div>

              {/* OPERATORS CHECKLIST */}
              <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                {operators.map((op) => {
                  const isHidden = hiddenOperatorIds.has(op.user_id);
                  const displayValue = getMetricDisplayValue(op);

                  return (
                    <div
                      key={op.user_id}
                      onClick={() => toggleOperatorHide(op.user_id)}
                      className={`p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                        isHidden 
                          ? 'bg-slate-950/40 border-white/5 opacity-50 hover:opacity-75' 
                          : 'bg-slate-900 border-cyan-500/30 hover:border-cyan-400/60 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-all ${
                          !isHidden 
                            ? 'bg-cyan-500 border-cyan-400 text-black' 
                            : 'bg-slate-800 border-slate-600 text-transparent'
                        }`}>
                          <Check size={12} strokeWidth={3} />
                        </div>

                        {op.avatar ? (
                          <img src={op.avatar} alt={op.name} className="w-7 h-7 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-300 shrink-0">
                            {op.name.charAt(0)}
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-bold truncate ${isHidden ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                            {op.name}
                          </p>
                        </div>
                      </div>

                      <span className={`text-[10px] font-black shrink-0 ${isHidden ? 'text-slate-600' : 'text-cyan-400'}`}>
                        {displayValue}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
