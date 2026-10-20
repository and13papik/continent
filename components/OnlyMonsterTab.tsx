import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { OnlyMonsterOperators, omMoney } from './OnlyMonsterOperators';
import { ShiftAnalysisPanel } from './ShiftAnalysisPanel';
import { LiveTrackModal } from './LiveTrackModal';
import { OperatorDeepStatsModal } from './OperatorDeepStatsModal';
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
  Receipt,
  X,
  AlertTriangle,
  ChevronRight,
  ChevronDown,
  Activity,
  UserPlus,
  Send,
  CheckCheck,
  CheckCircle2,
  Image,
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ArrowUpRight,
  Zap,
  Info
} from 'lucide-react';

/**
 * Standard OnlyFans platform fee percentage (20% fee, creator receives 80% net).
 * Creators receive gross * (1 - PLATFORM_FEE_PERCENT / 100) = gross * 0.8
 */
export const PLATFORM_FEE_PERCENT = 20;
export const PLATFORM_NET_MULTIPLIER = (100 - PLATFORM_FEE_PERCENT) / 100; // 0.8
export const NET_ESTIMATE_TOOLTIP = "Расчётное значение (Gross минус 20% комиссии платформы). Точное NET-значение после фактических удержаний доступно только в самой панели OnlyMonster.";

export interface OnlyMonsterTabProps {
  agencyModels: string[];
  shiftAnalysisEnabled?: boolean;
  userRole?: 'user' | 'owner' | null;
  activeView?: 'live' | 'operators' | 'models';
  onNavigateView?: (view: 'live' | 'operators' | 'models') => void;
  hideHeaderAndTabs?: boolean;
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
  tx_count?: number | null;
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

export {
  getClientKyivShiftIndexForDate,
  type KyivShiftRange,
  getKyivShiftRange,
  getKyivOpDateStr,
  isEventInCurrentKyivShift,
  createFeedProcessorState,
  resetFeedStateForShift,
  processEventBatch,
  runPollDrainLoop,
  type LiveShiftEventRecord,
  type FeedProcessorState,
  type ProcessBatchResult,
  type EventRecord,
  FINANCIAL_EVENT_TYPES
} from './feedProcessor';

import {
  getClientKyivShiftIndexForDate,
  type KyivShiftRange,
  getKyivShiftRange,
  isEventInCurrentKyivShift,
  createFeedProcessorState,
  resetFeedStateForShift,
  runPollDrainLoop,
  type LiveShiftEventRecord,
  type ProcessBatchResult
} from './feedProcessor';


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
        className="relative p-2.5 rounded-2xl border flex flex-col items-center justify-between text-center font-mono transition-all duration-500 bg-slate-900/90 overflow-hidden"
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
            className="absolute -bottom-1 px-3 py-0.5 rounded-full bg-slate-800/95 border-2 backdrop-blur-md transition-all duration-300 font-mono text-[11px] sm:text-[12px] font-black tracking-wider whitespace-nowrap flex items-center gap-1 shadow-lg"
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

export const ACCOUNT_OPERATOR_INACTIVITY_MINUTES = 20;
export const ACCOUNT_OPERATOR_GRACE_PERIOD_MINUTES = 20;
export const IDLE_THRESHOLD_MINUTES = 20;
export const IDLE_NO_ACTIVITY_MINUTES = 20;
export const SLOW_REPLY_WAITING_MINUTES = 10;
export const OVERLOAD_UNANSWERED_THRESHOLD = 10;
export const BIG_SALE_THRESHOLD = 49.99;
export const PURCHASE_BURST_COUNT = 3;
export const PURCHASE_BURST_WINDOW_MINUTES = 10;
export const VIOLATION_BURST_COUNT = 3;
export const VIOLATION_BURST_WINDOW_MINUTES = 15;
export const VIOLATION_REPEAT_WINDOW_MINUTES = 60; // для "блокировки повторяются на одном аккаунте"

// временно скрытые аккаунты, не показываем в UI
export const HIDDEN_ACCOUNT_NAMES = ['Catherine'];
export const HIDDEN_OPERATOR_NAMES: string[] = [];

export function normalizeAccountName(name?: string): string {
  if (!name) return '';
  return name.toLowerCase().replace(/[^\wа-яё]/gi, '').trim();
}

export function isAccountHidden(name?: string): boolean {
  if (!name) return false;
  const normalized = normalizeAccountName(name);
  return HIDDEN_ACCOUNT_NAMES.some(hiddenName => {
    const normHidden = normalizeAccountName(hiddenName);
    return normalized === normHidden || normalized.includes(normHidden);
  });
}

export function isOperatorHidden(name?: string): boolean {
  if (!name) return false;
  const normalized = normalizeAccountName(name);
  return HIDDEN_OPERATOR_NAMES.some(hiddenName => {
    const normHidden = normalizeAccountName(hiddenName);
    return normalized === normHidden || normalized.includes(normHidden);
  });
}

export interface EventFeedItem {
  id: number | string;
  event_type: string;
  account_id?: string;
  platform_account_id?: string;
  payload?: any;
  received_at?: string;
  event_timestamp?: string;
}

export interface EventWindowFilter {
  entityIdField?: 'account_id' | 'user_id' | 'platform_account_id';
  entityId?: string | number;
  eventType?: string;
  eventTypes?: string[];
  windowMinutes: number;
  now?: number;
}

/**
 * Переиспользуемый хелпер: подсчитывает число событий в скользящем окне N минут от now
 */
export function countEventsInWindow(
  events: EventFeedItem[],
  filter: EventWindowFilter
): number {
  const now = filter.now || Date.now();
  const windowMs = filter.windowMinutes * 60 * 1000;
  const cutoff = now - windowMs;

  return events.filter(e => {
    const rawPayload = e.payload || {};
    const p = rawPayload.payload || rawPayload;
    const tsStr = e.event_timestamp || e.received_at;
    const ts = tsStr ? new Date(tsStr).getTime() : 0;
    if (ts < cutoff || ts > now + 60000) return false;

    // Check eventType
    if (filter.eventType) {
      if (filter.eventType.endsWith('*')) {
        const prefix = filter.eventType.slice(0, -1);
        if (!e.event_type || !e.event_type.startsWith(prefix)) return false;
      } else if (e.event_type !== filter.eventType) {
        return false;
      }
    }

    // Check eventTypes
    if (filter.eventTypes && filter.eventTypes.length > 0) {
      const match = filter.eventTypes.some(type => {
        if (type.endsWith('*')) return e.event_type && e.event_type.startsWith(type.slice(0, -1));
        return e.event_type === type;
      });
      if (!match) return false;
    }

    // Check entityId
    if (filter.entityId !== undefined && filter.entityId !== null && filter.entityId !== '') {
      const target = String(filter.entityId);
      const accId1 = e.account_id ? String(e.account_id) : '';
      const accId2 = e.platform_account_id ? String(e.platform_account_id) : '';
      const pAccId1 = p.account_id ? String(p.account_id) : '';
      const pAccId2 = p.platform_account_id ? String(p.platform_account_id) : '';
      const pCreatorId = p.creator_id ? String(p.creator_id) : '';
      const pUserId = p.user_id ? String(p.user_id) : '';
      const pOperatorId = p.operator_id ? String(p.operator_id) : '';

      if (filter.entityIdField === 'user_id') {
        if (pUserId !== target && pOperatorId !== target) return false;
      } else {
        const matchesAcc = [accId1, accId2, pAccId1, pAccId2, pCreatorId].includes(target);
        if (!matchesAcc) return false;
      }
    }

    return true;
  }).length;
}

export function getPluralMessages(count: number): string {
  const c = Math.abs(count) % 100;
  const c10 = c % 10;
  if (c > 10 && c < 20) return 'сообщений';
  if (c10 > 1 && c10 < 5) return 'сообщения';
  if (c10 === 1) return 'сообщение';
  return 'сообщений';
}

export function parseChatMessageDirection(
  rawEventOrPayload: any,
  rowPlatformAccountId?: string | null
): {
  isOutgoing: boolean;
  isIncoming: boolean;
  fromId: string | null;
  fanId: string | null;
  platformAccountId: string | null;
  accountId: string | null;
} {
  const rawPayload = rawEventOrPayload?.payload || rawEventOrPayload || {};
  const p = rawPayload.payload || rawPayload;
  const msg = p.message || rawPayload.message || {};
  const acc = p.account || rawPayload.account || {};

  const fromId = msg.from_id ?? p.from_id ?? rawPayload.from_id ?? null;
  const fanId = msg.fan_id ?? p.fan_id ?? rawPayload.fan_id ?? null;
  const platId =
    acc.platform_account_id ??
    p.platform_account_id ??
    rawPayload.platform_account_id ??
    rowPlatformAccountId ??
    rawEventOrPayload?.platform_account_id ??
    null;
  const accId =
    acc.account_id ??
    acc.id ??
    p.account_id ??
    rawPayload.account_id ??
    rawEventOrPayload?.account_id ??
    null;

  const strFromId = fromId != null ? String(fromId).trim() : '';
  const strFanId = fanId != null ? String(fanId).trim() : '';
  const strPlatId = platId != null ? String(platId).trim() : '';

  const sender = String(msg.sender || p.sender || '').toLowerCase().trim();
  const direction = String(msg.direction || p.direction || '').toLowerCase().trim();
  const isIncomingFlag = msg.is_incoming ?? p.is_incoming;

  // 1. Explicit outgoing condition:
  // from_id matches platform_account_id OR sender is operator/creator/model OR direction is 'out' OR is_incoming === false
  const isOutgoing = Boolean(
    (strFromId && strPlatId && strFromId === strPlatId) ||
    sender === 'operator' ||
    sender === 'creator' ||
    sender === 'model' ||
    direction === 'out' ||
    isIncomingFlag === false
  );

  // 2. Explicit incoming condition:
  // from_id matches fan_id OR sender is fan OR direction is 'in' OR is_incoming === true
  const isIncoming = Boolean(
    (strFromId && strFanId && strFromId === strFanId) ||
    sender === 'fan' ||
    direction === 'in' ||
    isIncomingFlag === true
  );

  return {
    isOutgoing: isOutgoing && !isIncoming,
    isIncoming: isIncoming && !isOutgoing,
    fromId: strFromId || null,
    fanId: strFanId || null,
    platformAccountId: strPlatId || null,
    accountId: accId ? String(accId).trim() : null
  };
}

/**
 * Helper to determine if an operator in current shift is a "handoff tail" (передал смену).
 * Criterion: messages_count in current shift < 5 AND (if shift has run > 15 min),
 * their activity was only within the first ~15 minutes of the shift.
 */
export function isHandoverTailOperator(
  op: ShiftOperator,
  shiftStartIso?: string,
  lastOutgoingMap?: Record<string, number>
): boolean {
  const msgCount = op.messages_count || 0;
  if (msgCount <= 0 || msgCount >= 5) return false;
  if (!shiftStartIso) return false;

  const shiftStartTs = new Date(shiftStartIso).getTime();
  if (isNaN(shiftStartTs) || shiftStartTs <= 0) return false;

  const nowTs = Date.now();
  const handoverWindowMs = 15 * 60 * 1000; // 15 min from shift start
  if (nowTs - shiftStartTs <= handoverWindowMs) {
    return false; // shift just started, too early to classify as handoff tail
  }

  // Check operator's last message time if available
  let opLastTs = 0;
  if (lastOutgoingMap && op.creator_ids) {
    op.creator_ids.forEach(cid => {
      const ts = lastOutgoingMap[String(cid)];
      if (typeof ts === 'number' && ts > opLastTs) {
        opLastTs = ts;
      }
    });
  }

  if (opLastTs > 0 && opLastTs <= shiftStartTs + handoverWindowMs) {
    return true;
  }
  if (opLastTs === 0 && msgCount < 3) {
    return true;
  }

  return false;
}

/**
 * Helper to analyze operators assigned to an account in the current shift,
 * separating primary active operators from handover tail operators.
 */
export function getAccountShiftOperators(
  account: OnlyMonsterAccount,
  operators: ShiftOperator[],
  shiftStartIso?: string,
  lastOutgoingMap?: Record<string, number>
): {
  primaryOperators: ShiftOperator[];
  handoverOperators: ShiftOperator[];
  allAssignedOperators: ShiftOperator[];
  operatorContextText: string;
} {
  const accId = String(account.platform_account_id || account.id || '');
  const accNumId = String(account.id || '');

  const assigned = (operators || []).filter(op => {
    if (isOperatorHidden(op.name)) return false;
    if (!Array.isArray(op.creator_ids)) return false;
    return op.creator_ids.some(cid => String(cid) === accId || String(cid) === accNumId);
  });

  const primaryOperators: ShiftOperator[] = [];
  const handoverOperators: ShiftOperator[] = [];

  assigned.forEach(op => {
    if (isHandoverTailOperator(op, shiftStartIso, lastOutgoingMap)) {
      handoverOperators.push(op);
    } else {
      primaryOperators.push(op);
    }
  });

  let operatorContextText = '';
  if (primaryOperators.length === 1) {
    operatorContextText = `назначен: ${primaryOperators[0].name}`;
    if (handoverOperators.length > 0) {
      operatorContextText += ` (передал смену: ${handoverOperators.map(h => h.name).join(', ')})`;
    }
  } else if (primaryOperators.length > 1) {
    operatorContextText = `назначены: ${primaryOperators.map(p => p.name).join(', ')}`;
    if (handoverOperators.length > 0) {
      operatorContextText += ` (передал смену: ${handoverOperators.map(h => h.name).join(', ')})`;
    }
  } else if (handoverOperators.length > 0) {
    operatorContextText = `передал смену: ${handoverOperators.map(h => h.name).join(', ')}`;
  } else if (assigned.length > 0) {
    operatorContextText = `назначены: ${assigned.map(a => a.name).join(', ')}`;
  } else {
    operatorContextText = 'нет назначенного оператора';
  }

  return {
    primaryOperators,
    handoverOperators,
    allAssignedOperators: assigned,
    operatorContextText,
  };
}

export function formatAlertDuration(seconds: number): string {
  if (isNaN(seconds) || seconds <= 0) return '0с';
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins > 0 && secs > 0) {
    return `${mins}м ${secs}с`;
  } else if (mins > 0) {
    return `${mins}м`;
  } else {
    return `${secs}с`;
  }
}

// ==========================================
// LIVE EVENT FEED: FINANCIAL MILESTONES ONLY
// ==========================================
export const ACCOUNT_SHIFT_REVENUE_MILESTONES = [100, 200, 500];

export type LiveEventCategory = 'operators' | 'finance' | 'warnings' | 'system';
export type LiveEventFilter = 'all' | LiveEventCategory;
export type LiveEventSeverity = 'red' | 'amber' | 'green' | 'blue' | 'slate';
export type LiveEventStatus = 'active' | 'acknowledged' | 'resolved' | 'expired' | 'silently_passed';

export interface LiveFeedItem {
  id: string;
  dedupe_key: string;
  category: LiveEventCategory;
  event_type: string;
  severity: LiveEventSeverity;
  account_id?: string;
  account_name?: string;
  shift_id?: string;
  shift_label?: string;
  milestone?: number;
  amount?: number;
  currency?: string;
  title: string;
  description: string;
  subtitle?: string;
  threshold_text?: string;
  current_val_text?: string;
  status: LiveEventStatus;
  created_at: string;
  updated_at: string;
  expires_at: string;
}

export function formatEventRelativeTime(tsString: string | undefined, now: number): string {
  if (!tsString) return 'только что';
  const time = new Date(tsString).getTime();
  if (isNaN(time)) return 'только что';
  const diffSec = Math.max(0, Math.floor((now - time) / 1000));
  if (diffSec < 5) return 'только что';
  if (diffSec < 60) return `${diffSec}с назад`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}м назад`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}ч назад`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}д назад`;
}

// Detailed modal for inspecting milestone events
export const LiveFeedDetailModal: React.FC<{
  event: LiveFeedItem | null;
  accounts: OnlyMonsterAccount[];
  onClose: () => void;
  onNavigateToAccount: (acc: OnlyMonsterAccount) => void;
}> = ({ event, accounts, onClose, onNavigateToAccount }) => {
  if (!event) return null;

  const matchedAccount = accounts.find(
    a => String(a.id) === String(event.account_id) || String(a.platform_account_id) === String(event.account_id)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in font-mono">
      <div className="glass-card w-full max-w-lg p-6 rounded-3xl border border-emerald-500/30 bg-slate-800/95 shadow-2xl space-y-5 text-white max-h-[90vh] overflow-y-auto custom-scrollbar">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs px-2.5 py-1 rounded-full font-bold flex items-center gap-1.5">
                <CheckCircle2 size={13} className="text-emerald-400" />
                ФИНАНСОВОЕ ДОСТИЖЕНИЕ
              </span>
              <span className="bg-slate-800 text-slate-300 border border-white/10 text-xs px-2.5 py-1 rounded-full font-bold">
                Смена
              </span>
            </div>
            <h3 className="text-base sm:text-lg font-black text-white pt-1">
              {event.title}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-900 border border-white/10 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Fact / Description */}
        <div className="p-4 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 space-y-2">
          <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
            Результат смены
          </div>
          <p className="text-sm font-semibold text-slate-100 leading-relaxed">
            {event.description}
          </p>
        </div>

        {/* Context Information */}
        <div className="p-4 rounded-2xl bg-slate-900/40 border border-white/5 space-y-2 text-xs">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pb-1">
            Контекст события
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
            {event.account_name && (
              <div>
                <span className="text-slate-500">Анкета: </span>
                <span className="font-bold text-emerald-300">{event.account_name}</span>
              </div>
            )}
            {event.shift_label && (
              <div>
                <span className="text-slate-500">Смена: </span>
                <span className="font-bold text-white">{event.shift_label}</span>
              </div>
            )}
            <div>
              <span className="text-slate-500">Создано: </span>
              <span>{new Date(event.created_at).toLocaleTimeString('ru-RU')}</span>
            </div>
            <div>
              <span className="text-slate-500">Хранение: </span>
              <span className="text-slate-400">24 часа</span>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-white/10">
          {matchedAccount && (
            <button
              onClick={() => {
                onClose();
                onNavigateToAccount(matchedAccount);
              }}
              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs flex items-center gap-1.5 transition-colors shadow-lg shadow-violet-950/40"
            >
              <Users size={14} />
              Открыть карточку анкеты
            </button>
          )}

          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/5 font-bold text-xs transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
};

// Module-level cache to survive tab unmount/remount in Continental Dashboard
export const moduleFeedState = createFeedProcessorState();

export function recalculateLiveWebhookIncome(_syncTimestampMs?: number): Record<string, number> {
  const newMap: Record<string, number> = {};
  moduleFeedState.shiftLiveEvents.forEach(ev => {
    newMap[ev.accountId] = Math.round(((newMap[ev.accountId] || 0) + ev.amount) * 100) / 100;
  });
  moduleFeedState.liveIncomeByAccount = newMap;
  return newMap;
}

export const RealtimeEventFeed: React.FC<{
  accounts: OnlyMonsterAccount[];
  onAccountClick: (acc: OnlyMonsterAccount) => void;
  onNavigateToAccountsTab: () => void;
}> = ({
  accounts,
  onAccountClick,
  onNavigateToAccountsTab,
}) => {
  const [now, setNow] = useState<number>(Date.now());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [filter, setFilter] = useState<LiveEventFilter>('all');
  const [selectedDetailEvent, setSelectedDetailEvent] = useState<LiveFeedItem | null>(null);

  // Keep a stable ref to accounts to avoid re-triggering polling effects
  const accountsRef = useRef<OnlyMonsterAccount[]>(accounts);
  useEffect(() => {
    accountsRef.current = accounts;
  }, [accounts]);

  // Core internal states
  const [liveEventsMap, setLiveEventsMap] = useState<Map<string, LiveFeedItem>>(new Map());
  const activeShiftRef = useRef<KyivShiftRange>(getKyivShiftRange(new Date()));
  const liveWebhookIncomeByAccountRef = useRef<Record<string, number>>(moduleFeedState.liveIncomeByAccount);

  // Clock ticker for relative times
  useEffect(() => {
    const ticker = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(ticker);
  }, []);

  // Fetch persisted milestone events from backend on mount
  const fetchPersistedMilestones = useCallback(async () => {
    try {
      const res = await fetch('/api/onlymonster/admin?resource=live-events');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.events)) {
          setLiveEventsMap(prev => {
            const next = new Map(prev);
            data.events.forEach((ev: any) => {
              if (ev.dedupe_key && (ev.event_type === 'account_shift_revenue_milestone' || ev.category === 'finance')) {
                next.set(ev.dedupe_key, {
                  id: String(ev.id),
                  dedupe_key: ev.dedupe_key,
                  category: 'finance',
                  event_type: 'account_shift_revenue_milestone',
                  severity: 'green',
                  account_id: ev.account_id ? String(ev.account_id) : undefined,
                  account_name: ev.account_name || 'Анкета',
                  shift_id: ev.shift_id ? String(ev.shift_id) : undefined,
                  shift_label: ev.shift_label || activeShiftRef.current?.label,
                  milestone: Number(ev.milestone || ev.metrics?.milestone || 0),
                  amount: Number(ev.amount || ev.metrics?.amount || 0),
                  currency: ev.currency || 'USD',
                  title: ev.title,
                  description: ev.description,
                  status: (ev.status as LiveEventStatus) || 'active',
                  created_at: ev.created_at,
                  updated_at: ev.updated_at || ev.created_at,
                  expires_at: ev.expires_at || new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
                });
              }
            });
            return next;
          });
        }
      }
    } catch (err) {
      console.error('[RealtimeEventFeed] Error loading persisted milestones:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPersistedMilestones();
  }, [fetchPersistedMilestones]);

  // Evaluate revenue milestones for all accounts ($100, $200, $500)
  const evaluateMilestones = useCallback(() => {
    const currentShift = getKyivShiftRange(new Date());
    activeShiftRef.current = currentShift;
    const shiftIndex = currentShift.index;
    const shiftLabel = currentShift.label || `Смена ${shiftIndex}`;
    const shiftId = `shift_${currentShift.start.slice(0, 10)}_${shiftIndex}`;

    // Reset live webhook income counters when transitioning to a new shift window
    if (moduleFeedState.lastShiftId && moduleFeedState.lastShiftId !== shiftId) {
      resetFeedStateForShift(moduleFeedState, shiftId);
      liveWebhookIncomeByAccountRef.current = {};
    }
    moduleFeedState.lastShiftId = shiftId;

    const nowIso = new Date().toISOString();
    const expiresIso = new Date(Date.now() + 24 * 3600 * 1000).toISOString();

    const newMilestoneEvents: LiveFeedItem[] = [];

    setLiveEventsMap(prev => {
      const next = new Map(prev);
      let changed = false;

      const currentAccounts = accountsRef.current || [];
      currentAccounts.forEach(acc => {
        if (isAccountHidden(acc.name) || acc.status === 'inactive') return;
        const accId = String(acc.platform_account_id || acc.id || '');
        if (!accId) return;

        // Requirement 1 & 9: Exclusively calculate from current active shift revenue, NOT calendar day earnings
        const baseShiftRevenue = (acc.earnings_breakdown && typeof acc.earnings_breakdown[shiftIndex] === 'number')
          ? Number(acc.earnings_breakdown[shiftIndex])
          : 0;

        // Requirement 2: Do NOT sum unconfirmed live delta into confirmed analytics revenue without transaction confirmation.
        // Confirmed shift revenue is strictly baseShiftRevenue from OnlyMonster analytics breakdown.
        // Live events are displayed separately in the Live Feed.
        const accountShiftRevenue = Math.max(0, baseShiftRevenue);

        // Find all reached thresholds among [100, 200, 500]
        const reachedMilestones = ACCOUNT_SHIFT_REVENUE_MILESTONES.filter(m => accountShiftRevenue >= m);
        if (reachedMilestones.length === 0) return;

        // Find which reached milestones have NOT yet been triggered
        const untriggered = reachedMilestones.filter(m => {
          const dedupeKey = `account_shift_revenue_milestone:${accId}:${shiftId}:${m}`;
          return !next.has(dedupeKey);
        });

        if (untriggered.length > 0) {
          // Requirement 4: On first sync or sudden revenue jump past multiple thresholds,
          // only create a visible event for the HIGHEST reached milestone.
          const highestMilestone = Math.max(...untriggered);
          const formattedEarn = accountShiftRevenue.toFixed(2);

          // 1. Create visible event for the highest reached milestone
          const activeDedupeKey = `account_shift_revenue_milestone:${accId}:${shiftId}:${highestMilestone}`;
          const activeItem: LiveFeedItem = {
            id: `ms-${accId}-${shiftId}-${highestMilestone}`,
            dedupe_key: activeDedupeKey,
            category: 'finance',
            event_type: 'account_shift_revenue_milestone',
            severity: 'green',
            account_id: accId,
            account_name: acc.name,
            shift_id: shiftId,
            shift_label: shiftLabel,
            milestone: highestMilestone,
            amount: accountShiftRevenue,
            currency: 'USD',
            title: `🏆 ${acc.name} достигла $${highestMilestone} за текущую смену`,
            description: `Текущий результат: $${formattedEarn}`,
            status: 'active',
            created_at: nowIso,
            updated_at: nowIso,
            expires_at: expiresIso,
          };
          next.set(activeDedupeKey, activeItem);
          newMilestoneEvents.push(activeItem);
          changed = true;

          // 2. Mark all lower untriggered milestones as silently_passed so they are deduplicated and never spawn
          untriggered.forEach(lowerMilestone => {
            if (lowerMilestone < highestMilestone) {
              const silentDedupeKey = `account_shift_revenue_milestone:${accId}:${shiftId}:${lowerMilestone}`;
              const silentItem: LiveFeedItem = {
                id: `ms-${accId}-${shiftId}-${lowerMilestone}`,
                dedupe_key: silentDedupeKey,
                category: 'finance',
                event_type: 'account_shift_revenue_milestone',
                severity: 'green',
                account_id: accId,
                account_name: acc.name,
                shift_id: shiftId,
                shift_label: shiftLabel,
                milestone: lowerMilestone,
                amount: accountShiftRevenue,
                currency: 'USD',
                title: `🏆 ${acc.name} достигла $${lowerMilestone} за текущую смену`,
                description: `Текущий результат: $${formattedEarn}`,
                status: 'silently_passed',
                created_at: nowIso,
                updated_at: nowIso,
                expires_at: expiresIso,
              };
              next.set(silentDedupeKey, silentItem);
              newMilestoneEvents.push(silentItem);
              changed = true;
            }
          });
        } else {
          // All reached milestones already triggered. Update amount & current result description of highest existing active milestone
          const highestReached = Math.max(...reachedMilestones);
          const highestDedupeKey = `account_shift_revenue_milestone:${accId}:${shiftId}:${highestReached}`;
          const existing = next.get(highestDedupeKey);
          if (existing && existing.amount !== accountShiftRevenue) {
            const formattedEarn = accountShiftRevenue.toFixed(2);
            existing.amount = accountShiftRevenue;
            existing.description = `Текущий результат: $${formattedEarn}`;
            existing.updated_at = nowIso;
            changed = true;
          }
        }
      });

      return changed ? next : prev;
    });

    // Save newly generated milestone events to backend in batch
    if (newMilestoneEvents.length > 0) {
      fetch('/api/onlymonster/admin?resource=live-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ events: newMilestoneEvents }),
      }).catch(e => {
        console.error('[RealtimeEventFeed] Error posting new milestones:', e);
      });
    }
  }, []);

  // Re-evaluate on accounts change (when analytics updates earnings_breakdown)
  useEffect(() => {
    liveWebhookIncomeByAccountRef.current = moduleFeedState.liveIncomeByAccount;
    evaluateMilestones();
  }, [accounts, evaluateMilestones]);

  // Periodic polling for incoming confirmed webhooks using shared feedProcessor
  useEffect(() => {
    let isMounted = true;
    let pollTimeout: any = null;
    let activeFetchAbortController: AbortController | null = null;
    let activeFetchTimeoutId: any = null;
    let isPolling = false;

    const executePoll = async () => {
      if (!isMounted || isPolling) return;
      if (typeof document !== 'undefined' && document.hidden) {
        // Tab is inactive; postpone poll check
        pollTimeout = setTimeout(executePoll, 10000);
        return;
      }

      isPolling = true;

      try {
        const currentShift = getKyivShiftRange(new Date());
        activeShiftRef.current = currentShift;
        const shiftIdx = currentShift.index;
        const shiftId = `shift_${currentShift.start.slice(0, 10)}_${shiftIdx}`;

        await runPollDrainLoop({
          fetchBatch: async (cursor, shiftRange, signal) => {
            const params = new URLSearchParams();
            params.append('resource', 'events');
            params.append('compact', '1');
            params.append('limit', '50');
            params.append('order', 'asc');
            params.append('shift_start', shiftRange.start);
            params.append('shift_end', shiftRange.end);
            if (cursor) {
              params.append('since_id', String(cursor));
            }

            const res = await fetch(`/api/onlymonster/admin?${params.toString()}`, { signal });
            if (!res.ok) {
              return { ok: false, status: res.status };
            }
            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
              return { ok: false, status: res.status };
            }
            const data = await res.json();
            return { ok: true, status: res.status, data };
          },
          state: moduleFeedState,
          currentShift,
          isDocumentHidden: () => typeof document !== 'undefined' && document.hidden,
          isMounted: () => isMounted,
          onActiveControllerCreated: (controller, timeoutId) => {
            activeFetchAbortController = controller;
            activeFetchTimeoutId = timeoutId;
          },
          onActiveControllerCleared: () => {
            activeFetchAbortController = null;
            activeFetchTimeoutId = null;
          },
          onBatchProcessed: (batchResult: ProcessBatchResult) => {
            liveWebhookIncomeByAccountRef.current = moduleFeedState.liveIncomeByAccount;

            if (batchResult.newLiveEvents.length > 0) {
              setLiveEventsMap(prev => {
                const next = new Map(prev);
                batchResult.newLiveEvents.forEach(rec => {
                  const matchingAcc = accountsRef.current?.find(a => 
                    String(a.platform_account_id || a.id || '') === rec.accountId ||
                    String(a.id || '') === rec.accountId
                  );
                  const accName = matchingAcc?.name || 'Аккаунт';

                  let eventLabel = 'Продажа';
                  if (rec.eventType === 'fans.tip.received') eventLabel = 'Чаевые';
                  else if (rec.eventType === 'fans.ppv.purchased') eventLabel = 'Покупка PPV';
                  else if (rec.eventType === 'fans.message.purchased') eventLabel = 'Платное сообщение';
                  else if (rec.eventType === 'fans.post.purchased') eventLabel = 'Платный пост';
                  else if (rec.eventType === 'payment.received') eventLabel = 'Оплата';

                  const feedItemKey = `live_sale:${rec.id || rec.dedupKey || `${rec.accountId}_${rec.timestampIso}`}`;
                  const liveItem: LiveFeedItem = {
                    id: feedItemKey,
                    dedupe_key: feedItemKey,
                    category: 'finance',
                    event_type: rec.eventType,
                    severity: 'green',
                    account_id: rec.accountId,
                    account_name: accName,
                    shift_id: shiftId,
                    shift_label: currentShift.label || `Смена ${shiftIdx}`,
                    amount: rec.amount,
                    currency: 'USD',
                    title: `💰 ${eventLabel} $${rec.amount.toFixed(2)} — ${accName}`,
                    description: `Live событие: $${rec.amount.toFixed(2)} NET (Gross: $${rec.grossAmount.toFixed(2)})`,
                    status: 'active',
                    created_at: rec.timestampIso,
                    updated_at: rec.timestampIso,
                    expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
                  };
                  next.set(feedItemKey, liveItem);
                });
                return next;
              });
            }

            if (batchResult.newIncome) {
              evaluateMilestones();
            }
          },
          maxBatches: 20,
          batchLimit: 50,
          timeoutMs: 10000,
          isEventInShiftFn: isEventInCurrentKyivShift
        });

      } catch (err: any) {
        if (err?.name !== 'AbortError') {
          if (!err?.message?.includes('Unexpected token') && !err?.message?.includes('is not valid JSON')) {
            console.warn('[RealtimeEventFeed] Polling warning:', err?.message || err);
          }
        }
      } finally {
        isPolling = false;
        if (isMounted) {
          setIsLoading(false);
          // Exponential backoff up to 60s upon consecutive network/server errors
          const nextDelay = moduleFeedState.consecutiveErrors > 0 
            ? Math.min(60000, 10000 * Math.pow(2, moduleFeedState.consecutiveErrors - 1))
            : 10000;
          pollTimeout = setTimeout(executePoll, nextDelay);
        }
      }
    };

    // Immediate initial poll
    executePoll();

    // Catch up immediately when returning to tab
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden && isMounted) {
        clearTimeout(pollTimeout);
        executePoll();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      isMounted = false;
      if (activeFetchTimeoutId) {
        clearTimeout(activeFetchTimeoutId);
        activeFetchTimeoutId = null;
      }
      if (activeFetchAbortController) {
        activeFetchAbortController.abort();
        activeFetchAbortController = null;
      }
      clearTimeout(pollTimeout);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [evaluateMilestones]);

  // Periodic re-evaluation every 10s
  useEffect(() => {
    const interval = setInterval(() => {
      evaluateMilestones();
    }, 10000);
    return () => clearInterval(interval);
  }, [evaluateMilestones]);

  // Filtered & Sorted Event List
  const { allList, visibleList, counts } = useMemo(() => {
    const nowTs = Date.now();
    const items = Array.from(liveEventsMap.values()).filter(item => {
      // Exclude silently_passed milestone events (used only for deduplication)
      if (item.status === 'silently_passed') return false;

      // 24-hour expiration filter
      const expTs = new Date(item.expires_at).getTime();
      if (expTs <= nowTs) return false;

      // Filter hidden models
      if (item.account_name && isAccountHidden(item.account_name)) return false;
      return true;
    });

    // Priority sorting:
    // 1. Active Critical (🔴)
    // 2. Active Warnings (🟠)
    // 3. Important Financial Events (💰, 🔥, 🏆)
    // 4. Recovered / Resolved (🟢)
    // 5. System & Others
    const getPriority = (it: LiveFeedItem) => {
      if (it.status === 'active') {
        if (it.severity === 'red') return 1;
        if (it.severity === 'amber') return 2;
        if (it.category === 'finance') return 3;
        if (it.severity === 'green') return 4;
        if (it.category === 'system') return 5;
        return 6;
      }
      if (it.status === 'resolved' || it.severity === 'green') return 7;
      return 8;
    };

    items.sort((a, b) => {
      const pA = getPriority(a);
      const pB = getPriority(b);
      if (pA !== pB) return pA - pB;
      const tA = new Date(a.updated_at || a.created_at).getTime();
      const tB = new Date(b.updated_at || b.created_at).getTime();
      return tB - tA;
    });

    const c = {
      all: items.length,
      operators: items.filter(i => i.category === 'operators').length,
      finance: items.filter(i => i.category === 'finance').length,
      warnings: items.filter(i => i.category === 'warnings').length,
      system: items.filter(i => i.category === 'system').length,
    };

    const filtered = filter === 'all' ? items : items.filter(i => i.category === filter);
    const displayed = isExpanded ? filtered : filtered.slice(0, 7);

    return { allList: items, visibleList: displayed, totalInFilter: filtered.length, counts: c };
  }, [liveEventsMap, filter, isExpanded]);

  const handleRowClick = (item: LiveFeedItem) => {
    setSelectedDetailEvent(item);
  };

  const getVisualIndicator = (item: LiveFeedItem) => {
    if (item.category === 'system') {
      return <Zap size={14} className="text-violet-400 shrink-0" />;
    }
    if (item.status === 'resolved' || (item.severity === 'green' && item.category !== 'finance')) {
      return <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />;
    }
    if (item.severity === 'red') {
      return (
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
        </span>
      );
    }
    if (item.severity === 'amber') {
      return <span className="h-2.5 w-2.5 rounded-full bg-amber-400 shrink-0" />;
    }
    if (item.category === 'finance') {
      if (item.title.includes('РЕЗУЛЬТАТ')) return <Award size={14} className="text-amber-400 shrink-0" />;
      if (item.title.includes('СЕРИЯ')) return <Flame size={14} className="text-amber-400 shrink-0" />;
      return <DollarSign size={14} className="text-emerald-400 shrink-0" />;
    }
    return <span className="h-2.5 w-2.5 rounded-full bg-slate-400 shrink-0" />;
  };

  return (
    <>
      <div className="om-feed space-y-3">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-2 border-b border-white/5 pb-2.5">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
            <h3 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-2">
              <Activity size={15} className="text-emerald-400" />
              LIVE
            </h3>
          </div>

          <div className="text-[10px] text-slate-400 flex items-center gap-1.5">
            <Clock size={12} className="text-slate-500" />
            Обновление 10с
          </div>
        </div>

        {/* Filter Categories Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {[
            { id: 'all', label: 'Все', count: counts.all },
            { id: 'operators', label: 'Операторы', count: counts.operators },
            { id: 'finance', label: 'Финансы', count: counts.finance },
            { id: 'warnings', label: 'Блокировки', count: counts.warnings },
            { id: 'system', label: 'Система', count: counts.system },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as LiveEventCategory)}
              aria-pressed={filter === tab.id}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all flex items-center gap-1.5 ${
                filter === tab.id
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-950/40 border border-violet-400/30'
                  : 'bg-slate-900/80 text-slate-400 border border-white/5 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-[9px] px-1.5 py-0.2 rounded-full font-extrabold ${
                filter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-800 text-slate-400'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Event List Container */}
        <div className="space-y-1.5 pr-1">
          {isLoading && liveEventsMap.size === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500 animate-pulse">
              Загрузка ключевых событий смены...
            </div>
          ) : visibleList.length === 0 ? (
            <div className="text-center py-6 text-xs text-slate-500 italic bg-slate-900/20 rounded-2xl border border-white/5 p-4">
              {liveEventsMap.size === 0
                ? 'Событий за смену пока нет'
                : 'Нет событий в выбранной категории'}
            </div>
          ) : (
            visibleList.map(event => {
              const ts = event.updated_at || event.created_at;

              const isCritical = event.severity === 'red' && event.status === 'active';
              const isWarning = event.severity === 'amber' && event.status === 'active';
              const isResolved = event.status === 'resolved';

              const itemBgClass = isCritical
                ? 'bg-gradient-to-r from-rose-950/40 via-slate-900/90 to-slate-900/60 border-rose-500/30 hover:border-rose-400/50'
                : isWarning
                ? 'bg-gradient-to-r from-amber-950/30 via-slate-900/90 to-slate-900/60 border-amber-500/30 hover:border-amber-400/50'
                : isResolved
                ? 'bg-slate-900/40 border-emerald-500/20 hover:border-emerald-500/40'
                : 'bg-slate-900/60 border-white/5 hover:border-violet-500/40';

              return (
                <div
                  key={event.id}
                  onClick={() => handleRowClick(event)}
                  className={`om-feed-row flex items-center justify-between gap-3 group ${itemBgClass}`}
                  role="button" tabIndex={0} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleRowClick(event); } }}
                  title="Нажмите для просмотра подробностей и метрик"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="flex items-center justify-center shrink-0">
                      {getVisualIndicator(event)}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`text-xs font-bold truncate ${
                          isCritical
                            ? 'text-rose-200'
                            : isWarning
                            ? 'text-amber-200'
                            : isResolved
                            ? 'text-emerald-300'
                            : 'text-slate-200'
                        }`}>
                          {event.title}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate mt-0.5">
                        {event.description}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">
                      {formatEventRelativeTime(ts, now)}
                    </span>
                    <ChevronRight size={14} className="text-slate-600 group-hover:text-violet-400 transition-colors" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Expand / Collapse Toggle if more than 7 events */}
        {(filter === 'all' ? counts.all : counts[filter as keyof typeof counts]) > 7 && (
          <div className="pt-1 text-center border-t border-white/5">
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[11px] font-bold uppercase text-slate-400 hover:text-violet-300 transition-colors inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg hover:bg-white/5"
            >
              {isExpanded ? 'Свернуть до 7 событий' : `Показать все (${filter === 'all' ? counts.all : counts[filter as keyof typeof counts]})`}
              <ChevronDown size={13} className={`transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedDetailEvent && (
        <LiveFeedDetailModal
          event={selectedDetailEvent}
          accounts={accounts}
          onClose={() => setSelectedDetailEvent(null)}
          onNavigateToAccount={(acc) => {
            onNavigateToAccountsTab();
            onAccountClick(acc);
          }}
        />
      )}
    </>
  );
};

export const OnlyMonsterTab: React.FC<OnlyMonsterTabProps> = ({ 
  agencyModels, 
  shiftAnalysisEnabled = false,
  userRole,
  activeView,
  onNavigateView,
  hideHeaderAndTabs = false
}) => {
  // Sub-tabs state: 'live' (default), 'models', 'operator_metrics'
  const [activeSubTab, setActiveSubTab] = useState<'live' | 'models' | 'operator_metrics'>(() => {
    if (activeView === 'operators') return 'operator_metrics';
    if (activeView === 'models') return 'models';
    return 'live';
  });

  const effectiveSubTab: 'live' | 'models' | 'operator_metrics' = activeView
    ? (activeView === 'operators' ? 'operator_metrics' : activeView)
    : activeSubTab;
  const [alertSeverityFilter, setAlertSeverityFilter] = useState<'all' | 'red' | 'amber'>('all');

  // Accounts & API state
  const [accounts, setAccounts] = useState<OnlyMonsterAccount[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEarningsLoading, setIsEarningsLoading] = useState(false);
  const [connStatus, setConnStatus] = useState<'idle' | 'testing' | 'live' | 'not_configured' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [accountsEarningsDay, setAccountsEarningsDay] = useState<'today' | 'yesterday'>('today');
  const [showShiftBreakdown, setShowShiftBreakdown] = useState<boolean>(false);

  // Filter accounts by search query and HIDDEN_ACCOUNT_NAMES
  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => 
      !isAccountHidden(acc.name) && (
        acc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (acc.handle && acc.handle.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    );
  }, [accounts, searchQuery]);

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
  const [operatorView, setOperatorView] = useState<'list' | 'cards'>(() => {
    try { return localStorage.getItem('ct-om-view') === 'cards' ? 'cards' : 'list'; } catch { return 'list'; }
  });
  const [operatorSearch, setOperatorSearch] = useState('');
  const changeOperatorView = (view: 'list' | 'cards') => {
    setOperatorView(view); setRaceMode(false);
    try { localStorage.setItem('ct-om-view', view); } catch { /* View preference is optional. */ }
  };

  // Sorting state
  const [sortBy, setSortBy] = useState<'messages' | 'reply_time' | 'ppv_sent' | 'ppv_sold' | 'earnings'>('messages');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  // Shift Comparison state
  const [shiftCompMode, setShiftCompMode] = useState<'today' | 'yesterday' | 'week'>('today');
  const [comparisonByPeriod, setComparisonByPeriod] = useState<Record<string, { shifts: any[]; partial?: boolean; updatedAt: number }>>({});
  const shiftCompData = comparisonByPeriod[shiftCompMode] || null;
  const comparisonRequest = useRef<Record<string, number>>({});
  const operatorRequest = useRef(0);
  const comparisonModeRef = useRef(shiftCompMode);
  comparisonModeRef.current = shiftCompMode;
  const [operatorsUpdatedAt, setOperatorsUpdatedAt] = useState<number | null>(null);
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

  // Account detail modal state
  const [selectedAccountForDetail, setSelectedAccountForDetail] = useState<OnlyMonsterAccount | null>(null);
  const [selectedOperatorForDeepStats, setSelectedOperatorForDeepStats] = useState<ShiftOperator | null>(null);
  const [accountDetailData, setAccountDetailData] = useState<any | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Attention Alerts state & computation
  const [showAlertsExpanded, setShowAlertsExpanded] = useState(false);
  const [highlightedOpId, setHighlightedOpId] = useState<string | null>(null);
  const [lastOutgoingAtByAccount, setLastOutgoingAtByAccount] = useState<Record<string, number>>({});
  const [lastActivitySyncAt, setLastActivitySyncAt] = useState<number | null>(null);
  const [lastActivitySyncSuccess, setLastActivitySyncSuccess] = useState<boolean>(false);
  const [nowTime, setNowTime] = useState<number>(Date.now());

  // New signals state
  const [unansweredCountsByAccount, setUnansweredCountsByAccount] = useState<Record<string, number>>({});
  const [oldestUnansweredTsByAccount, setOldestUnansweredTsByAccount] = useState<Record<string, number>>({});
  const [lastHourOperatorMessages, setLastHourOperatorMessages] = useState<Record<string, { count: number; name: string }>>({});

  useEffect(() => {
    const ticker = setInterval(() => {
      setNowTime(Date.now());
    }, 10000);
    return () => clearInterval(ticker);
  }, []);

  // Poll unanswered messages count & oldest unreplied ts every 30s
  useEffect(() => {
    let isMounted = true;
    let timer: any = null;
    let abortController: AbortController | null = null;
    let isFetching = false;
    let consecutiveErrors = 0;

    const fetchUnanswered = async () => {
      if (!isMounted || isFetching) return;
      if (typeof document !== 'undefined' && document.hidden) {
        timer = setTimeout(fetchUnanswered, 30000);
        return;
      }

      let isTimedOut = false;
      isFetching = true;
      abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        isTimedOut = true;
        if (abortController) abortController.abort();
      }, 10000);

      try {
        const res = await fetch('/api/onlymonster/admin?resource=unanswered-counts', {
          signal: abortController.signal
        });

        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success) {
            if (data.unansweredCounts) {
              setUnansweredCountsByAccount(data.unansweredCounts);
            }
            if (data.oldestUnansweredTsByAccount) {
              setOldestUnansweredTsByAccount(data.oldestUnansweredTsByAccount);
            }
            consecutiveErrors = 0;
          } else {
            consecutiveErrors++;
          }
        } else {
          consecutiveErrors++;
        }
      } catch (err: any) {
        if (isTimedOut || (err?.name !== 'AbortError' && isMounted)) {
          consecutiveErrors++;
          console.error('[OnlyMonsterTab] Error fetching unanswered-counts:', err);
        }
      } finally {
        clearTimeout(timeoutId);
        isFetching = false;
        if (isMounted) {
          const nextDelay = consecutiveErrors > 0
            ? Math.min(120000, 30000 * Math.pow(2, consecutiveErrors - 1))
            : 30000;
          timer = setTimeout(fetchUnanswered, nextDelay);
        }
      }
    };

    fetchUnanswered();

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden && isMounted) {
        clearTimeout(timer);
        fetchUnanswered();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      isMounted = false;
      if (abortController) abortController.abort();
      clearTimeout(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, []);

  // Poll last hour operator messages every 5m
  useEffect(() => {
    let isMounted = true;
    let timer: any = null;
    let abortController: AbortController | null = null;
    let isFetching = false;
    let consecutiveErrors = 0;

    const fetchLastHourOperators = async () => {
      if (!isMounted || isFetching) return;
      if (typeof document !== 'undefined' && document.hidden) {
        timer = setTimeout(fetchLastHourOperators, 300000);
        return;
      }

      let isTimedOut = false;
      isFetching = true;
      abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        isTimedOut = true;
        if (abortController) abortController.abort();
      }, 10000);

      try {
        const toISO = new Date().toISOString();
        const fromISO = new Date(Date.now() - 60 * 60 * 1000).toISOString();
        const res = await fetch(`/api/onlymonster/analytics?resource=shift-operators&from=${fromISO}&to=${toISO}`, {
          signal: abortController.signal
        });

        if (res.ok) {
          const data = await res.json();
          if (isMounted && data.success && Array.isArray(data.operators)) {
            const map: Record<string, { count: number; name: string }> = {};
            data.operators.forEach((op: any) => {
              if (op.user_id) {
                map[op.user_id] = {
                  count: op.messages_count || 0,
                  name: op.name || 'Оператор',
                };
              }
            });
            setLastHourOperatorMessages(map);
            consecutiveErrors = 0;
          } else {
            consecutiveErrors++;
          }
        } else {
          consecutiveErrors++;
        }
      } catch (err: any) {
        if (isTimedOut || (err?.name !== 'AbortError' && isMounted)) {
          consecutiveErrors++;
          console.error('[OnlyMonsterTab] Error fetching last-hour shift-operators:', err);
        }
      } finally {
        clearTimeout(timeoutId);
        isFetching = false;
        if (isMounted) {
          const nextDelay = consecutiveErrors > 0
            ? Math.min(600000, 300000 * Math.pow(2, consecutiveErrors - 1))
            : 300000;
          timer = setTimeout(fetchLastHourOperators, nextDelay);
        }
      }
    };

    fetchLastHourOperators();

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden && isMounted) {
        clearTimeout(timer);
        fetchLastHourOperators();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      isMounted = false;
      if (abortController) abortController.abort();
      clearTimeout(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, []);

  const accountsLocalRef = useRef<OnlyMonsterAccount[]>(accounts);
  useEffect(() => {
    accountsLocalRef.current = accounts;
  }, [accounts]);

  useEffect(() => {
    let isMounted = true;
    let timer: any = null;
    let abortController: AbortController | null = null;
    let isFetching = false;
    let consecutiveErrors = 0;

    const fetchInitialLastActivity = async () => {
      if (!isMounted || isFetching) return;
      if (typeof document !== 'undefined' && document.hidden) {
        timer = setTimeout(fetchInitialLastActivity, 30000);
        return;
      }

      let isTimedOut = false;
      isFetching = true;
      abortController = new AbortController();
      const timeoutId = setTimeout(() => {
        isTimedOut = true;
        if (abortController) abortController.abort();
      }, 10000);

      try {
        const currentAccs = accountsLocalRef.current || [];
        const accParam = currentAccs
          .map(a => [a.id, a.platform_account_id, (a as any).account_id].filter(Boolean))
          .flat()
          .join(',');
        const url = '/api/onlymonster/admin?resource=last-activity' + (accParam ? `&accounts=${encodeURIComponent(accParam)}` : '');
        const res = await fetch(url, { signal: abortController.signal });

        if (!res.ok) {
          if (isMounted) setLastActivitySyncSuccess(false);
          consecutiveErrors++;
          return;
        }
        const data = await res.json();
        if (!data.success) {
          if (isMounted) setLastActivitySyncSuccess(false);
          consecutiveErrors++;
          return;
        }
        if (isMounted && data.success && data.lastOutgoingAtByAccount) {
          const rawIncoming: Record<string, number | null> = data.lastOutgoingAtByAccount;
          const nowTs = Date.now();
          setLastActivitySyncAt(nowTs);
          setLastActivitySyncSuccess(true);
          consecutiveErrors = 0;

          setLastOutgoingAtByAccount(prev => {
            const next = { ...prev };
            currentAccs.forEach(acc => {
              const keys = [
                String(acc.id || ''),
                String(acc.platform_account_id || ''),
                String((acc as any).account_id || '')
              ].filter(Boolean);

              const hasExplicitEntry = keys.some(k => k in rawIncoming);
              if (hasExplicitEntry) {
                const maxFresh = Math.max(...keys.map(k => Number(rawIncoming[k]) || 0));
                if (maxFresh > 0) {
                  keys.forEach(k => { next[k] = Math.max(next[k] || 0, maxFresh); });
                } else {
                  keys.forEach(k => { delete next[k]; });
                }
              }
            });

            Object.entries(rawIncoming).forEach(([key, ts]) => {
              const numTs = Number(ts);
              if (numTs > 0) {
                next[key] = Math.max(next[key] || 0, numTs);
              }
            });

            return next;
          });
        } else if (isMounted) {
          setLastActivitySyncSuccess(false);
          consecutiveErrors++;
        }
      } catch (err: any) {
        if (isTimedOut || (err?.name !== 'AbortError' && isMounted)) {
          if (isMounted) setLastActivitySyncSuccess(false);
          consecutiveErrors++;
          console.error('[OnlyMonsterTab] Error fetching last-activity:', err);
        }
      } finally {
        clearTimeout(timeoutId);
        isFetching = false;
        if (isMounted) {
          const nextDelay = consecutiveErrors > 0
            ? Math.min(120000, 30000 * Math.pow(2, consecutiveErrors - 1))
            : 30000;
          timer = setTimeout(fetchInitialLastActivity, nextDelay);
        }
      }
    };

    fetchInitialLastActivity();

    const handleVisibility = () => {
      if (typeof document !== 'undefined' && !document.hidden && isMounted) {
        clearTimeout(timer);
        fetchInitialLastActivity();
      }
    };
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibility);
    }

    return () => {
      isMounted = false;
      if (abortController) abortController.abort();
      clearTimeout(timer);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibility);
      }
    };
  }, []);

  const isActivitySyncFresh = useMemo(() => {
    if (!lastActivitySyncSuccess || !lastActivitySyncAt) return false;
    // Considered stale if no successful sync for > 90 seconds
    return (nowTime - lastActivitySyncAt) <= 90 * 1000;
  }, [lastActivitySyncSuccess, lastActivitySyncAt, nowTime]);

  /**
   * Unified Helper: Calculate NET earnings for a model for the given day mode ('today' | 'yesterday').
   * - For 'today': Sums NET earnings from 02:00 Kyiv Time up to the current active shift (1..currentKyivShiftIndex).
   * - For 'yesterday': Sums NET earnings for the entire operational day (shifts 1..4).
   */
  const calculateModelNet = (
    acc: { today_earnings?: number | null; earnings_breakdown?: { 1?: number; 2?: number; 3?: number; 4?: number } | null },
    dayMode: 'today' | 'yesterday' = accountsEarningsDay
  ): number | null => {
    if (acc.earnings_breakdown) {
      if (dayMode === 'today') {
        let sum = 0;
        for (let s = 1; s <= currentKyivShiftIndex; s++) {
          sum += Number(acc.earnings_breakdown[s as 1 | 2 | 3 | 4]) || 0;
        }
        return Math.round(sum * 100) / 100;
      } else {
        const b = acc.earnings_breakdown;
        const sum = (Number(b[1]) || 0) + (Number(b[2]) || 0) + (Number(b[3]) || 0) + (Number(b[4]) || 0);
        return Math.round(sum * 100) / 100;
      }
    }
    if (typeof acc.today_earnings === 'number') {
      return Math.round(acc.today_earnings * 100) / 100;
    }
    return null;
  };

  // Current-shift totals always use today's snapshot, independent of archive filters.
  const todaySnapshot = comparisonByPeriod.today;
  const currentShiftSnapshot = todaySnapshot?.shifts.find(s => s.index === currentKyivShiftIndex);
  const currentShiftRevenue = currentShiftSnapshot?.accountEarnings ?? null;
  const totalTodaySum = todaySnapshot && todaySnapshot.shifts.filter(s => !s.isFuture).every(s => typeof s.accountEarnings === 'number')
    ? todaySnapshot.shifts.reduce((sum, s) => sum + (s.accountEarnings ?? 0), 0) : null;
  const visibleOperators = useMemo(() => operators.filter(op => op.name.toLocaleLowerCase().includes(operatorSearch.toLocaleLowerCase())), [operators, operatorSearch]);

  const currentShiftTimeRange = useMemo(() => {
    switch (currentKyivShiftIndex) {
      case 1: return '02:00 — 08:00';
      case 2: return '08:00 — 14:00';
      case 3: return '14:00 — 20:00';
      case 4: return '20:00 — 02:00';
      default: return '14:00 — 20:00';
    }
  }, [currentKyivShiftIndex]);

  const totalUnansweredCount = useMemo(() => {
    return Object.values(unansweredCountsByAccount).reduce((sum, val) => sum + (Number(val) || 0), 0);
  }, [unansweredCountsByAccount]);

  const activeOpsCount = useMemo(() => {
    return operators.filter(o => {
      if (isOperatorHidden(o.name)) return false;
      if ((o.messages_count || 0) === 0) return false;
      const isHandover = isHandoverTailOperator(o, shiftInfo?.start, lastOutgoingAtByAccount);
      return !isHandover;
    }).length;
  }, [operators, shiftInfo, lastOutgoingAtByAccount]);

  // Helper to calculate real unique operator count for an account
  const getOperatorCountForAccount = (accId: string): number => {
    if (!operators || operators.length === 0) return 0;
    const uniqueUsers = new Set<string>();
    operators.forEach(op => {
      if (Array.isArray(op.creator_ids) && op.creator_ids.some(cid => String(cid) === String(accId))) {
        uniqueUsers.add(op.user_id);
      }
    });
    return uniqueUsers.size;
  };

  // Helper to get ISO range for operational day on client
  const getKyivOperationalDayISO = (day: 'today' | 'yesterday'): { start: string; end: string } => {
    const now = new Date();
    const hourFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Kyiv",
      hour: "numeric",
      hour12: false
    });
    const kyivHour = parseInt(hourFormatter.format(now), 10) || 0;
    const anchorOffset = kyivHour >= 2 ? 0 : -1;
    const baseOffset = day === 'today' ? anchorOffset : anchorOffset - 1;

    const getKyivStr = (offsetDays: number) => {
      const d = new Date(Date.now() + offsetDays * 24 * 3600 * 1000);
      const fmt = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Europe/Kyiv",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      });
      return fmt.format(d);
    };

    const baseDateStr = getKyivStr(baseOffset);
    const nextDateStr = getKyivStr(baseOffset + 1);

    const kyivToUtc = (dStr: string, hour: number) => {
      const naiveUtc = new Date(`${dStr}T${String(hour).padStart(2, '0')}:00:00.000Z`);
      const hFmt = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Kyiv", hour: "numeric", hour12: false });
      const kHour = parseInt(hFmt.format(naiveUtc), 10) || 0;
      let offset = kHour - hour;
      if (offset > 12) offset -= 24;
      if (offset < -12) offset += 24;
      return new Date(naiveUtc.getTime() - offset * 3600000).toISOString();
    };

    return {
      start: kyivToUtc(baseDateStr, 2),
      end: kyivToUtc(nextDateStr, 2)
    };
  };

  // Click handler for opening account detail modal
  const handleAccountClick = async (acc: OnlyMonsterAccount) => {
    setSelectedAccountForDetail(acc);
    setIsDetailLoading(true);
    setDetailError(null);
    setAccountDetailData(null);

    try {
      const range = getKyivOperationalDayISO(accountsEarningsDay);
      const params = new URLSearchParams();
      params.append('account_id', acc.platform_account_id);
      params.append('start', range.start);
      params.append('end', range.end);
      params.set('resource', 'account-detail');

      const res = await fetch(`/api/onlymonster/analytics?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setAccountDetailData(data);
        } else {
          setDetailError(data.error || 'Не удалось загрузить детальную статистику аккаунта');
        }
      } else {
        setDetailError(`Ошибка сервера (${res.status})`);
      }
    } catch (err: any) {
      setDetailError('Ошибка сети при загрузке детальной статистики аккаунта');
    } finally {
      setIsDetailLoading(false);
    }
  };

  // Fetch operator metrics for current shift/period
  const fetchShiftOperators = async (
    pMode: 'today' | 'yesterday' | 'week' | 'month' = periodMode,
    sIndex: 1 | 2 | 3 | 4 = selectedShiftIndex,
    sb: 'messages' | 'reply_time' | 'ppv_sent' | 'ppv_sold' | 'earnings' = sortBy,
    sd: 'asc' | 'desc' = sortDir
  ) => {
    const requestId = ++operatorRequest.current;
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
      params.set('resource', 'shift-operators');

      const url = `/api/onlymonster/analytics?${params.toString()}`;
      const res = await fetch(url);
      if (requestId !== operatorRequest.current) return;
      if (res.ok) {
        const data = await res.json();
        if (requestId !== operatorRequest.current) return;
        if (data.success) {
          setShiftInfo(data.shift || null);
          setOperators(data.operators || []);
          setHasLoadedOperators(true);
          setOperatorsUpdatedAt(Date.now());
        } else {
          setOperatorsError(data.error || 'Не удалось загрузить метрики операторов');
        }
      } else {
        setOperatorsError(`Ошибка сервера (${res.status})`);
      }
    } catch (e: any) {
      if (requestId === operatorRequest.current) setOperatorsError('Ошибка сети при загрузке метрик операторов');
    } finally {
      if (requestId === operatorRequest.current) setIsOperatorsLoading(false);
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
  const fetchShiftComparison = async (
    mode: 'today' | 'yesterday' | 'week' = shiftCompMode,
    accountsList: OnlyMonsterAccount[] = accounts
  ) => {
    const requestId = (comparisonRequest.current[mode] || 0) + 1;
    comparisonRequest.current[mode] = requestId;
    const isSelected = () => comparisonModeRef.current === mode && comparisonRequest.current[mode] === requestId;
    if (isSelected()) { setIsShiftCompLoading(true); setShiftCompError(null); }
    try {
      const params = new URLSearchParams();
      if (mode === 'week') {
        params.append('scope', 'week');
      } else {
        params.append('scope', 'day');
        params.append('day', mode);
      }
      
      const accIds = (accountsList || []).map(a => a.platform_account_id || a.id).filter(Boolean);
      if (accIds.length > 0) {
        params.append('accounts', accIds.join(','));
      }
      params.set('resource', 'shift-comparison');

      const res = await fetch(`/api/onlymonster/analytics?${params.toString()}`);
      if (comparisonRequest.current[mode] !== requestId) return;
      if (res.ok) {
        const data = await res.json();
        if (comparisonRequest.current[mode] !== requestId) return;
        if (data.success) {
          setComparisonByPeriod(prev => ({ ...prev, [mode]: { ...data, updatedAt: Date.now() } }));
        } else {
          if (isSelected()) setShiftCompError(data.error || 'Не удалось загрузить сравнение смен');
        }
      } else {
        if (isSelected()) setShiftCompError(`Ошибка сервера (${res.status})`);
      }
    } catch (e: any) {
      if (isSelected()) setShiftCompError('Ошибка соединения при запросе сравнения смен');
    } finally {
      if (isSelected()) setIsShiftCompLoading(false);
    }
  };

  const handleShiftCompModeChange = (mode: 'today' | 'yesterday' | 'week') => {
    setShiftCompMode(mode);
    comparisonModeRef.current = mode;
    setShiftCompError(null);
    fetchShiftComparison(mode, accounts);
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
      params.set('resource', 'operator-model-breakdown');

      const res = await fetch(`/api/onlymonster/analytics?${params.toString()}`);
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

  const handleSubTabChange = (tab: 'live' | 'models' | 'operator_metrics') => {
    setActiveSubTab(tab);
    if (onNavigateView) {
      onNavigateView(tab === 'operator_metrics' ? 'operators' : tab);
    }
    if (tab === 'models' || tab === 'live') {
      if (accounts.length === 0 && !isLoading) {
        fetchAccounts();
      }
    }
    if (tab === 'operator_metrics' || tab === 'live') {
      if (accounts.length === 0 && !isLoading) {
        fetchAccounts();
      }
      if (!hasLoadedOperators) {
        fetchShiftOperators(periodMode, selectedShiftIndex, sortBy, sortDir);
      }
      if (!shiftCompData) {
        fetchShiftComparison(shiftCompMode, accounts);
      }
    }
  };

  useEffect(() => {
    if (activeView) {
      const targetSubTab = activeView === 'operators' ? 'operator_metrics' : activeView;
      setActiveSubTab(targetSubTab);
      if (targetSubTab === 'models' || targetSubTab === 'live') {
        if (accounts.length === 0 && !isLoading) {
          fetchAccounts();
        }
      }
      if (targetSubTab === 'operator_metrics' || targetSubTab === 'live') {
        if (accounts.length === 0 && !isLoading) {
          fetchAccounts();
        }
        if (!hasLoadedOperators) {
          fetchShiftOperators(periodMode, selectedShiftIndex, sortBy, sortDir);
        }
        if (!shiftCompData) {
          fetchShiftComparison(shiftCompMode, accounts);
        }
      }
    }
  }, [activeView]);

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
      if (breakdownMode || dayMode === 'today') {
        params.append('breakdown', 'true');
      }
      params.set('resource', 'earnings');

      const syncStartTime = Date.now();
      const res = await fetch(`/api/onlymonster/analytics?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && data.success && data.earnings) {
          if (dayMode === 'today') {
            recalculateLiveWebhookIncome();
          }
          setAccounts(prev => {
            const baseList = prev.length > 0 ? prev : accountsList;
            return baseList.map(acc => {
              const entry = data.earnings[acc.platform_account_id] || data.earnings[acc.id];
              if (!entry) {
                return {
                  ...acc,
                  today_earnings: null,
                  earnings_label: dayMode === 'today' ? 'Сегодня' : 'Вчера',
                  earnings_breakdown: null
                };
              }

              let computedEarnings: number | null = null;
              if (entry.breakdown) {
                if (dayMode === 'today') {
                  let sSum = 0;
                  for (let s = 1; s <= currentKyivShiftIndex; s++) {
                    sSum += Number(entry.breakdown[s as 1 | 2 | 3 | 4]) || 0;
                  }
                  computedEarnings = Math.round(sSum * 100) / 100;
                } else {
                  const b = entry.breakdown;
                  computedEarnings = Math.round(((Number(b[1]) || 0) + (Number(b[2]) || 0) + (Number(b[3]) || 0) + (Number(b[4]) || 0)) * 100) / 100;
                }
              } else {
                const rawTotal = typeof entry.total === 'number' ? entry.total : (typeof entry.today === 'number' ? entry.today : null);
                computedEarnings = rawTotal !== null ? Math.round(rawTotal * 100) / 100 : null;
              }

              return {
                ...acc,
                today_earnings: computedEarnings,
                tx_count: typeof entry.tx_count === 'number' ? entry.tx_count : null,
                earnings_label: entry.label || (dayMode === 'today' ? 'Сегодня' : 'Вчера'),
                earnings_breakdown: entry.breakdown || null
              };
            });
          });
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
        if (data.apiKeyConfigured) {
          fetchAccounts();
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
              active_operators: typeof acc.active_operators === 'number' ? acc.active_operators : 0,
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
    fetchShiftComparison(shiftCompMode);
    if (!hasLoadedOperators) {
      fetchShiftOperators(periodMode, selectedShiftIndex, sortBy, sortDir);
    }
  }, []);

  const refreshRef = useRef<() => void>(() => {});
  refreshRef.current = () => {
    if (!isOperatorsLoading) fetchShiftOperators(periodMode, selectedShiftIndex, sortBy, sortDir);
    if (!isShiftCompLoading) {
      fetchShiftComparison('today', accounts);
      if (shiftCompMode !== 'today') fetchShiftComparison(shiftCompMode, accounts);
    }
  };
  useEffect(() => {
    const refresh = () => { if (!document.hidden) refreshRef.current(); };
    const timer = setInterval(refresh, 60000);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearInterval(timer); document.removeEventListener('visibilitychange', refresh);
      operatorRequest.current++;
      Object.keys(comparisonRequest.current).forEach(key => comparisonRequest.current[key]++);
    };
  }, []);
  const previousShift = useRef(currentKyivShiftIndex);
  useEffect(() => {
    if (previousShift.current !== currentKyivShiftIndex) {
      if (periodMode === 'today' && selectedShiftIndex === previousShift.current) {
        setSelectedShiftIndex(currentKyivShiftIndex);
        fetchShiftOperators('today', currentKyivShiftIndex, sortBy, sortDir);
      }
      fetchShiftComparison('today', accounts);
      previousShift.current = currentKyivShiftIndex;
    }
  }, [currentKyivShiftIndex]);

  return (
    <div className="om-workspace ct-legacy">
      {!hideHeaderAndTabs && <div className="om-subnav">
        <div className="om-segment">
          <button aria-pressed={effectiveSubTab === 'live'} onClick={() => handleSubTabChange('live')}><Activity size={15} />LIVE · смены и операторы</button>
          <button aria-pressed={effectiveSubTab === 'models'} onClick={() => handleSubTabChange('models')}><Users size={15} />Аккаунты OnlyMonster</button>
        </div>
        <span className="om-muted">Время Киева · NET после комиссии платформы</span>
      </div>}
      {effectiveSubTab === 'live' && <section className="om-hero">
        <header><h2><Zap size={17} />Текущая смена <span className="om-live-label">LIVE</span></h2><span>{currentShiftTimeRange} · Киев</span></header>
        <div className="om-kpis">
          <div><span title={NET_ESTIMATE_TOOLTIP}>Доход аккаунтов · NET</span><strong className="om-income">{omMoney(currentShiftRevenue)}</strong><small>Сегодня: {omMoney(totalTodaySum)}</small></div>
          <div><span>Продажи в чатах · NET</span><strong>{omMoney(currentShiftSnapshot?.operatorEarnings)}</strong><small>По данным OnlyMonster</small></div>
          <div><span>Сообщения</span><strong>{currentShiftSnapshot?.totalMessages ?? '—'}</strong><small>За текущую смену</small></div>
          <div><span>Операторы</span><strong>{currentShiftSnapshot?.operatorCount ?? '—'}</strong><small>В отчёте смены</small></div>
        </div>
        <footer>{todaySnapshot ? `Снимок на ${new Date(todaySnapshot.updatedAt).toLocaleTimeString('ru-RU', {timeZone: 'Europe/Kyiv', hour:'2-digit', minute:'2-digit'})}${nowTime - todaySnapshot.updatedAt > 120000 ? ' · данные устарели' : ' · автообновление раз в минуту'}` : 'Загрузка сводки OnlyMonster…'}{todaySnapshot?.partial && ' · часть данных недоступна'}</footer>
      </section>}

      {shiftAnalysisEnabled && effectiveSubTab === 'live' && <ShiftAnalysisPanel operatorNames={Object.fromEntries(operators.map(o => [o.user_id, o.name]))} modelNames={Object.fromEntries(accounts.map(a => [String(a.id), a.name]))} />}

      {/* ========================================================================= */}
      {/* 2. TAB "МОДЕЛИ": CONNECTED MODEL ACCOUNTS */}
      {/* ========================================================================= */}
      {effectiveSubTab === 'models' && statusMessage && connStatus !== 'live' && (
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

      {effectiveSubTab === 'models' && (
        <div className="glass-card p-6 rounded-3xl border border-white/10 bg-slate-800/85 space-y-5">
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
              {filteredAccounts.map((acc) => {
                const realOpCount = getOperatorCountForAccount(acc.id);
                return (
                  <div 
                    key={acc.id} 
                    id={`acc-card-${acc.id}`}
                    onClick={() => handleAccountClick(acc)}
                    className="p-4 bg-slate-900/60 rounded-2xl border border-white/5 hover:border-violet-500/50 hover:bg-slate-900/90 hover:scale-[1.01] transition-all cursor-pointer flex flex-col justify-between space-y-4 group shadow-md"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {acc.avatar_url ? (
                          <img 
                            src={acc.avatar_url} 
                            alt={acc.name} 
                            className="w-10 h-10 rounded-xl object-cover border border-violet-500/30 shadow-md"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-900 to-indigo-950 border border-violet-500/30 flex items-center justify-center text-white font-black text-sm font-mono shadow-md">
                            {acc.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <h4 className="text-sm font-black text-white font-mono group-hover:text-violet-300 transition-colors flex items-center gap-1.5">
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
                      <div className="p-2 bg-slate-800/85 rounded-xl border border-white/[0.02]">
                        <span className="text-[8px] uppercase text-slate-500 font-bold block">Операторов</span>
                        <span className={`text-xs font-black block mt-0.5 ${realOpCount > 0 ? 'text-violet-300' : 'text-slate-500'}`}>
                          {realOpCount}
                        </span>
                      </div>

                      <div className="p-2 bg-slate-800/85 rounded-xl border border-white/[0.02]">
                        <span className="text-[8px] uppercase text-slate-500 font-bold block truncate">Транзакций</span>
                        {isEarningsLoading && acc.tx_count === undefined ? (
                          <span className="flex items-center justify-center mt-1">
                            <RefreshCw size={12} className="animate-spin text-violet-400" />
                          </span>
                        ) : typeof acc.tx_count === 'number' ? (
                          <span className="text-xs font-black text-cyan-400 block mt-0.5">
                            {acc.tx_count}
                          </span>
                        ) : (
                          <span className="text-xs font-black text-slate-500 block mt-0.5">
                            —
                          </span>
                        )}
                      </div>

                      <div className="p-2 bg-slate-800/85 rounded-xl border border-white/[0.02]">
                        <span 
                          className="text-[8px] uppercase text-slate-500 font-bold flex items-center gap-0.5 truncate cursor-help"
                          title={NET_ESTIMATE_TOOLTIP}
                        >
                          <span className="truncate">{accountsEarningsDay === 'today' ? 'ДОХОД СЕГОДНЯ · NET' : 'ДОХОД ВЧЕРА · NET'}</span>
                          <Info size={9} className="text-slate-500 shrink-0" />
                        </span>
                        {isEarningsLoading && (acc.today_earnings === undefined && !acc.earnings_breakdown) ? (
                          <span className="flex items-center justify-center mt-1">
                            <RefreshCw size={12} className="animate-spin text-violet-400" />
                          </span>
                        ) : (() => {
                          const netVal = calculateModelNet(acc, accountsEarningsDay);
                          return typeof netVal === 'number' ? (
                            <span className="text-xs font-black text-emerald-400 block mt-0.5">
                              +${netVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-xs font-black text-slate-500 block mt-0.5">
                              —
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                  {/* OPTIONAL 4-SHIFT BREAKDOWN GRID */}
                  {showShiftBreakdown && (
                    <div className="pt-2 border-t border-white/10 space-y-1.5 font-mono">
                      <div className="flex items-center justify-between text-[9px] uppercase font-bold text-slate-400 px-0.5">
                        <span 
                          className="flex items-center gap-1 text-slate-300 cursor-help"
                          title={NET_ESTIMATE_TOOLTIP}
                        >
                          <Clock size={11} className="text-violet-400" />
                          Разбивка по сменам NET ({acc.earnings_label || (accountsEarningsDay === 'today' ? 'Сегодня' : 'Вчера')}):
                          <Info size={10} className="text-slate-400 shrink-0" />
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
                                  : 'bg-slate-800/85 border-white/[0.03]'
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
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* Shared shift control room; legacy race gauges remain available. */}
      {(effectiveSubTab === 'operator_metrics' || effectiveSubTab === 'live') && (
        <div className="om-control-room">
          <section className="om-shift-section">
            <header className="om-section-heading"><h2>Сравнение смен</h2><div className="om-segment">
              {(['today', 'yesterday', 'week'] as const).map((mode, i) => <button key={mode} aria-pressed={shiftCompMode === mode} onClick={() => handleShiftCompModeChange(mode)}>{['Сегодня', 'Вчера', 'Неделя'][i]}</button>)}
            </div></header>
            {shiftCompError && <p className="om-error" role="alert">{shiftCompError} {shiftCompData && 'Показан последний полученный снимок.'}</p>}
            {shiftCompData?.partial && <p className="om-notice">Часть данных недоступна. Итоги могут быть неполными.</p>}
            <div className="om-shift-grid" aria-busy={isShiftCompLoading}>
              {(shiftCompData?.shifts || [1,2,3,4].map(index => ({index, label: ['02:00–08:00','08:00–14:00','14:00–20:00','20:00–02:00'][index-1]}))).map((s: any) => <button key={s.index} className="om-shift-card" disabled={!shiftCompData || s.isFuture || shiftCompMode === 'week'} aria-pressed={shiftCompMode === periodMode && selectedShiftIndex === s.index} onClick={() => { setPeriodMode(shiftCompMode as 'today' | 'yesterday'); setSelectedShiftIndex(s.index); fetchShiftOperators(shiftCompMode, s.index, sortBy, sortDir); }}>
                <span className="om-shift-name">{['Ночь','Утро','День','Вечер'][s.index-1]}<span>{shiftCompMode === 'today' && s.index === currentKyivShiftIndex ? 'В процессе' : s.isFuture ? 'Не началась' : shiftCompData ? (shiftCompMode === 'week' ? 'Среднее за день' : 'Завершена') : 'Загрузка'}</span></span>
                <b>{s.label}</b><strong>{s.isFuture ? '—' : omMoney(shiftCompMode === 'week' ? s.avgEarningsPerDay : s.accountEarnings)}</strong>
                <small>{shiftCompMode === 'week' ? 'Продажи в чатах · NET / день' : 'Доход аккаунтов · NET'}</small>
                <footer><span>Сообщения</span><b>{s.isFuture ? '—' : (shiftCompMode === 'week' ? s.avgMessagesPerDay : s.totalMessages) ?? '—'}</b></footer>
                {shiftCompMode !== 'week' && !s.isFuture && <><div className="om-shift-sales"><span>В чатах</span><b>{omMoney(s.operatorEarnings)}</b></div><div className="om-shift-sales" title="Разница дохода аккаунтов и продаж операторов в чатах. Не является отдельным начислением."><span>Разница</span><b>{omMoney(typeof s.accountEarnings === 'number' && typeof s.operatorEarnings === 'number' ? s.accountEarnings - s.operatorEarnings : null)}</b></div></>}
              </button>)}
            </div>
          </section>
          <section className="om-operators-panel">
            <header className="om-section-heading"><div><h2>Операторы <span className="om-muted">{operators.length || ''}</span></h2><p>{shiftInfo?.label || 'Загрузка периода…'} · Киев{isOperatorsLoading ? ' · обновление…' : operatorsUpdatedAt ? ` · снимок ${new Date(operatorsUpdatedAt).toLocaleTimeString('ru-RU', {timeZone:'Europe/Kyiv',hour:'2-digit',minute:'2-digit'})}` : ''}</p></div>
              <div className="om-actions"><button className="ct-button" aria-pressed={raceMode} onClick={() => setRaceMode(!raceMode)}>Гонка</button><button className="ct-button" onClick={() => setIsTrackModalOpen(true)}>Трэк</button><button className="ct-button" aria-label="Обновить метрики" disabled={isOperatorsLoading || isShiftCompLoading} onClick={() => refreshRef.current()}><RefreshCw size={15} className={isOperatorsLoading || isShiftCompLoading ? 'animate-spin' : ''} /></button><div className="om-segment"><button aria-pressed={!raceMode && operatorView === 'list'} onClick={() => changeOperatorView('list')}>Список</button><button aria-pressed={!raceMode && operatorView === 'cards'} onClick={() => changeOperatorView('cards')}>Карточки</button></div></div>
            </header>
            <div className="om-operator-filters">
              <div className="om-segment">{(['today','yesterday','week','month'] as const).map((mode,i) => <button key={mode} aria-pressed={periodMode === mode} onClick={() => handlePeriodChange(mode)}>{['Сегодня','Вчера','Неделя','Месяц'][i]}</button>)}</div>
              <div className="om-actions"><input type="search" placeholder="Найти оператора…" aria-label="Найти оператора" value={operatorSearch} onChange={e => setOperatorSearch(e.target.value)} /><select aria-label="Сортировка операторов" value={sortBy} onChange={e => handleSortChange(e.target.value as typeof sortBy)}><option value="messages">Сообщения</option><option value="reply_time">Время ответа</option><option value="ppv_sent">PPV отправлено</option><option value="ppv_sold">PPV продано</option><option value="earnings">Доход</option></select><button className="ct-button" aria-label="Изменить направление сортировки" onClick={() => handleSortChange(sortBy)}>{sortDir === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />}</button></div>
            </div>
            {(periodMode === 'today' || periodMode === 'yesterday') && <div className="om-shift-picker">{(['02:00–08:00','08:00–14:00','14:00–20:00','20:00–02:00']).map((label,i) => <button key={label} disabled={periodMode === 'today' && i+1 > currentKyivShiftIndex} aria-pressed={selectedShiftIndex === i+1} onClick={() => handleShiftChange((i+1) as 1|2|3|4)}>{label}</button>)}</div>}
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
          ) : !raceMode ? (
            <OnlyMonsterOperators operators={visibleOperators} view={operatorView} formatDuration={formatDuration} onDetail={setSelectedOperatorForDeepStats}
              getRank={op => operators.findIndex(item => item.user_id === op.user_id) + 1}
              highlightRanks={sortBy === 'reply_time' ? sortDir === 'asc' : sortDir === 'desc'}
              isHandover={op => isHandoverTailOperator(op, shiftInfo?.start, lastOutgoingAtByAccount)}
              renderModels={(op, avatars) => {
                const models = (op.creator_ids || []).map(id => accounts.find(a => String(a.id) === String(id))).filter((acc): acc is OnlyMonsterAccount => !!acc && !isAccountHidden(acc.name));
                if (avatars && !models.length) return <span className="om-model-avatar om-model-avatar-empty" title="Нет привязанных моделей"><User size={15} /></span>;
                return models.map(acc => <button key={acc.id} className={avatars ? 'om-model-avatar' : undefined} title={`Метрики модели: ${acc.name}`} aria-label={`Метрики модели: ${acc.name}`} onClick={e => handleModelAvatarClick(e, op.user_id, op.name, acc.id, acc.name, acc.avatar_url)}>
                  {avatars ? <><span aria-hidden="true">{acc.name.replace(/[^\p{L}\p{N}]/gu, '').slice(0, 1).toUpperCase() || 'M'}</span>{acc.avatar_url && <img key={acc.avatar_url} src={acc.avatar_url} alt="" loading="lazy" onError={e => { e.currentTarget.style.display = 'none'; }} />}</> : acc.name}
                </button>);
              }} />
          ) : (
            <div className="om-race-view space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleOperators.map((op, index) => {
                  const rank = index + 1;
                  const ppvConversion = op.paid_messages_count > 0 
                    ? Math.round((op.sold_messages_count / op.paid_messages_count) * 100)
                    : null;
                  const isHighlighted = highlightedOpId === op.user_id;

                  return (
                    <div 
                      key={op.user_id || index}
                      id={`op-card-${op.user_id}`}
                      className={`p-4 rounded-2xl transition-all duration-500 flex flex-col justify-between space-y-4 font-mono group ${
                        isHighlighted
                          ? 'bg-slate-900 border-2 border-rose-500 shadow-[0_0_25px_rgba(244,63,94,0.5)] scale-[1.02] z-10'
                          : raceMode
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
                              'bg-slate-900 text-slate-400 border border-white/10'
                          }`}>
                            {rank === 1 ? <Award size={16} /> : `#${rank}`}
                          </div>

                          {/* MODEL AVATARS STACK */}
                          {(() => {
                            const matchedAccounts = (op.creator_ids || [])
                              .map(id => accounts.find(a => String(a.id) === String(id)))
                              .filter(a => a && !isAccountHidden(a.name)) as OnlyMonsterAccount[];

                            if (matchedAccounts.length === 0) {
                              return (
                                <div 
                                  title="Нет привязанных моделей"
                                  className="w-10 h-10 rounded-full bg-slate-900 border border-white/10 flex items-center justify-center text-slate-500 shrink-0 shadow-sm"
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
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-sm font-black text-white truncate group-hover:text-violet-300 transition-colors">
                                {op.name}
                              </h4>
                              {isHandoverTailOperator(op, shiftInfo?.start, lastOutgoingAtByAccount) && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-white/10 inline-flex items-center shrink-0">
                                  Передал смену
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 block truncate">
                              ID: {op.user_id || '—'}
                            </span>
                          </div>
                        </div>

                        {/* RIGHT ACTION/BADGE GROUP: EARNINGS BADGE + DEEP STATS ICON BUTTON */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <div 
                            className="shrink-0"
                            title={NET_ESTIMATE_TOOLTIP}
                          >
                            <div className={`px-2.5 py-1 rounded-xl font-black text-xs sm:text-sm tracking-tight shadow-sm whitespace-nowrap transition-all duration-500 flex items-center gap-1 cursor-help ${
                              raceMode
                                ? 'bg-blue-950/80 border border-cyan-400/50 text-cyan-300 shadow-[0_0_10px_rgba(56,189,248,0.2)]'
                                : 'bg-emerald-950/20 border border-emerald-500/30 text-emerald-400'
                            }`}>
                              <span>{op.earnings && op.earnings > 0 ? `+$${op.earnings}` : `$${op.earnings ?? 0}`}</span>
                              <span className="text-[9px] font-bold opacity-75">NET</span>
                              <Info size={10} className="opacity-60" />
                            </div>
                          </div>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedOperatorForDeepStats(op);
                            }}
                            title="Подробнее"
                            aria-label="Подробнее"
                            className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-violet-600/15 hover:bg-violet-600/30 border border-violet-500/30 hover:border-violet-500/60 text-violet-300 hover:text-white flex items-center justify-center transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm group/btn shrink-0"
                          >
                            <Activity size={14} className="text-violet-400 group-hover/btn:scale-110 transition-transform" />
                          </button>
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

          </section>

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

      {effectiveSubTab === 'live' && <RealtimeEventFeed accounts={accounts} onAccountClick={handleAccountClick} onNavigateToAccountsTab={() => handleSubTabChange('models')} />}

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

      {/* ACCOUNT DETAIL MODAL */}
      {selectedAccountForDetail && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setSelectedAccountForDetail(null)}
        >
          <div 
            className="bg-slate-900 border border-white/15 rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6 font-mono text-slate-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/10">
              <div className="flex items-center gap-3.5">
                {selectedAccountForDetail.avatar_url ? (
                  <img 
                    src={selectedAccountForDetail.avatar_url} 
                    alt={selectedAccountForDetail.name} 
                    className="w-12 h-12 rounded-2xl object-cover border border-violet-500/40 shadow-lg"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-800 to-indigo-950 border border-violet-500/40 flex items-center justify-center text-white font-black text-lg shadow-lg">
                    {selectedAccountForDetail.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="text-lg font-black text-white flex items-center gap-2">
                    {selectedAccountForDetail.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    {selectedAccountForDetail.handle && (
                      <span className="text-xs text-slate-400">@{selectedAccountForDetail.handle}</span>
                    )}
                    <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-violet-500/20 text-violet-300 border border-violet-500/30">
                      {selectedAccountForDetail.platform || 'OnlyFans'}
                    </span>
                    <span className="text-[9px] uppercase font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-white/10">
                      Период: {accountsEarningsDay === 'today' ? 'Сегодня' : 'Вчера'}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedAccountForDetail(null)}
                className="p-2 text-slate-400 hover:text-white bg-slate-900 hover:bg-slate-800 rounded-xl border border-white/10 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            {isDetailLoading ? (
              <div className="p-12 text-center space-y-3">
                <RefreshCw size={28} className="animate-spin text-violet-400 mx-auto" />
                <p className="text-sm text-slate-400 font-bold">Загрузка детальной статистики за смену...</p>
              </div>
            ) : detailError ? (
              <div className="p-6 bg-rose-950/30 border border-rose-500/30 rounded-2xl text-center space-y-2">
                <AlertCircle size={24} className="text-rose-400 mx-auto" />
                <p className="text-sm font-bold text-rose-300">{detailError}</p>
              </div>
            ) : accountDetailData ? (
              <div className="space-y-6">
                {/* 4 Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 bg-slate-900/80 border border-emerald-500/20 rounded-2xl text-center space-y-1">
                    <span className="text-[9px] font-bold uppercase text-slate-400 block">Доход</span>
                    <span className="text-base font-black text-emerald-400 block">
                      +${accountDetailData.summary?.totalAmount ?? 0}
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-900/80 border border-cyan-500/20 rounded-2xl text-center space-y-1">
                    <span className="text-[9px] font-bold uppercase text-slate-400 block">Транзакций</span>
                    <span className="text-base font-black text-cyan-400 block">
                      {accountDetailData.summary?.totalTransactions ?? 0}
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-900/80 border border-violet-500/20 rounded-2xl text-center space-y-1">
                    <span className="text-[9px] font-bold uppercase text-slate-400 block">Новых подписок</span>
                    <span className="text-base font-black text-violet-300 block">
                      {accountDetailData.subscriptions?.new ?? 0}
                    </span>
                  </div>

                  <div className="p-3.5 bg-slate-900/80 border border-amber-500/20 rounded-2xl text-center space-y-1">
                    <span className="text-[9px] font-bold uppercase text-slate-400 block">Продлений</span>
                    <span className="text-base font-black text-amber-300 block">
                      {accountDetailData.subscriptions?.renewals ?? 0}
                    </span>
                  </div>
                </div>

                {/* Transactions By Type Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase text-violet-300 flex items-center gap-2">
                      <Receipt size={14} className="text-violet-400" />
                      Транзакции по типам
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      Всего: {accountDetailData.transactionsByType?.length ?? 0} типов
                    </span>
                  </div>

                  {(!accountDetailData.transactionsByType || accountDetailData.transactionsByType.length === 0) ? (
                    <div className="p-4 bg-slate-900/40 rounded-xl border border-white/5 text-center text-xs text-slate-500">
                      Нет транзакций за выбранную смену / день
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {accountDetailData.transactionsByType.map((item: any, idx: number) => {
                        const typeLabel = (() => {
                          const t = (item.type || '').toLowerCase();
                          if (t === 'tip') return 'Чаевые';
                          if (t === 'message payment' || t === 'message_payment') return 'Оплата сообщений';
                          if (t === 'recurring subscription' || t === 'recurring_subscription' || t === 'subscription') return 'Продление подписки';
                          if (t === 'post purchase' || t === 'post_purchase') return 'Покупка поста';
                          if (t === 'live stream' || t === 'live_stream') return 'Лайв-стрим';
                          if (t === 'unknown') return 'Прочее';
                          return item.type;
                        })();

                        return (
                          <div 
                            key={idx}
                            className="p-3 bg-slate-900/70 border border-white/5 rounded-xl flex items-center justify-between gap-3 hover:border-violet-500/30 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400">
                                <DollarSign size={14} />
                              </div>
                              <div>
                                <span className="text-xs font-bold text-slate-100 block">{typeLabel}</span>
                                <span className="text-[9px] text-slate-500 font-mono">{item.type}</span>
                              </div>
                            </div>

                            <div className="text-right">
                              <span className="text-xs font-black text-emerald-400 block">+${item.totalAmount}</span>
                              <span className="text-[10px] text-slate-400 font-bold">{item.count} тр.</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Subscriptions Section */}
                <div className="space-y-3 pt-3 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black uppercase text-violet-300 flex items-center gap-2">
                      <UserCheck size={14} className="text-violet-400" />
                      Детализация подписок
                    </h4>
                    <span className="text-[10px] text-slate-400 font-mono">
                      Всего записей: {
                        accountDetailData.summary?.totalSubscriptions ?? 
                        ((accountDetailData.subscriptions?.new ?? 0) + 
                         (accountDetailData.subscriptions?.renewals ?? 0) + 
                         (accountDetailData.subscriptions?.returned ?? 0) + 
                         (accountDetailData.subscriptions?.unknownAction ?? 0))
                      }
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-slate-900/70 border border-white/5 rounded-xl flex items-center justify-between">
                      <span className="text-slate-400 font-bold">Новые подписки:</span>
                      <span className="font-black text-violet-300 text-sm">
                        {accountDetailData.subscriptions?.new ?? 0}
                      </span>
                    </div>

                    <div className="p-3 bg-slate-900/70 border border-white/5 rounded-xl flex items-center justify-between">
                      <span className="text-slate-400 font-bold">Продления:</span>
                      <span className="font-black text-amber-300 text-sm">
                        {accountDetailData.subscriptions?.renewals ?? 0}
                      </span>
                    </div>

                    {(accountDetailData.subscriptions?.returned ?? 0) > 0 && (
                      <div className="p-3 bg-slate-900/70 border border-rose-500/20 rounded-xl flex items-center justify-between">
                        <span className="text-slate-400 font-bold">Возвраты:</span>
                        <span className="font-black text-rose-300 text-sm">
                          {accountDetailData.subscriptions?.returned}
                        </span>
                      </div>
                    )}

                    {(accountDetailData.subscriptions?.unknownAction ?? 0) > 0 && (
                      <div className="p-3 bg-slate-900/70 border border-slate-500/20 rounded-xl flex items-center justify-between">
                        <span className="text-slate-400 font-bold">Неизвестно:</span>
                        <span className="font-black text-slate-300 text-sm">
                          {accountDetailData.subscriptions?.unknownAction}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Subscriptions breakdown by type */}
                  {accountDetailData.subscriptions?.byType && Object.keys(accountDetailData.subscriptions.byType).length > 0 && (
                    <div className="space-y-2 pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-400 uppercase block">
                          Типы планов подписок:
                        </span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Сумма по типам: {
                            Object.values(accountDetailData.subscriptions.byType).reduce((acc: number, val: any) => acc + (Number(val) || 0), 0)
                          }
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(accountDetailData.subscriptions.byType).map(([sType, count]: [string, any], sIdx: number) => {
                          const subLabel = (() => {
                            const st = sType.toLowerCase();
                            if (st === 'regular') return 'Обычная';
                            if (st === 'promo') return 'Промо';
                            if (st === 'trial') return 'Триал';
                            if (st === 'personal_trial') return 'Личный триал';
                            if (st === 'discount') return 'Скидка';
                            if (st === 'bundle') return 'Пакет';
                            if (st === 'auto') return 'Авто-продление';
                            if (st === 'unknown') return 'Неизвестный тип';
                            return sType;
                          })();

                          return (
                            <span 
                              key={sIdx}
                              className="px-2.5 py-1 bg-slate-900 border border-violet-500/20 rounded-lg text-[10px] font-mono flex items-center gap-1.5 text-slate-300"
                            >
                              <span className="font-bold text-violet-300">{subLabel}:</span>
                              <span className="font-black text-white">{count}</span>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* OPERATOR DEEP STATS MODAL */}
      {selectedOperatorForDeepStats && (
        <OperatorDeepStatsModal
          operator={selectedOperatorForDeepStats}
          onClose={() => setSelectedOperatorForDeepStats(null)}
          currentShiftLabel={shiftInfo?.label}
          currentSortBy={sortBy}
        />
      )}
    </div>
  );
};

export const OnlyMonsterLiveTab: React.FC<Omit<OnlyMonsterTabProps, 'activeView'>> = (props) => (
  <OnlyMonsterTab {...props} activeView="live" hideHeaderAndTabs />
);

export const OnlyMonsterOperatorsTab: React.FC<Omit<OnlyMonsterTabProps, 'activeView'>> = (props) => (
  <OnlyMonsterTab {...props} activeView="operators" hideHeaderAndTabs />
);

export const OnlyMonsterModelsTab: React.FC<Omit<OnlyMonsterTabProps, 'activeView'>> = (props) => (
  <OnlyMonsterTab {...props} activeView="models" hideHeaderAndTabs />
);


