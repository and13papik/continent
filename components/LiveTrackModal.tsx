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
  Zap,
  Trophy,
  ChevronUp,
  Sparkles,
  Target
} from 'lucide-react';
import {
  MESSAGES_PER_LAP,
  getLapInfo,
  sanitizeOperatorMessages,
  isLapCrossedForward,
  clampToBounds,
  getSpeedTier,
  easeInOutCubic,
  calculateAnimatedProgress,
  RaceAnimationState,
  SpeedTier
} from './trackLogic';
import { LiveCameraRaceScene } from './LiveCameraRaceScene';

export { MESSAGES_PER_LAP, getLapInfo };

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
  rankDelta?: number;
  deltaMessages?: number;
  isNewLap?: boolean;
  isLapCrossed?: boolean;
  isSelected?: boolean;
  isLapped?: boolean;
  isCloseBattle?: boolean;
  lapsBehind?: number;
  prefersReducedMotion?: boolean;
  onClick?: () => void;
}

const F1RaceCarNode: React.FC<CarNodeProps> = ({
  op,
  rank,
  isLeader,
  carX,
  carY,
  angle,
  rankDelta,
  deltaMessages = 0,
  isNewLap,
  isLapCrossed,
  isSelected,
  isLapped,
  isCloseBattle,
  lapsBehind = 0,
  prefersReducedMotion = false,
  onClick
}) => {
  const leftPct = (carX / 1000) * 100;
  const topPct = (carY / 520) * 100;

  const speedTier = getSpeedTier(deltaMessages);

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
  } else if (isLapped) {
    bodyColor = '#475569'; // Slate muted for lapped drivers
    rankStrokeColor = '#64748B';
  }

  const isOvertaking = (rankDelta || 0) > 0;
  const isDemoted = (rankDelta || 0) < 0;
  const isRush = deltaMessages >= 10;

  // Micro-engine vibration for idle / active motion
  const now = Date.now();
  const vibX = prefersReducedMotion
    ? 0
    : Math.sin(now / 45 + rank) * (speedTier === 'idle' ? 0.7 : 1.4);
  const vibY = prefersReducedMotion
    ? 0
    : Math.cos(now / 35 + rank) * (speedTier === 'idle' ? 0.7 : 1.4);

  // Lapped cars are rendered slightly smaller and muted so active battle cars pop out
  const scaleClass = isSelected
    ? 'scale-110 z-50'
    : isLapped
    ? 'scale-[0.82] opacity-75 z-20'
    : 'scale-100 z-30';

  return (
    <div
      onClick={onClick}
      className={`absolute pointer-events-auto group cursor-pointer ${
        isLapCrossed ? 'transition-none' : 'transition-transform duration-100 ease-out'
      } ${scaleClass}`}
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform: `translate(calc(-51.76% + ${vibX}px), calc(-50% + ${vibY}px)) rotate(${angle}deg)`,
      }}
    >
      {/* WIND / SPEED DUST PARTICLES (WHEN MOVING) */}
      {!prefersReducedMotion && speedTier !== 'idle' && (
        <div className="absolute right-[85%] top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none opacity-80">
          <div className="w-10 h-[2px] bg-gradient-to-l from-cyan-400 to-transparent animate-pulse" />
          <div className="w-6 h-[1.5px] bg-gradient-to-l from-white to-transparent" />
          {isRush && (
            <div className="w-14 h-[3px] bg-gradient-to-l from-amber-400 via-cyan-400 to-transparent blur-[0.5px]" />
          )}
        </div>
      )}

      {/* SPEED TRAIL BEHIND CAR */}
      <div
        className={`absolute right-[80%] top-1/2 -translate-y-1/2 h-2.5 rounded-l-full pointer-events-none transition-all duration-300 ${
          isRush
            ? 'w-24 bg-gradient-to-r from-transparent via-cyan-400 to-amber-300 opacity-100 blur-[2px] animate-pulse'
            : isLeader
            ? 'w-16 bg-gradient-to-r from-transparent via-amber-500 to-amber-300 opacity-90 blur-[1px]'
            : isLapped
            ? 'w-8 bg-gradient-to-r from-transparent via-slate-500 to-slate-400 opacity-30 blur-[1px]'
            : 'w-12 bg-gradient-to-r from-transparent via-cyan-500 to-cyan-300 opacity-70 blur-[1px]'
        }`}
      />

      {/* RUSH / BATTLE AURA RING */}
      {(isRush || isCloseBattle) && !isLapped && (
        <div
          className={`absolute -inset-2 rounded-full blur-md -z-10 animate-ping pointer-events-none ${
            isRush ? 'bg-cyan-400/40' : 'bg-rose-500/30'
          }`}
        />
      )}

      {/* LIVE ENGINE PULSE GLOW */}
      {!isLapped && (
        <div
          className={`absolute inset-0 rounded-full blur-md -z-10 animate-pulse pointer-events-none ${
            isLeader ? 'bg-amber-500/30' : 'bg-cyan-500/20'
          }`}
        />
      )}

      {/* F1 CAR CHASSIS + AVATAR */}
      <div className="relative flex items-center justify-center">
        <RaceCar
          avatarUrl={op.avatar}
          bodyColor={bodyColor}
          rankStrokeColor={rankStrokeColor}
          operatorId={op.user_id}
          operatorName={op.name}
        />

        {/* OVERTAKE / RUSH / BATTLE / NEW LAP BADGE */}
        {(isOvertaking || isDemoted || isNewLap || isRush || isCloseBattle) && (
          <div
            className="absolute -top-6 left-1/2 -translate-x-1/2 pointer-events-none z-50 animate-bounce"
            style={{ transform: `rotate(${-angle}deg)` }}
          >
            {isRush && (
              <span className="px-1.5 py-0.5 rounded-md bg-amber-950 border border-amber-400 text-amber-300 text-[9px] font-black tracking-wider uppercase shadow-[0_0_12px_rgba(251,191,36,0.9)] whitespace-nowrap flex items-center gap-0.5">
                🚀 РЫВОК +{deltaMessages}
              </span>
            )}
            {!isRush && isOvertaking && (
              <span className="px-1.5 py-0.5 rounded-md bg-cyan-950 border border-cyan-400 text-cyan-300 text-[9px] font-black tracking-wider uppercase shadow-[0_0_10px_rgba(34,211,238,0.8)] whitespace-nowrap">
                ОБГОН ↑{rankDelta}
              </span>
            )}
            {!isRush && isCloseBattle && !isOvertaking && (
              <span className="px-1.5 py-0.5 rounded-md bg-rose-950 border border-rose-400 text-rose-300 text-[8.5px] font-black tracking-wider uppercase shadow-[0_0_10px_rgba(244,63,94,0.8)] whitespace-nowrap">
                ⚔ БОРЬБА
              </span>
            )}
            {isDemoted && !isOvertaking && !isRush && (
              <span className="px-1.5 py-0.5 rounded-md bg-slate-900 border border-slate-500 text-slate-300 text-[9px] font-bold whitespace-nowrap">
                ↓{Math.abs(rankDelta || 0)}
              </span>
            )}
            {isNewLap && !isOvertaking && !isRush && (
              <span className="px-1.5 py-0.5 rounded-md bg-emerald-950 border border-emerald-400 text-emerald-300 text-[9px] font-black tracking-wider uppercase shadow-[0_0_10px_rgba(52,211,153,0.8)] whitespace-nowrap">
                НОВЫЙ КРУГ 🏁
              </span>
            )}
          </div>
        )}
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
  isCompact?: boolean;
  isUltraCompact?: boolean;
  isLapCrossed?: boolean;
  isSelected?: boolean;
  isLapped?: boolean;
  lapsBehind?: number;
  onClick?: () => void;
}

const F1DriverBadgeNode: React.FC<DriverBadgeNodeProps> = ({
  op,
  rank,
  badgeX,
  badgeY,
  displayValue,
  isCompact,
  isUltraCompact,
  isLapCrossed,
  isSelected,
  isLapped,
  lapsBehind = 0,
  onClick
}) => {
  const leftPct = (badgeX / 1000) * 100;
  const topPct = (badgeY / 520) * 100;
  const lapInfo = getLapInfo(op.messages_count);

  const lappedTag = isLapped ? ` (-${lapsBehind}К)` : '';

  return (
    <div
      onClick={onClick}
      className={`absolute pointer-events-auto cursor-pointer ${
        isLapCrossed ? 'transition-none' : 'transition-all duration-700 ease-out'
      } ${isSelected ? 'scale-110 z-50' : isLapped ? 'z-30 opacity-80 scale-95' : 'z-40'}`}
      style={{
        left: `${leftPct}%`,
        top: `${topPct}%`,
        transform: 'translate(-50%, -50%)',
      }}
      title={`${op.name} (#${rank}) — ${op.messages_count} сообщ. — КРУГ ${lapInfo.currentLap}${isLapped ? ` (отстает на ${lapsBehind} кр.)` : ''}`}
    >
      {isUltraCompact ? (
        // ULTRA COMPACT BADGE (#3 huskar · 213)
        <div
          className={`px-1.5 py-0.5 rounded-lg border shadow-lg backdrop-blur-md flex items-center gap-1 whitespace-nowrap text-[9px] font-mono select-none transition-all ${
            isSelected
              ? 'bg-cyan-950/95 border-cyan-400 text-cyan-200 shadow-cyan-500/40 ring-1 ring-cyan-400'
              : rank === 1
              ? 'bg-amber-950/95 border-amber-400/90 text-amber-200'
              : isLapped
              ? 'bg-slate-950/80 border-slate-700/60 text-slate-400'
              : 'bg-slate-950/95 border-cyan-500/40 text-slate-200'
          }`}
        >
          <span className={`font-black ${rank === 1 ? 'text-amber-400' : isLapped ? 'text-slate-500' : 'text-cyan-400'}`}>
            #{rank}
          </span>
          <span className="max-w-[50px] truncate text-slate-100 font-bold">
            {op.name}
          </span>
          <span className={isLapped ? 'text-slate-400 font-bold' : 'text-cyan-300 font-black'}>
            · {op.messages_count}
          </span>
        </div>
      ) : isCompact ? (
        // COMPACT BADGE (#3 huskar · 213 \n К3 · 13/100)
        <div
          className={`px-2 py-0.5 rounded-xl border shadow-lg backdrop-blur-md flex flex-col gap-0.5 whitespace-nowrap text-[9.5px] font-mono select-none transition-all ${
            isSelected
              ? 'bg-cyan-950/95 border-cyan-400 text-cyan-200 shadow-cyan-500/40 ring-1 ring-cyan-400'
              : rank === 1
              ? 'bg-amber-950/95 border-amber-400/90 text-amber-200'
              : isLapped
              ? 'bg-slate-950/80 border-slate-700/60 text-slate-400'
              : 'bg-slate-950/95 border-cyan-500/40 text-slate-200'
          }`}
        >
          <div className="flex items-center gap-1">
            <span className={`font-black ${rank === 1 ? 'text-amber-400' : isLapped ? 'text-slate-500' : 'text-cyan-400'}`}>
              #{rank}
            </span>
            <span className="max-w-[65px] truncate text-slate-100 font-bold">
              {op.name}
            </span>
            <span className={isLapped ? 'text-slate-400 font-bold ml-auto' : 'text-cyan-300 font-black ml-auto'}>
              · {op.messages_count}
            </span>
          </div>
          <div className="flex items-center justify-between text-[8.5px] text-slate-400 border-t border-white/10 pt-0.5">
            <span className={isLapped ? 'text-slate-400 font-semibold' : 'text-cyan-300/90 font-bold'}>К{lapInfo.currentLap}{lappedTag}</span>
            <span className="text-slate-400">{lapInfo.messagesInCurrentLap}/100</span>
          </div>
        </div>
      ) : (
        // STANDARD BADGE
        <div
          className={`px-2 py-1 rounded-xl border shadow-xl backdrop-blur-md flex flex-col gap-0.5 whitespace-nowrap text-[10px] font-mono select-none transition-all ${
            isSelected
              ? 'bg-cyan-950/95 border-cyan-400 text-cyan-200 shadow-cyan-500/40 ring-2 ring-cyan-400'
              : rank === 1
              ? 'bg-amber-950/95 border-amber-400/90 text-amber-200 shadow-amber-500/20 ring-1 ring-amber-400/30'
              : rank === 2
              ? 'bg-slate-900/95 border-slate-300/80 text-slate-200'
              : rank === 3
              ? 'bg-amber-950/90 border-amber-600/80 text-amber-300'
              : isLapped
              ? 'bg-slate-950/80 border-slate-700/60 text-slate-400'
              : 'bg-slate-950/95 border-cyan-500/40 text-slate-200'
          }`}
        >
          {/* ROW 1: RANK + NAME + MESSAGES */}
          <div className="flex items-center gap-1.5">
            <span
              className={`font-black flex items-center gap-0.5 ${
                rank === 1
                  ? 'text-amber-400'
                  : rank === 2
                  ? 'text-slate-300'
                  : rank === 3
                  ? 'text-amber-500'
                  : isLapped
                  ? 'text-slate-500'
                  : 'text-slate-400'
              }`}
            >
              {rank === 1 && <Crown size={10} className="fill-amber-400 text-amber-400 shrink-0" />}
              #{rank}
            </span>

            <span className="max-w-[70px] sm:max-w-[95px] truncate text-slate-100 font-bold" title={op.name}>
              {op.name}
            </span>

            <span className={`font-black tracking-tight ml-auto ${isLapped ? 'text-slate-400' : 'text-cyan-400'}`}>
              {displayValue}
            </span>
          </div>

          {/* ROW 2: LAP NUMBER & CURRENT LAP PROGRESS */}
          <div className="flex items-center justify-between text-[9px] text-slate-300 font-semibold border-t border-white/10 pt-0.5">
            <span className={isLapped ? 'text-slate-400 font-semibold' : 'text-cyan-300 font-bold'}>К{lapInfo.currentLap}{lappedTag}</span>
            <span className="text-slate-400 font-mono">{lapInfo.messagesInCurrentLap}/100</span>
          </div>
        </div>
      )}
    </div>
  );
};

interface RaceEvent {
  id: string;
  type: 'gain' | 'overtake' | 'lap' | 'leader' | 'gap';
  text: string;
  timestamp: number;
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
  const [isShiftEnded, setIsShiftEnded] = useState<boolean>(false);
  const [showSidebar, setShowSidebar] = useState<boolean>(true);

  // Camera & Motion Mode
  const [cameraMode] = useState<'overview' | 'live_camera'>('live_camera');
  const [cameraTransform, setCameraTransform] = useState<{ scale: number; x: number; y: number }>({ scale: 1, x: 0, y: 0 });
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);
  const [, setFrameTick] = useState<number>(0);

  // Live Dynamics & Target Selection State
  const [eventsFeed, setEventsFeed] = useState<RaceEvent[]>([]);
  const [overtakingOpIds, setOvertakingOpIds] = useState<Map<string, number>>(new Map());
  const [newLapOpIds, setNewLapOpIds] = useState<Set<string>>(new Set());
  const [startLineFlash, setStartLineFlash] = useState<boolean>(false);
  const [selectedOperatorId, setSelectedOperatorId] = useState<string | null>(null);

  // Animation state store for continuous 10-12s interpolation
  const animStateRef = useRef<Record<string, RaceAnimationState>>({});

  // Previous snapshot ref for detecting real delta events by operatorId
  const prevSnapshotRef = useRef<Record<string, { messages: number; rank: number; completedLaps: number }>>({});
  const operatorHistoryRef = useRef<Record<string, {
    messages: number;
    lapProgress: number;
    completedLaps: number;
    rawDist: number;
  }>>({});

  // SVG Track Ref & Length state
  const pathRef = useRef<SVGPathElement>(null);
  const [trackLength, setTrackLength] = useState<number>(0);

  // Detect prefers-reduced-motion
  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia) {
      const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
      setPrefersReducedMotion(mq.matches);
      const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
      if (mq.addEventListener) mq.addEventListener('change', handler);
      return () => {
        if (mq.removeEventListener) mq.removeEventListener('change', handler);
      };
    }
  }, []);

  // Update animation target distances for smooth 10-12s motion replay
  const updateAnimStatesForOperators = (opsList: ShiftOperator[], pathL?: number) => {
    const L = pathL || trackLength || 1000;
    const now = Date.now();

    opsList.forEach((op) => {
      const existing = animStateRef.current[op.user_id];
      const { messages: sanitizedMsgs } = sanitizeOperatorMessages(op.messages_count, existing?.targetMessages);
      const targetDist = (sanitizedMsgs / MESSAGES_PER_LAP) * L;

      if (!existing) {
        animStateRef.current[op.user_id] = {
          operatorId: op.user_id,
          previousMessages: sanitizedMsgs,
          targetMessages: sanitizedMsgs,
          displayedMessages: sanitizedMsgs,
          previousDistance: targetDist,
          targetDistance: targetDist,
          animatedDistance: targetDist,
          deltaMessages: 0,
          animationStartTime: now,
          animationDuration: 11000
        };
      } else {
        const deltaMsgs = sanitizedMsgs - existing.targetMessages;
        if (deltaMsgs > 0) {
          animStateRef.current[op.user_id] = {
            operatorId: op.user_id,
            previousMessages: existing.displayedMessages,
            targetMessages: sanitizedMsgs,
            displayedMessages: existing.displayedMessages,
            previousDistance: existing.animatedDistance,
            targetDistance: targetDist,
            animatedDistance: existing.animatedDistance,
            deltaMessages: deltaMsgs,
            animationStartTime: now,
            animationDuration: 11000
          };
        } else if (deltaMsgs === 0) {
          animStateRef.current[op.user_id] = {
            ...existing,
            targetMessages: sanitizedMsgs,
            targetDistance: targetDist,
            deltaMessages: 0
          };
        } else {
          animStateRef.current[op.user_id] = {
            operatorId: op.user_id,
            previousMessages: sanitizedMsgs,
            targetMessages: sanitizedMsgs,
            displayedMessages: sanitizedMsgs,
            previousDistance: targetDist,
            targetDistance: targetDist,
            animatedDistance: targetDist,
            deltaMessages: 0,
            animationStartTime: now,
            animationDuration: 11000
          };
        }
      }
    });
  };

  // Measure path length on mount/modal open
  useEffect(() => {
    if (!isOpen) return;

    const measurePath = () => {
      if (pathRef.current) {
        try {
          const len = pathRef.current.getTotalLength();
          if (len > 0) {
            setTrackLength(len);
            updateAnimStatesForOperators(operators, len);
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

      updateAnimStatesForOperators(initialOperators);

      // Seed initial snapshot
      const sortedByMsgs = [...initialOperators].sort((a, b) => b.messages_count - a.messages_count);
      const initSnap: Record<string, { messages: number; rank: number; completedLaps: number }> = {};
      sortedByMsgs.forEach((op, idx) => {
        initSnap[op.user_id] = {
          messages: op.messages_count,
          rank: idx + 1,
          completedLaps: Math.floor(op.messages_count / MESSAGES_PER_LAP)
        };
      });
      prevSnapshotRef.current = initSnap;
    }
  }, [isOpen, initialOperators, initialShiftInfo]);

  // Continuous RAF loop for 60fps smooth interpolation & live camera pan
  useEffect(() => {
    if (!isOpen) return;

    let rafId: number;

    const loop = () => {
      const now = Date.now();
      const animStates = animStateRef.current;

      // 1. Smoothly advance distance & displayed messages for each operator
      Object.keys(animStates).forEach((id) => {
        const st = animStates[id];
        if (!st) return;

        const { animatedDistance, progress } = calculateAnimatedProgress(
          st.previousDistance,
          st.targetDistance,
          st.animationStartTime,
          st.animationDuration,
          now
        );

        st.animatedDistance = animatedDistance;
        const interp = Math.round(
          st.previousMessages + (st.targetMessages - st.previousMessages) * easeInOutCubic(progress)
        );
        st.displayedMessages = interp;
      });

      // 2. Live camera auto-zoom and battle tracking
      if (cameraMode === 'live_camera') {
        let targetX = 0;
        let targetY = 0;
        let targetScale = 1.0;

        const visibleOps = operators.filter(o => !hiddenOperatorIds.has(o.user_id));
        const sorted = [...visibleOps].sort((a, b) => {
          const mA = animStates[a.user_id]?.displayedMessages ?? a.messages_count;
          const mB = animStates[b.user_id]?.displayedMessages ?? b.messages_count;
          return mB - mA;
        });

        let focusCar: { x: number; y: number } | null = null;

        // Focus on active surge or close battle
        const rushingOp = sorted.find(o => (animStates[o.user_id]?.deltaMessages ?? 0) >= 3);
        if (rushingOp && pathRef.current && trackLength > 0) {
          const dist = animStates[rushingOp.user_id]?.animatedDistance ?? 0;
          const pt = pathRef.current.getPointAtLength((dist % trackLength + trackLength) % trackLength);
          focusCar = { x: pt.x, y: pt.y };
        }

        if (!focusCar && sorted.length >= 2) {
          for (let i = 0; i < sorted.length - 1; i++) {
            const op1 = sorted[i];
            const op2 = sorted[i + 1];
            const m1 = animStates[op1.user_id]?.displayedMessages ?? op1.messages_count;
            const m2 = animStates[op2.user_id]?.displayedMessages ?? op2.messages_count;
            if (m1 - m2 <= 5 && pathRef.current && trackLength > 0) {
              const d1 = animStates[op1.user_id]?.animatedDistance ?? 0;
              const d2 = animStates[op2.user_id]?.animatedDistance ?? 0;
              const pt1 = pathRef.current.getPointAtLength((d1 % trackLength + trackLength) % trackLength);
              const pt2 = pathRef.current.getPointAtLength((d2 % trackLength + trackLength) % trackLength);
              focusCar = { x: (pt1.x + pt2.x) / 2, y: (pt1.y + pt2.y) / 2 };
              break;
            }
          }
        }

        if (focusCar && !prefersReducedMotion) {
          targetScale = 1.18;
          targetX = (500 - focusCar.x) * 0.18;
          targetY = (260 - focusCar.y) * 0.18;
        }

        setCameraTransform(prev => ({
          scale: prev.scale + (targetScale - prev.scale) * 0.05,
          x: prev.x + (targetX - prev.x) * 0.05,
          y: prev.y + (targetY - prev.y) * 0.05
        }));
      } else {
        setCameraTransform({ scale: 1, x: 0, y: 0 });
      }

      setFrameTick(now);
      rafId = requestAnimationFrame(loop);
    };

    rafId = requestAnimationFrame(loop);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [isOpen, cameraMode, operators, hiddenOperatorIds, trackLength, prefersReducedMotion]);

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

  // Fetch updated data for track (15-second polling)
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
      params.set('resource', 'shift-operators');

      const url = `/api/onlymonster/analytics?${params.toString()}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.operators) {
          const newOps: ShiftOperator[] = data.operators;
          setOperators(newOps);
          updateAnimStatesForOperators(newOps);
          if (data.shift) setShiftInfo(data.shift);
          setLastUpdated(new Date());
          setSecondsAgo(0);

          // Compare snapshot to trigger live race events
          const sortedNew = [...newOps].sort((a, b) => b.messages_count - a.messages_count);
          const currentRanks = new Map<string, number>();
          sortedNew.forEach((op, idx) => currentRanks.set(op.user_id, idx + 1));

          const newEvents: RaceEvent[] = [];
          const nextOvertakes = new Map<string, number>();
          const nextNewLaps = new Set<string>();
          const prevSnap = prevSnapshotRef.current;

          if (Object.keys(prevSnap).length > 0) {
            sortedNew.forEach((op) => {
              const prev = prevSnap[op.user_id];
              const currRank = currentRanks.get(op.user_id) || 999;
              const currLaps = Math.floor(op.messages_count / MESSAGES_PER_LAP);

              if (prev) {
                const deltaMsgs = op.messages_count - prev.messages;

                // 1. Gain Event
                if (deltaMsgs > 0) {
                  newEvents.push({
                    id: `gain-${op.user_id}-${Date.now()}-${Math.random()}`,
                    type: 'gain',
                    text: `⚡ ${op.name}: +${deltaMsgs} ${deltaMsgs === 1 ? 'сообщение' : deltaMsgs < 5 ? 'сообщения' : 'сообщений'}`,
                    timestamp: Date.now()
                  });
                }

                // 2. Overtake Event
                if (currRank < prev.rank) {
                  const rankDelta = prev.rank - currRank;
                  nextOvertakes.set(op.user_id, rankDelta);
                  const victim = sortedNew.find(other => currentRanks.get(other.user_id) === currRank + 1);
                  const victimName = victim ? victim.name : '';
                  newEvents.push({
                    id: `overtake-${op.user_id}-${Date.now()}`,
                    type: 'overtake',
                    text: `🔥 ${op.name} ${victimName ? `обошёл ${victimName} и ` : ''}вышел на #${currRank}`,
                    timestamp: Date.now()
                  });
                }

                // 3. Lap Completion Event
                if (currLaps > prev.completedLaps) {
                  nextNewLaps.add(op.user_id);
                  newEvents.push({
                    id: `lap-${op.user_id}-${Date.now()}`,
                    type: 'lap',
                    text: `🏁 ${op.name} завершил ${currLaps}-й круг`,
                    timestamp: Date.now()
                  });
                }

                // 4. Leader Change Event
                if (currRank === 1 && prev.rank !== 1) {
                  newEvents.push({
                    id: `leader-${op.user_id}-${Date.now()}`,
                    type: 'leader',
                    text: `👑 НОВЫЙ ЛИДЕР — ${op.name}`,
                    timestamp: Date.now()
                  });
                }

                // 5. Gap Reduction Event
                if (deltaMsgs > 0 && currRank > 1 && currRank === prev.rank) {
                  const leader = sortedNew[0];
                  if (leader && leader.user_id !== op.user_id) {
                    const prevLeaderMsgs = prevSnap[leader.user_id]?.messages || leader.messages_count;
                    const prevGap = prevLeaderMsgs - prev.messages;
                    const currGap = leader.messages_count - op.messages_count;
                    const reducedBy = prevGap - currGap;
                    if (reducedBy > 0) {
                      newEvents.push({
                        id: `gap-${op.user_id}-${Date.now()}`,
                        type: 'gap',
                        text: `🚀 ${op.name} сократил разрыв до лидера на ${reducedBy} ${reducedBy === 1 ? 'сообщение' : reducedBy < 5 ? 'сообщения' : 'сообщений'}`,
                        timestamp: Date.now()
                      });
                    }
                  }
                }
              }
            });
          }

          // Save next snapshot
          const nextSnap: Record<string, { messages: number; rank: number; completedLaps: number }> = {};
          sortedNew.forEach((op) => {
            nextSnap[op.user_id] = {
              messages: op.messages_count,
              rank: currentRanks.get(op.user_id) || 999,
              completedLaps: Math.floor(op.messages_count / MESSAGES_PER_LAP)
            };
          });
          prevSnapshotRef.current = nextSnap;

          if (newEvents.length > 0) {
            setEventsFeed(prev => [...newEvents, ...prev].slice(0, 3));
          }

          if (nextOvertakes.size > 0) {
            setOvertakingOpIds(nextOvertakes);
            setTimeout(() => setOvertakingOpIds(new Map()), 3500);
          }

          if (nextNewLaps.size > 0) {
            setNewLapOpIds(nextNewLaps);
            setStartLineFlash(true);
            setTimeout(() => {
              setNewLapOpIds(new Set());
              setStartLineFlash(false);
            }, 3500);
          }
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
      setIsShiftEnded(false);
      return;
    }

    const updateCountdown = () => {
      const endMs = new Date(shiftInfo.end).getTime();
      const nowMs = Date.now();
      const diffMs = endMs - nowMs;

      if (diffMs <= 0) {
        setRemainingTimeText('Смена завершена');
        setIsShiftEnded(true);
      } else {
        setIsShiftEnded(false);
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

  // Sort labels
  const sortLabels: Record<string, string> = {
    messages: 'Сообщения',
    reply_time: 'Время ответа',
    ppv_sent: 'PPV отправлено',
    ppv_sold: 'PPV продано',
    earnings: 'Доход ($)'
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

  interface CarLayout {
    op: ShiftOperator;
    rank: number;
    isLeader: boolean;
    carX: number;
    carY: number;
    angle: number;
    badgeX: number;
    badgeY: number;
    hasPointer: boolean;
    displayValue: string;
    isCompact: boolean;
    isUltraCompact: boolean;
    isLapCrossed: boolean;
    isLapped: boolean;
    lapsBehind: number;
    lapInfo: ReturnType<typeof getLapInfo>;
    deltaMessages: number;
    isCloseBattle: boolean;
  }

  // Calculate 2D coordinates for cars and upright badges on the SVG track
  // Absolute longitudinal progress along lap = (messages % 100) / 100
  // Cars NEVER move backward unless their messages count decreases in real data.
  const getTrackLayouts = (visibleOps: ShiftOperator[]): CarLayout[] => {
    if (!pathRef.current || trackLength === 0 || visibleOps.length === 0) {
      return [];
    }

    const L = trackLength;

    // 1. Sort visibleOps strictly by messages_count desc to assign accurate race ranks
    const sortedByMsgs = [...visibleOps].sort((a, b) => b.messages_count - a.messages_count);
    const rankMap = new Map<string, number>();
    sortedByMsgs.forEach((o, i) => rankMap.set(o.user_id, i + 1));

    // Determine close battles (gap <= 10 messages between adjacent drivers)
    const closeBattleSet = new Set<string>();
    for (let i = 0; i < sortedByMsgs.length - 1; i++) {
      const op1 = sortedByMsgs[i];
      const op2 = sortedByMsgs[i + 1];
      const m1 = animStateRef.current[op1.user_id]?.displayedMessages ?? op1.messages_count;
      const m2 = animStateRef.current[op2.user_id]?.displayedMessages ?? op2.messages_count;
      if (m1 - m2 <= 10) {
        closeBattleSet.add(op1.user_id);
        closeBattleSet.add(op2.user_id);
      }
    }

    // 2. Compute absolute lap progress & path distances with history & sanitization
    const rawData = visibleOps.map((op) => {
      const animState = animStateRef.current[op.user_id];
      const displayedMsgs = animState?.displayedMessages ?? op.messages_count;
      const animDist = animState?.animatedDistance ?? (op.messages_count / MESSAGES_PER_LAP) * L;
      const deltaMsgs = animState?.deltaMessages ?? 0;

      const rank = rankMap.get(op.user_id) || 1;
      const isLeader = rank === 1;

      const history = operatorHistoryRef.current[op.user_id];
      const { messages: effectiveMsgs, wasDecreased } = sanitizeOperatorMessages(
        displayedMsgs,
        history?.messages
      );

      if (wasDecreased) {
        console.warn(
          `[LiveTrackModal] Message count decreased for operator ${op.user_id} (${op.name}): prev=${history?.messages}, curr=${displayedMsgs}. Preserving previous progress.`
        );
      }

      const lapInfo = getLapInfo(effectiveMsgs);
      const rawDist = Math.max(0, (animDist % L + L) % L);

      const isLapCrossed = isLapCrossedForward(
        history?.lapProgress ?? 0,
        lapInfo.lapProgress
      );

      operatorHistoryRef.current[op.user_id] = {
        messages: effectiveMsgs,
        lapProgress: lapInfo.lapProgress,
        completedLaps: lapInfo.completedLaps,
        rawDist
      };

      const displayValue = getMetricDisplayValue({ ...op, messages_count: effectiveMsgs });
      return {
        op: { ...op, messages_count: effectiveMsgs },
        rank,
        isLeader,
        lapInfo,
        rawDist,
        displayValue,
        isLapCrossed,
        deltaMsgs,
        isCloseBattle: closeBattleSet.has(op.user_id)
      };
    });

    // 3. Assign deterministic lateral lane shifts and separate cars on different laps
    const carTransforms = rawData.map((item) => {
      const closeCluster = rawData
        .filter((other) => {
          const delta = Math.abs(other.rawDist - item.rawDist);
          const loopDelta = Math.min(delta, L - delta);
          return loopDelta < 50;
        })
        .sort((a, b) => {
          // Cars on leading laps take inner racing lines; lapped cars take secondary outer lines
          if (b.lapInfo.completedLaps !== a.lapInfo.completedLaps) {
            return b.lapInfo.completedLaps - a.lapInfo.completedLaps;
          }
          if (a.rank !== b.rank) {
            return a.rank - b.rank;
          }
          return a.op.user_id.localeCompare(b.op.user_id);
        });

      const maxLapsInCluster = Math.max(...closeCluster.map((c) => c.lapInfo.completedLaps));
      const lapsBehind = maxLapsInCluster - item.lapInfo.completedLaps;
      const isLapped = lapsBehind > 0;

      let laneShift = 0;
      if (closeCluster.length > 1) {
        const clusterIdx = closeCluster.findIndex((o) => o.op.user_id === item.op.user_id);
        const leadLanes = [0, -14, 14, -8, 8];
        const lappedLanes = [22, -22, 30, -30, 36, -36];
        if (!isLapped) {
          laneShift = leadLanes[clusterIdx % leadLanes.length];
        } else {
          laneShift = lappedLanes[(clusterIdx + lapsBehind) % lappedLanes.length];
        }
      }

      const distOnPath = (item.rawDist + L) % L;
      const p1 = pathRef.current!.getPointAtLength(distOnPath);
      const p2 = pathRef.current!.getPointAtLength((distOnPath + 3) % L);

      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const angleRad = Math.atan2(dy, dx);
      const angleDeg = (angleRad * 180) / Math.PI;

      const perpRad = angleRad + Math.PI / 2;
      let carX = p1.x + Math.cos(perpRad) * laneShift;
      let carY = p1.y + Math.sin(perpRad) * laneShift;

      // Safe bounds enforcement on bottom section:
      if (p1.y > 400 && Math.sin(perpRad) * laneShift > 0) {
        carY = p1.y - Math.abs(Math.sin(perpRad) * laneShift);
      }

      carX = clampToBounds(carX, 35, 965);
      carY = clampToBounds(carY, 25, 475);

      // Density calculation for badge compactness:
      const densityNeighbors = rawData.filter((other) => {
        if (other.op.user_id === item.op.user_id) return false;
        const delta = Math.abs(other.rawDist - item.rawDist);
        const loopDelta = Math.min(delta, L - delta);
        return loopDelta < 90;
      });

      const density = densityNeighbors.length;
      const isUltraCompact = density >= 3;
      const isCompact = density >= 1 && density < 3;

      return {
        ...item,
        carX,
        carY,
        angle: angleDeg,
        angleRad,
        isUltraCompact,
        isCompact,
        isLapped,
        lapsBehind
      };
    });

    // 4. Badge Collision Resolution (place active battle/lead cars first)
    const sortedForBadgePlacement = [...carTransforms].sort((a, b) => {
      if (a.isLapped !== b.isLapped) return a.isLapped ? 1 : -1;
      return a.rank - b.rank;
    });

    const placedBadges: { bx: number; by: number; width: number; height: number }[] = [];
    const telemetryBox = { minX: 320, maxX: 640, minY: 150, maxY: 355 };
    const containerBox = { minX: 25, maxX: 975, minY: 15, maxY: 505 };

    const layoutMap = new Map<string, CarLayout>();

    sortedForBadgePlacement.forEach((car) => {
      const W = car.isUltraCompact ? 80 : car.isCompact ? 95 : 110;
      const H = car.isUltraCompact ? 18 : car.isCompact ? 24 : 30;

      const candidateOffsets = car.carY > 380
        ? [
            { dx: 0, dy: -32 },
            { dx: -45, dy: -22 },
            { dx: 45, dy: -22 },
            { dx: 0, dy: -52 },
            { dx: -60, dy: -18 },
            { dx: 60, dy: -18 },
            { dx: 0, dy: 28 },
          ]
        : [
            { dx: 0, dy: -30 },    // Level 1: Above
            { dx: 0, dy: 30 },     // Level 2: Below
            { dx: 45, dy: -22 },   // Level 3: Top-Right
            { dx: -45, dy: -22 },  // Level 4: Top-Left
            { dx: 0, dy: -48 },    // Level 5: Farther Above
            { dx: 45, dy: 22 },    // Level 6: Bottom-Right
            { dx: -45, dy: 22 },   // Level 7: Bottom-Left
            { dx: 70, dy: 0 },     // Level 8: Far Right
            { dx: -70, dy: 0 },    // Level 9: Far Left
          ];

      let bestBx = car.carX;
      let bestBy = car.carY > 380 ? car.carY - 32 : car.carY - 30;
      let found = false;

      const normDx = Math.cos(car.angleRad + Math.PI / 2) * 30;
      const normDy = Math.sin(car.angleRad + Math.PI / 2) * 30;

      const dynamicCandidates = car.carY > 380
        ? candidateOffsets
        : [
            { dx: normDx, dy: normDy },
            { dx: -normDx, dy: -normDy },
            ...candidateOffsets
          ];

      for (const cand of dynamicCandidates) {
        let bx = car.carX + cand.dx;
        let by = car.carY + cand.dy;

        bx = clampToBounds(bx, containerBox.minX + W / 2, containerBox.maxX - W / 2);
        by = clampToBounds(by, containerBox.minY + H / 2, containerBox.maxY - H / 2);

        if (
          bx + W / 2 > telemetryBox.minX &&
          bx - W / 2 < telemetryBox.maxX &&
          by + H / 2 > telemetryBox.minY &&
          by - H / 2 < telemetryBox.maxY
        ) {
          continue;
        }

        const badgeCollision = placedBadges.some((pb) => {
          return Math.abs(bx - pb.bx) < (W + pb.width) * 0.45 && Math.abs(by - pb.by) < (H + pb.height) * 0.48;
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
          let bx = car.carX + cand.dx;
          let by = car.carY + cand.dy;

          bx = clampToBounds(bx, containerBox.minX + W / 2, containerBox.maxX - W / 2);
          by = clampToBounds(by, containerBox.minY + H / 2, containerBox.maxY - H / 2);

          let score = 0;
          placedBadges.forEach((pb) => {
            const overlapX = Math.max(0, (W + pb.width) * 0.5 - Math.abs(bx - pb.bx));
            const overlapY = Math.max(0, (H + pb.height) * 0.5 - Math.abs(by - pb.by));
            score += overlapX * overlapY;
          });

          if (score < minOverlap) {
            minOverlap = score;
            bestBx = bx;
            bestBy = by;
          }
        }
      }

      bestBx = clampToBounds(bestBx, containerBox.minX + W / 2, containerBox.maxX - W / 2);
      bestBy = clampToBounds(bestBy, containerBox.minY + H / 2, containerBox.maxY - H / 2);

      placedBadges.push({ bx: bestBx, by: bestBy, width: W, height: H });

      const distToBadge = Math.hypot(bestBx - car.carX, bestBy - car.carY);
      const hasPointer = distToBadge > 18;

      layoutMap.set(car.op.user_id, {
        op: car.op,
        rank: car.rank,
        isLeader: car.isLeader,
        carX: car.carX,
        carY: car.carY,
        angle: car.angle,
        badgeX: bestBx,
        badgeY: bestBy,
        hasPointer,
        displayValue: car.displayValue,
        isCompact: car.isCompact,
        isUltraCompact: car.isUltraCompact,
        isLapCrossed: car.isLapCrossed,
        isLapped: car.isLapped,
        lapsBehind: car.lapsBehind,
        deltaMessages: car.deltaMsgs,
        isCloseBattle: car.isCloseBattle,
        lapInfo: car.lapInfo
      });
    });

    return carTransforms.map((c) => layoutMap.get(c.op.user_id)!);
  };

  const trackLayouts = getTrackLayouts(visibleOperators);

  // Identify Leader & Telemetry Gap
  const sortedVisible = [...visibleOperators].sort((a, b) => b.messages_count - a.messages_count);
  const leaderOp = sortedVisible[0];
  const secondOp = sortedVisible[1];
  const gapValue = leaderOp && secondOp ? Math.max(0, leaderOp.messages_count - secondOp.messages_count) : 0;

  // Nearest Target calculation for selected operator
  const selectedOp = visibleOperators.find(o => o.user_id === selectedOperatorId);
  const selectedOpRank = selectedOp ? sortedVisible.findIndex(o => o.user_id === selectedOp.user_id) + 1 : 0;
  const prevRankOp = selectedOpRank > 1 ? sortedVisible[selectedOpRank - 2] : null;
  const gapToNextRank = selectedOp && prevRankOp ? prevRankOp.messages_count - selectedOp.messages_count + 1 : 0;
  const selectedOpLap = selectedOp ? getLapInfo(selectedOp.messages_count) : null;

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
                  ГОНОЧНЫЙ ТРЕК
                </h3>
                <span className="text-[10px] uppercase font-extrabold text-slate-300 bg-cyan-950/80 border border-cyan-500/40 px-2.5 py-0.5 rounded-lg shadow-sm">
                  {shiftInfo?.label ? `ЗАЕЗД ${shiftInfo.label}` : 'ЗАЕЗД 08:00–14:00'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-bold flex items-center gap-1.5 mt-0.5">
                <span>Метрика:</span>
                <span className="text-cyan-400 uppercase font-black">
                  {sortLabels[sortBy] || sortBy} ({sortDir === 'asc' ? '▲' : '▼'})
                </span>
                <span className="text-slate-500">• 1 КРУГ = 100 СООБЩЕНИЙ</span>
              </p>
            </div>
          </div>

          {/* TIMER & LIVE STATUS */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Shift Countdown Timer */}
            {isCurrentActiveShift && remainingTimeText && (
              <div className={`px-3.5 py-1.5 rounded-xl flex items-center gap-2 shadow-md transition-all ${
                isShiftEnded 
                  ? 'bg-amber-950/80 border border-amber-500/50 text-amber-300' 
                  : 'bg-emerald-950/60 border border-emerald-500/40 text-emerald-300'
              }`}>
                <Clock size={14} className={isShiftEnded ? 'text-amber-400' : 'text-emerald-400 animate-pulse'} />
                <div className="text-left">
                  <span className="text-[9px] uppercase font-bold block leading-none opacity-80">
                    {isShiftEnded ? 'Статус смены' : 'До конца смены'}
                  </span>
                  <span className="text-xs font-black tracking-wider">
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
              title="Закрыть трек (Esc)"
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
            ) : cameraMode === 'live_camera' ? (
              <LiveCameraRaceScene
                operators={operators}
                hiddenOperatorIds={hiddenOperatorIds}
                sortBy={sortBy}
                sortDir={sortDir}
                isShiftEnded={isShiftEnded}
                remainingTimeText={remainingTimeText}
                shiftInfo={shiftInfo}
                eventsFeed={eventsFeed}
                overtakingOpIds={overtakingOpIds}
                selectedOperatorId={selectedOperatorId}
                onSelectOperator={(id) => setSelectedOperatorId(id)}
                prefersReducedMotion={prefersReducedMotion}
                isCurrentActiveShift={isCurrentActiveShift}
              />
            ) : (
              <div className="relative w-full aspect-[2/1] min-h-[380px] sm:min-h-[500px] my-auto select-none rounded-3xl border border-cyan-500/20 bg-slate-950 overflow-hidden shadow-[inset_0_0_60px_rgba(0,0,0,0.85)]">
                
                {/* CENTRAL LIVE TELEMETRY BOARD */}
                <div className="absolute top-[48%] left-[48%] -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none flex flex-col items-center">
                  <div className="bg-slate-950/90 border border-cyan-500/40 rounded-xl p-2 sm:p-2.5 shadow-[0_0_35px_rgba(6,182,212,0.15)] backdrop-blur-md min-w-[190px] sm:min-w-[220px] text-center font-mono">
                    
                    {/* Live Status Header */}
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <span className="relative flex h-1.5 w-1.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
                      </span>
                      <span className="text-[9px] font-black tracking-widest text-slate-300 uppercase">
                        ТЕЛЕМЕТРИЯ ГОНКИ
                      </span>
                    </div>

                    {/* Shift Label Header */}
                    <div className="text-[9px] font-bold text-cyan-400/90 uppercase tracking-wider mb-1">
                      {shiftInfo?.label ? `ЗАЕЗД ${shiftInfo.label}` : 'ЗАЕЗД 08:00–14:00'}
                    </div>

                    {/* Shift Countdown / Ended State */}
                    {isShiftEnded ? (
                      <div className="mb-1 pb-1 border-b border-amber-500/30">
                        <div className="text-xs sm:text-xs font-black text-amber-300 tracking-wider flex items-center justify-center gap-1">
                          <Trophy size={12} className="text-amber-400" />
                          ЗАЕЗД ЗАВЕРШЁН
                        </div>
                      </div>
                    ) : isCurrentActiveShift && remainingTimeText ? (
                      <div className="mb-1 pb-1 border-b border-white/10">
                        <div className="text-sm sm:text-base font-black text-emerald-400 tracking-wider">
                          {remainingTimeText}
                        </div>
                        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                          ДО КОНЦА СМЕНЫ
                        </div>
                      </div>
                    ) : (
                      <div className="mb-1 pb-1 border-b border-white/10">
                        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">
                          ДО КОНЦА СМЕНЫ
                        </div>
                      </div>
                    )}

                    {/* Leader Display */}
                    {leaderOp && (
                      <div className="text-left bg-amber-500/10 border border-amber-500/30 rounded-lg p-1.5">
                        <div className="text-[8px] font-extrabold text-amber-400 uppercase tracking-wider flex items-center justify-between">
                          <span className="flex items-center gap-1">
                            <Crown size={10} className="fill-amber-400 text-amber-400 shrink-0" />
                            {isShiftEnded ? 'ПОБЕДИТЕЛЬ' : 'ЛИДЕР'}
                          </span>
                          <span className="text-amber-300 font-black text-[10px]">
                            {leaderOp.messages_count}
                          </span>
                        </div>
                        
                        <div className="text-xs font-black text-slate-100 truncate">
                          {leaderOp.name}
                        </div>

                        {/* Leader Lap Status & Lap Bar */}
                        {(() => {
                          const leaderLap = getLapInfo(leaderOp.messages_count);
                          return (
                            <div className="mt-1 pt-1 border-t border-amber-500/20">
                              <div className="flex items-center justify-between text-[9px] font-bold text-amber-200">
                                <span>КРУГ {leaderLap.currentLap}</span>
                                <span className="text-amber-400">{leaderLap.messagesInCurrentLap}/100</span>
                              </div>
                              <div className="w-full h-1 bg-slate-900 rounded-full overflow-hidden mt-0.5 border border-amber-500/30">
                                <div 
                                  className="h-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-500" 
                                  style={{ width: `${leaderLap.lapProgress * 100}%` }} 
                                />
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    )}

                    {/* #2 & Gap */}
                    {!isShiftEnded && secondOp && (
                      <div className="mt-1 text-left bg-slate-900/90 border border-white/10 rounded-lg p-1.5 flex items-center justify-between gap-2 text-[10px]">
                        <div className="min-w-0 flex-1">
                          <span className="text-[8px] font-extrabold text-slate-400 block truncate">
                            #2 {secondOp.name}
                          </span>
                          <span className="font-black text-slate-200 text-[10px]">
                            {secondOp.messages_count}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[8px] text-slate-400 block font-bold">ОТСТАВАНИЕ #2</span>
                          <span className="text-cyan-400 font-black text-[11px]">
                            {gapValue}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Ended Shift Summary Banner */}
                    {isShiftEnded && leaderOp && (
                      <div className="mt-1 text-[9px] text-amber-300 font-bold">
                        {getLapInfo(leaderOp.messages_count).completedLaps} ЗАВЕРШЁННЫХ КРУГА
                      </div>
                    )}
                  </div>
                </div>

                {/* CAMERA TRANSFORM VIEWPORT WRAPPER */}
                <div 
                  className="absolute inset-0 w-full h-full pointer-events-none transition-transform duration-300 ease-out"
                  style={{
                    transform: `scale(${cameraTransform.scale}) translate(${cameraTransform.x}px, ${cameraTransform.y}px)`,
                    transformOrigin: '50% 50%'
                  }}
                >
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

                  {/* Turn Kerbs */}
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
                    opacity="0.4 flex"
                  />

                  {/* BADGE CONNECTOR POINTER LINES */}
                  {trackLayouts.map((layout) => {
                    if (!layout.hasPointer) return null;
                    const strokeColor = layout.isLapped
                      ? '#64748b'
                      : layout.rank === 1
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
                        strokeWidth={layout.isLapped ? '1' : '1.2'}
                        strokeDasharray={layout.isLapped ? '2 2' : '3 3'}
                        opacity={layout.isLapped ? '0.45' : '0.65'}
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
                    stroke={startLineFlash ? '#38bdf8' : '#06b6d4'}
                    strokeWidth={startLineFlash ? '3' : '1.5'}
                    className={`transition-all duration-300 ${
                      startLineFlash
                        ? 'drop-shadow-[0_0_20px_rgba(56,189,248,1)] animate-pulse'
                        : 'drop-shadow-[0_0_8px_rgba(6,182,212,0.8)]'
                    }`}
                  />

                  <text
                    x="340"
                    y="42"
                    fill={startLineFlash ? '#38bdf8' : '#22d3ee'}
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
                      rankDelta={overtakingOpIds.get(layout.op.user_id)}
                      deltaMessages={layout.deltaMessages}
                      isNewLap={newLapOpIds.has(layout.op.user_id)}
                      isLapped={layout.isLapped}
                      isCloseBattle={layout.isCloseBattle}
                      lapsBehind={layout.lapsBehind}
                      isSelected={selectedOperatorId === layout.op.user_id}
                      prefersReducedMotion={prefersReducedMotion}
                      onClick={() => setSelectedOperatorId(prev => prev === layout.op.user_id ? null : layout.op.user_id)}
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
                      isCompact={layout.isCompact}
                      isUltraCompact={layout.isUltraCompact}
                      isLapped={layout.isLapped}
                      lapsBehind={layout.lapsBehind}
                      isSelected={selectedOperatorId === layout.op.user_id}
                      onClick={() => setSelectedOperatorId(prev => prev === layout.op.user_id ? null : layout.op.user_id)}
                    />
                  ))}
                </div>
              </div>

                {/* LIVE RACE EVENTS FEED (BOTTOM LEFT CANVAS) */}
                {eventsFeed.length > 0 && (
                  <div className="absolute bottom-3 left-3 z-30 pointer-events-none flex flex-col gap-1.5 max-w-xs sm:max-w-sm">
                    {eventsFeed.map((evt) => (
                      <div
                        key={evt.id}
                        className="px-2.5 py-1 rounded-xl bg-slate-950/90 border border-cyan-500/40 text-[11px] font-mono font-bold text-cyan-200 shadow-lg backdrop-blur-md animate-fade-in flex items-center gap-1.5"
                      >
                        <span>{evt.text}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* NEAREST TARGET POPOVER CARD */}
                {selectedOp && selectedOpLap && (
                  <div className="absolute bottom-3 right-3 z-30 pointer-events-auto bg-slate-950/95 border border-cyan-400/60 rounded-2xl p-3 shadow-[0_0_30px_rgba(6,182,212,0.3)] backdrop-blur-md flex items-center gap-3.5 text-xs font-mono animate-fade-in">
                    <div className="flex items-center gap-2">
                      {selectedOp.avatar ? (
                        <img src={selectedOp.avatar} alt={selectedOp.name} className="w-8 h-8 rounded-full border border-cyan-400 object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-cyan-950 border border-cyan-400 flex items-center justify-center font-bold text-cyan-200">
                          {selectedOp.name.charAt(0)}
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-slate-100 flex items-center gap-1.5">
                          <span className="truncate max-w-[90px]">{selectedOp.name}</span>
                          <span className="text-cyan-400 font-black">#{selectedOpRank}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {selectedOp.messages_count} сообщ. · КРУГ {selectedOpLap.currentLap} ({selectedOpLap.messagesInCurrentLap}/100)
                        </div>
                      </div>
                    </div>

                    <div className="h-7 w-px bg-white/10" />

                    <div className="space-y-0.5 text-[10px]">
                      <div className="text-amber-300 font-bold flex items-center justify-between gap-2">
                        <span>До #{selectedOpRank > 1 ? selectedOpRank - 1 : 1}:</span>
                        <span className="text-white font-black">{selectedOpRank > 1 ? `${gapToNextRank} сообщ.` : 'Лидер заезда'}</span>
                      </div>
                      <div className="text-cyan-300 font-bold flex items-center justify-between gap-2">
                        <span>До следующего круга:</span>
                        <span className="text-white font-black">{100 - selectedOpLap.messagesInCurrentLap} сообщ.</span>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedOperatorId(null)}
                      className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white transition-colors ml-1"
                      title="Закрыть"
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* BOTTOM TRACK FOOTER LEGEND */}
            <div className="pt-2 border-t border-white/10 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 z-10">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span>#1 Золотой болид = Лидер заезда</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-cyan-400"></span>
                  <span>1 КРУГ = 100 Сообщений</span>
                </span>
              </div>
              <p className="text-slate-500">
                Живая трансляция каждые 15 сек • Кликните по машине, чтобы узнать цель
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
                  Скройте оператора, если он попал в статистику случайно. Место и круг определяются общим количеством сообщений.
                </span>
              </div>

              {/* OPERATORS CHECKLIST */}
              <div className="space-y-2 flex-1 overflow-y-auto pr-1">
                {operators.map((op, index) => {
                  const isHidden = hiddenOperatorIds.has(op.user_id);
                  const displayValue = getMetricDisplayValue(op);
                  const lapInfo = getLapInfo(op.messages_count);

                  // Calculate gap to operator ahead in full operator list
                  const sortedOps = [...operators].sort((a, b) => b.messages_count - a.messages_count);
                  const opRank = sortedOps.findIndex(o => o.user_id === op.user_id) + 1;
                  const opAhead = opRank > 1 ? sortedOps[opRank - 2] : null;
                  const gapToAhead = opAhead ? opAhead.messages_count - op.messages_count + 1 : 0;

                  return (
                    <div
                      key={op.user_id}
                      onClick={() => toggleOperatorHide(op.user_id)}
                      className={`p-1.5 sm:p-2 rounded-xl border transition-all cursor-pointer flex flex-col gap-1 ${
                        isHidden 
                          ? 'bg-slate-950/40 border-white/5 opacity-50 hover:opacity-75' 
                          : selectedOperatorId === op.user_id
                          ? 'bg-cyan-950/60 border-cyan-400 shadow-md ring-1 ring-cyan-400'
                          : 'bg-slate-900/90 border-cyan-500/20 hover:border-cyan-400/60 shadow-sm'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <div className={`w-3.5 h-3.5 rounded flex items-center justify-center shrink-0 border transition-all ${
                            !isHidden 
                              ? 'bg-cyan-500 border-cyan-400 text-black' 
                              : 'bg-slate-800 border-slate-600 text-transparent'
                          }`}>
                            <Check size={10} strokeWidth={3} />
                          </div>

                          {op.avatar ? (
                            <img src={op.avatar} alt={op.name} className="w-6 h-6 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[9px] font-bold text-slate-300 shrink-0">
                              {op.name.charAt(0)}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <p className={`text-[11px] font-bold truncate leading-tight ${isHidden ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                              #{opRank} {op.name}
                            </p>
                          </div>
                        </div>

                        <span className={`text-[11px] font-black shrink-0 ${isHidden ? 'text-slate-600' : 'text-cyan-400'}`}>
                          {displayValue}
                        </span>
                      </div>

                      {/* SUBTITLE: LAP INFO + COLOR-CODED GAP */}
                      {!isHidden && (
                        <div className="flex items-center justify-between text-[9.5px] font-mono pl-5 pt-0.5 border-t border-white/5 text-slate-400">
                          <span className="text-slate-300 font-semibold">
                            К{lapInfo.currentLap} · {lapInfo.messagesInCurrentLap}/100
                          </span>
                          {opRank > 1 && gapToAhead > 0 && (
                            <span className={`text-[9px] font-extrabold px-1 py-0.2 rounded ${
                              gapToAhead <= 10
                                ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-500/30'
                                : gapToAhead <= 30
                                ? 'text-amber-300 bg-amber-950/60 border border-amber-500/30'
                                : 'text-slate-400 bg-slate-800/60'
                            }`}>
                              ДО ОБГОНА #{opRank - 1}: +{gapToAhead}
                            </span>
                          )}
                        </div>
                      )}
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
