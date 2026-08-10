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

interface RaceCarProps {
  avatarUrl?: string;
  bodyColor: string;
  rankStrokeColor: string;
  operatorId: string;
  operatorName: string;
  className?: string;
}

export const RaceCar: React.FC<RaceCarProps> = ({
  avatarUrl,
  bodyColor,
  rankStrokeColor,
  operatorId,
  operatorName,
  className = "w-16 h-7 sm:w-20 sm:h-9"
}) => {
  const safeId = String(operatorId).replace(/[^a-zA-Z0-9_-]/g, '');
  const clipId = `avatarClip-${safeId}`;
  const initials = operatorName
    ? operatorName
        .trim()
        .split(/\s+/)
        .map((n) => n[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'OP';

  return (
    <svg
      viewBox="0 0 680 300"
      className={`${className} overflow-visible filter drop-shadow-[0_4px_10px_rgba(0,0,0,0.85)]`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="352" cy="150" r="45" />
        </clipPath>
      </defs>

      {/* REAR WING */}
      <rect x="40" y="50" width="70" height="22" rx="5" fill="#0f172a" stroke="#334155" strokeWidth="3" />
      <rect x="40" y="228" width="70" height="22" rx="5" fill="#0f172a" stroke="#334155" strokeWidth="3" />
      <rect x="55" y="65" width="35" height="170" rx="6" fill={bodyColor} stroke="#0f172a" strokeWidth="3" />
      <rect x="45" y="100" width="15" height="100" rx="3" fill="#020617" />

      {/* REAR SUSPENSION & WHEELS */}
      <line x1="140" y1="150" x2="190" y2="60" stroke="#475569" strokeWidth="6" strokeLinecap="round" />
      <line x1="140" y1="150" x2="190" y2="240" stroke="#475569" strokeWidth="6" strokeLinecap="round" />
      <line x1="220" y1="150" x2="200" y2="60" stroke="#475569" strokeWidth="6" strokeLinecap="round" />
      <line x1="220" y1="150" x2="200" y2="240" stroke="#475569" strokeWidth="6" strokeLinecap="round" />

      <rect x="140" y="25" width="105" height="55" rx="12" fill="#090d16" stroke="#334155" strokeWidth="4" />
      <rect x="140" y="220" width="105" height="55" rx="12" fill="#090d16" stroke="#334155" strokeWidth="4" />
      <rect x="155" y="32" width="75" height="41" rx="6" fill="#1e293b" opacity="0.6" />
      <rect x="155" y="227" width="75" height="41" rx="6" fill="#1e293b" opacity="0.6" />

      {/* MAIN BODY / MONOCOQUE */}
      <path
        d="M 90,150 C 120,130 160,105 210,95 L 360,90 C 420,95 460,115 520,135 L 610,148 Q 625,150 610,152 L 520,165 C 460,185 420,205 360,210 L 210,205 C 160,195 120,170 90,150 Z"
        fill={bodyColor}
        stroke="#0f172a"
        strokeWidth="6"
      />

      <path
        d="M 230,110 C 300,105 380,115 420,135 L 500,146 L 500,154 L 420,165 C 380,185 300,195 230,190 Z"
        fill="#020617"
        opacity="0.35"
      />

      {/* FRONT SUSPENSION & WHEELS */}
      <line x1="470" y1="150" x2="490" y2="65" stroke="#475569" strokeWidth="6" strokeLinecap="round" />
      <line x1="470" y1="150" x2="490" y2="235" stroke="#475569" strokeWidth="6" strokeLinecap="round" />
      <line x1="510" y1="150" x2="520" y2="65" stroke="#475569" strokeWidth="6" strokeLinecap="round" />
      <line x1="510" y1="150" x2="520" y2="235" stroke="#475569" strokeWidth="6" strokeLinecap="round" />

      <rect x="450" y="30" width="95" height="48" rx="10" fill="#090d16" stroke="#334155" strokeWidth="4" />
      <rect x="450" y="222" width="95" height="48" rx="10" fill="#090d16" stroke="#334155" strokeWidth="4" />
      <rect x="465" y="36" width="65" height="36" rx="5" fill="#1e293b" opacity="0.6" />
      <rect x="465" y="228" width="65" height="36" rx="5" fill="#1e293b" opacity="0.6" />

      {/* FRONT WING */}
      <path
        d="M 570,55 L 640,65 C 655,100 660,130 660,150 C 660,170 655,200 640,235 L 570,245 L 585,150 Z"
        fill={bodyColor}
        stroke="#0f172a"
        strokeWidth="5"
      />
      <path
        d="M 590,75 L 640,83 C 650,110 652,130 652,150 C 652,170 650,190 640,217 L 590,225 Z"
        fill="#020617"
        opacity="0.4"
      />

      {/* COCKPIT HOLE & HALO */}
      <circle cx="352" cy="150" r="58" fill="#020617" stroke={rankStrokeColor} strokeWidth="5" />
      <path
        d="M 310,115 Q 352,100 395,115 L 415,150 L 395,185 Q 352,200 310,185 Z"
        fill="none"
        stroke="#1e293b"
        strokeWidth="6"
        opacity="0.8"
      />

      {/* DRIVER AVATAR IN COCKPIT */}
      {avatarUrl ? (
        <image
          href={avatarUrl}
          x="307"
          y="105"
          width="90"
          height="90"
          preserveAspectRatio="xMidYMid slice"
          clipPath={`url(#${clipId})`}
        />
      ) : (
        <g clipPath={`url(#${clipId})`}>
          <circle cx="352" cy="150" r="45" fill="#1e293b" />
          <text
            x="352"
            y="160"
            fill="#f8fafc"
            fontSize="30"
            fontWeight="bold"
            textAnchor="middle"
            fontFamily="sans-serif"
          >
            {initials}
          </text>
        </g>
      )}

      {/* COCKPIT INNER RING STROKE */}
      <circle cx="352" cy="150" r="45" fill="none" stroke={rankStrokeColor} strokeWidth="4" />
    </svg>
  );
};

interface CarNodeProps {
  op: ShiftOperator;
  index: number;
  rank: number;
  isLeader: boolean;
  transform: { x: number; y: number; angle: number };
  displayValue: string;
}

const F1RaceCarNode: React.FC<CarNodeProps> = ({
  op,
  rank,
  isLeader,
  transform,
  displayValue
}) => {
  const leftPct = (transform.x / 1000) * 100;
  const topPct = (transform.y / 500) * 100;

  let bodyColor = '#0EA5E9'; // Cyan/Blue
  let rankStrokeColor = '#38BDF8';
  let badgeBg = 'bg-cyan-500 text-black';

  if (rank === 1) {
    bodyColor = '#F2A623'; // Gold
    rankStrokeColor = '#FAC775';
    badgeBg = 'bg-amber-400 text-black font-black';
  } else if (rank === 2) {
    bodyColor = '#9CA3AF'; // Silver
    rankStrokeColor = '#E5E7EB';
    badgeBg = 'bg-slate-200 text-black font-black';
  } else if (rank === 3) {
    bodyColor = '#B8622F'; // Bronze
    rankStrokeColor = '#D08A4E';
    badgeBg = 'bg-amber-600 text-white font-black';
  }

  return (
    <div
      className="absolute z-30 pointer-events-auto transition-all duration-1000 ease-in-out group"
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform: `translate(-51.76%, -50%) rotate(${transform.angle}deg)`,
      }}
    >
      {/* SPEED TRAIL BEHIND CAR */}
      <div
        className={`absolute right-[80%] top-1/2 -translate-y-1/2 h-2.5 rounded-l-full pointer-events-none transition-all duration-1000 ${
          isLeader
            ? 'w-16 bg-gradient-to-r from-transparent via-amber-500 to-amber-300 opacity-90 blur-[1px]'
            : 'w-12 bg-gradient-to-r from-transparent via-cyan-500 to-cyan-300 opacity-70 blur-[1px]'
        }`}
      />

      {/* F1 CAR CHASSIS + AVATAR */}
      <div className="relative flex items-center justify-center">
        {/* Leader Crown floating above car */}
        {isLeader && (
          <div
            className="absolute -top-7 left-1/2 -translate-x-1/2 bg-amber-400 text-black text-[9px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-[0_0_12px_rgba(245,158,11,1)] animate-bounce z-40 whitespace-nowrap"
            style={{ transform: `rotate(${-transform.angle}deg)` }}
          >
            <Crown size={10} className="fill-black" />
            <span>#1 ЛИДЕР</span>
          </div>
        )}

        {/* Top-View F1 Race Car with Driver Avatar in Cockpit */}
        <RaceCar
          avatarUrl={op.avatar}
          bodyColor={bodyColor}
          rankStrokeColor={rankStrokeColor}
          operatorId={op.user_id}
          operatorName={op.name}
        />

        {/* Position Badge (#1, #2, #3...) attached to car */}
        <div
          className={`absolute -bottom-2 -left-1 px-1.5 py-0.2 text-[9px] font-black rounded-md border border-black/40 shadow-md ${badgeBg}`}
          style={{ transform: `rotate(${-transform.angle}deg)` }}
        >
          #{rank}
        </div>

        {/* Operator Name & Metric Badge (kept upright for readability) */}
        <div
          className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-slate-950/95 border border-white/20 rounded-lg shadow-2xl backdrop-blur-md flex flex-col items-center pointer-events-none whitespace-nowrap z-50 transition-opacity duration-200"
          style={{ transform: `rotate(${-transform.angle}deg)` }}
        >
          <span className={`text-[10px] font-extrabold ${isLeader ? 'text-amber-300' : 'text-slate-100'}`}>
            {op.name}
          </span>
          <span className="text-[9px] font-black text-cyan-400">
            {displayValue}
          </span>
        </div>
      </div>
    </div>
  );
};

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

  // SVG Track Ref & Length state
  const pathRef = useRef<SVGPathElement>(null);
  const [trackLength, setTrackLength] = useState<number>(0);

  // Measure path length on mount/modal open
  useEffect(() => {
    if (!isOpen) return;

    const measurePath = () => {
      if (pathRef.current) {
        try {
          const len = pathRef.current.getTotalLength();
          if (len > 0) {
            setTrackLength(len);
          }
        } catch (e) {
          console.error('Failed to measure path length:', e);
        }
      }
    };

    measurePath();
    const timer = setTimeout(measurePath, 60);
    return () => clearTimeout(timer);
  }, [isOpen]);

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

  // Calculate track progress percentage (0.05 to 0.90) along closed circuit path
  const calculateProgress = (op: ShiftOperator, visibleOps: ShiftOperator[]): number => {
    if (visibleOps.length <= 1) return 0.85;

    if (sortBy === 'reply_time') {
      const validTimes = visibleOps
        .map(o => o.reply_time_avg)
        .filter((t): t is number => t !== null && t !== undefined && !isNaN(t));

      if (validTimes.length === 0) return 0.08;
      const minTime = Math.min(...validTimes);
      const maxTime = Math.max(...validTimes);

      const val = op.reply_time_avg;
      if (val === null || val === undefined) return 0.05;

      if (sortDir === 'asc') {
        if (maxTime === minTime) return 0.85;
        const norm = (maxTime - val) / (maxTime - minTime);
        return 0.08 + norm * 0.80;
      } else {
        if (maxTime === minTime) return 0.85;
        const norm = (val - minTime) / (maxTime - minTime);
        return 0.08 + norm * 0.80;
      }
    } else {
      const values = visibleOps.map(o => getMetricRawValue(o) ?? 0);
      const maxVal = Math.max(...values, 0);
      const minVal = Math.min(...values, 0);
      const val = getMetricRawValue(op) ?? 0;

      if (sortDir === 'asc') {
        if (maxVal === minVal) return 0.85;
        const norm = (maxVal - val) / (maxVal - minVal);
        return 0.08 + norm * 0.80;
      } else {
        if (maxVal === 0) return 0.05;
        const norm = val / maxVal;
        return 0.08 + norm * 0.80;
      }
    }
  };

  // Get {x, y, angle} coordinates for positioning a car on the SVG track
  const getCarTransform = (op: ShiftOperator, index: number, visibleOps: ShiftOperator[]) => {
    if (!pathRef.current || trackLength === 0) {
      return { x: 260, y: 90, angle: 0 };
    }

    const progress = calculateProgress(op, visibleOps);
    const distance = Math.max(0, Math.min(trackLength, progress * trackLength));

    const p1 = pathRef.current.getPointAtLength(distance);
    const nextDist = (distance + 3) % trackLength;
    const p2 = pathRef.current.getPointAtLength(nextDist);

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const angleRad = Math.atan2(dy, dx);
    const angleDeg = (angleRad * 180) / Math.PI;

    // Lateral shift perpendicular to track centerline (-14px to +14px)
    const perpRad = angleRad + Math.PI / 2;
    const laneShift = visibleOps.length > 1 ? ((index % 3) - 1) * 14 : 0;

    const x = p1.x + Math.cos(perpRad) * laneShift;
    const y = p1.y + Math.sin(perpRad) * laneShift;

    return { x, y, angle: angleDeg };
  };

  // Identify Leader (operator #1 in visible list)
  const leaderUserId = visibleOperators.length > 0 ? visibleOperators[0].user_id : null;

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

        {/* MAIN BODY: FORMULA-1 CLOSED CIRCUIT + PARTICIPANTS SIDEBAR */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* CIRCUIT CANVAS AREA */}
          <div className="flex-1 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-slate-950 p-3 sm:p-6 overflow-y-auto flex flex-col justify-between relative">
            
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
              <div className="relative w-full aspect-[2/1] min-h-[360px] sm:min-h-[480px] my-auto select-none rounded-3xl border border-cyan-500/20 bg-slate-950 overflow-hidden shadow-[inset_0_0_60px_rgba(0,0,0,0.85)]">
                {/* SVG CLOSED F1 CIRCUIT TRACK */}
                <svg
                  viewBox="0 0 1000 500"
                  className="w-full h-full absolute inset-0 pointer-events-none"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <defs>
                    {/* Checkered Finish Line Pattern */}
                    <pattern id="checkeredPattern" width="16" height="16" patternUnits="userSpaceOnUse">
                      <rect width="8" height="8" fill="#ffffff" />
                      <rect x="8" width="8" height="8" fill="#0f172a" />
                      <rect y="8" width="8" height="8" fill="#0f172a" />
                      <rect x="8" y="8" width="8" height="8" fill="#ffffff" />
                    </pattern>
                  </defs>

                  {/* Circuit Outer Grass / Run-off Areas */}
                  <path
                    d="M 260,90 L 740,90 C 860,90 940,150 910,230 C 880,310 780,260 700,310 C 620,360 520,410 380,410 C 210,410 90,350 90,250 C 90,150 150,90 260,90 Z"
                    fill="none"
                    stroke="#0b1329"
                    strokeWidth="80"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Turn 1 Outer Kerbs (Red/White) */}
                  <path
                    d="M 740,65 C 880,65 965,130 932,230"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="8"
                    strokeDasharray="14 14"
                  />
                  <path
                    d="M 740,65 C 880,65 965,130 932,230"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="8"
                    strokeDasharray="14 14"
                    strokeDashoffset="14"
                  />

                  {/* Turn 3 Outer Kerbs (Red/White) */}
                  <path
                    d="M 380,435 C 190,435 65,370 65,250"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="8"
                    strokeDasharray="14 14"
                  />
                  <path
                    d="M 380,435 C 190,435 65,370 65,250"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="8"
                    strokeDasharray="14 14"
                    strokeDashoffset="14"
                  />

                  {/* Main Asphalt Track Path */}
                  <path
                    ref={pathRef}
                    d="M 260,90 L 740,90 C 860,90 940,150 910,230 C 880,310 780,260 700,310 C 620,360 520,410 380,410 C 210,410 90,350 90,250 C 90,150 150,90 260,90 Z"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="52"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Track Edge Inner Border */}
                  <path
                    d="M 260,90 L 740,90 C 860,90 940,150 910,230 C 880,310 780,260 700,310 C 620,360 520,410 380,410 C 210,410 90,350 90,250 C 90,150 150,90 260,90 Z"
                    fill="none"
                    stroke="#334155"
                    strokeWidth="48"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.4"
                  />

                  {/* Dashed Center Road Line */}
                  <path
                    d="M 260,90 L 740,90 C 860,90 940,150 910,230 C 880,310 780,260 700,310 C 620,360 520,410 380,410 C 210,410 90,350 90,250 C 90,150 150,90 260,90 Z"
                    fill="none"
                    stroke="#f8fafc"
                    strokeWidth="2"
                    strokeDasharray="10 10"
                    opacity="0.45"
                  />

                  {/* Pit Lane Road */}
                  <path
                    d="M 320,135 L 680,135"
                    fill="none"
                    stroke="#334155"
                    strokeWidth="14"
                    strokeDasharray="6 6"
                    opacity="0.7"
                  />

                  {/* Pit Stop Garages */}
                  <g opacity="0.85">
                    <rect x="340" y="148" width="50" height="20" rx="3" fill="#0f172a" stroke="#3b82f6" strokeWidth="1" />
                    <text x="365" y="162" fill="#60a5fa" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">PIT 1</text>

                    <rect x="400" y="148" width="50" height="20" rx="3" fill="#0f172a" stroke="#06b6d4" strokeWidth="1" />
                    <text x="425" y="162" fill="#22d3ee" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">PIT 2</text>

                    <rect x="460" y="148" width="50" height="20" rx="3" fill="#0f172a" stroke="#a855f7" strokeWidth="1" />
                    <text x="485" y="162" fill="#c084fc" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">PIT 3</text>

                    <rect x="520" y="148" width="50" height="20" rx="3" fill="#0f172a" stroke="#f59e0b" strokeWidth="1" />
                    <text x="545" y="162" fill="#fbbf24" fontSize="9" fontWeight="bold" textAnchor="middle" fontFamily="monospace">PIT 4</text>
                  </g>

                  {/* Grandstand / Spectator Stand */}
                  <g opacity="0.9">
                    <rect x="350" y="22" width="280" height="26" rx="4" fill="#020617" stroke="#334155" strokeWidth="1.5" />
                    <rect x="355" y="25" width="270" height="5" rx="2" fill="#ef4444" opacity="0.8" />
                    <rect x="355" y="33" width="270" height="5" rx="2" fill="#3b82f6" opacity="0.8" />
                    <text x="490" y="44" fill="#94a3b8" fontSize="8" fontWeight="black" textAnchor="middle" letterSpacing="2" fontFamily="monospace">GRANDSTAND • ФОРМУЛА-1</text>
                  </g>

                  {/* Checkered Start / Finish Line Banner */}
                  <rect
                    x="254"
                    y="38"
                    width="12"
                    height="104"
                    fill="url(#checkeredPattern)"
                    rx="2"
                    stroke="#06b6d4"
                    strokeWidth="1.5"
                    className="drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]"
                  />

                  <text
                    x="260"
                    y="30"
                    fill="#22d3ee"
                    fontSize="9"
                    fontWeight="900"
                    textAnchor="middle"
                    fontFamily="monospace"
                    letterSpacing="1"
                  >
                    🏁 СТАРТ / ФИНИШ
                  </text>
                </svg>

                {/* FORMULA 1 CARS LAYER */}
                <div className="absolute inset-0 pointer-events-none">
                  {visibleOperators.map((op, index) => {
                    const isLeader = op.user_id === leaderUserId;
                    const transform = getCarTransform(op, index, visibleOperators);
                    const displayValue = getMetricDisplayValue(op);
                    const rank = index + 1;

                    return (
                      <F1RaceCarNode
                        key={op.user_id}
                        op={op}
                        index={index}
                        rank={rank}
                        isLeader={isLeader}
                        transform={transform}
                        displayValue={displayValue}
                      />
                    );
                  })}
                </div>
              </div>
            )}

            {/* BOTTOM TRACK FOOTER LEGEND */}
            <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 z-10">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>#1 Золотой болид = Лидер смены</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                  <span>Дистанция на треке = {sortLabels[sortBy]}</span>
                </span>
              </div>
              <p className="text-slate-500">
                Автообновление каждые 15 сек • Плавный обгон по трассе Ф1
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

