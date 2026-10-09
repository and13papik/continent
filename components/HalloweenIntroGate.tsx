import React, { useState, useRef, useEffect } from 'react';
import { Volume2, VolumeX, Play, Skull, Sparkles } from 'lucide-react';

const STORAGE_KEY = 'continental_halloween_intro_seen_v1';

interface HalloweenIntroGateProps {
  onComplete: () => void;
}

export const HalloweenIntroGate: React.FC<HalloweenIntroGateProps> = ({ onComplete }) => {
  const [step, setStep] = useState<'prompt' | 'video' | 'done'>('prompt');
  const [isVideoLoading, setIsVideoLoading] = useState(true);
  const [canSkip, setCanSkip] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Spooky chime to unlock browser audio context on button press
  const unlockAudioContext = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        ctx.resume().catch(() => {});
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gain.gain.setValueAtTime(0.01, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.25);
      }
    } catch {
      // ignore
    }
  };

  const handleStartIntro = () => {
    unlockAudioContext();
    setStep('video');
  };

  // Play video with audio once mounted in 'video' step
  useEffect(() => {
    if (step === 'video' && videoRef.current) {
      const video = videoRef.current;
      video.muted = false;
      video.volume = 1.0;

      const playPromise = video.play();
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            setIsVideoLoading(false);
          })
          .catch((err) => {
            console.warn('[HalloweenIntro] Autoplay with sound failed, attempting retry:', err);
            // Fallback retry with user interaction
            video.play().catch(() => {});
          });
      }

      // Allow skipping after 4 seconds if needed
      const skipTimer = setTimeout(() => {
        setCanSkip(true);
      }, 4000);

      return () => clearTimeout(skipTimer);
    }
  }, [step]);

  const finishIntro = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {}
    setStep('done');
    onComplete();
  };

  if (step === 'done') {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[99999] bg-[#070913] flex items-center justify-center overflow-hidden p-4 select-none">
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-radial from-purple-950/40 via-slate-950/80 to-[#04060c] pointer-events-none" />

      {/* Spooky Cobwebs in Corners */}
      <div className="absolute top-0 right-0 w-48 h-48 opacity-40 pointer-events-none text-purple-400">
        <svg viewBox="0 0 200 200" className="w-full h-full fill-none stroke-current">
          <path d="M 200,0 L 0,0" strokeWidth="1" />
          <path d="M 200,0 L 200,200" strokeWidth="1" />
          <path d="M 200,0 L 50,150" strokeWidth="0.8" />
          <path d="M 200,0 L 100,190" strokeWidth="0.8" />
          <path d="M 180,0 Q 185,15 200,18" strokeWidth="0.6" />
          <path d="M 155,0 Q 165,30 200,42" strokeWidth="0.6" />
          <path d="M 125,0 Q 145,55 200,75" strokeWidth="0.6" />
          <path d="M 90,0 Q 120,85 200,115" strokeWidth="0.6" />
        </svg>
      </div>

      <div className="absolute top-0 left-0 w-48 h-48 opacity-40 pointer-events-none text-purple-400">
        <svg viewBox="0 0 200 200" className="w-full h-full fill-none stroke-current">
          <path d="M 0,0 L 200,0" strokeWidth="1" />
          <path d="M 0,0 L 0,200" strokeWidth="1" />
          <path d="M 0,0 L 150,150" strokeWidth="0.8" />
          <path d="M 0,0 L 190,100" strokeWidth="0.8" />
          <path d="M 20,0 Q 15,15 0,20" strokeWidth="0.6" />
          <path d="M 45,0 Q 35,35 0,50" strokeWidth="0.6" />
          <path d="M 80,0 Q 60,65 0,90" strokeWidth="0.6" />
          <path d="M 120,0 Q 90,105 0,140" strokeWidth="0.6" />
        </svg>
      </div>

      {/* STEP 1: SOUND ENABLE & ENTRY GATE */}
      {step === 'prompt' && (
        <div className="relative z-10 max-w-md w-full bg-[#111728]/95 border border-purple-500/40 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(139,92,246,0.3)] backdrop-blur-2xl text-center space-y-6 animate-fade-in">
          {/* Animated Pumpkin Icon */}
          <div className="flex flex-col items-center gap-2">
            <div className="relative">
              <div className="w-16 h-16 bg-gradient-to-br from-amber-500 via-orange-600 to-purple-900 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-500/30 border border-amber-400/50">
                <span className="text-3xl animate-bounce">🎃</span>
              </div>
              <span className="absolute -top-2 -right-2 text-lg animate-pulse">🦇</span>
            </div>
          </div>

          {/* Prompt text as requested */}
          <div className="space-y-2">
            <p className="text-sm sm:text-base font-bold text-slate-200 leading-relaxed font-mono">
              ( для входа в сайт необходимо включить звук )
            </p>
          </div>

          {/* Single Action Button: Включаешь и сразу начинается видео */}
          <div className="pt-2">
            <button
              onClick={handleStartIntro}
              className="w-full py-4 px-6 rounded-2xl font-mono text-xs sm:text-sm font-black uppercase tracking-wider transition-all flex items-center justify-center gap-3 bg-gradient-to-r from-amber-500 via-orange-600 to-purple-700 hover:from-amber-400 hover:to-orange-500 text-white border border-amber-400/50 shadow-xl shadow-orange-600/30 hover:scale-[1.02] active:scale-[0.98]"
            >
              <Volume2 size={20} className="animate-pulse" />
              <span>ВКЛЮЧИТЬ ЗВУК 🔊</span>
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: VIDEO PLAYER */}
      {step === 'video' && (
        <div className="relative z-10 max-w-2xl w-full flex flex-col items-center animate-fade-in">
          {/* Spooky Header Above Video */}
          <div className="mb-3 flex items-center justify-between w-full px-2 text-slate-300">
            <span className="text-xs font-mono font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
              <span className="animate-spin text-base">🎃</span>
              SPOOKY SCARY SKELETONS...
            </span>

            {canSkip && (
              <button
                onClick={finishIntro}
                className="text-[11px] font-mono font-bold text-slate-400 hover:text-white px-3 py-1 rounded-xl bg-slate-900/80 border border-slate-700 hover:border-slate-500 transition-all"
              >
                Пропустить ✕
              </button>
            )}
          </div>

          {/* Video Container */}
          <div className="relative w-full max-w-md sm:max-w-lg aspect-[3/4] sm:aspect-[4/5] rounded-3xl overflow-hidden border-2 border-purple-500/60 shadow-[0_0_60px_rgba(168,85,247,0.4)] bg-black flex items-center justify-center">
            {isVideoLoading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 z-20">
                <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-mono text-amber-400 font-bold uppercase tracking-wider">
                  Загрузка видео со звуком...
                </span>
              </div>
            )}

            <video
              ref={videoRef}
              src="/halloween_intro.mp4"
              playsInline
              autoPlay
              onEnded={finishIntro}
              onLoadedData={() => setIsVideoLoading(false)}
              className="w-full h-full object-cover rounded-3xl"
            />
          </div>

          {/* Bottom Hint */}
          <p className="mt-4 text-[11px] font-mono text-purple-300/80 uppercase tracking-widest flex items-center gap-2">
            <span>🔊</span>
            Громкий звук включен! После окончания вы попадёте на сайт
          </p>
        </div>
      )}
    </div>
  );
};

export default HalloweenIntroGate;
