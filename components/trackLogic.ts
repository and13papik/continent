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
