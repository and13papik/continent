import React, { useState, useEffect } from 'react';
import { LiveTrackModal } from './LiveTrackModal';
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
  fans_count?: number;
  earnings?: number;
  reply_time_avg?: number | null;
  creator_ids?: string[];
  gauges?: {
    messages?: { value: number; target: number; max: number };
    reply_time?: { value: number | null; goodThreshold: number; okThreshold: number; max: number };
    ppv_sent?: { value: number; target: number; max: number };
    ppv_sold?: { value: number; okThreshold: number; goodThreshold: number; max: number };
  };
}

interface MetricGaugeZone {
  from: number;
  to: number;
  color: string;
}

interface MetricGaugeProps {
  label: string;
  value: number | null;
  displayValue: string;
  min: number;
  max: number;
  zones: MetricGaugeZone[];
  inverted?: boolean;
  raceMode?: boolean;
  raceColor?: string;
}

const polarToCartesian = (cx: number, cy: number, r: number, angleInDegrees: number) => {
  const angleInRadians = (angleInDegrees * Math.PI) / 180.0;
  return {
    x: cx + r * Math.cos(angleInRadians),
    y: cy + r * Math.sin(angleInRadians)
  };
};

const describeArc = (cx: number, cy: number, r: number, startAngleDeg: number, endAngleDeg: number) => {
  if (endAngleDeg <= startAngleDeg) return '';
  const start = polarToCartesian(cx, cy, r, startAngleDeg);
  const end = polarToCartesian(cx, cy, r, endAngleDeg);
  const arcSweep = endAngleDeg - startAngleDeg;
  const largeArcFlag = arcSweep > 180 ? 1 : 0;
  return [
    "M", start.x.toFixed(2), start.y.toFixed(2),
    "A", r, r, 0, largeArcFlag, 1, end.x.toFixed(2), end.y.toFixed(2)
  ].join(" ");
};

const STATIC_PARTICLES = [
  { aOff: -10, rOff: 8, opacity: 0.6, size: 1.5 },
  { aOff: 15, rOff: -12, opacity: 0.4, size: 2.0 },
  { aOff: 35, rOff: 10, opacity: 0.7, size: 1.2 },
  { aOff: 50, rOff: -8, opacity: 0.5, size: 2.2 },
  { aOff: 75, rOff: 12, opacity: 0.8, size: 1.0 },
  { aOff: 95, rOff: -10, opacity: 0.3, size: 1.8 },
  { aOff: 120, rOff: 9, opacity: 0.6, size: 2.5 },
  { aOff: 140, rOff: -11, opacity: 0.5, size: 1.2 },
  { aOff: 165, rOff: 11, opacity: 0.7, size: 1.6 },
  { aOff: 185, rOff: -9, opacity: 0.4, size: 2.0 },
  { aOff: 205, rOff: 10, opacity: 0.8, size: 1.4 },
  { aOff: 225, rOff: -12, opacity: 0.5, size: 1.8 },
  { aOff: 245, rOff: 8, opacity: 0.6, size: 2.2 },
  { aOff: 260, rOff: -8, opacity: 0.7, size: 1.2 },
  { aOff: 275, rOff: 12, opacity: 0.4, size: 1.5 },
  { aOff: 5, rOff: -15, opacity: 0.5, size: 1.0 },
  { aOff: 110, rOff: 14, opacity: 0.6, size: 1.8 },
  { aOff: 190, rOff: 13, opacity: 0.7, size: 1.3 },
  { aOff: 250, rOff: -14, opacity: 0.5, size: 2.0 },
];

const MetricGauge: React.FC<MetricGaugeProps> = ({
  label,
  value,
  displayValue,
  min,
  max,
  zones,
  raceMode = false,
  raceColor = '#00f0ff'
}) => {
  const safeMin = min;
  const safeMax = max > min ? max : min + 1;

  const isNull = value === null || value === undefined;
  const clampedVal = isNull ? null : Math.min(Math.max(value, safeMin), safeMax);

  const getColorHex = (c: string) => {
    if (c === 'red' || c === 'rose') return '#ff2a5f';
    if (c === 'orange' || c === 'amber' || c === 'yellow') return '#ffb703';
    if (c === 'green' || c === 'emerald') return '#00e676';
    if (c === 'cyan' || c === 'cyan-super' || c === 'blue') return '#00f0ff';
    return c;
  };

  // Find active zone and color based on current value
  let activeColor = raceColor || '#00f0ff';
  let isCyanSuper = false;

  if (clampedVal !== null && zones && zones.length > 0) {
    const matchingZone = zones.find(z => {
      const f = Math.min(Math.max(z.from, safeMin), safeMax);
      const t = Math.min(Math.max(z.to, safeMin), safeMax);
      return clampedVal >= f && clampedVal <= t;
    }) || zones[zones.length - 1];

    if (matchingZone) {
      activeColor = getColorHex(matchingZone.color);
      if (matchingZone.color === 'cyan' || matchingZone.color === 'cyan-super' || activeColor === '#00f0ff') {
        isCyanSuper = true;
      }
    }
  }

  const getModeInfo = (color: string) => {
    if (color === '#ff2a5f') return { label: 'КРИТИЧЕСНО', tag: '🔴', bg: 'bg-rose-950/90', border: 'border-rose-500/60', text: 'text-rose-400' };
    if (color === '#ffb703') return { label: 'СРЕДНЕ', tag: '🟡', bg: 'bg-amber-950/90', border: 'border-amber-500/60', text: 'text-amber-400' };
    if (color === '#00e676') return { label: 'ОПТИМАЛЬНО', tag: '🟢', bg: 'bg-emerald-950/90', border: 'border-emerald-500/60', text: 'text-emerald-400' };
    return { label: 'ТУРБО', tag: '⚡', bg: 'bg-cyan-950/90', border: 'border-cyan-400', text: 'text-cyan-300' };
  };

  const modeInfo = getModeInfo(activeColor);

  // RACE MODE HIGH-TECH 270 DEGREE SPEEDOMETER
  if (raceMode) {
    const cx = 100;
    const cy = 88;
    const R = 62;

    // Needle position calculation
    let needleAngle = 135;
    if (clampedVal !== null) {
      const r = (clampedVal - safeMin) / (safeMax - safeMin);
      needleAngle = 135 + r * 270;
    }
    const needleEnd = polarToCartesian(cx, cy, R - 4, needleAngle);

    // Render 4-zone arcs along the 270° sweep (135° to 405°)
    const rendered270Zones = zones.map((z, idx) => {
      const f = Math.min(Math.max(z.from, safeMin), safeMax);
      const t = Math.min(Math.max(z.to, safeMin), safeMax);
      if (t <= f) return null;

      const r1 = (f - safeMin) / (safeMax - safeMin);
      const r2 = (t - safeMin) / (safeMax - safeMin);

      const a1 = 135 + r1 * 270;
      const a2 = 135 + r2 * 270;

      const d = describeArc(cx, cy, R, a1, a2);
      if (!d) return null;

      const zColor = getColorHex(z.color);
      const isThisActive = !isNull && clampedVal !== null && clampedVal >= f && clampedVal <= t;

      return (
        <path
          key={idx}
          d={d}
          fill="none"
          stroke={zColor}
          strokeWidth="6"
          strokeOpacity={isNull ? 0.2 : 0.35}
          strokeLinecap="butt"
        />
      );
    });

    // Active Filled Arc running from 135° to needleAngle
    const activeArcPath = describeArc(cx, cy, R, 135, Math.max(135.5, needleAngle));
    const activeOuterGlowPath = describeArc(cx, cy, R + 6, 135, Math.max(135.5, needleAngle));

    // Main Ticks & Labels (6 ticks)
    const mainTicksCount = 6;
    const mainTicks = [];
    for (let i = 0; i < mainTicksCount; i++) {
      const ratio = i / (mainTicksCount - 1);
      const tickVal = safeMin + ratio * (safeMax - safeMin);
      const angleDeg = 135 + ratio * 270;

      const pInner = polarToCartesian(cx, cy, R - 6, angleDeg);
      const pOuter = polarToCartesian(cx, cy, R + 2, angleDeg);
      const pText = polarToCartesian(cx, cy, R - 16, angleDeg);

      const isTickLit = angleDeg <= needleAngle && !isNull;

      let formattedVal = '';
      if (safeMax >= 1000) {
        formattedVal = (tickVal / 1000).toFixed(1) + 'k';
      } else {
        formattedVal = String(Math.round(tickVal));
      }

      mainTicks.push(
        <g key={`m-tick-${i}`}>
          <line
            x1={pInner.x.toFixed(2)}
            y1={pInner.y.toFixed(2)}
            x2={pOuter.x.toFixed(2)}
            y2={pOuter.y.toFixed(2)}
            stroke={isTickLit ? activeColor : "rgba(255, 255, 255, 0.4)"}
            strokeWidth={isTickLit ? "2" : "1.2"}
            style={isTickLit ? { filter: `drop-shadow(0 0 4px ${activeColor})` } : undefined}
          />
          <text
            x={pText.x.toFixed(2)}
            y={pText.y.toFixed(2)}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize="7"
            fill={isTickLit ? "#ffffff" : "rgba(255, 255, 255, 0.5)"}
            fontWeight={isTickLit ? "bold" : "normal"}
            fontFamily="monospace"
          >
            {formattedVal}
          </text>
        </g>
      );
    }

    // Sub-ticks (16 divisions -> 3 sub-divisions between main ticks)
    const subTicksCount = 16;
    const subTicks = [];
    for (let j = 0; j < subTicksCount; j++) {
      if (j % 3 !== 0) {
        const ratio = j / (subTicksCount - 1);
        const angleDeg = 135 + ratio * 270;
        const pInner = polarToCartesian(cx, cy, R - 4, angleDeg);
        const pOuter = polarToCartesian(cx, cy, R, angleDeg);
        const isLit = angleDeg <= needleAngle && !isNull;
        subTicks.push(
          <line
            key={`s-tick-${j}`}
            x1={pInner.x.toFixed(2)}
            y1={pInner.y.toFixed(2)}
            x2={pOuter.x.toFixed(2)}
            y2={pOuter.y.toFixed(2)}
            stroke={isLit ? activeColor : "rgba(255, 255, 255, 0.2)"}
            strokeWidth={isLit ? "1.2" : "0.8"}
            opacity={isLit ? 0.9 : 0.4}
          />
        );
      }
    }

    // Particles / Sparks around the gauge
    const particles = STATIC_PARTICLES.map((pt, idx) => {
      const angle = 135 + pt.aOff;
      const r = R + pt.rOff;
      const p = polarToCartesian(cx, cy, r, angle);
      const isParticleActive = angle <= needleAngle + 20;
      const partColor = isParticleActive ? activeColor : 'rgba(255, 255, 255, 0.3)';
      return (
        <circle
          key={`part-${idx}`}
          cx={p.x.toFixed(2)}
          cy={p.y.toFixed(2)}
          r={isParticleActive ? pt.size * 1.2 : pt.size * 0.8}
          fill={partColor}
          opacity={isParticleActive ? pt.opacity : pt.opacity * 0.3}
          style={isParticleActive ? { filter: `drop-shadow(0 0 4px ${activeColor})` } : undefined}
        />
      );
    });

    return (
      <div
        className="relative p-2.5 rounded-2xl border flex flex-col items-center justify-between text-center font-mono transition-all duration-500 bg-slate-950/90 overflow-hidden"
        style={{
          borderColor: isCyanSuper ? '#00f0ff' : `${activeColor}60`,
          boxShadow: isCyanSuper
            ? '0 0 22px rgba(0,240,255,0.35), inset 0 0 15px rgba(0,240,255,0.1)'
            : `0 0 16px ${activeColor}25, inset 0 0 10px ${activeColor}08`
        }}
      >
        {/* Background Ambient Glow Halo */}
        <div
          className="absolute -top-10 -bottom-10 -left-10 -right-10 pointer-events-none opacity-20 blur-2xl transition-all duration-700"
          style={{ background: `radial-gradient(circle, ${activeColor} 0%, transparent 70%)` }}
        />

        {/* Header: Label ONLY - FULL CLEAR UNTRUNCATED TEXT */}
        <div className="relative z-10 w-full text-center px-1 mb-1 min-h-[26px] flex items-center justify-center">
          <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-slate-100 block leading-tight text-center break-words">
            {label}
          </span>
        </div>

        {/* 270 Degree Gauge SVG Container */}
        <div className="relative z-10 w-full max-w-[150px] aspect-[200/165] flex items-center justify-center my-0.5 overflow-visible">
          <svg viewBox="0 0 200 170" className="w-full h-full overflow-visible">
            <defs>
              <radialGradient id={`dialGrad-${label.replace(/\s+/g, '-')}`} cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#1e293b" />
                <stop offset="60%" stopColor="#0f172a" />
                <stop offset="100%" stopColor="#020617" />
              </radialGradient>
              <radialGradient id={`chromeHub-${label.replace(/\s+/g, '-')}`} cx="35%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="40%" stopColor="#cbd5e1" />
                <stop offset="80%" stopColor="#334155" />
                <stop offset="100%" stopColor="#020617" />
              </radialGradient>
            </defs>

            {/* Dark Dial Circle Background with Chrome Bevel */}
            <circle
              cx={cx}
              cy={cy}
              r={R + 8}
              fill={`url(#dialGrad-${label.replace(/\s+/g, '-')})`}
              stroke="rgba(255, 255, 255, 0.12)"
              strokeWidth="1.5"
            />

            {/* Inner Ring Accent */}
            <circle
              cx={cx}
              cy={cy}
              r={R - 12}
              fill="none"
              stroke="rgba(255, 255, 255, 0.05)"
              strokeWidth="1"
            />

            {/* Background Track Arc 270° */}
            <path
              d={describeArc(cx, cy, R, 135, 405)}
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth="8"
            />

            {/* 4-Zone Background Arcs */}
            {rendered270Zones}

            {/* ACTIVE Dynamic Filled Arc */}
            {clampedVal !== null && activeArcPath && (
              <>
                {/* Outer Glow Line */}
                {activeOuterGlowPath && (
                  <path
                    d={activeOuterGlowPath}
                    fill="none"
                    stroke={activeColor}
                    strokeWidth="2"
                    strokeOpacity="0.8"
                    strokeLinecap="round"
                    style={{ filter: `drop-shadow(0 0 6px ${activeColor})` }}
                  />
                )}

                {/* Main Dynamic Active Arc */}
                <path
                  d={activeArcPath}
                  fill="none"
                  stroke={activeColor}
                  strokeWidth="8"
                  strokeLinecap="round"
                  style={{
                    filter: `drop-shadow(0 0 ${isCyanSuper ? '12px' : '8px'} ${activeColor})`
                  }}
                />
              </>
            )}

            {/* Sub-ticks and Main Ticks */}
            {subTicks}
            {mainTicks}

            {/* Sparks & Particles */}
            {particles}

            {/* Needle with Laser Glow */}
            {clampedVal !== null && (
              <g>
                {/* Blur Backlight Glow Line */}
                <line
                  x1={cx}
                  y1={cy}
                  x2={needleEnd.x.toFixed(2)}
                  y2={needleEnd.y.toFixed(2)}
                  stroke={activeColor}
                  strokeWidth="5"
                  strokeLinecap="round"
                  opacity="0.75"
                  style={{ filter: `drop-shadow(0 0 8px ${activeColor})` }}
                />

                {/* Sharp White Needle Core */}
                <line
                  x1={cx}
                  y1={cy}
                  x2={needleEnd.x.toFixed(2)}
                  y2={needleEnd.y.toFixed(2)}
                  stroke="#ffffff"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                />

                {/* Laser Tip Marker */}
                <circle
                  cx={needleEnd.x.toFixed(2)}
                  cy={needleEnd.y.toFixed(2)}
                  r="2.5"
                  fill="#ffffff"
                  style={{ filter: `drop-shadow(0 0 6px ${activeColor})` }}
                />

                {/* Metallic Hub */}
                <circle
                  cx={cx}
                  cy={cy}
                  r="7"
                  fill={`url(#chromeHub-${label.replace(/\s+/g, '-')})`}
                  stroke={activeColor}
                  strokeWidth="1.8"
                  style={{ filter: `drop-shadow(0 0 6px ${activeColor})` }}
                />
              </g>
            )}
          </svg>

          {/* Value Capsule Pill Overlay */}
          <div
            className="absolute -bottom-1 px-3 py-0.5 rounded-full bg-slate-950/95 border-2 backdrop-blur-md transition-all duration-300 font-mono text-[11px] sm:text-[12px] font-black tracking-wider whitespace-nowrap flex items-center gap-1 shadow-lg"
            style={{
              borderColor: activeColor,
              color: activeColor,
              boxShadow: `0 0 ${isCyanSuper ? '16px' : '8px'} ${activeColor}80`,
              textShadow: `0 0 8px ${activeColor}`
            }}
          >
            {isCyanSuper && <span className="animate-pulse">⚡</span>}
            <span>{displayValue}</span>
          </div>
        </div>

        {/* Status Tag UNDER Speedometer */}
        <div className="relative z-10 mt-3 mb-0.5 flex items-center justify-center w-full">
          <span
            className={`text-[8px] sm:text-[9px] font-black px-2.5 py-0.5 rounded-full border tracking-widest uppercase flex items-center gap-1 shadow-md ${modeInfo.bg} ${modeInfo.border} ${modeInfo.text}`}
            style={{ textShadow: `0 0 6px ${activeColor}` }}
          >
            <span>{modeInfo.tag}</span>
            <span>{modeInfo.label}</span>
          </span>
        </div>
      </div>
    );
  }

  // STANDARD 180 DEGREE SEMI-CIRCLE GAUGE
  const cx = 60;
  const cy = 50;
  const R = 40;

  const renderedZones = zones.map((z, idx) => {
    const f = Math.min(Math.max(z.from, safeMin), safeMax);
    const t = Math.min(Math.max(z.to, safeMin), safeMax);
    if (t <= f) return null;

    const r1 = (f - safeMin) / (safeMax - safeMin);
    const r2 = (t - safeMin) / (safeMax - safeMin);

    const a1 = (180 - r1 * 180) * (Math.PI / 180);
    const a2 = (180 - r2 * 180) * (Math.PI / 180);

    const x1 = cx + R * Math.cos(a1);
    const y1 = cy - R * Math.sin(a1);
    const x2 = cx + R * Math.cos(a2);
    const y2 = cy - R * Math.sin(a2);

    const d = `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${R} ${R} 0 0 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;

    return (
      <path
        key={idx}
        d={d}
        fill="none"
        stroke={getColorHex(z.color)}
        strokeWidth="7"
        strokeOpacity={isNull ? 0.25 : 0.85}
        strokeLinecap="butt"
      />
    );
  });

  let needleX = cx;
  let needleY = cy - 32;
  if (clampedVal !== null) {
    const r = (clampedVal - safeMin) / (safeMax - safeMin);
    const a = (180 - r * 180) * (Math.PI / 180);
    needleX = cx + 32 * Math.cos(a);
    needleY = cy - 32 * Math.sin(a);
  }

  return (
    <div className="p-2 bg-slate-800/60 rounded-2xl border border-white/10 shadow-inner flex flex-col items-center justify-between text-center font-mono">
      <span className="text-[8px] uppercase font-bold block tracking-wider truncate w-full text-slate-400">
        {label}
      </span>

      <div className="relative w-full max-w-[110px] aspect-[120/58] flex items-center justify-center my-1 overflow-visible">
        <svg viewBox="0 0 120 58" className="w-full h-full overflow-visible">
          <path
            d={`M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`}
            fill="none"
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="7"
          />
          {renderedZones}
          {clampedVal !== null && (
            <>
              <line
                x1={cx}
                y1={cy}
                x2={needleX.toFixed(2)}
                y2={needleY.toFixed(2)}
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              <circle cx={cx} cy={cy} r="3.5" fill="#f8fafc" stroke="#0f172a" strokeWidth="2" />
            </>
          )}
        </svg>
      </div>

      <span className="text-[11px] sm:text-[12px] font-black block tracking-tight truncate w-full text-slate-100 font-mono">
        {displayValue}
      </span>
    </div>
  );
};

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

  // Race Mode toggle state
  const [raceMode, setRaceMode] = useState(false);

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
  const [isTrackModalOpen, setIsTrackModalOpen] = useState(false);

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
        <div
          className={`glass-card p-6 rounded-3xl transition-all duration-500 space-y-5 ${
            raceMode
              ? 'border border-cyan-500/30 bg-gradient-to-b from-slate-950 via-blue-950/40 to-slate-950 shadow-[0_0_30px_rgba(15,23,42,0.8),inset_0_0_60px_rgba(56,189,248,0.06)]'
              : 'border border-white/15 bg-slate-900/60'
          }`}
        >
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

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setRaceMode(!raceMode)}
                className={`px-3.5 py-2 text-xs font-mono font-bold uppercase rounded-xl transition-all duration-300 flex items-center gap-2 shadow-md ${
                  raceMode
                    ? 'bg-gradient-to-r from-blue-900 via-cyan-900 to-blue-900 text-cyan-300 border-2 border-cyan-400 shadow-[0_0_15px_rgba(56,189,248,0.5)] animate-pulse'
                    : 'bg-slate-900 border border-white/15 hover:border-violet-500/40 hover:bg-slate-800 text-slate-200'
                }`}
                title="Переключить визуальный режим гоночной приборной панели"
              >
                <span className="text-sm">🏁</span>
                <span>ГОНКА</span>
              </button>

              <button
                onClick={() => setIsTrackModalOpen(true)}
                className="px-3.5 py-2 text-xs font-mono font-bold uppercase rounded-xl transition-all duration-300 flex items-center gap-2 shadow-md bg-gradient-to-r from-cyan-900 via-blue-900 to-cyan-900 text-cyan-300 border border-cyan-400/60 hover:border-cyan-300 hover:shadow-[0_0_15px_rgba(6,182,212,0.4)]"
                title="Открыть интерактивный живой трек гонки операторов"
              >
                <span className="text-sm">🏁</span>
                <span>ТРЭК</span>
              </button>

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

                      {/* Diagnostic comparison line for Today / Yesterday */}
                      {(shiftCompMode === 'today' || shiftCompMode === 'yesterday') && !s.isFuture && s.accountEarnings !== undefined && s.accountEarnings !== null && (
                        <div className="mt-2 pt-2 border-t border-white/10 text-[9px] text-slate-500 leading-tight space-y-0.5">
                          <div>Доход по аккаунтам: <span className="text-slate-300 font-bold">${s.accountEarnings}</span></div>
                          <div>Доход по операторам: <span className="text-slate-300 font-bold">${s.totalEarnings ?? 0}</span></div>
                          <div>
                            Разница: <span className={s.diff > 0 ? 'text-amber-400 font-black' : s.diff < 0 ? 'text-rose-400 font-black' : 'text-slate-400 font-bold'}>${s.diff > 0 ? `+${s.diff}` : s.diff}</span>
                          </div>
                        </div>
                      )}
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
                      className={`p-4 rounded-2xl transition-all duration-500 flex flex-col justify-between space-y-4 font-mono group ${
                        raceMode
                          ? 'bg-blue-950/30 border border-cyan-400/40 shadow-[0_0_20px_rgba(56,189,248,0.15)] hover:border-cyan-300 hover:shadow-[0_0_25px_rgba(56,189,248,0.3)]'
                          : rank === 1
                          ? 'bg-slate-900/90 border border-amber-500/50 shadow-lg shadow-amber-500/10 hover:border-amber-400/70 hover:bg-slate-900'
                          : rank === 2
                          ? 'bg-slate-900/85 border border-slate-300/40 shadow-md shadow-slate-400/5 hover:border-slate-300/60 hover:bg-slate-900'
                          : rank === 3
                          ? 'bg-slate-900/85 border border-orange-600/40 shadow-md shadow-orange-700/5 hover:border-orange-500/60 hover:bg-slate-900'
                          : 'bg-slate-900/80 border border-white/15 hover:border-violet-500/40 hover:bg-slate-800/90'
                      }`}
                    >
                      {/* TOP SECTION: RANK, MODEL AVATARS STACK, NAME, ID, EARNINGS BADGE */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div className={`w-8 h-8 rounded-xl font-black text-xs flex items-center justify-center shrink-0 shadow-md transition-all duration-500 ${
                            raceMode
                              ? 'bg-cyan-950/80 text-cyan-300 border border-cyan-400/50 shadow-[0_0_10px_rgba(56,189,248,0.3)]'
                              : rank === 1 ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' :
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
                                    className={`relative w-10 h-10 rounded-full bg-gradient-to-br from-violet-700 to-indigo-900 border-2 flex items-center justify-center text-white font-black text-xs shadow-md shrink-0 overflow-hidden cursor-pointer hover:scale-105 transition-all ${
                                      raceMode ? 'border-cyan-400/80 shadow-[0_0_8px_rgba(56,189,248,0.4)]' : 'border-slate-900 hover:border-violet-400'
                                    }`}
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

                        {/* ACCENT EARNINGS BADGE */}
                        <div className="shrink-0">
                          <div className={`px-2.5 py-1 rounded-xl font-black text-xs sm:text-sm tracking-tight shadow-sm whitespace-nowrap transition-all duration-500 ${
                            raceMode
                              ? 'bg-blue-950/80 border border-cyan-400/50 text-cyan-300 shadow-[0_0_10px_rgba(56,189,248,0.2)]'
                              : 'bg-emerald-950/20 border border-emerald-500/30 text-emerald-400'
                          }`}>
                            {op.earnings && op.earnings > 0 ? `+$${op.earnings}` : `$${op.earnings ?? 0}`}
                          </div>
                        </div>
                      </div>

                      {/* BOTTOM SECTION: METRICS (FLAT CELLS WHEN NORMAL, GAUGES WHEN RACE MODE) */}
                      <div className="space-y-2 pt-3 border-t border-white/15 transition-all duration-500">
                        {raceMode ? (
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                            {/* 1. MESSAGES (Hourly Rate) */}
                            {(() => {
                              let shiftHours = 6;
                              if (shiftInfo?.start && shiftInfo?.end) {
                                const startMs = new Date(shiftInfo.start).getTime();
                                const endMs = new Date(shiftInfo.end).getTime();
                                const nowMs = Date.now();
                                if (!isNaN(startMs) && !isNaN(endMs) && endMs > startMs) {
                                  if (nowMs >= startMs && nowMs < endMs) {
                                    shiftHours = Math.max(0.5, (nowMs - startMs) / 3600000);
                                  } else {
                                    shiftHours = Math.max(1, (endMs - startMs) / 3600000);
                                  }
                                }
                              }
                              const msgPerHour = op.messages_count / shiftHours;
                              // Thresholds per hour:
                              // < 50: КРИТИЧЕСКИ (red)
                              // 50-64: СРЕДНЕ (orange)
                              // 65-79: ОПТИМАЛЬНО (green)
                              // 80+: УЛЬТРА (cyan)
                              const max = Math.max(120, Math.ceil(msgPerHour * 1.2));
                              const zones = [
                                { from: 0, to: 50, color: 'red' },
                                { from: 50, to: 65, color: 'orange' },
                                { from: 65, to: 80, color: 'green' },
                                { from: 80, to: max, color: 'cyan' }
                              ];
                              return (
                                <MetricGauge
                                  label="СООБЩЕНИЯ"
                                  value={msgPerHour}
                                  displayValue={String(op.messages_count)}
                                  min={0}
                                  max={max}
                                  zones={zones}
                                  raceMode={raceMode}
                                />
                              );
                            })()}

                            {/* 2. REPLY TIME */}
                            {(() => {
                              const val = op.reply_time_avg ?? null;
                              // Thresholds (seconds):
                              // < 1:50 (110s): УЛЬТРА (cyan)
                              // 1:50-2:40 (110s-160s): ОПТИМАЛЬНО (green)
                              // 2:40-5:00 (160s-300s): СРЕДНЕ (orange)
                              // 5:00+ (300s+): КРИТИЧЕСКИ (red)
                              const max = Math.max(600, val ? Math.ceil(val * 1.1) : 600);
                              const zones = [
                                { from: 0, to: 110, color: 'cyan' },
                                { from: 110, to: 160, color: 'green' },
                                { from: 160, to: 300, color: 'orange' },
                                { from: 300, to: max, color: 'red' }
                              ];
                              return (
                                <MetricGauge
                                  label="СР. ВРЕМЯ ОТВЕТА"
                                  value={val}
                                  displayValue={formatDuration(op.reply_time_avg)}
                                  min={0}
                                  max={max}
                                  zones={zones}
                                  inverted={true}
                                  raceMode={raceMode}
                                />
                              );
                            })()}

                            {/* 3. PPV SENT */}
                            {(() => {
                              const g = op.gauges?.ppv_sent;
                              const val = g?.value ?? op.paid_messages_count;
                              const target = g?.target || 20;
                              const max = g?.max || Math.max(target * 2, 10);
                              const zones = [
                                { from: 0, to: Math.round(target * 0.5), color: 'red' },
                                { from: Math.round(target * 0.5), to: Math.round(target * 0.85), color: 'orange' },
                                { from: Math.round(target * 0.85), to: Math.round(target * 1.3), color: 'green' },
                                { from: Math.round(target * 1.3), to: max, color: 'cyan' }
                              ];
                              return (
                                <MetricGauge
                                  label="PPV ОТПРАВЛЕНО"
                                  value={val}
                                  displayValue={String(op.paid_messages_count)}
                                  min={0}
                                  max={max}
                                  zones={zones}
                                  raceMode={raceMode}
                                />
                              );
                            })()}

                            {/* 4. PPV SOLD / CONVERSION */}
                            {(() => {
                              const conversionPct = op.paid_messages_count > 0
                                ? (op.sold_messages_count / op.paid_messages_count) * 100
                                : 0;
                              const displayConversionPct = Math.round(conversionPct);
                              // Thresholds (%):
                              // < 12%: КРИТИЧЕСКИ (red)
                              // 12-20%: СРЕДНЕ (orange)
                              // 20-34%: ОПТИМАЛЬНО (green)
                              // 35-50%+: УЛЬТРА (cyan)
                              const max = 100;
                              const zones = [
                                { from: 0, to: 12, color: 'red' },
                                { from: 12, to: 20, color: 'orange' },
                                { from: 20, to: 35, color: 'green' },
                                { from: 35, to: max, color: 'cyan' }
                              ];
                              return (
                                <MetricGauge
                                  label="PPV ПРОДАНО"
                                  value={conversionPct}
                                  displayValue={`${op.sold_messages_count} (${displayConversionPct}%)`}
                                  min={0}
                                  max={max}
                                  zones={zones}
                                  raceMode={raceMode}
                                />
                              );
                            })()}
                          </div>
                        ) : (
                          <>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
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
                          </>
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

      {/* LIVE TRACK MODAL */}
      <LiveTrackModal
        isOpen={isTrackModalOpen}
        onClose={() => setIsTrackModalOpen(false)}
        initialOperators={operators}
        initialShiftInfo={shiftInfo}
        periodMode={periodMode}
        selectedShiftIndex={selectedShiftIndex}
        sortBy={sortBy}
        sortDir={sortDir}
        accounts={accounts}
        currentKyivShiftIndex={currentKyivShiftIndex}
      />
    </div>
  );
};

