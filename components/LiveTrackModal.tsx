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
  rank: number;
  isLeader: boolean;
  carX: number;
  carY: number;
  angle: number;
}

const F1RaceCarNode: React.FC<CarNodeProps> = ({
  op,
  rank,
  isLeader,
  carX,
  carY,
  angle
}) => {
  const leftPct = (carX / 1000) * 100;
  const topPct = (carY / 520) * 100;

  let bodyColor = '#0EA5E9'; // Cyan/Blue
  let rankStrokeColor = '#38BDF8';

  if (rank === 1) {
    bodyColor = '#F2A623'; // Gold
    rankStrokeColor = '#FAC775';
  } else if (rank === 2) {
    bodyColor = '#9CA3AF'; // Silver
    rankStrokeColor = '#E5E7EB';
  } else if (rank === 3) {
    bodyColor = '#B8622F'; // Bronze
    rankStrokeColor = '#D08A4E';
  }

  return (
    <div
      className="absolute z-30 pointer-events-auto transition-all duration-700 ease-out group"
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform: `translate(-51.76%, -50%) rotate(${angle}deg)`,
      }}
    >
      {/* SPEED TRAIL BEHIND CAR */}
      <div
        className={`absolute right-[80%] top-1/2 -translate-y-1/2 h-2.5 rounded-l-full pointer-events-none transition-all duration-700 ${
          isLeader
            ? 'w-16 bg-gradient-to-r from-transparent via-amber-500 to-amber-300 opacity-90 blur-[1px]'
            : 'w-12 bg-gradient-to-r from-transparent via-cyan-500 to-cyan-300 opacity-70 blur-[1px]'
        }`}
      />

      {/* F1 CAR CHASSIS + AVATAR */}
      <div className="relative flex items-center justify-center">
        <RaceCar
          avatarUrl={op.avatar}
          bodyColor={bodyColor}
          rankStrokeColor={rankStrokeColor}
          operatorId={op.user_id}
          operatorName={op.name}
        />
      </div>
    </div>
  );
};

interface DriverBadgeNodeProps {
  op: ShiftOperator;
  rank: number;
  badgeX: number;
  badgeY: number;
  displayValue: string;
}

const F1DriverBadgeNode: React.FC<DriverBadgeNodeProps> = ({
  op,
  rank,
  badgeX,
  badgeY,
  displayValue
}) => {
  const leftPct = (badgeX / 1000) * 100;
  const topPct = (badgeY / 520) * 100;

  return (
    <div
      className="absolute z-40 pointer-events-auto transition-all duration-700 ease-out"
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform: 'translate(-50%, -50%)',
      }}
      title={`${op.name} (#${rank}) — ${displayValue}`}
    >
      <div
        className={`px-2 py-0.5 rounded-lg border shadow-xl backdrop-blur-md flex items-center gap-1.5 whitespace-nowrap text-[10px] font-bold select-none ${
          rank === 1
            ? 'bg-amber-950/95 border-amber-400/90 text-amber-200 shadow-amber-500/20 ring-1 ring-amber-400/30'
            : rank === 2
            ? 'bg-slate-900/95 border-slate-300/80 text-slate-200'
            : rank === 3
            ? 'bg-amber-950/90 border-amber-600/80 text-amber-300'
            : 'bg-slate-950/95 border-cyan-500/40 text-slate-200'
        }`}
      >
        <span
          className={`font-black flex items-center gap-0.5 ${
            rank === 1
              ? 'text-amber-400'
              : rank === 2
              ? 'text-slate-300'
              : rank === 3
              ? 'text-amber-500'
              : 'text-slate-400'
          }`}
        >
          {rank === 1 && <Crown size={10} className="fill-amber-400 text-amber-400 shrink-0" />}
          #{rank}
        </span>

        <span className="max-w-[70px] sm:max-w-[95px] truncate text-slate-100 font-bold" title={op.name}>
          {op.name}
        </span>

        <span className="text-cyan-400 font-black tracking-tight">
          {displayValue}
        </span>
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

  interface CarLayout {
    op: ShiftOperator;
    index: number;
    rank: number;
    isLeader: boolean;
    carX: number;
    carY: number;
    angle: number;
    badgeX: number;
    badgeY: number;
    hasPointer: boolean;
    displayValue: string;
  }

  // Get collision-free 2D coordinates for cars and upright badges on the SVG track
  const getTrackLayouts = (visibleOps: ShiftOperator[]): CarLayout[] => {
    if (!pathRef.current || trackLength === 0 || visibleOps.length === 0) {
      return [];
    }

    const L = trackLength;

    // 1. Calculate raw progress and path distances
    const rawData = visibleOps.map((op, index) => {
      const rank = index + 1;
      const isLeader = rank === 1;
      const progress = calculateProgress(op, visibleOps);
      const rawDist = Math.max(0, Math.min(L, progress * L));
      const displayValue = getMetricDisplayValue(op);
      return { op, index, rank, isLeader, progress, rawDist, displayValue };
    });

    // 2. Identify clusters and assign longitudinal + lateral shifts
    const carTransforms = rawData.map((item) => {
      const closeCluster = rawData.filter((other) => {
        const delta = Math.abs(other.rawDist - item.rawDist);
        const loopDelta = Math.min(delta, L - delta);
        return loopDelta < 55;
      });

      let laneShift = 0;
      let microLongShift = 0;

      if (closeCluster.length > 1) {
        const clusterIdx = closeCluster.findIndex((o) => o.op.user_id === item.op.user_id);
        const lanes = [0, -18, 18, -9, 9, -24, 24];
        laneShift = lanes[clusterIdx % lanes.length];

        // Micro longitudinal shift: shift lower ranks slightly backwards along path (preserving exact rank order)
        microLongShift = -(clusterIdx * 14);
      }

      const distOnPath = (item.rawDist + microLongShift + L * 2) % L;
      const p1 = pathRef.current!.getPointAtLength(distOnPath);
      const p2 = pathRef.current!.getPointAtLength((distOnPath + 3) % L);

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const angleRad = Math.atan2(dy, dx);
      const angleDeg = (angleRad * 180) / Math.PI;

      const perpRad = angleRad + Math.PI / 2;
      const carX = p1.x + Math.cos(perpRad) * laneShift;
      const carY = p1.y + Math.sin(perpRad) * laneShift;

      return {
        ...item,
        carX,
        carY,
        angle: angleDeg,
        angleRad
      };
    });

    // 3. Collision Resolution for Badges in 2D space
    const placedBadges: { bx: number; by: number; width: number; height: number }[] = [];
    const W = 105;
    const H = 22;

    const telemetryBox = { minX: 335, maxX: 625, minY: 170, maxY: 340 };
    const containerBox = { minX: 35, maxX: 965, minY: 20, maxY: 500 };

    const candidateOffsets = [
      { dx: 0, dy: -28 },    // Above
      { dx: 0, dy: 28 },     // Below
      { dx: 55, dy: 0 },     // Right
      { dx: -55, dy: 0 },    // Left
      { dx: 45, dy: -24 },   // Top-Right
      { dx: 45, dy: 24 },    // Bottom-Right
      { dx: -45, dy: -24 },  // Top-Left
      { dx: -45, dy: 24 },   // Bottom-Left
      { dx: 0, dy: -48 },    // Farther Above
      { dx: 0, dy: 48 },     // Farther Below
      { dx: 80, dy: 0 },     // Farther Right
      { dx: -80, dy: 0 },    // Farther Left
      { dx: 65, dy: -40 },   // Far Top-Right
      { dx: -65, dy: -40 },  // Far Top-Left
      { dx: 65, dy: 40 },    // Far Bottom-Right
      { dx: -65, dy: 40 },   // Far Bottom-Left
    ];

    const layouts: CarLayout[] = carTransforms.map((car) => {
      let bestBx = car.carX;
      let bestBy = car.carY - 28;
      let found = false;

      const normDx = Math.cos(car.angleRad + Math.PI / 2) * 30;
      const normDy = Math.sin(car.angleRad + Math.PI / 2) * 30;

      const dynamicCandidates = [
        { dx: normDx, dy: normDy },
        { dx: -normDx, dy: -normDy },
        ...candidateOffsets
      ];

      for (const cand of dynamicCandidates) {
        const bx = car.carX + cand.dx;
        const by = car.carY + cand.dy;

        if (
          bx + W / 2 > telemetryBox.minX &&
          bx - W / 2 < telemetryBox.maxX &&
          by + H / 2 > telemetryBox.minY &&
          by - H / 2 < telemetryBox.maxY
        ) {
          continue;
        }

        if (
          bx - W / 2 < containerBox.minX ||
          bx + W / 2 > containerBox.maxX ||
          by - H / 2 < containerBox.minY ||
          by + H / 2 > containerBox.maxY
        ) {
          continue;
        }

        const badgeCollision = placedBadges.some((pb) => {
          return Math.abs(bx - pb.bx) < W * 0.82 && Math.abs(by - pb.by) < H * 0.90;
        });
        if (badgeCollision) continue;

        const carCollision = carTransforms.some((other) => {
          if (other.op.user_id === car.op.user_id) return false;
          return Math.abs(bx - other.carX) < 32 && Math.abs(by - other.carY) < 18;
        });
        if (carCollision) continue;

        bestBx = bx;
        bestBy = by;
        found = true;
        break;
      }

      if (!found) {
        let minOverlap = Infinity;
        for (const cand of dynamicCandidates) {
          const bx = car.carX + cand.dx;
          const by = car.carY + cand.dy;
          let score = 0;

          placedBadges.forEach((pb) => {
            const overlapX = Math.max(0, W * 0.85 - Math.abs(bx - pb.bx));
            const overlapY = Math.max(0, H * 0.90 - Math.abs(by - pb.by));
            score += overlapX * overlapY;
          });

          if (score < minOverlap) {
            minOverlap = score;
            bestBx = bx;
            bestBy = by;
          }
        }
      }

      placedBadges.push({ bx: bestBx, by: bestBy, width: W, height: H });

      const distToBadge = Math.hypot(bestBx - car.carX, bestBy - car.carY);
      const hasPointer = distToBadge > 22;

      return {
        op: car.op,
        index: car.index,
        rank: car.rank,
        isLeader: car.isLeader,
        carX: car.carX,
        carY: car.carY,
        angle: car.angle,
        badgeX: bestBx,
        badgeY: bestBy,
        hasPointer,
        displayValue: car.displayValue
      };
    });

    return layouts;
  };

  const trackLayouts = getTrackLayouts(visibleOperators);

  // Identify Leader (operator #1 in visible list) & calculate telemetry gap
  const leaderUserId = visibleOperators.length > 0 ? visibleOperators[0].user_id : null;
  const leaderOp = visibleOperators[0];
  const secondOp = visibleOperators[1];
  const leaderVal = leaderOp ? (getMetricRawValue(leaderOp) ?? 0) : 0;
  const secondVal = secondOp ? (getMetricRawValue(secondOp) ?? 0) : 0;
  const gapValue = Math.max(0, leaderVal - secondVal);

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
              <div className="relative w-full aspect-[2/1] min-h-[380px] sm:min-h-[500px] my-auto select-none rounded-3xl border border-cyan-500/20 bg-slate-950 overflow-hidden shadow-[inset_0_0_60px_rgba(0,0,0,0.85)]">
                {/* CENTRAL LIVE TELEMETRY BOARD */}
                <div className="absolute top-[48%] left-[48%] -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none flex flex-col items-center">
                  <div className="bg-slate-950/85 border border-cyan-500/30 rounded-2xl p-3 sm:p-4 shadow-[0_0_30px_rgba(0,0,0,0.8)] backdrop-blur-md min-w-[200px] sm:min-w-[240px] text-center font-mono">
                    <div className="flex items-center justify-center gap-1.5 mb-1.5">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                      </span>
                      <span className="text-[10px] font-black tracking-widest text-slate-300 uppercase">
                        ТЕЛЕМЕТРИЯ ГОНКИ
                      </span>
                    </div>

                    {/* Shift Countdown / Info */}
                    {isCurrentActiveShift && remainingTimeText ? (
                      <div className="mb-2 pb-2 border-b border-white/10">
                        <div className="text-base sm:text-xl font-black text-emerald-400 tracking-wider">
                          {remainingTimeText}
                        </div>
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          ДО КОНЦА СМЕНЫ
                        </div>
                      </div>
                    ) : (
                      <div className="mb-2 pb-2 border-b border-white/10">
                        <div className="text-xs font-bold text-cyan-300">
                          {shiftInfo?.label || 'Текущая смена'}
                        </div>
                      </div>
                    )}

                    {/* Leader */}
                    {leaderOp && (
                      <div className="mb-1.5 text-left bg-amber-500/10 border border-amber-500/30 rounded-xl p-2">
                        <div className="text-[9px] font-extrabold text-amber-400 uppercase tracking-wider flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Crown size={10} className="fill-amber-400" />
                            ЛИДЕР
                          </span>
                          <span className="text-amber-300 font-black">
                            {getMetricDisplayValue(leaderOp)}
                          </span>
                        </div>
                        <div className="text-xs font-black text-slate-100 truncate mt-0.5">
                          {leaderOp.name}
                        </div>
                      </div>
                    )}

                    {/* #2 & Gap */}
                    {secondOp && (
                      <div className="text-left bg-slate-900/90 border border-white/10 rounded-xl p-2 flex items-center justify-between gap-2 text-[11px]">
                        <div className="min-w-0 flex-1">
                          <span className="text-[9px] font-extrabold text-slate-400 block truncate">
                            #2 {secondOp.name}
                          </span>
                          <span className="font-black text-slate-200">
                            {getMetricDisplayValue(secondOp)}
                          </span>
                        </div>
                        {sortBy === 'messages' && (
                          <div className="text-right shrink-0">
                            <span className="text-[9px] text-slate-400 block font-bold">РАЗРЫВ</span>
                            <span className="text-cyan-400 font-black text-xs">
                              +{gapValue}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* SVG CLOSED AUTODROME CIRCUIT TRACK */}
                <svg
                  viewBox="0 0 1000 520"
                  className="w-full h-full absolute inset-0 pointer-events-none"
                  preserveAspectRatio="xMidYMid meet"
                >
                  <defs>
                    {/* Checkered Finish Line Pattern */}
                    <pattern id="checkeredPattern" width="12" height="12" patternUnits="userSpaceOnUse">
                      <rect width="6" height="6" fill="#ffffff" />
                      <rect x="6" width="6" height="6" fill="#0f172a" />
                      <rect y="6" width="6" height="6" fill="#0f172a" />
                      <rect x="6" y="6" width="6" height="6" fill="#ffffff" />
                    </pattern>
                  </defs>

                  {/* Outer Run-Off / Grass Buffer */}
                  <path
                    d="M 280,75 L 680,75 C 780,75 920,100 920,180 C 920,240 820,260 820,310 C 820,360 910,390 910,435 C 910,485 820,485 740,485 L 480,485 C 380,485 360,410 300,390 C 240,370 210,465 140,465 C 70,465 65,330 85,230 C 105,120 180,75 280,75 Z"
                    fill="none"
                    stroke="#0b1329"
                    strokeWidth="80"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Turn 1 Outer Kerbs (Red/White) */}
                  <path
                    d="M 680,52 C 800,52 943,80 943,180"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="7"
                    strokeDasharray="12 12"
                  />
                  <path
                    d="M 680,52 C 800,52 943,80 943,180"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="7"
                    strokeDasharray="12 12"
                    strokeDashoffset="12"
                  />

                  {/* Hairpin Turn 4 Outer Kerbs (Red/White) */}
                  <path
                    d="M 933,435 C 933,508 820,508 740,508"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="7"
                    strokeDasharray="12 12"
                  />
                  <path
                    d="M 933,435 C 933,508 820,508 740,508"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="7"
                    strokeDasharray="12 12"
                    strokeDashoffset="12"
                  />

                  {/* Final Sweeper Turns 7-8 Kerbs (Red/White) */}
                  <path
                    d="M 140,488 C 47,488 42,330 62,230"
                    fill="none"
                    stroke="#ef4444"
                    strokeWidth="7"
                    strokeDasharray="12 12"
                  />
                  <path
                    d="M 140,488 C 47,488 42,330 62,230"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="7"
                    strokeDasharray="12 12"
                    strokeDashoffset="12"
                  />

                  {/* Main Asphalt Track Path */}
                  <path
                    ref={pathRef}
                    d="M 280,75 L 680,75 C 780,75 920,100 920,180 C 920,240 820,260 820,310 C 820,360 910,390 910,435 C 910,485 820,485 740,485 L 480,485 C 380,485 360,410 300,390 C 240,370 210,465 140,465 C 70,465 65,330 85,230 C 105,120 180,75 280,75 Z"
                    fill="none"
                    stroke="#1e293b"
                    strokeWidth="48"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />

                  {/* Track Edge Inner Border */}
                  <path
                    d="M 280,75 L 680,75 C 780,75 920,100 920,180 C 920,240 820,260 820,310 C 820,360 910,390 910,435 C 910,485 820,485 740,485 L 480,485 C 380,485 360,410 300,390 C 240,370 210,465 140,465 C 70,465 65,330 85,230 C 105,120 180,75 280,75 Z"
                    fill="none"
                    stroke="#334155"
                    strokeWidth="44"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity="0.3"
                  />

                  {/* Dashed Center Road Line */}
                  <path
                    d="M 280,75 L 680,75 C 780,75 920,100 920,180 C 920,240 820,260 820,310 C 820,360 910,390 910,435 C 910,485 820,485 740,485 L 480,485 C 380,485 360,410 300,390 C 240,370 210,465 140,465 C 70,465 65,330 85,230 C 105,120 180,75 280,75 Z"
                    fill="none"
                    stroke="#f8fafc"
                    strokeWidth="2"
                    strokeDasharray="10 10"
                    opacity="0.4"
                  />

                  {/* BADGE CONNECTOR POINTER LINES */}
                  {trackLayouts.map((layout) => {
                    if (!layout.hasPointer) return null;
                    const strokeColor =
                      layout.rank === 1
                        ? '#f59e0b'
                        : layout.rank === 2
                        ? '#9ca3af'
                        : layout.rank === 3
                        ? '#b8622f'
                        : '#22d3ee';
                    return (
                      <line
                        key={`ptr-${layout.op.user_id}`}
                        x1={layout.carX}
                        y1={layout.carY}
                        x2={layout.badgeX}
                        y2={layout.badgeY}
                        stroke={strokeColor}
                        strokeWidth="1.2"
                        strokeDasharray="2 2"
                        opacity="0.65"
                      />
                    );
                  })}

                  {/* Clean Start / Finish Line on Top Straight */}
                  <rect
                    x="334"
                    y="50"
                    width="12"
                    height="50"
                    fill="url(#checkeredPattern)"
                    rx="2"
                    stroke="#06b6d4"
                    strokeWidth="1.5"
                    className="drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]"
                  />

                  <text
                    x="340"
                    y="42"
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

                {/* FORMULA 1 CARS & BADGES LAYER */}
                <div className="absolute inset-0 pointer-events-none">
                  {/* CARS */}
                  {trackLayouts.map((layout) => (
                    <F1RaceCarNode
                      key={`car-${layout.op.user_id}`}
                      op={layout.op}
                      rank={layout.rank}
                      isLeader={layout.isLeader}
                      carX={layout.carX}
                      carY={layout.carY}
                      angle={layout.angle}
                    />
                  ))}

                  {/* DRIVER BADGES */}
                  {trackLayouts.map((layout) => (
                    <F1DriverBadgeNode
                      key={`badge-${layout.op.user_id}`}
                      op={layout.op}
                      rank={layout.rank}
                      badgeX={layout.badgeX}
                      badgeY={layout.badgeY}
                      displayValue={layout.displayValue}
                    />
                  ))}
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

