import { getOmToken } from '../_lib/om-store.js';
import { 
  getOperationalDayRange,
  getCurrentKyivShift, 
  getCurrentKyivShiftIndex, 
  getShiftRangeForDay, 
  getWeekRange, 
  getMonthRange,
  getShiftRangeForDate,
  getKyivDateStr,
  SHIFTS_CONFIG,
  KyivShift 
} from '../_lib/shifts.js';

function sendJson(res: any, status: number, data: any) {
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(data);
  }
  res.statusCode = status;
  if (typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'application/json');
  }
  return res.end(JSON.stringify(data));
}

async function fetchWithTimeout(url: string, headers: Record<string, string>, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal as any
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/* =========================================================================
   1. EARNINGS LOGIC
   ========================================================================= */

async function getAccountEarnings(
  platformAccountId: string,
  token: string,
  startISO: string,
  endISO: string,
  includeBreakdown: boolean,
  label: string
): Promise<{
  total: number | null;
  today?: number | null;
  currency: string;
  label: string;
  breakdown?: { 1: number; 2: number; 3: number; 4: number };
  error?: string;
}> {
  let totalAmount = 0;
  let txCount = 0;
  const shiftTotals = { 1: 0, 2: 0, 3: 0, 4: 0 };
  let cursor: string | null = null;
  let page = 0;
  const maxPages = 5;

  const startTs = new Date(startISO).getTime();
  const endTs = new Date(endISO).getTime();

  try {
    do {
      page++;
      let url = `https://omapi.onlymonster.ai/api/v0/platforms/onlyfans/accounts/${encodeURIComponent(platformAccountId)}/transactions?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}&limit=1000`;
      if (cursor) {
        url += `&cursor=${encodeURIComponent(cursor)}`;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-om-auth-token': token
        },
        signal: controller.signal as any
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        let errBody: any = null;
        try { errBody = await response.json(); } catch (e) {}
        const errorMsg = (errBody && (errBody.error || errBody.message)) || `HTTP ${response.status}`;
        console.error(`[getAccountEarnings] HTTP error fetching transactions for account ${platformAccountId}: ${response.status}`, errorMsg);
        return { total: null, today: null, currency: 'USD', label, error: errorMsg };
      }

      const body: any = await response.json();
      let items: any[] = [];
      cursor = null;

      if (Array.isArray(body)) {
        items = body;
      } else if (body && typeof body === 'object') {
        if (Array.isArray(body.transactions)) items = body.transactions;
        else if (Array.isArray(body.items)) items = body.items;
        else if (Array.isArray(body.data)) items = body.data;
        else if (Array.isArray(body.results)) items = body.results;

        if (typeof body.cursor === 'string' && body.cursor) cursor = body.cursor;
        else if (typeof body.next_cursor === 'string' && body.next_cursor) cursor = body.next_cursor;
        else if (body.pagination && typeof body.pagination.cursor === 'string' && body.pagination.cursor) cursor = body.pagination.cursor;
        else if (body.pagination && typeof body.pagination.next_cursor === 'string' && body.pagination.next_cursor) cursor = body.pagination.next_cursor;
      }

      for (const tx of items) {
        // Enforce strict operational day range filtering for every transaction
        const rawTs = tx.timestamp || tx.created_at || tx.date || tx.createdAt || tx.time;
        if (!rawTs) continue;
        const txDate = new Date(rawTs);
        const txTs = txDate.getTime();
        if (isNaN(txTs) || txTs < startTs || txTs >= endTs) {
          continue;
        }

        const status = (tx.status || tx.tx_status || tx.state || '').toString().toLowerCase();
        const isExcludedStatus =
          status.includes('return') ||
          status.includes('refund') ||
          status.includes('chargeback') ||
          status === 'pending return' ||
          status === 'pending_return' ||
          status === 'refund' ||
          status === 'refunded' ||
          status === 'chargeback';

        if (!isExcludedStatus) {
          // Extract NET amount from OnlyMonster/OnlyFans transaction data
          let val: number | null = null;

          // 1. Direct NET fields from OnlyMonster / OnlyFans API
          const netCandidate =
            tx.net_amount !== undefined ? tx.net_amount :
            tx.net !== undefined ? tx.net :
            tx.netAmount !== undefined ? tx.netAmount :
            tx.creator_amount !== undefined ? tx.creator_amount :
            tx.creatorAmount !== undefined ? tx.creatorAmount :
            tx.amount_net !== undefined ? tx.amount_net :
            tx.payout_amount !== undefined ? tx.payout_amount :
            undefined;

          if (netCandidate !== undefined && netCandidate !== null) {
            const parsed = typeof netCandidate === 'number' ? netCandidate : parseFloat(netCandidate);
            if (!isNaN(parsed)) val = parsed;
          }

          // 2. If gross and fee are provided separately
          if (val === null && tx.gross !== undefined && tx.fee !== undefined) {
            const gross = typeof tx.gross === 'number' ? tx.gross : parseFloat(tx.gross);
            const fee = typeof tx.fee === 'number' ? tx.fee : parseFloat(tx.fee);
            if (!isNaN(gross) && !isNaN(fee)) val = gross - fee;
          }

          // 3. If amount and fee are provided
          if (val === null && tx.amount !== undefined && tx.fee !== undefined && Number(tx.fee) > 0 && Number(tx.amount) > Number(tx.fee)) {
            const amt = typeof tx.amount === 'number' ? tx.amount : parseFloat(tx.amount);
            const fee = typeof tx.fee === 'number' ? tx.fee : parseFloat(tx.fee);
            if (!isNaN(amt) && !isNaN(fee)) val = amt - fee;
          }

          // 4. Fallback to amount / sum
          if (val === null) {
            const rawAmt = tx.amount !== undefined ? tx.amount : tx.sum;
            const parsed = typeof rawAmt === 'number' ? rawAmt : parseFloat(rawAmt);
            if (!isNaN(parsed)) val = parsed;
          }

          if (val !== null && !isNaN(val)) {
            txCount++;
            totalAmount += val;

            if (includeBreakdown) {
              const hourFormatter = new Intl.DateTimeFormat("en-US", {
                timeZone: "Europe/Kyiv",
                hour: "numeric",
                hour12: false
              });
              const h = parseInt(hourFormatter.format(txDate), 10) || 0;
              if (h >= 2 && h < 8) shiftTotals[1] += val;
              else if (h >= 8 && h < 14) shiftTotals[2] += val;
              else if (h >= 14 && h < 20) shiftTotals[3] += val;
              else shiftTotals[4] += val;
            }
          }
        }
      }

    } while (cursor && page < maxPages);

    const roundedTotal = Math.round(totalAmount * 100) / 100;
    const resObj: any = {
      total: roundedTotal,
      today: roundedTotal,
      tx_count: txCount,
      currency: 'USD',
      label
    };

    if (includeBreakdown) {
      resObj.breakdown = {
        1: Math.round(shiftTotals[1] * 100) / 100,
        2: Math.round(shiftTotals[2] * 100) / 100,
        3: Math.round(shiftTotals[3] * 100) / 100,
        4: Math.round(shiftTotals[4] * 100) / 100
      };
    }

    return resObj;
  } catch (err: any) {
    console.error(`[getAccountEarnings] Network or execution exception for account ${platformAccountId}:`, err?.message || err);
    return { total: null, today: null, currency: 'USD', label, error: err.message || 'Network error' };
  }
}

export async function getAllAccountsShiftEarnings(
  token: string,
  day: 'today' | 'yesterday',
  providedAccountIds?: string[]
): Promise<{ 1: number; 2: number; 3: number; 4: number }> {
  const shiftTotals = { 1: 0, 2: 0, 3: 0, 4: 0 };
  try {
    if (!token || !token.trim() || token.startsWith("om_token_fc269e0")) {
      return shiftTotals;
    }

    let platformAccountIds: string[] = providedAccountIds && providedAccountIds.length > 0
      ? providedAccountIds
      : [];

    if (platformAccountIds.length === 0) {
      const accRes = await fetch('https://omapi.onlymonster.ai/api/v0/platforms/onlyfans/accounts', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-om-auth-token': token.trim()
        }
      });

      if (!accRes.ok) {
        if (accRes.status === 401) {
          console.warn(`[getAllAccountsShiftEarnings] OnlyMonster API authentication failed (Status: 401). Please verify ONLYMONSTER_API_KEY.`);
        } else {
          console.warn(`[getAllAccountsShiftEarnings] Could not fetch accounts from OnlyMonster API. Status: ${accRes.status}`);
        }
        return shiftTotals;
      }

      const body: any = await accRes.json();
      let accountsList: any[] = [];
      if (Array.isArray(body)) {
        accountsList = body;
      } else if (body && typeof body === 'object') {
        if (Array.isArray(body.accounts)) accountsList = body.accounts;
        else if (Array.isArray(body.items)) accountsList = body.items;
        else if (Array.isArray(body.data)) accountsList = body.data;
        else if (Array.isArray(body.results)) accountsList = body.results;
      }

      platformAccountIds = accountsList
        .map((a: any) => a.platform_account_id || a.id || a.account_id || a.platformAccountId || a.user_id)
        .filter(Boolean);
    }

    if (platformAccountIds.length === 0) {
      return shiftTotals;
    }

    const range = getOperationalDayRange(day);
    const batchSize = 4;
    const results: any[] = [];

    for (let i = 0; i < platformAccountIds.length; i += batchSize) {
      const batch = platformAccountIds.slice(i, i + batchSize);
      const batchResults = await Promise.all(
        batch.map((id: string) =>
          getAccountEarnings(id, token, range.start, range.end, true, range.label)
        )
      );
      results.push(...batchResults);

      if (i + batchSize < platformAccountIds.length) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    for (const resData of results) {
      if (resData && resData.breakdown) {
        shiftTotals[1] += resData.breakdown[1] || 0;
        shiftTotals[2] += resData.breakdown[2] || 0;
        shiftTotals[3] += resData.breakdown[3] || 0;
        shiftTotals[4] += resData.breakdown[4] || 0;
      }
    }

    return {
      1: Math.round(shiftTotals[1] * 100) / 100,
      2: Math.round(shiftTotals[2] * 100) / 100,
      3: Math.round(shiftTotals[3] * 100) / 100,
      4: Math.round(shiftTotals[4] * 100) / 100
    };
  } catch (e: any) {
    console.error('[getAllAccountsShiftEarnings] Unexpected exception:', e?.message || e);
    return shiftTotals;
  }
}

async function handleEarnings(req: any, res: any, queryParams: Record<string, string>) {
  const accountsParam = queryParams.accounts;
  if (!accountsParam || typeof accountsParam !== 'string' || !accountsParam.trim()) {
    return sendJson(res, 400, { success: false, error: "Missing required 'accounts' query parameter" });
  }

  const omToken = await getOmToken();
  if (!omToken || !omToken.trim() || omToken.startsWith("om_token_fc269e0")) {
    return sendJson(res, 200, {
      success: false,
      not_configured: true,
      error: "API-ключ OnlyMonster не настроен. Укажите переменную ONLYMONSTER_API_KEY в Vercel."
    });
  }

  const accountIds = accountsParam.split(',').map(s => s.trim()).filter(Boolean);
  if (accountIds.length === 0) {
    return sendJson(res, 400, { success: false, error: "No valid account IDs provided" });
  }

  const dayParam = (queryParams.day || 'today').toLowerCase();
  const day = dayParam === 'yesterday' ? 'yesterday' : 'today';
  const includeBreakdown = (queryParams.breakdown || '').toLowerCase() === 'true';

  const range = getOperationalDayRange(day);

  try {
    const results = await Promise.all(
      accountIds.map(async (platformAccountId) => {
        const resData = await getAccountEarnings(
          platformAccountId,
          omToken.trim(),
          range.start,
          range.end,
          includeBreakdown,
          range.label
        );
        return { id: platformAccountId, resData };
      })
    );

    const earnings: Record<string, any> = {};
    for (const { id, resData } of results) {
      earnings[id] = resData;
    }

    return sendJson(res, 200, {
      success: true,
      day,
      label: range.label,
      range: {
        start: range.start,
        end: range.end
      },
      earnings
    });
  } catch (err: any) {
    return sendJson(res, 200, {
      success: false,
      error: `Internal server error: ${err.message || err}`
    });
  }
}

/* =========================================================================
   2. SHIFT OPERATORS LOGIC
   ========================================================================= */

async function handleShiftOperators(req: any, res: any, queryParams: Record<string, string>) {
  const omToken = await getOmToken();
  if (!omToken || !omToken.trim() || omToken.startsWith("om_token_fc269e0")) {
    return sendJson(res, 200, {
      success: false,
      not_configured: true,
      error: "API-ключ OnlyMonster не настроен."
    });
  }

  const token = omToken.trim();

  const period = (queryParams.period || 'shift').toLowerCase();
  const day = (queryParams.day || 'today').toLowerCase();
  const shiftParam = queryParams.shift;

  const sortByParam = (queryParams.sortBy || 'messages').toLowerCase();
  const validSortBy = ['messages', 'reply_time', 'ppv_sent', 'ppv_sold', 'earnings'].includes(sortByParam)
    ? sortByParam
    : 'messages';

  const defaultSortDir = validSortBy === 'reply_time' ? 'asc' : 'desc';
  const sortDirParam = (queryParams.sortDir || defaultSortDir).toLowerCase();
  const sortDir = sortDirParam === 'asc' ? 'asc' : 'desc';

  let range: KyivShift;

  if (queryParams.from && queryParams.to) {
    range = {
      label: 'Скользящее окно',
      start: String(queryParams.from),
      end: String(queryParams.to)
    };
  } else if (period === 'week') {
    range = getWeekRange();
  } else if (period === 'month') {
    range = getMonthRange();
  } else {
    if (day === 'yesterday') {
      if (!shiftParam || !['1', '2', '3', '4'].includes(String(shiftParam))) {
        return sendJson(res, 400, {
          success: false,
          error: 'Укажите номер смены для вчерашнего дня'
        });
      }
      const shiftNum = Number(shiftParam) as 1 | 2 | 3 | 4;
      range = getShiftRangeForDay('yesterday', shiftNum);
    } else {
      if (shiftParam && ['1', '2', '3', '4'].includes(String(shiftParam))) {
        const shiftNum = Number(shiftParam) as 1 | 2 | 3 | 4;
        range = getShiftRangeForDay('today', shiftNum);
      } else {
        range = getCurrentKyivShift();
      }
    }
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
      'x-om-auth-token': token
    };

    let metricsItems: any[] = [];
    let metricsOffset = 0;
    const metricsLimit = 100;
    const maxMetricsPages = 5;

    for (let page = 0; page < maxMetricsPages; page++) {
      const url = `https://omapi.onlymonster.ai/api/v0/users/metrics?from=${encodeURIComponent(range.start)}&to=${encodeURIComponent(range.end)}&offset=${metricsOffset}&limit=${metricsLimit}`;
      let response: Response;
      try {
        response = await fetchWithTimeout(url, headers);
      } catch (err: any) {
        return sendJson(res, 200, {
          success: false,
          error: "Ошибка соединения с OnlyMonster API при запросе метрик операторов."
        });
      }

      if (!response.ok) {
        let errText = `Ошибка OnlyMonster API (${response.status})`;
        try {
          const errBody = await response.json();
          if (errBody && (errBody.error || errBody.message)) {
            errText = errBody.error || errBody.message;
          }
        } catch (e) {}
        return sendJson(res, 200, { success: false, error: errText });
      }

      const body: any = await response.json();
      let pageItems: any[] = [];
      if (Array.isArray(body)) {
        pageItems = body;
      } else if (body && typeof body === 'object') {
        pageItems = body.items || body.metrics || body.data || body.results || [];
      }

      metricsItems.push(...pageItems);
      if (pageItems.length < metricsLimit) break;
      metricsOffset += metricsLimit;
    }

    let membersMap = new Map<string, { name: string; customName: string; avatar: string }>();
    let memberOffset = 0;
    const memberLimit = 50;
    const maxMemberPages = 10;

    for (let page = 0; page < maxMemberPages; page++) {
      const url = `https://omapi.onlymonster.ai/api/v0/members?limit=${memberLimit}&offset=${memberOffset}`;
      let response: Response;
      try {
        response = await fetchWithTimeout(url, headers);
      } catch (err) {
        break;
      }

      if (!response.ok) break;

      const body: any = await response.json();
      let pageMembers: any[] = [];
      if (Array.isArray(body)) {
        pageMembers = body;
      } else if (body && typeof body === 'object') {
        pageMembers = body.members || body.users || body.items || body.data || [];
      }

      for (const m of pageMembers) {
        const id = String(m.id || m.user_id || m.member_id || '');
        if (id) {
          membersMap.set(id, {
            name: m.name || m.username || m.display_name || '',
            customName: m.custom_name || m.customName || m.custom_title || '',
            avatar: m.avatar || m.avatar_url || m.photo || m.image || ''
          });
        }
      }

      if (pageMembers.length < memberLimit) break;
      memberOffset += memberLimit;
    }

    const operatorsMap = new Map<string, {
      user_id: string;
      name: string;
      avatar: string;
      messages_count: number;
      paid_messages_count: number;
      sold_messages_count: number;
      earnings: number;
      reply_time_sum: number;
      reply_time_count: number;
      fans_count: number;
      creator_ids: Set<string>;
    }>();

    for (const item of metricsItems) {
      const messagesCount = typeof item.messages_count === 'number'
        ? item.messages_count
        : (item.messages || item.sent_messages || 0);

      if (messagesCount > 0) {
        const userId = String(item.user_id || item.id || item.member_id || '');
        const memberInfo = membersMap.get(userId);

        const displayName = (memberInfo && (memberInfo.customName || memberInfo.name))
          ? (memberInfo.customName || memberInfo.name)
          : (item.user_name || item.name || `Оператор #${userId || '?'}`);

        const avatar = memberInfo?.avatar || item.avatar || item.avatar_url || '';

        const paidMessagesCount = typeof item.paid_messages_count === 'number'
          ? item.paid_messages_count
          : (item.paid_messages || 0);

        const soldMessagesCount = typeof item.sold_messages_count === 'number'
          ? item.sold_messages_count
          : (item.sold_messages || 0);

        const fansCount = typeof item.fans_count === 'number'
          ? item.fans_count
          : (typeof item.fans === 'number' ? item.fans : (typeof item.dialogs_count === 'number' ? item.dialogs_count : 0));

        const soldMessagesPrice = typeof item.sold_messages_price_sum === 'number'
          ? item.sold_messages_price_sum
          : (parseFloat(item.sold_messages_price_sum) || 0);

        const soldPostsPrice = typeof item.sold_posts_price_sum === 'number'
          ? item.sold_posts_price_sum
          : (parseFloat(item.sold_posts_price_sum) || 0);

        const tipsAmount = typeof item.tips_amount_sum === 'number'
          ? item.tips_amount_sum
          : (parseFloat(item.tips_amount_sum) || 0);

        const itemEarnings = soldMessagesPrice + soldPostsPrice + tipsAmount;

        const replyTimeAvg = typeof item.reply_time_avg === 'number'
          ? item.reply_time_avg
          : (typeof item.reply_time === 'number' ? item.reply_time : null);

        let rawCreatorIds: any[] = [];
        if (Array.isArray(item.creator_ids)) rawCreatorIds = item.creator_ids;
        else if (Array.isArray(item.creators)) rawCreatorIds = item.creators;
        else if (item.creator_id !== undefined && item.creator_id !== null) rawCreatorIds = [item.creator_id];

        const existing = operatorsMap.get(userId);
        if (existing) {
          existing.messages_count += messagesCount;
          existing.paid_messages_count += paidMessagesCount;
          existing.sold_messages_count += soldMessagesCount;
          existing.earnings += itemEarnings;
          existing.fans_count += fansCount;
          if (replyTimeAvg !== null) {
            existing.reply_time_sum += replyTimeAvg;
            existing.reply_time_count += 1;
          }
          for (const cId of rawCreatorIds) {
            if (cId !== undefined && cId !== null && cId !== '') {
              existing.creator_ids.add(String(cId));
            }
          }
        } else {
          const creatorSet = new Set<string>();
          for (const cId of rawCreatorIds) {
            if (cId !== undefined && cId !== null && cId !== '') {
              creatorSet.add(String(cId));
            }
          }
          operatorsMap.set(userId, {
            user_id: userId,
            name: displayName,
            avatar,
            messages_count: messagesCount,
            paid_messages_count: paidMessagesCount,
            sold_messages_count: soldMessagesCount,
            earnings: itemEarnings,
            reply_time_sum: replyTimeAvg !== null ? replyTimeAvg : 0,
            reply_time_count: replyTimeAvg !== null ? 1 : 0,
            fans_count: fansCount,
            creator_ids: creatorSet
          });
        }
      }
    }

    const rawOperators = Array.from(operatorsMap.values()).map(op => ({
      user_id: op.user_id,
      name: op.name,
      avatar: op.avatar,
      messages_count: op.messages_count,
      paid_messages_count: op.paid_messages_count,
      sold_messages_count: op.sold_messages_count,
      fans_count: op.fans_count,
      earnings: Math.round(op.earnings * 100) / 100,
      reply_time_avg: op.reply_time_count > 0 ? Math.round(op.reply_time_sum / op.reply_time_count) : null,
      creator_ids: Array.from(op.creator_ids)
    }));

    const totalPaidMsg = rawOperators.reduce((acc, op) => acc + op.paid_messages_count, 0);
    const totalFans = rawOperators.reduce((acc, op) => acc + op.fans_count, 0);
    const teamPpvPerFanRatio = totalPaidMsg / Math.max(totalFans, 1);

    const operators = rawOperators.map(op => {
      const targetPpvSent = Math.round((op.fans_count || 0) * teamPpvPerFanRatio);
      const conversionPct = op.paid_messages_count > 0
        ? Math.round((op.sold_messages_count / op.paid_messages_count) * 100)
        : 0;

      return {
        ...op,
        gauges: {
          messages: {
            value: op.messages_count,
            target: 80,
            max: 120
          },
          reply_time: {
            value: op.reply_time_avg,
            goodThreshold: 110,
            okThreshold: 300,
            max: 600
          },
          ppv_sent: {
            value: op.paid_messages_count,
            target: targetPpvSent,
            max: Math.max(Math.round(targetPpvSent * 2), Math.round(op.paid_messages_count * 1.1), 10)
          },
          ppv_sold: {
            value: conversionPct,
            okThreshold: 12,
            goodThreshold: 20,
            ultraThreshold: 35,
            max: 100
          }
        }
      };
    });

    operators.sort((a, b) => {
      let valA = 0;
      let valB = 0;

      if (validSortBy === 'reply_time') {
        const rtA = a.reply_time_avg;
        const rtB = b.reply_time_avg;
        if (rtA === null && rtB === null) return 0;
        if (rtA === null) return 1;
        if (rtB === null) return -1;
        valA = rtA;
        valB = rtB;
      } else if (validSortBy === 'ppv_sent') {
        valA = a.paid_messages_count;
        valB = b.paid_messages_count;
      } else if (validSortBy === 'ppv_sold') {
        valA = a.sold_messages_count;
        valB = b.sold_messages_count;
      } else if (validSortBy === 'earnings') {
        valA = a.earnings;
        valB = b.earnings;
      } else {
        valA = a.messages_count;
        valB = b.messages_count;
      }

      return sortDir === 'asc' ? valA - valB : valB - valA;
    });

    return sendJson(res, 200, {
      success: true,
      period: {
        mode: period,
        day: period === 'shift' ? day : undefined,
        shift: period === 'shift' ? (shiftParam || getCurrentKyivShiftIndex()) : undefined
      },
      shift: {
        label: range.label,
        start: range.start,
        end: range.end
      },
      operators
    });
  } catch (err: any) {
    return sendJson(res, 200, {
      success: false,
      error: `Внутренняя ошибка сервера: ${err.message || err}`
    });
  }
}

/* =========================================================================
   3. SHIFT COMPARISON LOGIC
   ========================================================================= */

async function fetchShiftMetrics(
  url: string,
  headers: Record<string, string>
): Promise<{ totalMessages: number; totalEarnings: number; operatorCount: number; error?: string }> {
  let totalMessages = 0;
  let totalEarnings = 0;
  const userSet = new Set<string>();

  let offset = 0;
  const limit = 100;
  const maxPages = 3;

  for (let page = 0; page < maxPages; page++) {
    const pageUrl = `${url}&offset=${offset}&limit=${limit}`;
    let response: Response;
    try {
      response = await fetchWithTimeout(pageUrl, headers, 8000);
    } catch (err: any) {
      return { totalMessages: 0, totalEarnings: 0, operatorCount: 0, error: err.message };
    }

    if (!response.ok) break;

    const body: any = await response.json();
    let pageItems: any[] = [];
    if (Array.isArray(body)) {
      pageItems = body;
    } else if (body && typeof body === 'object') {
      pageItems = body.items || body.metrics || body.data || body.results || [];
    }

    for (const item of pageItems) {
      const msgCount = typeof item.messages_count === 'number'
        ? item.messages_count
        : (item.messages || item.sent_messages || 0);

      if (msgCount > 0) {
        totalMessages += msgCount;

        const soldMsgs = typeof item.sold_messages_price_sum === 'number'
          ? item.sold_messages_price_sum
          : (parseFloat(item.sold_messages_price_sum) || 0);
        const soldPosts = typeof item.sold_posts_price_sum === 'number'
          ? item.sold_posts_price_sum
          : (parseFloat(item.sold_posts_price_sum) || 0);
        const tips = typeof item.tips_amount_sum === 'number'
          ? item.tips_amount_sum
          : (parseFloat(item.tips_amount_sum) || 0);

        totalEarnings += (soldMsgs + soldPosts + tips);

        const userId = String(item.user_id || item.id || item.member_id || '');
        if (userId) {
          userSet.add(userId);
        }
      }
    }

    if (pageItems.length < limit) break;
    offset += limit;
  }

  return {
    totalMessages,
    totalEarnings: Math.round(totalEarnings * 100) / 100,
    operatorCount: userSet.size
  };
}

async function handleShiftComparison(req: any, res: any, queryParams: Record<string, string>) {
  const omToken = await getOmToken();
  if (!omToken || !omToken.trim() || omToken.startsWith("om_token_fc269e0")) {
    return sendJson(res, 200, {
      success: false,
      not_configured: true,
      error: "API-ключ OnlyMonster не настроен."
    });
  }

  const token = omToken.trim();
  const headers = {
    'Content-Type': 'application/json',
    'x-om-auth-token': token
  };

  const scope = (queryParams.scope || 'day').toLowerCase() === 'week' ? 'week' : 'day';
  const day = (queryParams.day || 'today').toLowerCase() === 'yesterday' ? 'yesterday' : 'today';

  const startTime = Date.now();

  try {
    if (scope === 'day') {
      const currentShiftIdx = getCurrentKyivShiftIndex();
      const shiftsRes: any[] = [];

      let accountShiftTotals: { 1: number; 2: number; 3: number; 4: number } = { 1: 0, 2: 0, 3: 0, 4: 0 };
      try {
        accountShiftTotals = await getAllAccountsShiftEarnings(token, day);
      } catch (errAcc: any) {
        console.error('[shift-comparison] Error in getAllAccountsShiftEarnings:', errAcc?.message || errAcc);
      }

      for (let s = 1; s <= 4; s++) {
        const isFuture = day === 'today' && s > currentShiftIdx;
        const config = SHIFTS_CONFIG[s - 1];

        if (isFuture) {
          shiftsRes.push({
            index: s,
            label: config.label,
            totalMessages: null,
            totalEarnings: null,
            accountEarnings: null,
            diff: null,
            operatorCount: 0,
            isFuture: true
          });
          continue;
        }

        const range = getShiftRangeForDay(day, s as 1 | 2 | 3 | 4);
        const url = `https://omapi.onlymonster.ai/api/v0/users/metrics?from=${encodeURIComponent(range.start)}&to=${encodeURIComponent(range.end)}`;

        const data = await fetchShiftMetrics(url, headers);

        const accountEarnings = accountShiftTotals[s as 1 | 2 | 3 | 4] ?? 0;
        const operatorEarnings = data.totalEarnings ?? 0;
        const diff = Math.round((accountEarnings - operatorEarnings) * 100) / 100;

        shiftsRes.push({
          index: s,
          label: range.label,
          totalMessages: data.totalMessages,
          totalEarnings: operatorEarnings,
          accountEarnings,
          diff,
          operatorCount: data.operatorCount,
          isFuture: false
        });

        await new Promise(r => setTimeout(r, 100));
      }

      const validShifts = shiftsRes.filter(s => !s.isFuture && s.totalEarnings !== null);
      let strongestIndex: number | null = null;
      let weakestIndex: number | null = null;

      if (validShifts.length > 0) {
        let maxVal = -1;
        let minVal = Infinity;

        for (const s of validShifts) {
          if (s.totalEarnings > maxVal) {
            maxVal = s.totalEarnings;
            strongestIndex = s.index;
          }
          if (s.totalEarnings > 0 && s.totalEarnings < minVal) {
            minVal = s.totalEarnings;
            weakestIndex = s.index;
          }
        }
        if (weakestIndex === null && validShifts.length > 1) {
          weakestIndex = validShifts[0].index;
        }
      }

      return sendJson(res, 200, {
        success: true,
        scope: 'day',
        day,
        shifts: shiftsRes,
        strongestIndex,
        weakestIndex
      });
    } else {
      const todayStr = getKyivDateStr(0);
      const todayDate = new Date(`${todayStr}T00:00:00Z`);
      const dayOfWeek = todayDate.getUTCDay();
      const daysSinceMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;

      const dates: string[] = [];
      for (let i = daysSinceMon; i >= 0; i--) {
        dates.push(getKyivDateStr(-i));
      }

      const currentShiftIdx = getCurrentKyivShiftIndex();
      const tasks: { dateStr: string; shiftIndex: 1 | 2 | 3 | 4 }[] = [];

      for (const dStr of dates) {
        const isToday = dStr === todayStr;
        for (let s = 1; s <= 4; s++) {
          if (isToday && s > currentShiftIdx) continue;
          tasks.push({ dateStr: dStr, shiftIndex: s as 1 | 2 | 3 | 4 });
        }
      }

      const shiftStats: Record<number, { totalMessages: number; totalEarnings: number; daysCounted: number }> = {
        1: { totalMessages: 0, totalEarnings: 0, daysCounted: 0 },
        2: { totalMessages: 0, totalEarnings: 0, daysCounted: 0 },
        3: { totalMessages: 0, totalEarnings: 0, daysCounted: 0 },
        4: { totalMessages: 0, totalEarnings: 0, daysCounted: 0 }
      };

      let isPartial = false;
      const batchSize = 5;

      for (let i = 0; i < tasks.length; i += batchSize) {
        if (Date.now() - startTime > 7500) {
          isPartial = true;
          break;
        }

        const chunk = tasks.slice(i, i + batchSize);
        await Promise.all(chunk.map(async (task) => {
          const range = getShiftRangeForDate(task.dateStr, task.shiftIndex);
          const url = `https://omapi.onlymonster.ai/api/v0/users/metrics?from=${encodeURIComponent(range.start)}&to=${encodeURIComponent(range.end)}`;
          const data = await fetchShiftMetrics(url, headers);

          const st = shiftStats[task.shiftIndex];
          st.totalMessages += data.totalMessages;
          st.totalEarnings += data.totalEarnings;
          st.daysCounted += 1;
        }));

        if (i + batchSize < tasks.length) {
          await new Promise(r => setTimeout(r, 150));
        }
      }

      const shiftsRes = SHIFTS_CONFIG.map(config => {
        const st = shiftStats[config.index];
        const daysCounted = st ? st.daysCounted : 0;
        const totalEarnings = st ? Math.round(st.totalEarnings * 100) / 100 : 0;
        const totalMessages = st ? st.totalMessages : 0;
        const avgEarningsPerDay = daysCounted > 0 ? Math.round((totalEarnings / daysCounted) * 100) / 100 : 0;
        const avgMessagesPerDay = daysCounted > 0 ? Math.round(totalMessages / daysCounted) : 0;

        return {
          index: config.index,
          label: config.label,
          totalMessages,
          totalEarnings,
          daysCounted,
          avgEarningsPerDay,
          avgMessagesPerDay,
          isFuture: daysCounted === 0
        };
      });

      const activeShifts = shiftsRes.filter(s => s.daysCounted > 0);
      let strongestIndex: number | null = null;
      let weakestIndex: number | null = null;

      if (activeShifts.length > 0) {
        let maxVal = -1;
        let minVal = Infinity;

        for (const s of activeShifts) {
          if (s.avgEarningsPerDay > maxVal) {
            maxVal = s.avgEarningsPerDay;
            strongestIndex = s.index;
          }
          if (s.avgEarningsPerDay > 0 && s.avgEarningsPerDay < minVal) {
            minVal = s.avgEarningsPerDay;
            weakestIndex = s.index;
          }
        }
        if (weakestIndex === null && activeShifts.length > 1) {
          weakestIndex = activeShifts[0].index;
        }
      }

      return sendJson(res, 200, {
        success: true,
        scope: 'week',
        weekLabel: "Текущая неделя",
        shifts: shiftsRes,
        strongestIndex,
        weakestIndex,
        partial: isPartial
      });
    }
  } catch (err: any) {
    return sendJson(res, 200, {
      success: false,
      error: `Ошибка при обработке сравнения смен: ${err.message || err}`
    });
  }
}

/* =========================================================================
   4. OPERATOR MODEL BREAKDOWN LOGIC
   ========================================================================= */

async function handleOperatorModelBreakdown(req: any, res: any, queryParams: Record<string, string>) {
  const omToken = await getOmToken();
  if (!omToken || !omToken.trim() || omToken.startsWith("om_token_fc269e0")) {
    return sendJson(res, 200, {
      success: false,
      not_configured: true,
      error: "API-ключ OnlyMonster не настроен."
    });
  }

  const token = omToken.trim();
  const headers = {
    'Content-Type': 'application/json',
    'x-om-auth-token': token
  };

  const userId = queryParams.user_id || queryParams.userId;
  const creatorId = queryParams.creator_id || queryParams.creatorId;
  const start = queryParams.start;
  const end = queryParams.end;

  if (!userId || !creatorId || !start || !end) {
    return sendJson(res, 400, {
      success: false,
      error: "Отсутствуют обязательные параметры (user_id, creator_id, start, end)."
    });
  }

  try {
    const url = `https://omapi.onlymonster.ai/api/v0/users/metrics?from=${encodeURIComponent(start)}&to=${encodeURIComponent(end)}&user_ids=${encodeURIComponent(userId)}&creator_ids=${encodeURIComponent(creatorId)}&offset=0&limit=100`;

    let response: Response;
    try {
      response = await fetchWithTimeout(url, headers, 8000);
    } catch (err: any) {
      return sendJson(res, 200, {
        success: false,
        error: "Ошибка подключения к OnlyMonster API."
      });
    }

    if (!response.ok) {
      return sendJson(res, 200, {
        success: false,
        error: `OnlyMonster API вернул статус ${response.status}`
      });
    }

    const body: any = await response.json();
    let pageItems: any[] = [];
    if (Array.isArray(body)) {
      pageItems = body;
    } else if (body && typeof body === 'object') {
      pageItems = body.items || body.metrics || body.data || body.results || [];
    }

    let messagesCount = 0;
    let paidMessagesCount = 0;
    let soldMessagesCount = 0;
    let totalEarnings = 0;
    let replyTimeSum = 0;
    let replyTimeCount = 0;

    for (const item of pageItems) {
      const msgCount = typeof item.messages_count === 'number'
        ? item.messages_count
        : (item.messages || item.sent_messages || 0);

      messagesCount += msgCount;

      const paidMsgs = typeof item.paid_messages_count === 'number'
        ? item.paid_messages_count
        : (item.paid_messages || 0);
      paidMessagesCount += paidMsgs;

      const soldMsgs = typeof item.sold_messages_count === 'number'
        ? item.sold_messages_count
        : (item.sold_messages || 0);
      soldMessagesCount += soldMsgs;

      const soldMsgsPrice = typeof item.sold_messages_price_sum === 'number'
        ? item.sold_messages_price_sum
        : (parseFloat(item.sold_messages_price_sum) || 0);
      const soldPostsPrice = typeof item.sold_posts_price_sum === 'number'
        ? item.sold_posts_price_sum
        : (parseFloat(item.sold_posts_price_sum) || 0);
      const tipsAmount = typeof item.tips_amount_sum === 'number'
        ? item.tips_amount_sum
        : (parseFloat(item.tips_amount_sum) || 0);

      totalEarnings += (soldMsgsPrice + soldPostsPrice + tipsAmount);

      const replyTime = typeof item.reply_time_avg === 'number'
        ? item.reply_time_avg
        : (typeof item.reply_time === 'number' ? item.reply_time : null);

      if (replyTime !== null) {
        replyTimeSum += replyTime;
        replyTimeCount += 1;
      }
    }

    const replyTimeAvg = replyTimeCount > 0 ? Math.round(replyTimeSum / replyTimeCount) : null;

    return sendJson(res, 200, {
      success: true,
      user_id: userId,
      creator_id: creatorId,
      metrics: {
        messages_count: messagesCount,
        paid_messages_count: paidMessagesCount,
        sold_messages_count: soldMessagesCount,
        reply_time_avg: replyTimeAvg,
        earnings: Math.round(totalEarnings * 100) / 100
      }
    });
  } catch (err: any) {
    return sendJson(res, 200, {
      success: false,
      error: `Ошибка получения детализации оператора по модели: ${err.message || err}`
    });
  }
}

/* =========================================================================
   5. ACCOUNT DETAIL LOGIC
   ========================================================================= */

async function handleAccountDetail(req: any, res: any, queryParams: Record<string, string>) {
  const accountId = queryParams.account_id || queryParams.accountId;
  if (!accountId || typeof accountId !== 'string' || !accountId.trim()) {
    return sendJson(res, 400, { success: false, error: "Missing required 'account_id' parameter" });
  }

  const omToken = await getOmToken();
  if (!omToken || !omToken.trim() || omToken.startsWith("om_token_fc269e0")) {
    return sendJson(res, 200, {
      success: false,
      not_configured: true,
      error: "API-ключ OnlyMonster не настроен. Укажите переменную ONLYMONSTER_API_KEY в Vercel."
    });
  }

  let startISO = queryParams.start;
  let endISO = queryParams.end;

  if (!startISO || !endISO) {
    const dayParam = (queryParams.day || 'today').toLowerCase();
    const day = dayParam === 'yesterday' ? 'yesterday' : 'today';
    const range = getOperationalDayRange(day);
    startISO = startISO || range.start;
    endISO = endISO || range.end;
  }

  const cleanToken = omToken.trim();

  try {
    const [txResult, subResult] = await Promise.all([
      (async () => {
        let items: any[] = [];
        let cursor: string | null = null;
        let page = 0;
        const maxPages = 5;

        do {
          page++;
          let url = `https://omapi.onlymonster.ai/api/v0/platforms/onlyfans/accounts/${encodeURIComponent(accountId)}/transactions?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}&limit=1000`;
          if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;

          const response = await fetchWithTimeout(url, {
            'Content-Type': 'application/json',
            'x-om-auth-token': cleanToken
          }, 12000);

          if (!response.ok) break;

          const body: any = await response.json();
          let pageItems: any[] = [];
          cursor = null;

          if (Array.isArray(body)) {
            pageItems = body;
          } else if (body && typeof body === 'object') {
            if (Array.isArray(body.transactions)) pageItems = body.transactions;
            else if (Array.isArray(body.items)) pageItems = body.items;
            else if (Array.isArray(body.data)) pageItems = body.data;
            else if (Array.isArray(body.results)) pageItems = body.results;

            if (typeof body.cursor === 'string' && body.cursor) cursor = body.cursor;
            else if (typeof body.next_cursor === 'string' && body.next_cursor) cursor = body.next_cursor;
            else if (body.pagination && typeof body.pagination.cursor === 'string') cursor = body.pagination.cursor;
            else if (body.pagination && typeof body.pagination.next_cursor === 'string') cursor = body.pagination.next_cursor;
          }

          items.push(...pageItems);
        } while (cursor && page < maxPages);

        return items;
      })(),

      (async () => {
        let items: any[] = [];
        let cursor: string | null = null;
        let page = 0;
        const maxPages = 5;

        do {
          page++;
          let url = `https://omapi.onlymonster.ai/api/v0/platforms/onlyfans/accounts/${encodeURIComponent(accountId)}/subscriptions?start=${encodeURIComponent(startISO)}&end=${encodeURIComponent(endISO)}&limit=1000`;
          if (cursor) url += `&cursor=${encodeURIComponent(cursor)}`;

          const response = await fetchWithTimeout(url, {
            'Content-Type': 'application/json',
            'x-om-auth-token': cleanToken
          }, 12000);

          if (!response.ok) break;

          const body: any = await response.json();
          let pageItems: any[] = [];
          cursor = null;

          if (Array.isArray(body)) {
            pageItems = body;
          } else if (body && typeof body === 'object') {
            if (Array.isArray(body.subscriptions)) pageItems = body.subscriptions;
            else if (Array.isArray(body.items)) pageItems = body.items;
            else if (Array.isArray(body.data)) pageItems = body.data;
            else if (Array.isArray(body.results)) pageItems = body.results;

            if (typeof body.cursor === 'string' && body.cursor) cursor = body.cursor;
            else if (typeof body.next_cursor === 'string' && body.next_cursor) cursor = body.next_cursor;
            else if (body.pagination && typeof body.pagination.cursor === 'string') cursor = body.pagination.cursor;
            else if (body.pagination && typeof body.pagination.next_cursor === 'string') cursor = body.pagination.next_cursor;
          }

          items.push(...pageItems);
        } while (cursor && page < maxPages);

        return items;
      })()
    ]);

    const txTypeMap: Record<string, { count: number; totalAmount: number }> = {};
    let totalTxCount = 0;
    let totalTxAmount = 0;

    for (const tx of txResult) {
      const status = (tx.status || tx.tx_status || tx.state || '').toString().toLowerCase();
      const isExcluded =
        status.includes('return') ||
        status.includes('refund') ||
        status.includes('chargeback') ||
        status === 'pending return' ||
        status === 'pending_return' ||
        status === 'refunded';

      if (!isExcluded) {
        const rawType = (tx.type || tx.tx_type || tx.category || 'unknown').toString().trim();
        const rawAmt = tx.amount !== undefined ? tx.amount : (tx.sum !== undefined ? tx.sum : 0);
        const val = typeof rawAmt === 'number' ? rawAmt : (parseFloat(rawAmt) || 0);

        if (!txTypeMap[rawType]) {
          txTypeMap[rawType] = { count: 0, totalAmount: 0 };
        }
        txTypeMap[rawType].count += 1;
        txTypeMap[rawType].totalAmount += val;

        totalTxCount += 1;
        totalTxAmount += val;
      }
    }

    const transactionsByType = Object.entries(txTypeMap).map(([type, data]) => ({
      type,
      count: data.count,
      totalAmount: Math.round(data.totalAmount * 100) / 100
    })).sort((a, b) => b.totalAmount - a.totalAmount);

    let newSubs = 0;
    let prolongSubs = 0;
    let returnedSubs = 0;
    let unknownActionSubs = 0;
    const subTypeMap: Record<string, number> = {};

    for (const sub of subResult) {
      const action = (sub.action || sub.event || '').toString().toLowerCase().trim();
      if (action === 'subscribe' || action === 'subscription' || action === 'new') {
        newSubs += 1;
      } else if (action === 'prolong' || action === 'renew' || action === 'renewed' || action === 'recurring') {
        prolongSubs += 1;
      } else if (action === 'return' || action === 'returned' || action === 'refund' || action === 'refunded' || action === 'chargeback') {
        returnedSubs += 1;
      } else {
        unknownActionSubs += 1;
      }

      const subType = (sub.type || sub.sub_type || sub.plan_type || 'regular').toString().trim() || 'unknown';
      subTypeMap[subType] = (subTypeMap[subType] || 0) + 1;
    }

    return sendJson(res, 200, {
      success: true,
      accountId,
      period: {
        start: startISO,
        end: endISO
      },
      summary: {
        totalTransactions: totalTxCount,
        totalAmount: Math.round(totalTxAmount * 100) / 100,
        totalSubscriptions: subResult.length
      },
      transactionsByType,
      subscriptions: {
        new: newSubs,
        renewals: prolongSubs,
        returned: returnedSubs,
        unknownAction: unknownActionSubs,
        byType: subTypeMap,
        byAction: {
          subscribe: newSubs,
          prolong: prolongSubs,
          return: returnedSubs,
          unknown: unknownActionSubs
        }
      }
    });

  } catch (err: any) {
    return sendJson(res, 200, {
      success: false,
      error: `Error processing account detail: ${err.message || err}`
    });
  }
}

/* =========================================================================
   MAIN ROUTER
   ========================================================================= */

export default async function handler(req: any, res: any) {
  const method = req.method || 'GET';
  if (method !== 'GET') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  let queryParams: Record<string, string> = {};
  if (req.query && typeof req.query === 'object') {
    queryParams = req.query as Record<string, string>;
  } else if (req.url) {
    try {
      const parsedUrl = new URL(req.url, 'http://localhost');
      parsedUrl.searchParams.forEach((val, key) => {
        queryParams[key] = val;
      });
    } catch (e) {}
  }

  let resource = (queryParams.resource || '').toLowerCase().trim();

  if (!resource) {
    if (queryParams.accounts) resource = 'earnings';
    else if ((queryParams.user_id || queryParams.userId) && (queryParams.creator_id || queryParams.creatorId)) resource = 'operator-model-breakdown';
    else if (queryParams.account_id || queryParams.accountId) resource = 'account-detail';
    else if (queryParams.scope) resource = 'shift-comparison';
    else resource = 'shift-operators';
  }

  switch (resource) {
    case 'earnings':
      return handleEarnings(req, res, queryParams);
    case 'shift-operators':
      return handleShiftOperators(req, res, queryParams);
    case 'shift-comparison':
      return handleShiftComparison(req, res, queryParams);
    case 'operator-model-breakdown':
      return handleOperatorModelBreakdown(req, res, queryParams);
    case 'account-detail':
      return handleAccountDetail(req, res, queryParams);
    default:
      return sendJson(res, 400, { success: false, error: `Unknown resource '${resource}'` });
  }
}
