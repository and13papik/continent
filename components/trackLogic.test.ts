import { describe, it, expect } from 'vitest';
import { 
  getLapInfo, 
  sanitizeOperatorMessages, 
  isLapCrossedForward,
  getSpeedTier,
  easeInOutCubic,
  calculateAnimatedProgress
} from './trackLogic';

describe('Track Logic Verification', () => {
  it('calculates lap info correctly across thresholds', () => {
    const lap0 = getLapInfo(0);
    expect(lap0.completedLaps).toBe(0);
    expect(lap0.currentLap).toBe(1);
    expect(lap0.lapProgress).toBe(0);

    const lap99 = getLapInfo(99);
    expect(lap99.completedLaps).toBe(0);
    expect(lap99.currentLap).toBe(1);
    expect(lap99.lapProgress).toBeCloseTo(0.99);

    const lap100 = getLapInfo(100);
    expect(lap100.completedLaps).toBe(1);
    expect(lap100.currentLap).toBe(2);
    expect(lap100.lapProgress).toBe(0);

    const lap205 = getLapInfo(205);
    expect(lap205.completedLaps).toBe(2);
    expect(lap205.currentLap).toBe(3);
    expect(lap205.lapProgress).toBeCloseTo(0.05);
  });

  it('prevents backward movement when message count decreases', () => {
    const same = sanitizeOperatorMessages(100, 100);
    expect(same.messages).toBe(100);
    expect(same.wasDecreased).toBe(false);

    const increase = sanitizeOperatorMessages(105, 100);
    expect(increase.messages).toBe(105);
    expect(increase.wasDecreased).toBe(false);

    const decrease = sanitizeOperatorMessages(95, 100);
    expect(decrease.messages).toBe(100);
    expect(decrease.wasDecreased).toBe(true);
  });

  it('detects forward lap crossing accurately', () => {
    expect(isLapCrossedForward(0.99, 0.02)).toBe(true);
    expect(isLapCrossedForward(0.50, 0.55)).toBe(false);
  });

  it('classifies speed tiers based on message deltas', () => {
    expect(getSpeedTier(0)).toBe('idle');
    expect(getSpeedTier(2)).toBe('low');
    expect(getSpeedTier(5)).toBe('normal');
    expect(getSpeedTier(8)).toBe('accel');
    expect(getSpeedTier(12)).toBe('rush');
  });

  it('calculates smooth animation progress over time', () => {
    const start = 1000;
    const duration = 10000;
    
    // At start
    const res0 = calculateAnimatedProgress(100, 200, start, duration, 1000);
    expect(res0.animatedDistance).toBe(100);
    expect(res0.isCompleted).toBe(false);

    // At 50% time
    const resMid = calculateAnimatedProgress(100, 200, start, duration, 6000);
    expect(resMid.animatedDistance).toBe(150);

    // At end
    const resEnd = calculateAnimatedProgress(100, 200, start, duration, 11000);
    expect(resEnd.animatedDistance).toBe(200);
    expect(resEnd.isCompleted).toBe(true);
  });
});
