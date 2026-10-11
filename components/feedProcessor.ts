export interface EventRecord {
  id: string | number;
  event_type: string;
  account_id: string;
  platform_account_id?: string;
  payload: any;
  received_at: string;
  event_timestamp?: string;
  dedup_key?: string | null;
}

export interface LiveShiftEventRecord {
  id: string;
  dedupKey: string | null;
  accountId: string;
  amount: number;
  grossAmount: number;
  eventType: string;
  timestampIso: string;
  timestampMs: number;
}

export interface FeedProcessorState {
  processedEventIds: Set<string>;
  processedDedupKeys: Set<string>;
  lastKnownId: string | null;
  shiftLiveEvents: LiveShiftEventRecord[];
  liveIncomeByAccount: Record<string, number>;
  lastShiftId: string | null;
  consecutiveErrors: number;
}

export function createFeedProcessorState(): FeedProcessorState {
  return {
    processedEventIds: new Set<string>(),
    processedDedupKeys: new Set<string>(),
    lastKnownId: null,
    shiftLiveEvents: [],
    liveIncomeByAccount: {},
    lastShiftId: null,
    consecutiveErrors: 0,
  };
}

export function resetFeedStateForShift(state: FeedProcessorState, newShiftId: string) {
  state.lastShiftId = newShiftId;
  state.processedEventIds.clear();
  state.processedDedupKeys.clear();
  state.lastKnownId = null;
  state.shiftLiveEvents = [];
  state.liveIncomeByAccount = {};
}

export const FINANCIAL_EVENT_TYPES = new Set([
  'fans.tip.received',
  'fans.ppv.purchased',
  'fans.message.purchased',
  'fans.post.purchased',
  'payment.received'
]);

export interface KyivShiftRange {
  label: string;
  start: string; // ISO 8601 UTC
  end: string;   // ISO 8601 UTC
  index: 1 | 2 | 3 | 4;
}

export const getClientKyivShiftIndexForDate = (d: Date = new Date()): 1 | 2 | 3 | 4 => {
  try {
    const hourFormatter = new Intl.DateTimeFormat("en-US", {
      timeZone: "Europe/Kyiv",
      hour: "numeric",
      hour12: false
    });
    const hour = parseInt(hourFormatter.format(d), 10) || 0;
    if (hour >= 2 && hour < 8) return 1;
    if (hour >= 8 && hour < 14) return 2;
    if (hour >= 14 && hour < 20) return 3;
    return 4;
  } catch (e) {
    return 1;
  }
};

export function getKyivShiftRange(date: Date = new Date()): KyivShiftRange {
  const hourFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Kyiv",
    hour: "numeric",
    hour12: false
  });
  const kyivHour = parseInt(hourFormatter.format(date), 10) || 0;

  let shiftIndex: 1 | 2 | 3 | 4 = 1;
  let label = "02:00–08:00";
  let startHour = 2;
  let endHour = 8;

  if (kyivHour >= 2 && kyivHour < 8) {
    shiftIndex = 1;
    label = "02:00–08:00";
    startHour = 2;
    endHour = 8;
  } else if (kyivHour >= 8 && kyivHour < 14) {
    shiftIndex = 2;
    label = "08:00–14:00";
    startHour = 8;
    endHour = 14;
  } else if (kyivHour >= 14 && kyivHour < 20) {
    shiftIndex = 3;
    label = "14:00–20:00";
    startHour = 14;
    endHour = 20;
  } else {
    shiftIndex = 4;
    label = "20:00–02:00";
    startHour = 20;
    endHour = 2;
  }

  const getKyivDateStr = (offsetDays: number = 0) => {
    const d = new Date(date.getTime() + offsetDays * 86400000);
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Kyiv",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(d);
  };

  const kyivWallTimeToUTC = (dStr: string, hour: number) => {
    const padded = String(hour).padStart(2, '0');
    const naiveUtc = new Date(`${dStr}T${padded}:00:00.000Z`);
    const hFmt = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Kyiv", hour: "numeric", hour12: false });
    const kH = parseInt(hFmt.format(naiveUtc), 10) || 0;
    let offset = kH - hour;
    if (offset > 12) offset -= 24;
    if (offset < -12) offset += 24;
    return new Date(naiveUtc.getTime() - offset * 3600000).toISOString();
  };

  if (shiftIndex !== 4) {
    const todayStr = getKyivDateStr(0);
    const start = kyivWallTimeToUTC(todayStr, startHour);
    const end = kyivWallTimeToUTC(todayStr, endHour);
    return { label, start, end, index: shiftIndex };
  } else {
    if (kyivHour < 2) {
      const prevDayStr = getKyivDateStr(-1);
      const todayStr = getKyivDateStr(0);
      const start = kyivWallTimeToUTC(prevDayStr, 20);
      const end = kyivWallTimeToUTC(todayStr, 2);
      return { label, start, end, index: 4 };
    } else {
      const todayStr = getKyivDateStr(0);
      const nextDayStr = getKyivDateStr(1);
      const start = kyivWallTimeToUTC(todayStr, 20);
      const end = kyivWallTimeToUTC(nextDayStr, 2);
      return { label, start, end, index: 4 };
    }
  }
}

export const getKyivOpDateStr = (d: Date = new Date()): string => {
  try {
    const hourFmt = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Kyiv", hour: "numeric", hour12: false });
    const kHour = parseInt(hourFmt.format(d), 10) || 0;
    const offsetDays = kHour >= 2 ? 0 : -1;
    const target = new Date(d.getTime() + offsetDays * 86400000);
    return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Kyiv", year: "numeric", month: "2-digit", day: "2-digit" }).format(target);
  } catch (e) {
    return '';
  }
};

export const isEventInCurrentKyivShift = (rawTs: string | number | undefined | null, targetShiftIndex: number) => {
  if (!rawTs) return false;
  try {
    const d = new Date(rawTs);
    if (isNaN(d.getTime())) return false;
    const shiftIdx = getClientKyivShiftIndexForDate(d);
    if (shiftIdx !== targetShiftIndex) return false;

    const eventOpDate = getKyivOpDateStr(d);
    const currentOpDate = getKyivOpDateStr(new Date());
    return eventOpDate === currentOpDate;
  } catch (e) {
    return false;
  }
};

export interface ProcessBatchResult {
  processedCount: number;
  newFinancialEventsCount: number;
  nextCursor: string | null;
  newIncome: boolean;
  newLiveEvents: LiveShiftEventRecord[];
}

/**
 * Shared pure event batch processing function used by both Continental Dashboard
 * and test verifications.
 */
export function processEventBatch(
  events: EventRecord[],
  shiftIdx: number,
  state: FeedProcessorState,
  isEventInShiftFn: (ts: string | number | undefined | null, shiftIdx: number) => boolean = isEventInCurrentKyivShift,
  platformNetMultiplier = 0.8
): ProcessBatchResult {
  let newIncome = false;
  let newFinancialEventsCount = 0;
  const newLiveEvents: LiveShiftEventRecord[] = [];

  for (const e of events) {
    const evId = e.id !== undefined && e.id !== null ? String(e.id).trim() : null;
    const dedupKey = e.dedup_key ? String(e.dedup_key).trim() : null;

    // Deduplication by ID
    if (evId && state.processedEventIds.has(evId)) {
      continue;
    }
    // Deduplication by dedup_key (e.g. same transaction re-delivered with different ID)
    if (dedupKey && state.processedDedupKeys.has(dedupKey)) {
      if (evId) state.processedEventIds.add(evId);
      continue;
    }

    if (evId) state.processedEventIds.add(evId);
    if (dedupKey) state.processedDedupKeys.add(dedupKey);

    // Business timestamp priority: event_timestamp preferred over received_at
    const evTs = e.event_timestamp || e.received_at;
    if (!isEventInShiftFn(evTs, shiftIdx)) {
      continue;
    }

    const rawPayload = e.payload || {};
    const p = rawPayload.payload || rawPayload;
    const type = (e.event_type || '').toLowerCase().trim();

    if (FINANCIAL_EVENT_TYPES.has(type)) {
      const grossAmt = Number(p.price_gross ?? p.amount_gross ?? p.amount ?? p.price ?? 0);
      const amt = grossAmt * platformNetMultiplier;
      const rawAccId = String(e.account_id || e.platform_account_id || p.account_id || p.platform_account_id || p.creator_id || '').trim();

      if (rawAccId && amt > 0) {
        const evTsMs = new Date(evTs).getTime();
        const liveRecord: LiveShiftEventRecord = {
          id: evId || String(Date.now()),
          dedupKey,
          accountId: rawAccId,
          amount: amt,
          grossAmount: grossAmt,
          eventType: type,
          timestampIso: String(evTs),
          timestampMs: isNaN(evTsMs) ? Date.now() : evTsMs
        };
        state.shiftLiveEvents.push(liveRecord);
        newLiveEvents.push(liveRecord);

        // Update live income per account
        const curVal = state.liveIncomeByAccount[rawAccId] || 0;
        state.liveIncomeByAccount[rawAccId] = Math.round((curVal + amt) * 100) / 100;
        newIncome = true;
        newFinancialEventsCount++;
      }
    }
  }

  // Update cursor ONLY AFTER full successful processing of the entire batch
  if (events.length > 0) {
    const lastItem = events[events.length - 1];
    if (lastItem && lastItem.id !== undefined && lastItem.id !== null) {
      state.lastKnownId = String(lastItem.id).trim();
    }
  }

  return {
    processedCount: events.length,
    newFinancialEventsCount,
    nextCursor: state.lastKnownId,
    newIncome,
    newLiveEvents
  };
}

export interface PollDrainLoopOptions {
  fetchBatch: (cursor: string | null, shiftRange: KyivShiftRange, signal: AbortSignal) => Promise<{ ok: boolean; status?: number; data?: any }>;
  state: FeedProcessorState;
  currentShift: KyivShiftRange;
  isDocumentHidden: () => boolean;
  isMounted: () => boolean;
  onActiveControllerCreated?: (controller: AbortController, timeoutId: any) => void;
  onActiveControllerCleared?: () => void;
  onBatchProcessed?: (result: ProcessBatchResult) => void;
  maxBatches?: number;
  batchLimit?: number;
  timeoutMs?: number;
  isEventInShiftFn?: (ts: string | number | undefined | null, shiftIdx: number) => boolean;
}

/**
 * Shared drain loop runner for paginating current shift events gaplessly.
 */
export async function runPollDrainLoop(options: PollDrainLoopOptions): Promise<{
  batchesRun: number;
  hasMore: boolean;
  pollHadErrors: boolean;
  timedOut: boolean;
}> {
  const {
    fetchBatch,
    state,
    currentShift,
    isDocumentHidden,
    isMounted,
    onActiveControllerCreated,
    onActiveControllerCleared,
    onBatchProcessed,
    maxBatches = 20,
    batchLimit = 50,
    timeoutMs = 10000,
    isEventInShiftFn = isEventInCurrentKyivShift
  } = options;

  if (!isMounted()) {
    return { batchesRun: 0, hasMore: false, pollHadErrors: false, timedOut: false };
  }

  if (isDocumentHidden()) {
    return { batchesRun: 0, hasMore: true, pollHadErrors: false, timedOut: false };
  }

  // Shift boundary check
  const shiftIdx = currentShift.index;
  const shiftId = `shift_${currentShift.start.slice(0, 10)}_${shiftIdx}`;
  if (state.lastShiftId && state.lastShiftId !== shiftId) {
    resetFeedStateForShift(state, shiftId);
  }
  state.lastShiftId = shiftId;

  let hasMore = true;
  let batchesRun = 0;
  let pollHadErrors = false;
  let timedOut = false;

  while (hasMore && isMounted() && batchesRun < maxBatches) {
    // If tab became hidden, do NOT start subsequent batches!
    if (isDocumentHidden()) {
      hasMore = false;
      break;
    }

    batchesRun++;
    let isTimedOut = false;
    const fetchAbortController = new AbortController();
    const timeoutId = setTimeout(() => {
      isTimedOut = true;
      timedOut = true;
      fetchAbortController.abort();
    }, timeoutMs);

    onActiveControllerCreated?.(fetchAbortController, timeoutId);

    let res: { ok: boolean; status?: number; data?: any };

    try {
      res = await fetchBatch(state.lastKnownId, currentShift, fetchAbortController.signal);

      if (!res.ok || !res.data || !res.data.success || !Array.isArray(res.data.events)) {
        state.consecutiveErrors++;
        pollHadErrors = true;
        hasMore = false;
        break;
      }
    } catch (err: any) {
      if (isTimedOut) {
        state.consecutiveErrors++;
        pollHadErrors = true;
        hasMore = false;
        break;
      } else if (!isMounted()) {
        // Unmounted during active request: do NOT increment consecutiveErrors
        hasMore = false;
        break;
      } else {
        state.consecutiveErrors++;
        pollHadErrors = true;
        hasMore = false;
        break;
      }
    } finally {
      clearTimeout(timeoutId);
      onActiveControllerCleared?.();
    }

    const events: EventRecord[] = res.data.events;
    if (events.length === 0) {
      hasMore = false;
      break;
    }

    // Process batch
    const batchResult = processEventBatch(events, shiftIdx, state, isEventInShiftFn);
    onBatchProcessed?.(batchResult);

    if (events.length < batchLimit && !res.data.truncated) {
      hasMore = false;
      break;
    }
  }

  // Reset consecutiveErrors only after a pass with no errors
  if (!pollHadErrors && isMounted()) {
    state.consecutiveErrors = 0;
  }

  return { batchesRun, hasMore, pollHadErrors, timedOut };
}
