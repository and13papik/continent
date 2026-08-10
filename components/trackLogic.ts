export const MESSAGES_PER_LAP = 100;

export interface LapInfo {
  completedLaps: number;
  currentLap: number;
  messagesInCurrentLap: number;
  lapProgress: number;
  totalMessages: number;
}

export function getLapInfo(messages: number): LapInfo {
  const safeMsgs = Math.max(0, messages || 0);
  const completedLaps = Math.floor(safeMsgs / MESSAGES_PER_LAP);
  const currentLap = completedLaps + 1;
  const messagesInCurrentLap = safeMsgs % MESSAGES_PER_LAP;
  const lapProgress = messagesInCurrentLap / MESSAGES_PER_LAP;
  return {
    completedLaps,
    currentLap,
    messagesInCurrentLap,
    lapProgress,
    totalMessages: safeMsgs
  };
}

export function sanitizeOperatorMessages(
  currentMsgs: number,
  previousMsgs?: number
): { messages: number; wasDecreased: boolean } {
  const safeCurrent = Math.max(0, currentMsgs || 0);
  if (previousMsgs !== undefined && safeCurrent < previousMsgs) {
    return { messages: previousMsgs, wasDecreased: true };
  }
  return { messages: safeCurrent, wasDecreased: false };
}

export function isLapCrossedForward(prevProgress: number, currProgress: number): boolean {
  // If lap progress drops from >0.80 to <0.20, it represents crossing the start/finish line forward
  return prevProgress > 0.80 && currProgress < 0.20;
}

export function clampToBounds(
  val: number,
  min: number,
  max: number
): number {
  return Math.max(min, Math.min(max, val));
}

export type SpeedTier = 'idle' | 'low' | 'normal' | 'accel' | 'rush';

export interface RaceAnimationState {
  operatorId: string;
  previousMessages: number;
  targetMessages: number;
  displayedMessages: number;
  previousDistance: number;
  targetDistance: number;
  animatedDistance: number;
  deltaMessages: number;
  animationStartTime: number;
  animationDuration: number;
}

export function getSpeedTier(deltaMessages: number): SpeedTier {
  if (deltaMessages <= 0) return 'idle';
  if (deltaMessages <= 2) return 'low';
  if (deltaMessages <= 5) return 'normal';
  if (deltaMessages <= 9) return 'accel';
  return 'rush';
}

export function easeInOutCubic(t: number): number {
  const clampT = Math.max(0, Math.min(1, t));
  return clampT < 0.5 ? 4 * clampT * clampT * clampT : 1 - Math.pow(-2 * clampT + 2, 3) / 2;
}

export function calculateAnimatedProgress(
  previousDistance: number,
  targetDistance: number,
  startTime: number,
  duration: number,
  currentTime: number
): { animatedDistance: number; progress: number; isCompleted: boolean } {
  if (duration <= 0 || currentTime <= startTime) {
    return { animatedDistance: previousDistance, progress: 0, isCompleted: false };
  }
  const rawProgress = (currentTime - startTime) / duration;
  if (rawProgress >= 1) {
    return { animatedDistance: targetDistance, progress: 1, isCompleted: true };
  }
  const eased = easeInOutCubic(rawProgress);
  const animatedDistance = previousDistance + (targetDistance - previousDistance) * eased;
  return { animatedDistance, progress: rawProgress, isCompleted: false };
}
