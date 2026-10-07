import React, { useState, useEffect, useRef } from 'react';
import { Volume2, VolumeX, Sparkles, Skull, Eye, Ghost } from 'lucide-react';

// Web Audio synthesizer for spooky sounds (zero external assets needed)
class SpookyAudio {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Lazy initialize on first interaction to abide by browser autoplay policies
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  // Thunder rumble
  public playThunder() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const ctx = this.ctx;

      // White noise buffer
      const bufferSize = ctx.sampleRate * 2.5;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let lastOut = 0.0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        // Brown noise filter
        data[i] = (lastOut + 0.02 * white) / 1.02;
        lastOut = data[i];
        data[i] *= 2.8;
      }

      const noise = ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(350, ctx.currentTime);
      filter.frequency.exponentialRampToValueAtTime(80, ctx.currentTime + 2.2);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.01, ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 2.4);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      noise.start();
    } catch {
      // Audio fallback silent
    }
  }

  // Bat screech / squeak
  public playBatScreech() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const ctx = this.ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(3200, now);
      osc.frequency.linearRampToValueAtTime(5400, now + 0.08);
      osc.frequency.linearRampToValueAtTime(2800, now + 0.16);
      osc.frequency.linearRampToValueAtTime(4600, now + 0.24);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.08, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.26);
    } catch {
      // silent
    }
  }

  // Creepy high wail / wisp
  public playCreepyWail() {
    if (this.isMuted) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      const ctx = this.ctx;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      const now = ctx.currentTime;
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(750, now + 0.6);
      osc.frequency.exponentialRampToValueAtTime(320, now + 1.2);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 0.3);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 1.35);
    } catch {
      // silent
    }
  }
}

const audioFX = new SpookyAudio();

interface BatData {
  id: number;
  startX: number;
  startY: number;
  scale: number;
  duration: number;
  delay: number;
  curve: number; // upward or downward arc
  direction: 'ltr' | 'rtl';
}

function lerpAngle(from: number, to: number, t: number): number {
  let diff = (to - from) % 360;
  if (diff < -180) diff += 360;
  if (diff > 180) diff -= 360;
  return from + diff * t;
}

interface CursorBatConfig {
  id: number;
  scale: number;
  flapDuration: number;
  ease: number;
  friction: number;
  orbitRadius: number;
  orbitSpeed: number;
  orbitPhase: number;
}

const CURSOR_BATS: CursorBatConfig[] = [
  { id: 1, scale: 0.68, flapDuration: 0.16, ease: 0.18, friction: 0.76, orbitRadius: 26, orbitSpeed: 2.2, orbitPhase: 0 },
  { id: 2, scale: 0.52, flapDuration: 0.20, ease: 0.12, friction: 0.80, orbitRadius: 44, orbitSpeed: -1.7, orbitPhase: 2.1 },
  { id: 3, scale: 0.38, flapDuration: 0.14, ease: 0.08, friction: 0.84, orbitRadius: 62, orbitSpeed: 2.9, orbitPhase: 4.2 }
];

export const CursorBatFollower: React.FC<{ enabled: boolean }> = ({ enabled }) => {
  const batRefs = useRef<(HTMLDivElement | null)[]>([]);
  const trailContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // Internal state stored in refs to avoid React re-renders at 60fps
    const mouse = { x: -300, y: -300, active: false, lastMoveTime: Date.now() };
    const batsState = CURSOR_BATS.map(b => ({
      x: -300,
      y: -300,
      vx: 0,
      vy: 0,
      angle: 0
    }));

    let animFrameId: number;
    let startTime = performance.now();
    let lastTrailSpawn = 0;

    const onPointerMove = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
      mouse.lastMoveTime = Date.now();
    };

    const onMouseLeave = () => {
      mouse.active = false;
    };

    const onMouseEnter = (e: MouseEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
      mouse.active = true;
      mouse.lastMoveTime = Date.now();
    };

    window.addEventListener('mousemove', onPointerMove, { passive: true });
    document.addEventListener('mouseleave', onMouseLeave);
    document.addEventListener('mouseenter', onMouseEnter);

    const spawnTrailParticle = (x: number, y: number, angle: number) => {
      if (!trailContainerRef.current) return;
      const p = document.createElement('div');
      p.className = 'absolute pointer-events-none transition-all duration-500';
      p.style.left = `${x}px`;
      p.style.top = `${y}px`;
      p.style.transform = `translate(-50%, -50%) rotate(${angle}deg) scale(0.6)`;
      p.style.opacity = '0.7';
      p.innerHTML = `
        <svg viewBox="0 0 100 60" class="w-5 h-3.5 fill-purple-950/80 stroke-purple-500/50">
          <path d="M 50,30 Q 30,5 5,15 Q 22,35 50,35 Q 78,35 95,15 Q 70,5 50,30 Z" />
        </svg>
      `;
      trailContainerRef.current.appendChild(p);

      requestAnimationFrame(() => {
        p.style.opacity = '0';
        p.style.transform = `translate(-50%, -50%) rotate(${angle}deg) scale(0.2)`;
      });

      setTimeout(() => {
        if (p.parentNode) {
          p.parentNode.removeChild(p);
        }
      }, 550);
    };

    const animate = (now: number) => {
      const elapsed = (now - startTime) / 1000;
      const isIdle = Date.now() - mouse.lastMoveTime > 300;

      batsState.forEach((bat, i) => {
        const config = CURSOR_BATS[i];
        const el = batRefs.current[i];
        if (!el) return;

        let targetX = mouse.x;
        let targetY = mouse.y;

        if (isIdle) {
          // Playful idle circling/hovering around cursor
          const angle = elapsed * config.orbitSpeed + config.orbitPhase;
          targetX += Math.cos(angle) * config.orbitRadius;
          targetY += Math.sin(angle) * (config.orbitRadius * 0.7);
        } else {
          // Dynamic offset while moving
          const offsetAngle = config.orbitPhase + elapsed * 1.5;
          targetX += Math.cos(offsetAngle) * (config.orbitRadius * 0.5);
          targetY += Math.sin(offsetAngle) * (config.orbitRadius * 0.5);
        }

        const dx = targetX - bat.x;
        const dy = targetY - bat.y;

        bat.vx = bat.vx * config.friction + dx * config.ease;
        bat.vy = bat.vy * config.friction + dy * config.ease;

        bat.x += bat.vx;
        bat.y += bat.vy;

        // Calculate rotation based on velocity vector
        const speed = Math.hypot(bat.vx, bat.vy);
        if (speed > 0.4) {
          const targetAngle = Math.atan2(bat.vy, bat.vx) * (180 / Math.PI) + 90;
          bat.angle = lerpAngle(bat.angle, targetAngle, 0.22);
        }

        // Spawn trailing micro-bats when moving fast
        if (i === 0 && speed > 7 && now - lastTrailSpawn > 120) {
          lastTrailSpawn = now;
          spawnTrailParticle(bat.x, bat.y, bat.angle);
        }

        el.style.transform = `translate3d(${bat.x - 22}px, ${bat.y - 16}px, 0) scale(${config.scale}) rotate(${bat.angle}deg)`;
        el.style.opacity = mouse.active ? '1' : '0';
      });

      animFrameId = requestAnimationFrame(animate);
    };

    animFrameId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(animFrameId);
      window.removeEventListener('mousemove', onPointerMove);
      document.removeEventListener('mouseleave', onMouseLeave);
      document.removeEventListener('mouseenter', onMouseEnter);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <>
      <div ref={trailContainerRef} className="fixed inset-0 pointer-events-none z-50 overflow-hidden" />
      {CURSOR_BATS.map((bat, idx) => (
        <div
          key={bat.id}
          ref={(el) => { batRefs.current[idx] = el; }}
          className="fixed top-0 left-0 pointer-events-none z-50 transition-opacity duration-300 select-none will-change-transform"
          style={{ opacity: 0, transform: 'translate3d(-200px, -200px, 0)' }}
        >
          <div className="relative filter drop-shadow(0 3px 6px rgba(0,0,0,0.95))">
            <svg viewBox="0 0 100 60" className="w-11 h-8 overflow-visible">
              {/* Left wing with flapping */}
              <g style={{ transformOrigin: '50px 30px', animation: `batFollowerFlapLeft ${bat.flapDuration}s ease-in-out infinite` }}>
                <path d="M 50,30 Q 30,5 5,15 Q 12,30 22,35 Q 32,45 50,35 Z" fill="#0b0816" stroke="#581c87" strokeWidth="1.2" />
                <path d="M 5,15 Q 18,22 24,34" stroke="#7e22ce" strokeWidth="0.8" fill="none" opacity="0.6" />
              </g>

              {/* Right wing with flapping */}
              <g style={{ transformOrigin: '50px 30px', animation: `batFollowerFlapRight ${bat.flapDuration}s ease-in-out infinite` }}>
                <path d="M 50,30 Q 70,5 95,15 Q 88,30 78,35 Q 68,45 50,35 Z" fill="#0b0816" stroke="#581c87" strokeWidth="1.2" />
                <path d="M 95,15 Q 82,22 76,34" stroke="#7e22ce" strokeWidth="0.8" fill="none" opacity="0.6" />
              </g>

              {/* Bat Body */}
              <ellipse cx="50" cy="33" rx="6.5" ry="11" fill="#150e26" stroke="#6b21a8" strokeWidth="1" />
              {/* Ears */}
              <polygon points="46,24 44,14 49,21" fill="#150e26" />
              <polygon points="54,24 56,14 51,21" fill="#150e26" />

              {/* Glowing Crimson Eyes */}
              <circle cx="48" cy="25" r="1.3" fill="#f43f5e" style={{ filter: 'drop-shadow(0 0 3px #ef4444)' }} />
              <circle cx="52" cy="25" r="1.3" fill="#f43f5e" style={{ filter: 'drop-shadow(0 0 3px #ef4444)' }} />
            </svg>
          </div>
        </div>
      ))}
    </>
  );
};

export const HalloweenOverlay: React.FC<{ onReplayIntro?: () => void }> = ({ onReplayIntro }) => {
  // Halloween mode state (persisted in localStorage)
  const [isEnabled, setIsEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('continental_halloween');
      return saved !== null ? saved === 'true' : true; // Default ON for Halloween mood
    } catch {
      return true;
    }
  });

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('continental_halloween_sound') === 'true';
    } catch {
      return false; // Sound mute by default so we don't startle during work
    }
  });

  const [cursorBatsEnabled, setCursorBatsEnabled] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('continental_halloween_cursor_bats');
      return saved !== null ? saved === 'true' : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('continental_halloween_cursor_bats', String(cursorBatsEnabled));
    } catch {}
  }, [cursorBatsEnabled]);

  // Interactive spider state
  const [spiderScared, setSpiderScared] = useState(false);
  const [spiderMessage, setSpiderMessage] = useState<string | null>(null);

  // Lightning flash trigger
  const [isFlashing, setIsFlashing] = useState(false);

  // Flying bat swarms
  const [bats, setBats] = useState<BatData[]>([]);

  // Ghost drifting state
  const [showGhost, setShowGhost] = useState(false);
  const [ghostPos, setGhostPos] = useState({ x: 20, y: 70 });

  // Floating creepy eyes in dark corners
  const [showSpookyEyes, setShowSpookyEyes] = useState(false);

  useEffect(() => {
    audioFX.setMuted(!soundEnabled);
    try {
      localStorage.setItem('continental_halloween_sound', String(soundEnabled));
    } catch {}
  }, [soundEnabled]);

  useEffect(() => {
    try {
      localStorage.setItem('continental_halloween', String(isEnabled));
    } catch {}
  }, [isEnabled]);

  // Generate periodic bats flight
  const spawnBats = () => {
    const newBats: BatData[] = [];
    const count = Math.floor(Math.random() * 4) + 3; // 3 to 6 bats
    const direction: 'ltr' | 'rtl' = Math.random() > 0.4 ? 'ltr' : 'rtl';
    const baseY = Math.random() * 50 + 10; // 10% to 60% vertical

    for (let i = 0; i < count; i++) {
      newBats.push({
        id: Date.now() + i + Math.random(),
        startX: direction === 'ltr' ? -10 - i * 8 : 110 + i * 8,
        startY: baseY + (Math.random() * 25 - 12),
        scale: 0.6 + Math.random() * 0.7,
        duration: 4.5 + Math.random() * 3.5,
        delay: i * 0.45,
        curve: Math.random() * 80 - 40,
        direction
      });
    }

    setBats(newBats);
    if (Math.random() > 0.5) {
      audioFX.playBatScreech();
    }
  };

  // Timer loop for ambient events
  useEffect(() => {
    if (!isEnabled) return;

    // Spawn first bats shortly after mount
    const firstTimer = setTimeout(() => {
      spawnBats();
    }, 2500);

    // Periodic bats flock every 16-24 seconds
    const batsInterval = setInterval(() => {
      spawnBats();
    }, 18000);

    // Periodic lightning flash every 45-65 seconds
    const lightningInterval = setInterval(() => {
      if (Math.random() > 0.4) {
        setIsFlashing(true);
        audioFX.playThunder();
        setTimeout(() => setIsFlashing(false), 350);
      }
    }, 45000);

    // Periodic ghost appearance
    const ghostInterval = setInterval(() => {
      if (Math.random() > 0.35) {
        setGhostPos({
          x: Math.random() * 70 + 15,
          y: Math.random() * 60 + 20
        });
        setShowGhost(true);
        setTimeout(() => setShowGhost(false), 6000);
      }
    }, 32000);

    // Glowing red eyes lurking in dark corners
    const eyesInterval = setInterval(() => {
      setShowSpookyEyes(true);
      setTimeout(() => setShowSpookyEyes(false), 4500);
    }, 24000);

    return () => {
      clearTimeout(firstTimer);
      clearInterval(batsInterval);
      clearInterval(lightningInterval);
      clearInterval(ghostInterval);
      clearInterval(eyesInterval);
    };
  }, [isEnabled]);

  // Handle clicking the interactive spider
  const handleSpiderClick = () => {
    if (spiderScared) return;
    setSpiderScared(true);
    audioFX.playBatScreech();
    const spookyQuotes = [
      'БУУУ! 🕷️',
      'Не трогай паутину!',
      'Хэллоуин близко... 🎃',
      'Шшшш! 🕸️',
      'Я слежу за сменой! 👀'
    ];
    setSpiderMessage(spookyQuotes[Math.floor(Math.random() * spookyQuotes.length)]);

    // Spider scampers up furiously, then slowly rappels back down after 4.5s
    setTimeout(() => {
      setSpiderScared(false);
      setSpiderMessage(null);
    }, 4500);
  };

  // Trigger manual spooky thunder
  const triggerManualSpook = () => {
    setIsFlashing(true);
    audioFX.playThunder();
    spawnBats();
    setTimeout(() => setIsFlashing(false), 350);
  };

  if (!isEnabled) {
    return (
      // Compact minimized toggle pill when disabled
      <div className="fixed bottom-3 right-3 z-50 pointer-events-auto">
        <button
          onClick={() => {
            setIsEnabled(true);
            audioFX.playThunder();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-900/90 border border-amber-500/40 text-amber-400 hover:text-amber-300 text-[11px] font-mono font-bold shadow-lg shadow-black/60 transition-all hover:scale-105"
          title="Включить Хэллоуин-тему"
        >
          <span>🎃</span>
          <span>Spooky Mode</span>
        </button>
      </div>
    );
  }

  return (
    <>
      <CursorBatFollower enabled={cursorBatsEnabled} />

      {/* INJECTED HALLOWEEN CSS ANIMATIONS */}
      <style>{`
        @keyframes batFollowerFlapLeft {
          0%, 100% { transform: rotate(0deg) scaleY(1); }
          50% { transform: rotate(-45deg) scaleY(0.45); }
        }
        @keyframes batFollowerFlapRight {
          0%, 100% { transform: rotate(0deg) scaleY(1); }
          50% { transform: rotate(45deg) scaleY(0.45); }
        }
        @keyframes batFlapLeft {
          0%, 100% { transform: rotate(0deg) scaleY(1); }
          50% { transform: rotate(-35deg) scaleY(0.5); }
        }
        @keyframes batFlapRight {
          0%, 100% { transform: rotate(0deg) scaleY(1); }
          50% { transform: rotate(35deg) scaleY(0.5); }
        }
        @keyframes spiderSwing {
          0%, 100% { transform: rotate(-3deg); }
          50% { transform: rotate(3.5deg); }
        }
        @keyframes spiderLegTwitch {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.05) rotate(2deg); }
        }
        @keyframes fogDrift {
          0% { transform: translateX(0); }
          50% { transform: translateX(-40px); }
          100% { transform: translateX(0); }
        }
        @keyframes ghostFloat {
          0% { opacity: 0; transform: translateY(20px) scale(0.85); }
          20% { opacity: 0.35; transform: translateY(0px) scale(1); }
          80% { opacity: 0.35; transform: translateY(-30px) scale(1.05); }
          100% { opacity: 0; transform: translateY(-50px) scale(0.9); }
        }
        @keyframes eyesBlink {
          0%, 90%, 100% { opacity: 0.85; transform: scaleY(1); }
          95% { opacity: 0; transform: scaleY(0.1); }
        }
        @keyframes candleFlicker {
          0%, 100% { opacity: 0.95; filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.9)); }
          25% { opacity: 0.7; filter: drop-shadow(0 0 3px rgba(239, 68, 68, 0.6)); }
          50% { opacity: 1; filter: drop-shadow(0 0 10px rgba(245, 158, 11, 1)); }
          75% { opacity: 0.8; filter: drop-shadow(0 0 4px rgba(245, 158, 11, 0.7)); }
        }
      `}</style>

      {/* FULL-SCREEN NON-BLOCKING CONTAINER: pointer-events-none ensures NO interference with clicks/inputs */}
      <div className="fixed inset-0 pointer-events-none z-40 overflow-hidden select-none">
        {/* 1. LIGHTNING FLASH EFFECT */}
        {isFlashing && (
          <div 
            className="absolute inset-0 bg-indigo-200/25 z-50 transition-opacity duration-150 pointer-events-none mix-blend-screen"
            style={{ backdropFilter: 'brightness(1.5)' }}
          />
        )}

        {/* 2. SPIDER WEBS (CORNER COBWEBS) */}
        {/* Top-Right Cobweb */}
        <div className="absolute top-0 right-0 w-44 h-44 sm:w-60 sm:h-60 opacity-60 hover:opacity-85 transition-opacity text-slate-400">
          <svg viewBox="0 0 200 200" className="w-full h-full fill-none stroke-current" style={{ filter: 'drop-shadow(0 0 5px rgba(168, 85, 247, 0.25))' }}>
            <path d="M 200,0 L 0,0" strokeWidth="1" stroke="rgba(255,255,255,0.4)" />
            <path d="M 200,0 L 200,200" strokeWidth="1" stroke="rgba(255,255,255,0.4)" />
            <path d="M 200,0 L 40,160" strokeWidth="0.8" stroke="rgba(255,255,255,0.35)" />
            <path d="M 200,0 L 90,190" strokeWidth="0.8" stroke="rgba(255,255,255,0.3)" />
            <path d="M 200,0 L 150,195" strokeWidth="0.8" stroke="rgba(255,255,255,0.3)" />
            <path d="M 200,0 L 10,100" strokeWidth="0.8" stroke="rgba(255,255,255,0.3)" />
            <path d="M 200,0 L 5,50" strokeWidth="0.8" stroke="rgba(255,255,255,0.3)" />

            {/* Radial Web Strands */}
            <path d="M 180,0 Q 185,15 200,18" strokeWidth="0.6" stroke="rgba(220,220,255,0.5)" />
            <path d="M 155,0 Q 165,30 200,42" strokeWidth="0.6" stroke="rgba(220,220,255,0.5)" />
            <path d="M 125,0 Q 145,55 200,75" strokeWidth="0.6" stroke="rgba(220,220,255,0.5)" />
            <path d="M 90,0 Q 120,85 200,115" strokeWidth="0.6" stroke="rgba(220,220,255,0.5)" />
            <path d="M 50,0 Q 90,120 200,160" strokeWidth="0.6" stroke="rgba(220,220,255,0.45)" />
            <path d="M 15,0 Q 60,160 200,200" strokeWidth="0.6" stroke="rgba(220,220,255,0.4)" />

            {/* Micro Dew drops */}
            <circle cx="145" cy="55" r="1.5" fill="#a855f7" className="animate-pulse" />
            <circle cx="120" cy="85" r="1.2" fill="#38bdf8" />
            <circle cx="90" cy="120" r="1.5" fill="#fb923c" />
          </svg>
        </div>

        {/* Top-Left Cobweb (Anchored above sidebar) */}
        <div className="absolute top-0 left-0 w-36 h-36 sm:w-48 sm:h-48 opacity-45 pointer-events-none text-slate-400">
          <svg viewBox="0 0 200 200" className="w-full h-full fill-none stroke-current">
            <path d="M 0,0 L 200,0" strokeWidth="0.8" stroke="rgba(255,255,255,0.35)" />
            <path d="M 0,0 L 0,200" strokeWidth="0.8" stroke="rgba(255,255,255,0.35)" />
            <path d="M 0,0 L 160,160" strokeWidth="0.6" stroke="rgba(255,255,255,0.25)" />
            <path d="M 0,0 L 110,190" strokeWidth="0.6" stroke="rgba(255,255,255,0.2)" />
            <path d="M 0,0 L 190,110" strokeWidth="0.6" stroke="rgba(255,255,255,0.2)" />
            <path d="M 20,0 Q 15,15 0,20" strokeWidth="0.6" stroke="rgba(255,255,255,0.35)" />
            <path d="M 45,0 Q 35,35 0,50" strokeWidth="0.6" stroke="rgba(255,255,255,0.35)" />
            <path d="M 80,0 Q 60,65 0,90" strokeWidth="0.6" stroke="rgba(255,255,255,0.35)" />
            <path d="M 120,0 Q 90,105 0,140" strokeWidth="0.6" stroke="rgba(255,255,255,0.35)" />
            <path d="M 170,0 Q 120,150 0,190" strokeWidth="0.6" stroke="rgba(255,255,255,0.3)" />
          </svg>
        </div>

        {/* 3. INTERACTIVE DANGLING SPIDER (Top-right corner, hanging on silk thread) */}
        <div 
          className="absolute right-20 sm:right-32 top-0 pointer-events-auto z-50 cursor-pointer group"
          onClick={handleSpiderClick}
          title="Нажми на паука!"
          style={{
            transformOrigin: 'top center',
            animation: spiderScared ? 'none' : 'spiderSwing 4s ease-in-out infinite'
          }}
        >
          {/* Silk thread */}
          <div 
            className="w-[1px] bg-gradient-to-b from-white/40 via-purple-300/60 to-white/80 mx-auto transition-all duration-700 ease-out"
            style={{
              height: spiderScared ? '18px' : '90px',
              boxShadow: '0 0 3px rgba(255, 255, 255, 0.4)'
            }}
          />

          {/* Spider Body */}
          <div 
            className="relative -mt-1 transition-all duration-700 ease-out hover:scale-125"
            style={{
              transform: spiderScared ? 'translateY(-10px) rotate(180deg)' : 'translateY(0)',
              animation: 'spiderLegTwitch 2.5s ease-in-out infinite'
            }}
          >
            {/* Pop-up message when tapped */}
            {spiderMessage && (
              <div className="absolute -top-10 -left-16 whitespace-nowrap bg-purple-950/95 border border-purple-500/60 text-purple-200 text-[10px] font-black font-mono px-2.5 py-1 rounded-xl shadow-xl shadow-purple-950/80 animate-bounce pointer-events-none">
                {spiderMessage}
              </div>
            )}

            <svg width="42" height="42" viewBox="0 0 100 100" className="fill-slate-950 stroke-purple-400">
              {/* Spider Legs - Left Side */}
              <path d="M 45,45 Q 20,25 5,40" strokeWidth="4" strokeLinecap="round" fill="none" />
              <path d="M 45,50 Q 15,45 8,62" strokeWidth="4" strokeLinecap="round" fill="none" />
              <path d="M 45,55 Q 18,65 15,82" strokeWidth="4" strokeLinecap="round" fill="none" />
              <path d="M 45,60 Q 25,85 28,95" strokeWidth="4" strokeLinecap="round" fill="none" />

              {/* Spider Legs - Right Side */}
              <path d="M 55,45 Q 80,25 95,40" strokeWidth="4" strokeLinecap="round" fill="none" />
              <path d="M 55,50 Q 85,45 92,62" strokeWidth="4" strokeLinecap="round" fill="none" />
              <path d="M 55,55 Q 82,65 85,82" strokeWidth="4" strokeLinecap="round" fill="none" />
              <path d="M 55,60 Q 75,85 72,95" strokeWidth="4" strokeLinecap="round" fill="none" />

              {/* Abdomen */}
              <ellipse cx="50" cy="65" rx="15" ry="18" fill="#120d24" stroke="#8b5cf6" strokeWidth="2.5" />
              {/* Skull mark on abdomen */}
              <path d="M 47,60 L 53,60 L 52,65 L 48,65 Z" fill="#ec4899" opacity="0.8" />
              <circle cx="47.5" cy="59" r="1.5" fill="#f43f5e" />
              <circle cx="52.5" cy="59" r="1.5" fill="#f43f5e" />

              {/* Cephalothorax (Head) */}
              <circle cx="50" cy="46" r="10" fill="#1e1338" stroke="#8b5cf6" strokeWidth="2.5" />

              {/* Glowing Crimson Eyes */}
              <circle cx="47" cy="43" r="2.2" fill="#ef4444" style={{ filter: 'drop-shadow(0 0 3px #ef4444)' }} />
              <circle cx="53" cy="43" r="2.2" fill="#ef4444" style={{ filter: 'drop-shadow(0 0 3px #ef4444)' }} />
              <circle cx="44" cy="46" r="1.3" fill="#f97316" />
              <circle cx="56" cy="46" r="1.3" fill="#f97316" />

              {/* Chelicerae (Fangs) */}
              <path d="M 48,54 L 46,59" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
              <path d="M 52,54 L 54,59" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* 4. FLYING BATS SWARM */}
        {bats.map((bat) => {
          const isLtr = bat.direction === 'ltr';
          return (
            <div
              key={bat.id}
              className="absolute pointer-events-none"
              style={{
                top: `${bat.startY}%`,
                left: isLtr ? '-10%' : '110%',
                transform: `scale(${bat.scale})`,
                animation: `flyAcross_${bat.id} ${bat.duration}s cubic-bezier(0.4, 0, 0.2, 1) ${bat.delay}s forwards`
              }}
            >
              <style>{`
                @keyframes flyAcross_${bat.id} {
                  0% {
                    transform: translate3d(0, 0, 0) scale(${bat.scale}) rotate(${isLtr ? 15 : -15}deg);
                    opacity: 0;
                  }
                  10% {
                    opacity: 0.9;
                  }
                  50% {
                    transform: translate3d(${isLtr ? '60vw' : '-60vw'}, ${bat.curve}px, 0) scale(${bat.scale * 1.1}) rotate(${isLtr ? -10 : 10}deg);
                  }
                  90% {
                    opacity: 0.9;
                  }
                  100% {
                    transform: translate3d(${isLtr ? '120vw' : '-120vw'}, ${bat.curve * 1.5}px, 0) scale(${bat.scale * 0.9}) rotate(${isLtr ? 20 : -20}deg);
                    opacity: 0;
                  }
                }
              `}</style>

              {/* Bat SVG with wing flapping */}
              <div className="relative w-14 h-10 filter drop-shadow(0 2px 5px rgba(0,0,0,0.8))">
                <svg viewBox="0 0 100 60" className="w-full h-full fill-slate-950">
                  {/* Left Wing with flap animation */}
                  <g style={{ transformOrigin: '50px 30px', animation: 'batFlapLeft 0.22s ease-in-out infinite' }}>
                    <path d="M 50,30 Q 30,5 5,15 Q 12,30 22,35 Q 32,45 50,35 Z" fill="#0b0816" stroke="#4c1d95" strokeWidth="1" />
                    <path d="M 5,15 Q 18,22 24,34" stroke="#6d28d9" strokeWidth="0.8" fill="none" opacity="0.6" />
                  </g>

                  {/* Right Wing with flap animation */}
                  <g style={{ transformOrigin: '50px 30px', animation: 'batFlapRight 0.22s ease-in-out infinite' }}>
                    <path d="M 50,30 Q 70,5 95,15 Q 88,30 78,35 Q 68,45 50,35 Z" fill="#0b0816" stroke="#4c1d95" strokeWidth="1" />
                    <path d="M 95,15 Q 82,22 76,34" stroke="#6d28d9" strokeWidth="0.8" fill="none" opacity="0.6" />
                  </g>

                  {/* Bat Body */}
                  <ellipse cx="50" cy="33" rx="7" ry="12" fill="#160e29" stroke="#581c87" strokeWidth="1" />
                  {/* Ears */}
                  <polygon points="46,24 44,14 49,21" fill="#160e29" />
                  <polygon points="54,24 56,14 51,21" fill="#160e29" />

                  {/* Glowing Tiny Red Eyes */}
                  <circle cx="48" cy="25" r="1.2" fill="#ef4444" style={{ filter: 'drop-shadow(0 0 2px #ef4444)' }} />
                  <circle cx="52" cy="25" r="1.2" fill="#ef4444" style={{ filter: 'drop-shadow(0 0 2px #ef4444)' }} />
                </svg>
              </div>
            </div>
          );
        })}

        {/* 5. GHOST WISPY SPECTER DRIFTING */}
        {showGhost && (
          <div
            className="absolute pointer-events-none transition-all"
            style={{
              top: `${ghostPos.y}%`,
              left: `${ghostPos.x}%`,
              animation: 'ghostFloat 6s ease-in-out forwards'
            }}
          >
            <div className="w-16 h-20 text-indigo-300/40 filter drop-shadow(0 0 15px rgba(129, 140, 248, 0.4))">
              <svg viewBox="0 0 100 120" className="w-full h-full fill-current">
                <path d="M 50,10 C 25,10 15,35 15,65 C 15,95 20,110 30,105 C 40,100 45,115 55,108 C 65,102 75,115 85,105 C 95,95 85,65 85,45 C 85,25 75,10 50,10 Z" />
                {/* Spooky dark oval eyes */}
                <ellipse cx="40" cy="40" rx="4.5" ry="7" fill="#080718" />
                <ellipse cx="60" cy="40" rx="4.5" ry="7" fill="#080718" />
                {/* Open screaming mouth */}
                <ellipse cx="50" cy="58" rx="6" ry="10" fill="#080718" />
              </svg>
            </div>
          </div>
        )}

        {/* 6. GLOWING RED/YELLOW EYES IN SHADOWS */}
        {showSpookyEyes && (
          <div 
            className="absolute bottom-16 right-12 flex gap-2 pointer-events-none"
            style={{ animation: 'eyesBlink 3.5s ease-in-out infinite' }}
          >
            <div className="w-3 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b] -rotate-12" />
            <div className="w-3 h-2 rounded-full bg-amber-500 shadow-[0_0_8px_#f59e0b] rotate-12" />
          </div>
        )}

        {/* 7. EERIE CRAWLING MIST / FOG (Bottom of viewport) */}
        <div 
          className="absolute bottom-0 left-0 right-0 h-28 pointer-events-none opacity-20 bg-gradient-to-t from-purple-950/80 via-slate-900/40 to-transparent"
          style={{ animation: 'fogDrift 14s ease-in-out infinite' }}
        >
          <svg className="w-full h-full" preserveAspectRatio="none" viewBox="0 0 1200 120">
            <path 
              d="M 0,60 Q 150,10 300,50 T 600,40 T 900,60 T 1200,30 L 1200,120 L 0,120 Z" 
              fill="rgba(88, 28, 135, 0.35)" 
            />
            <path 
              d="M 0,80 Q 200,30 400,70 T 800,50 T 1200,70 L 1200,120 L 0,120 Z" 
              fill="rgba(15, 23, 42, 0.45)" 
            />
          </svg>
        </div>
      </div>

      {/* 8. HALLOWEEN CONTROL BAR & JACK-O'-LANTERN (Bottom-Right corner, sleek & unobtrusive) */}
      <aside aria-label="Halloween Mode Controls" className="fixed bottom-3 right-3 z-50 pointer-events-auto flex items-center gap-1.5 p-1.5 rounded-2xl bg-[#111726]/95 border border-amber-500/30 shadow-2xl backdrop-blur-xl transition-all hover:border-amber-400/60">
        {/* Animated Pumpkin Icon */}
        <button
          onClick={triggerManualSpook}
          className="relative p-1.5 rounded-xl hover:bg-amber-500/15 transition-all text-amber-400 hover:scale-110 active:scale-95 group"
          title="Вызвать гром и стаю летучих мышей! 🦇⚡"
        >
          <div style={{ animation: 'candleFlicker 3s infinite' }}>
            <svg width="24" height="24" viewBox="0 0 100 100" className="fill-amber-500 stroke-amber-600">
              {/* Pumpkin Stem */}
              <path d="M 47,15 Q 50,5 60,6 L 57,15 Z" fill="#15803d" stroke="#166534" strokeWidth="2" />
              {/* Pumpkin Ribs */}
              <ellipse cx="50" cy="55" rx="36" ry="32" fill="#d97706" stroke="#92400e" strokeWidth="3" />
              <ellipse cx="50" cy="55" rx="24" ry="31" fill="#ea580c" stroke="#92400e" strokeWidth="2" />
              <ellipse cx="50" cy="55" rx="12" ry="30" fill="#f59e0b" stroke="#b45309" strokeWidth="1.5" />
              {/* Carved Eyes */}
              <polygon points="34,42 44,46 38,52" fill="#450a0a" />
              <polygon points="66,42 56,46 62,52" fill="#450a0a" />
              {/* Carved Nose */}
              <polygon points="50,50 46,57 54,57" fill="#450a0a" />
              {/* Jagged Jack-o'-Lantern Grin */}
              <path d="M 30,65 L 37,70 L 44,65 L 50,72 L 56,65 L 63,70 L 70,65 L 65,76 L 50,80 L 35,76 Z" fill="#450a0a" />
            </svg>
          </div>
          <span className="absolute -top-1 -right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          </span>
        </button>

        {/* Spooky Mode label + Toggle */}
        <div className="flex items-center gap-1.5 px-1.5 border-l border-slate-700/60 font-mono">
          <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1">
            <span>HALLOWEEN</span>
          </span>

          {/* Cursor Bats Toggle Button */}
          <button
            onClick={() => setCursorBatsEnabled(prev => !prev)}
            className={`px-1.5 py-1 rounded-lg transition-colors flex items-center gap-1 ${
              cursorBatsEnabled ? 'text-purple-300 bg-purple-500/25 border border-purple-500/40' : 'text-slate-500 hover:text-slate-300'
            }`}
            title={cursorBatsEnabled ? 'Мыши за курсором: ВКЛ (кликните чтобы выключить)' : 'Мыши за курсором: ВЫКЛ (кликните чтобы включить)'}
          >
            <span className="text-[11px] leading-none">🦇</span>
          </button>

          {/* Replay Intro Video Button */}
          {onReplayIntro && (
            <button
              onClick={onReplayIntro}
              className="px-1.5 py-1 rounded-lg transition-colors flex items-center gap-1 text-amber-300 hover:text-amber-200 hover:bg-amber-500/20"
              title="Посмотреть Хэллоуин-видео со звуком снова 🎬"
            >
              <span className="text-[11px] leading-none">🎬</span>
            </button>
          )}

          {/* Sound Mute/Unmute button */}
          <button
            onClick={() => setSoundEnabled(prev => !prev)}
            className={`p-1 rounded-lg transition-colors ${
              soundEnabled ? 'text-amber-400 bg-amber-500/20' : 'text-slate-500 hover:text-slate-300'
            }`}
            title={soundEnabled ? 'Звуковые эффекты: ВКЛ (кликните чтобы выключить)' : 'Звуковые эффекты: ВЫКЛ (кликните чтобы включить)'}
          >
            {soundEnabled ? <Volume2 size={13} /> : <VolumeX size={13} />}
          </button>

          {/* Turn Off Button */}
          <button
            onClick={() => setIsEnabled(false)}
            className="text-[9px] font-bold uppercase text-slate-400 hover:text-rose-400 px-1 py-0.5 rounded transition-colors"
            title="Выключить тему Хэллоуина"
          >
            ✕
          </button>
        </div>
      </aside>
    </>
  );
};

export default HalloweenOverlay;
