import React, { useEffect, useRef, useState } from 'react';
import {
  Crown,
  Flame,
  Zap,
  Sparkles,
  Clock,
  Trophy,
  Volume2,
  VolumeX,
  Target,
  ChevronUp
} from 'lucide-react';
import { getLapInfo } from './trackLogic';

export interface ShiftOperator {
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

export interface RaceEvent {
  id: string;
  type: 'gain' | 'overtake' | 'lap' | 'leader' | 'gap';
  text: string;
  timestamp: number;
}

interface LiveCameraRaceSceneProps {
  operators: ShiftOperator[];
  hiddenOperatorIds: Set<string>;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  isShiftEnded: boolean;
  remainingTimeText: string | null;
  shiftInfo: { label: string; start: string; end: string } | null;
  eventsFeed: RaceEvent[];
  overtakingOpIds: Map<string, number>;
  selectedOperatorId: string | null;
  onSelectOperator: (id: string | null) => void;
  prefersReducedMotion: boolean;
  isCurrentActiveShift: boolean;
}

interface OperatorAnimNode {
  userId: string;
  // Positions
  currX: number;
  targetX: number;
  baseY: number;        // Target Y based on messages & ranking
  currY: number;        // Smoothly lerped Y base position
  boostYOffset: number; // Temporary forward offset (negative Y = forward)
  boostScale: number;   // Body scale factor (1.0 to 1.06)
  
  // Counters & Boost state
  lastProcessedMsgs: number;
  displayedMsgs: number;
  targetMsgs: number;
  deltaMsgs: number;
  boostBadge: string | null; // e.g. "+2", "⚡ +5", "🚀 BOOST +12"
  boostTimer: number;        // Frames remaining for boost effect
  maxBoostFrames: number;
  
  // Lane & Overtake
  currLane: number;
  targetLane: number;
  isOvertaking: boolean;
}

// Deterministic hash for stable base lane assignment
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

// Preset distinct car livery colors by rank & index
const CAR_COLORS = [
  { primary: '#f59e0b', accent: '#fef08a', glow: '#f59e0b', name: 'Gold Leader' },
  { primary: '#38bdf8', accent: '#bae6fd', glow: '#06b6d4', name: 'Cyan Stealth' },
  { primary: '#f97316', accent: '#ffedd5', glow: '#ea580c', name: 'Copper Nitro' },
  { primary: '#a855f7', accent: '#f3e8ff', glow: '#9333ea', name: 'Violet Venom' },
  { primary: '#10b981', accent: '#d1fae5', glow: '#059669', name: 'Emerald Rush' },
  { primary: '#ec4899', accent: '#fce7f3', glow: '#db2777', name: 'Rose Phantom' },
  { primary: '#6366f1', accent: '#e0e7ff', glow: '#4f46e5', name: 'Indigo Apex' },
  { primary: '#eab308', accent: '#fef9c3', glow: '#ca8a04', name: 'Yellow Fury' },
  { primary: '#06b6d4', accent: '#cffafe', glow: '#0891b2', name: 'Teal Velocity' },
  { primary: '#f43f5e', accent: '#ffe4e6', glow: '#e11d48', name: 'Crimson Pulse' },
];

export const LiveCameraRaceScene: React.FC<LiveCameraRaceSceneProps> = ({
  operators,
  hiddenOperatorIds,
  sortBy,
  sortDir,
  isShiftEnded,
  remainingTimeText,
  shiftInfo,
  eventsFeed,
  overtakingOpIds,
  selectedOperatorId,
  onSelectOperator,
  prefersReducedMotion,
  isCurrentActiveShift,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Mute audio state toggle
  const [isMuted, setIsMuted] = useState(true);

  // Anim state stored in Ref for continuous RAF rendering
  const animNodesRef = useRef<Record<string, OperatorAnimNode>>({});

  // Camera zoom & pan state
  const cameraRef = useRef<{ scale: number; x: number; y: number; targetScale: number; targetY: number }>({
    scale: 1,
    x: 0,
    y: 0,
    targetScale: 1,
    targetY: 0,
  });

  // Active overtake banners overlay state
  const [activeOvertakeBanner, setActiveOvertakeBanner] = useState<{ text: string; id: string } | null>(null);

  // React state tick for DOM driver badges positioning
  const [positionsTick, setPositionsTick] = useState<
    Record<string, { x: number; y: number; rank: number; deltaMsgs: number; boostBadge: string | null; isLeader: boolean }>
  >({});

  // Visible operators sorted by current message count
  const visibleOperators = operators.filter((o) => !hiddenOperatorIds.has(o.user_id));
  const sortedOperators = [...visibleOperators].sort((a, b) => b.messages_count - a.messages_count);

  const numVisible = visibleOperators.length;
  const numLanes = numVisible >= 7 ? 5 : 4; // Adaptive 4 or 5 lanes!

  const leaderOp = sortedOperators[0] || null;
  const secondOp = sortedOperators[1] || null;

  // Gap between #1 and #2
  const gapValue = leaderOp && secondOp ? Math.max(0, leaderOp.messages_count - secondOp.messages_count) : 0;

  // Closest battle detection (gap <= 10)
  let battleOps: { op1: ShiftOperator; op2: ShiftOperator; gap: number; rank1: number } | null = null;
  for (let i = 0; i < sortedOperators.length - 1; i++) {
    const gap = sortedOperators[i].messages_count - sortedOperators[i + 1].messages_count;
    if (gap <= 10) {
      battleOps = {
        op1: sortedOperators[i],
        op2: sortedOperators[i + 1],
        gap,
        rank1: i + 1,
      };
      break;
    }
  }

  // Handle snapshot updates and overtake banner triggers
  useEffect(() => {
    if (overtakingOpIds.size > 0) {
      overtakingOpIds.forEach((rankDelta, opId) => {
        const op = sortedOperators.find((o) => o.user_id === opId);
        if (op) {
          const rank = sortedOperators.findIndex((o) => o.user_id === opId) + 1;
          const bannerText = `🔥 ОБГОН! ${op.name.toUpperCase()} ВЫХОДИТ НА #${rank}`;
          setActiveOvertakeBanner({ text: bannerText, id: `${opId}-${Date.now()}` });

          // Trigger camera focus zoom onto overtaking operator
          cameraRef.current.targetScale = prefersReducedMotion ? 1.0 : 1.18;

          setTimeout(() => {
            setActiveOvertakeBanner(null);
            cameraRef.current.targetScale = 1.0;
          }, 3500);
        }
      });
    }
  }, [overtakingOpIds, prefersReducedMotion]);

  // Main RAF loop & Canvas renderer
  useEffect(() => {
    let rafId: number;
    let scrollOffset = 0;
    let particlePool: { x: number; y: number; speed: number; size: number; opacity: number }[] = [];

    // Initialize particle pool for wind / speed lines
    for (let i = 0; i < 50; i++) {
      particlePool.push({
        x: Math.random(),
        y: Math.random(),
        speed: 0.008 + Math.random() * 0.02,
        size: 1 + Math.random() * 2.5,
        opacity: 0.2 + Math.random() * 0.7,
      });
    }

    const render = () => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) {
        rafId = requestAnimationFrame(render);
        return;
      }

      const rect = container.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;

      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        rafId = requestAnimationFrame(render);
        return;
      }

      // --- 1. CALCULATE COMPRESSED VERTICAL POSITIONS & ADAPTIVE LANES ---
      const visOps = operators.filter((o) => !hiddenOperatorIds.has(o.user_id));
      const sorted = [...visOps].sort((a, b) => b.messages_count - a.messages_count);

      const rankMap = new Map<string, number>();
      sorted.forEach((op, idx) => rankMap.set(op.user_id, idx + 1));

      const leaderMsgs = sorted[0]?.messages_count || 0;
      const lowestMsgs = sorted[sorted.length - 1]?.messages_count || 0;
      const maxGap = Math.max(1, leaderMsgs - lowestMsgs);

      // Adaptive lane layout (4 vs 5 lanes)
      const currentNumLanes = visOps.length >= 7 ? 5 : 4;
      const roadWidth = Math.min(W * (currentNumLanes === 5 ? 0.82 : 0.74), currentNumLanes === 5 ? 580 : 500);
      const roadLeft = (W - roadWidth) / 2;
      const laneWidth = roadWidth / currentNumLanes;

      const topY = H * 0.16;
      const bottomY = H * 0.82;

      // Track lane occupancy to avoid overlaps
      const laneOccupancy: Record<number, number[]> = {};
      for (let l = 0; l < currentNumLanes; l++) laneOccupancy[l] = [];

      const nextTickPositions: Record<
        string,
        { x: number; y: number; rank: number; deltaMsgs: number; boostBadge: string | null; isLeader: boolean }
      > = {};

      sorted.forEach((op) => {
        const rank = rankMap.get(op.user_id) || 1;
        const gap = Math.max(0, leaderMsgs - op.messages_count);

        // Logarithmic compressed distance formula
        const normalizedGap = maxGap > 0 ? Math.log1p(gap) / Math.log1p(maxGap) : 0;
        let targetY = topY + normalizedGap * (bottomY - topY);

        // Base lane determined deterministically by operatorId
        let baseLane = hashString(op.user_id) % currentNumLanes;

        // Collision avoidance: if another car is within 56px Y in same lane, shift lane
        let assignedLane = baseLane;
        for (let l = 0; l < currentNumLanes; l++) {
          const testLane = (baseLane + l) % currentNumLanes;
          const collision = laneOccupancy[testLane]?.some((y) => Math.abs(y - targetY) < 56);
          if (!collision) {
            assignedLane = testLane;
            break;
          }
        }
        if (!laneOccupancy[assignedLane]) laneOccupancy[assignedLane] = [];
        laneOccupancy[assignedLane].push(targetY);

        const targetX = roadLeft + assignedLane * laneWidth + laneWidth / 2;

        // Retrieve or initialize operator node state
        let node = animNodesRef.current[op.user_id];
        if (!node) {
          node = {
            userId: op.user_id,
            currX: targetX,
            targetX,
            baseY: targetY,
            currY: targetY,
            boostYOffset: 0,
            boostScale: 1.0,
            lastProcessedMsgs: op.messages_count,
            displayedMsgs: op.messages_count,
            targetMsgs: op.messages_count,
            deltaMsgs: 0,
            boostBadge: null,
            boostTimer: 0,
            maxBoostFrames: 60,
            currLane: assignedLane,
            targetLane: assignedLane,
            isOvertaking: false,
          };
          animNodesRef.current[op.user_id] = node;
        } else {
          node.targetX = targetX;
          node.baseY = targetY;
          node.targetLane = assignedLane;
          node.targetMsgs = op.messages_count;

          // Check if real new snapshot messages arrived!
          const realDelta = op.messages_count - node.lastProcessedMsgs;
          if (realDelta > 0) {
            node.deltaMsgs = realDelta;
            node.lastProcessedMsgs = op.messages_count;

            // Trigger visual BOOST scaled by delta level
            let maxImpulse = 10;
            let targetScale = 1.02;
            let badgeText = `+${realDelta}`;
            let boostFrames = 45;

            if (realDelta >= 10) {
              maxImpulse = 38;
              targetScale = 1.06;
              badgeText = `🚀 BOOST +${realDelta}`;
              boostFrames = 90;
            } else if (realDelta >= 6) {
              maxImpulse = 28;
              targetScale = 1.05;
              badgeText = `⚡ +${realDelta}`;
              boostFrames = 75;
            } else if (realDelta >= 3) {
              maxImpulse = 18;
              targetScale = 1.035;
              badgeText = `⚡ +${realDelta}`;
              boostFrames = 60;
            }

            if (prefersReducedMotion) {
              targetScale = 1.0;
              maxImpulse = 10;
            }

            node.boostYOffset = -maxImpulse; // Negative Y moves forward on canvas
            node.boostScale = targetScale;
            node.boostBadge = badgeText;
            node.boostTimer = boostFrames;
            node.maxBoostFrames = boostFrames;
          }
        }

        // --- UPDATE BOOST & ANIMATION STEPS ---
        // 1. Lerp base Y towards target Y
        node.currY += (node.baseY - node.currY) * 0.08;
        node.currX += (node.targetX - node.currX) * 0.08;

        // 2. Roll displayed messages count smoothly
        node.displayedMsgs += (node.targetMsgs - node.displayedMsgs) * 0.1;
        if (Math.abs(node.targetMsgs - node.displayedMsgs) < 0.1) {
          node.displayedMsgs = node.targetMsgs;
        }

        // 3. Smoothly decay boostYOffset back to 0 without backward jerky motion
        if (node.boostTimer > 0) {
          node.boostTimer--;
          const progress = node.boostTimer / node.maxBoostFrames; // 1 down to 0
          // Smooth decay using cubic easing
          node.boostYOffset *= 0.94;
          node.boostScale = 1.0 + (node.boostScale - 1.0) * 0.94;
        } else {
          node.boostYOffset *= 0.85;
          if (Math.abs(node.boostYOffset) < 0.2) node.boostYOffset = 0;
          node.boostScale = 1.0;
          node.boostBadge = null;
        }

        // Effective drawing Y = currY + boostYOffset
        const finalDrawY = node.currY + node.boostYOffset;

        nextTickPositions[op.user_id] = {
          x: node.currX,
          y: finalDrawY,
          rank,
          deltaMsgs: node.deltaMsgs,
          boostBadge: node.boostBadge,
          isLeader: rank === 1,
        };
      });

      setPositionsTick(nextTickPositions);

      // --- 2. CAMERA LERP & TRANSFORM ---
      const cam = cameraRef.current;
      cam.scale += (cam.targetScale - cam.scale) * 0.05;

      ctx.save();
      ctx.clearRect(0, 0, W, H);

      // Apply camera transform
      ctx.translate(W / 2, H / 2);
      ctx.scale(cam.scale, cam.scale);
      ctx.translate(-W / 2, -H / 2);

      // --- 3. DRAW ENVIRONMENT & BACKGROUND HIGHWAY ---
      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, W, H);

      // Scroll speed delta
      const scrollSpeed = prefersReducedMotion ? 1 : 5.5;
      scrollOffset = (scrollOffset + scrollSpeed) % 60;

      // Outer terrain grid
      ctx.strokeStyle = 'rgba(30, 41, 59, 0.35)';
      ctx.lineWidth = 1;
      for (let y = scrollOffset - 60; y < H + 60; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(W, y);
        ctx.stroke();
      }

      // Asphalt Road Bed
      const roadGradient = ctx.createLinearGradient(roadLeft, 0, roadLeft + roadWidth, 0);
      roadGradient.addColorStop(0, '#0f172a');
      roadGradient.addColorStop(0.15, '#1e293b');
      roadGradient.addColorStop(0.5, '#0f172a');
      roadGradient.addColorStop(0.85, '#1e293b');
      roadGradient.addColorStop(1, '#0f172a');

      ctx.fillStyle = roadGradient;
      ctx.fillRect(roadLeft, 0, roadWidth, H);

      // Outer Red-and-White Rumble Strips (Kerbs)
      const kerbWidth = 12;
      const kerbHeight = 32;

      for (let y = (scrollOffset % (kerbHeight * 2)) - kerbHeight * 2; y < H + kerbHeight * 2; y += kerbHeight * 2) {
        // Left Kerb
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(roadLeft - kerbWidth, y, kerbWidth, kerbHeight);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(roadLeft - kerbWidth, y + kerbHeight, kerbWidth, kerbHeight);

        // Right Kerb
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(roadLeft + roadWidth, y, kerbWidth, kerbHeight);
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(roadLeft + roadWidth, y + kerbHeight, kerbWidth, kerbHeight);
      }

      // Outer Highway Laser Barriers
      ctx.shadowColor = '#06b6d4';
      ctx.shadowBlur = 14;
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 3;

      ctx.beginPath();
      ctx.moveTo(roadLeft, 0);
      ctx.lineTo(roadLeft, H);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(roadLeft + roadWidth, 0);
      ctx.lineTo(roadLeft + roadWidth, H);
      ctx.stroke();

      ctx.shadowBlur = 0; // Reset shadow

      // Roadside Light Pillars (scrolling down)
      const pylonDist = 120;
      for (let y = (scrollOffset % pylonDist) - pylonDist; y < H + pylonDist; y += pylonDist) {
        ctx.fillStyle = '#0284c7';
        ctx.fillRect(roadLeft - kerbWidth - 14, y, 8, 16);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(roadLeft - kerbWidth - 12, y + 4, 4, 8);

        ctx.fillStyle = '#0284c7';
        ctx.fillRect(roadLeft + roadWidth + kerbWidth + 6, y, 8, 16);
        ctx.fillStyle = '#38bdf8';
        ctx.fillRect(roadLeft + roadWidth + kerbWidth + 8, y + 4, 4, 8);
      }

      // Moving Dashed Lane Dividers
      ctx.strokeStyle = 'rgba(248, 250, 252, 0.45)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([20, 25]);
      ctx.lineDashOffset = -scrollOffset * 2.5;

      for (let l = 1; l < currentNumLanes; l++) {
        const lx = roadLeft + l * laneWidth;
        ctx.beginPath();
        ctx.moveTo(lx, 0);
        ctx.lineTo(lx, H);
        ctx.stroke();
      }
      ctx.setLineDash([]); // Reset dash

      // Environmental Speed Lines / Wind Particles
      if (!prefersReducedMotion) {
        particlePool.forEach((p) => {
          p.y += p.speed * 2.2;
          if (p.y > 1) p.y = 0;

          const px = p.x * W;
          const py = p.y * H;

          ctx.strokeStyle = `rgba(56, 189, 248, ${p.opacity * 0.45})`;
          ctx.lineWidth = p.size;
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(px, py + 22);
          ctx.stroke();
        });
      }

      // --- 4. DRAW TOP-DOWN HIGH-TECH CARS WITH BOOST EFFECTS ---
      sorted.forEach((op) => {
        const node = animNodesRef.current[op.user_id];
        if (!node) return;

        const rank = rankMap.get(op.user_id) || 1;
        const colorScheme = CAR_COLORS[(rank - 1) % CAR_COLORS.length];
        const cx = node.currX;
        const cy = node.currY + node.boostYOffset; // Include boost offset!

        const isBoosting = node.boostYOffset < -1 || node.boostScale > 1.01;

        const carW = 32 * node.boostScale;
        const carH = 62 * node.boostScale;

        ctx.save();
        ctx.translate(cx, cy);

        // Subtle vibration during speed or boost
        const vibIntensity = isBoosting ? 2.5 : 0.8;
        const vibX = (Math.random() - 0.5) * vibIntensity;
        const vibY = (Math.random() - 0.5) * vibIntensity;
        ctx.translate(vibX, vibY);

        // Ground shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
        ctx.beginPath();
        ctx.ellipse(0, 8, carW * 0.75, carH * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();

        // Rear Exhaust Flame / Energy Jet (extended during boost!)
        const boostTrailBonus = isBoosting ? Math.abs(node.boostYOffset) * 1.5 : 0;
        const trailLen = 18 + boostTrailBonus;
        const fireGrad = ctx.createLinearGradient(0, carH / 2, 0, carH / 2 + trailLen);
        fireGrad.addColorStop(0, colorScheme.glow);
        fireGrad.addColorStop(0.4, '#f97316');
        fireGrad.addColorStop(0.8, '#ef4444');
        fireGrad.addColorStop(1, 'transparent');

        ctx.fillStyle = fireGrad;
        ctx.beginPath();
        ctx.moveTo(-7, carH / 2);
        ctx.lineTo(7, carH / 2);
        ctx.lineTo(0, carH / 2 + trailLen);
        ctx.closePath();
        ctx.fill();

        // Front Headlight Light Beams
        const lightGrad = ctx.createLinearGradient(0, -carH / 2, 0, -carH / 2 - (isBoosting ? 90 : 70));
        lightGrad.addColorStop(0, 'rgba(254, 240, 138, 0.7)');
        lightGrad.addColorStop(1, 'transparent');

        ctx.fillStyle = lightGrad;
        ctx.beginPath();
        ctx.moveTo(-12, -carH / 2);
        ctx.lineTo(-28, -carH / 2 - (isBoosting ? 90 : 70));
        ctx.lineTo(28, -carH / 2 - (isBoosting ? 90 : 70));
        ctx.lineTo(12, -carH / 2);
        ctx.closePath();
        ctx.fill();

        // Aerodynamic GT/Formula Car Body
        ctx.fillStyle = colorScheme.primary;
        ctx.strokeStyle = isBoosting ? '#ffffff' : colorScheme.accent;
        ctx.lineWidth = isBoosting ? 3 : 2;

        // Main Chassis
        ctx.beginPath();
        ctx.moveTo(0, -carH / 2 - 5);
        ctx.lineTo(carW / 2, -carH / 4);
        ctx.lineTo(carW / 2 + 2, carH / 3);
        ctx.lineTo(carW / 3, carH / 2);
        ctx.lineTo(-carW / 3, carH / 2);
        ctx.lineTo(-carW / 2 - 2, carH / 3);
        ctx.lineTo(-carW / 2, -carH / 4);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Front Splitter & Rear Wing
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(-carW / 2 - 5, -carH / 2 - 3, carW + 10, 6);
        ctx.fillRect(-carW / 2 - 3, carH / 2 - 3, carW + 6, 7);

        // Side Pod Accent Lines
        ctx.strokeStyle = colorScheme.accent;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-carW / 3, -carH / 6);
        ctx.lineTo(-carW / 3, carH / 4);
        ctx.moveTo(carW / 3, -carH / 6);
        ctx.lineTo(carW / 3, carH / 4);
        ctx.stroke();

        // Cockpit Glass
        const glassGrad = ctx.createLinearGradient(0, -12, 0, 8);
        glassGrad.addColorStop(0, '#38bdf8');
        glassGrad.addColorStop(1, '#0284c7');
        ctx.fillStyle = glassGrad;
        ctx.beginPath();
        ctx.ellipse(0, -4, 7, 14, 0, 0, Math.PI * 2);
        ctx.fill();

        // 4 Racing Tires
        ctx.fillStyle = '#020617';
        ctx.fillRect(-carW / 2 - 6, -carH / 3, 6, 14);
        ctx.fillRect(carW / 2, -carH / 3, 6, 14);
        ctx.fillRect(-carW / 2 - 6, carH / 4, 6, 16);
        ctx.fillRect(carW / 2, carH / 4, 6, 16);

        // Leader Crown or Roof Rank Badge
        if (rank === 1) {
          ctx.fillStyle = '#fbbf24';
          ctx.shadowColor = '#fbbf24';
          ctx.shadowBlur = 10;
          ctx.font = '900 14px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('👑', 0, -24);
          ctx.shadowBlur = 0;
        }

        ctx.fillStyle = '#ffffff';
        ctx.font = '900 12px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`#${rank}`, 0, 10);

        ctx.restore();
      });

      ctx.restore(); // Restore camera transform

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);
    return () => {
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [operators, hiddenOperatorIds, prefersReducedMotion]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[540px] sm:min-h-[620px] bg-slate-950 overflow-hidden font-mono select-none rounded-3xl border border-cyan-500/30 shadow-[inset_0_0_80px_rgba(0,0,0,0.9)]"
    >
      {/* BACKGROUND CANVAS FOR HIGHWAY & CARS */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />

      {/* OVERLAY: ACTIVE OVERTAKE BANNER */}
      {activeOvertakeBanner && (
        <div className="absolute top-16 left-1/2 -translate-x-1/2 z-40 pointer-events-none animate-bounce">
          <div className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 via-rose-600 to-amber-500 text-white font-black text-xs sm:text-sm uppercase tracking-widest shadow-[0_0_35px_rgba(244,63,94,0.85)] border border-white/40 flex items-center gap-2">
            <Flame size={18} className="animate-pulse text-amber-300" />
            <span>{activeOvertakeBanner.text}</span>
            <Sparkles size={18} className="animate-pulse text-amber-300" />
          </div>
        </div>
      )}

      {/* TOP LEFT HUD: LIVE STATUS, SHIFT & AUDIO TOGGLE */}
      <div className="absolute top-4 left-4 z-30 pointer-events-none flex flex-col gap-2">
        <div className="px-3.5 py-2 rounded-2xl bg-slate-950/85 border border-cyan-500/40 backdrop-blur-md shadow-xl flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
          </span>
          <div>
            <div className="text-[10px] font-black tracking-widest text-white uppercase flex items-center gap-1.5">
              <span>● LIVE-КАМЕРА</span>
              <span className="text-[9px] text-cyan-400 font-normal">| {numLanes} ПОЛОС</span>
            </div>
            <div className="text-[9px] text-slate-400 font-bold uppercase">
              {shiftInfo?.label ? `СМЕНА ${shiftInfo.label}` : 'ЗАЕЗД 08:00–14:00'}
            </div>
          </div>

          <button
            onClick={() => setIsMuted(!isMuted)}
            className="pointer-events-auto ml-1 p-1.5 rounded-lg bg-slate-900 border border-white/10 hover:border-cyan-400/50 text-slate-400 hover:text-white transition-colors"
            title={isMuted ? 'Звук выключен' : 'Звук включен'}
          >
            {isMuted ? <VolumeX size={13} /> : <Volume2 size={13} className="text-cyan-400" />}
          </button>
        </div>

        {/* Countdown */}
        {isCurrentActiveShift && remainingTimeText && (
          <div className="px-3 py-1.5 rounded-xl bg-slate-950/80 border border-emerald-500/40 text-emerald-300 backdrop-blur-md shadow-lg flex items-center gap-2 text-xs font-bold w-fit">
            <Clock size={13} className="text-emerald-400 animate-pulse" />
            <span>{remainingTimeText}</span>
          </div>
        )}
      </div>

      {/* TOP RIGHT HUD: LEADER SUMMARY CARD */}
      {leaderOp && (
        <div className="absolute top-4 right-4 z-30 pointer-events-none max-w-[210px] sm:max-w-[250px]">
          <div className="p-3 rounded-2xl bg-slate-950/90 border border-amber-500/40 backdrop-blur-md shadow-[0_0_25px_rgba(245,158,11,0.2)] text-left font-mono">
            <div className="flex items-center justify-between text-[9px] font-extrabold uppercase text-amber-400 tracking-wider mb-1">
              <span className="flex items-center gap-1">
                <Crown size={12} className="fill-amber-400 text-amber-400 shrink-0" />
                ЛИДЕР ЗАЕЗДА
              </span>
              <span className="text-amber-300 font-black text-xs">{leaderOp.messages_count}</span>
            </div>

            <div className="text-xs sm:text-sm font-black text-white truncate">{leaderOp.name}</div>

            {secondOp && (
              <div className="mt-1.5 pt-1.5 border-t border-white/10 flex items-center justify-between text-[10px] font-bold">
                <span className="text-slate-400">ОТРЫВ ДО #2:</span>
                <span className="text-emerald-400 font-black">+{gapValue} СООБЩ.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* BOTTOM LEFT HUD: LIVE EVENT TICKER FEED */}
      {eventsFeed.length > 0 && (
        <div className="absolute bottom-4 left-4 z-30 pointer-events-none flex flex-col gap-1.5 max-w-xs sm:max-w-sm">
          {eventsFeed.slice(0, 3).map((evt) => (
            <div
              key={evt.id}
              className="px-3 py-1.5 rounded-xl bg-slate-950/90 border border-cyan-500/40 text-[10px] sm:text-[11px] font-mono font-bold text-cyan-200 shadow-xl backdrop-blur-md animate-fade-in flex items-center gap-1.5"
            >
              <span>{evt.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* BOTTOM CENTER/RIGHT HUD: CLOSE BATTLE DISPLAY */}
      {battleOps && (
        <div className="absolute bottom-4 right-4 z-30 pointer-events-none">
          <div className="px-3.5 py-2 rounded-2xl bg-slate-950/90 border border-rose-500/50 text-rose-200 backdrop-blur-md shadow-[0_0_20px_rgba(244,63,94,0.3)] font-mono text-left space-y-0.5">
            <div className="text-[9px] font-black uppercase tracking-widest text-rose-400 flex items-center gap-1">
              <Zap size={11} className="text-rose-400 fill-rose-400 animate-bounce" />
              <span>БЛИЖАЙШАЯ БОРЬБА ЗА #{battleOps.rank1}</span>
            </div>
            <div className="text-xs font-black text-white flex items-center gap-2">
              <span className="truncate max-w-[90px]">{battleOps.op1.name}</span>
              <span className="text-rose-400">VS</span>
              <span className="truncate max-w-[90px]">{battleOps.op2.name}</span>
            </div>
            <div className="text-[10px] font-bold text-amber-300">
              РАЗРЫВ: {battleOps.gap} {battleOps.gap === 1 ? 'СООБЩЕНИЕ' : 'СООБЩЕНИЙ'}
            </div>
          </div>
        </div>
      )}

      {/* DRIVER LABELS & SELECTION NODES OVERLAY */}
      <div className="absolute inset-0 pointer-events-none">
        {Object.entries(positionsTick).map(([opId, pos]) => {
          const op = operators.find((o) => o.user_id === opId);
          if (!op) return null;

          const isSelected = selectedOperatorId === opId;

          return (
            <div
              key={opId}
              onClick={(e) => {
                e.stopPropagation();
                onSelectOperator(isSelected ? null : opId);
              }}
              className="absolute pointer-events-auto cursor-pointer -translate-x-1/2 -translate-y-1/2 transition-all duration-75"
              style={{
                left: `${pos.x}px`,
                top: `${pos.y - 52}px`,
              }}
            >
              <div
                className={`px-2.5 py-1 rounded-xl border shadow-xl backdrop-blur-md flex items-center gap-2 whitespace-nowrap text-[10px] font-mono select-none transition-all ${
                  isSelected
                    ? 'bg-cyan-950/95 border-cyan-400 text-cyan-200 shadow-cyan-500/50 ring-2 ring-cyan-400 scale-105'
                    : pos.isLeader
                    ? 'bg-amber-950/90 border-amber-400 text-amber-200 ring-1 ring-amber-400/40 shadow-amber-500/20'
                    : 'bg-slate-950/90 border-white/15 text-slate-200 hover:border-cyan-400/60'
                }`}
              >
                <span
                  className={`font-black flex items-center gap-0.5 ${
                    pos.isLeader ? 'text-amber-400' : 'text-slate-400'
                  }`}
                >
                  {pos.isLeader && <Crown size={10} className="fill-amber-400 text-amber-400 shrink-0" />}
                  #{pos.rank}
                </span>

                <span className="font-bold text-white max-w-[75px] sm:max-w-[105px] truncate" title={op.name}>
                  {op.name}
                </span>

                <span className="font-black text-cyan-400">{op.messages_count}</span>

                {/* BOOST BADGE PILL */}
                {pos.boostBadge && (
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-extrabold text-[9px] border border-amber-500/40 animate-pulse flex items-center gap-0.5">
                    {pos.boostBadge}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
