import crypto from 'crypto';

export function verifyOmWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  timestampHeader: string | null | undefined,
  secret: string
): { isValid: boolean; error?: string } {
  if (!secret) {
    return { isValid: false, error: 'WEBHOOK_SECRET is not configured' };
  }
  if (!signatureHeader) {
    return { isValid: false, error: 'Missing x-om-webhook-signature header' };
  }
  if (!timestampHeader) {
    return { isValid: false, error: 'Missing x-om-webhook-timestamp header' };
  }

  try {
    const signedContent = `${timestampHeader}.${rawBody}`;
    const hmac = crypto.createHmac('sha256', secret.trim());
    hmac.update(signedContent);
    const expectedHex = hmac.digest('hex').toLowerCase();
    const cleanReceivedHex = signatureHeader.trim().toLowerCase();

    const expectedBuf = Buffer.from(expectedHex, 'utf-8');
    const receivedBuf = Buffer.from(cleanReceivedHex, 'utf-8');

    if (expectedBuf.length !== receivedBuf.length) {
      return { isValid: false, error: 'Signature length mismatch' };
    }

    const isValid = crypto.timingSafeEqual(expectedBuf, receivedBuf);
    return { isValid, error: isValid ? undefined : 'Signature verification failed' };
  } catch (err: any) {
    return { isValid: false, error: `Signature verification exception: ${err.message || err}` };
  }
}

export function computeDedupKey(eventType: string, payload: any, webhookDeliveryId?: string | null): string {
  const typeLower = (eventType || '').toLowerCase().trim();

  // 1. fans.tip.received -> tip_id
  if (typeLower === 'fans.tip.received') {
    const tipId =
      payload?.payload?.tip_id ||
      payload?.payload?.tip?.id ||
      payload?.data?.tip_id ||
      payload?.data?.tip?.id ||
      payload?.tip_id ||
      payload?.tip?.id ||
      null;
    if (tipId) return String(tipId);
  }

  // 2. fans.ppv.purchased -> ${accId}:${contentType}:${contentId}:${fanId}
  if (typeLower === 'fans.ppv.purchased') {
    const accId =
      payload?.payload?.account?.account_id ||
      payload?.account?.account_id ||
      payload?.payload?.account_id ||
      payload?.account_id ||
      '';
    const contentType =
      payload?.payload?.content_type ||
      payload?.data?.content_type ||
      payload?.content_type ||
      'media';
    const contentId =
      payload?.payload?.content_id ||
      payload?.payload?.media_id ||
      payload?.data?.content_id ||
      payload?.content_id ||
      '';
    const fanId =
      payload?.payload?.fan_id ||
      payload?.payload?.user_id ||
      payload?.data?.fan_id ||
      payload?.fan_id ||
      '';
    if (contentId) {
      return `${accId}:${contentType}:${contentId}:${fanId}`;
    }
  }

  // 3. fans.subscription.new_subscriber -> ${accId}:${fanId}
  if (typeLower === 'fans.subscription.new_subscriber') {
    const accId =
      payload?.payload?.account?.account_id ||
      payload?.account?.account_id ||
      payload?.payload?.account_id ||
      payload?.account_id ||
      '';
    const fanId =
      payload?.payload?.fan_id ||
      payload?.payload?.subscriber_id ||
      payload?.payload?.user_id ||
      payload?.data?.fan_id ||
      payload?.fan_id ||
      '';
    if (accId || fanId) {
      return `${accId}:${fanId}`;
    }
  }

  // 4. vault.media_upload.created / vault.media_upload.updated -> ${mediaUploadId}:${updatedAt}
  if (typeLower === 'vault.media_upload.created' || typeLower === 'vault.media_upload.updated') {
    const mediaUploadId =
      payload?.payload?.media_upload_id ||
      payload?.payload?.media_id ||
      payload?.data?.media_upload_id ||
      payload?.media_upload_id ||
      '';
    const updatedAt =
      payload?.payload?.updated_at ||
      payload?.payload?.created_at ||
      payload?.data?.updated_at ||
      payload?.updated_at ||
      payload?.created_at ||
      '';
    if (mediaUploadId) {
      return `${mediaUploadId}:${updatedAt}`;
    }
  }

  // 5. firewall.message_guard.violation.user / .om_api -> violation_id
  if (
    typeLower === 'firewall.message_guard.violation.user' ||
    typeLower === 'firewall.message_guard.violation.om_api' ||
    typeLower.includes('violation')
  ) {
    const violationId =
      payload?.payload?.violation_id ||
      payload?.data?.violation_id ||
      payload?.violation_id ||
      null;
    if (violationId) return String(violationId);
  }

  // 6. chat.message -> message_id
  if (typeLower === 'chat.message') {
    const msgId =
      payload?.payload?.message?.message_id ||
      payload?.payload?.message?.id ||
      payload?.message?.message_id ||
      payload?.message?.id ||
      payload?.payload?.message_id ||
      payload?.data?.message?.message_id ||
      payload?.data?.message?.id ||
      payload?.data?.message_id ||
      payload?.message_id ||
      null;
    if (msgId) return String(msgId);
  }

  // 7. chat.message_sent / chat.message_error -> send_id
  if (typeLower === 'chat.message_sent' || typeLower === 'chat.message_error') {
    const sendId =
      payload?.payload?.send_id ||
      payload?.payload?.message_id ||
      payload?.payload?.message?.message_id ||
      payload?.data?.send_id ||
      payload?.send_id ||
      payload?.message_id ||
      null;
    if (sendId) return String(sendId);
  }

  // Fallback 1: deliveryId from x-om-webhook-id header
  if (webhookDeliveryId && String(webhookDeliveryId).trim()) {
    return String(webhookDeliveryId).trim();
  }

  // Fallback 2: root payload ID if present
  if (payload?.id && typeof payload.id === 'string' && payload.id.trim()) {
    return String(payload.id).trim();
  }

  // Fallback 3: generated unique string
  return `fallback_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export function extractEventDetails(payload: any) {
  const eventType = payload?.type || payload?.event || 'unknown';

  const accountId =
    payload?.payload?.account?.account_id ||
    payload?.account?.account_id ||
    payload?.payload?.account_id ||
    payload?.account_id ||
    null;

  const platformAccountId =
    payload?.payload?.account?.platform_account_id ||
    payload?.account?.platform_account_id ||
    payload?.payload?.platform_account_id ||
    payload?.platform_account_id ||
    null;

  const rawTs =
    payload?.payload?.message?.created_at ||
    payload?.message?.created_at ||
    payload?.payload?.created_at ||
    payload?.created_at ||
    payload?.payload?.purchased_at ||
    payload?.purchased_at ||
    payload?.payload?.tipped_at ||
    payload?.tipped_at ||
    payload?.payload?.updated_at ||
    payload?.updated_at ||
    payload?.payload?.timestamp ||
    payload?.timestamp ||
    null;

  let eventTimestamp: string | null = null;
  if (rawTs) {
    try {
      const d = new Date(rawTs);
      if (!isNaN(d.getTime())) {
        eventTimestamp = d.toISOString();
      }
    } catch (e) {
      eventTimestamp = null;
    }
  }

  return {
    eventType,
    accountId,
    platformAccountId,
    eventTimestamp
  };
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

