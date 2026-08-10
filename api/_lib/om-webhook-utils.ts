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

  // 1. fans.tip.received -> payload.tip_id
  if (typeLower === 'fans.tip.received') {
    const tipId = payload?.tip_id || payload?.id;
    if (tipId) return String(tipId);
  }

  // 2. fans.ppv.purchased -> ${payload.account.account_id}:${payload.content_type}:${payload.content_id}:${payload.fan_id}
  if (typeLower === 'fans.ppv.purchased') {
    const accId = payload?.account?.account_id || payload?.account_id || '';
    const contentType = payload?.content_type || 'media';
    const contentId = payload?.content_id || payload?.id || '';
    const fanId = payload?.fan_id || payload?.user_id || '';
    if (contentId) {
      return `${accId}:${contentType}:${contentId}:${fanId}`;
    }
  }

  // 3. fans.subscription.new_subscriber -> ${payload.account.account_id}:${payload.fan_id}
  if (typeLower === 'fans.subscription.new_subscriber') {
    const accId = payload?.account?.account_id || payload?.account_id || '';
    const fanId = payload?.fan_id || payload?.user_id || '';
    if (accId || fanId) {
      return `${accId}:${fanId}`;
    }
  }

  // 4. vault.media_upload.created / vault.media_upload.updated -> ${payload.media_upload_id}:${payload.updated_at}
  if (typeLower === 'vault.media_upload.created' || typeLower === 'vault.media_upload.updated') {
    const mediaUploadId = payload?.media_upload_id || payload?.id || '';
    const updatedAt = payload?.updated_at || payload?.created_at || '';
    if (mediaUploadId) {
      return `${mediaUploadId}:${updatedAt}`;
    }
  }

  // 5. firewall.message_guard.violation.user / .om_api -> payload.violation_id
  if (
    typeLower === 'firewall.message_guard.violation.user' ||
    typeLower === 'firewall.message_guard.violation.om_api' ||
    typeLower.includes('violation')
  ) {
    const violationId = payload?.violation_id || payload?.id;
    if (violationId) return String(violationId);
  }

  // 6. chat.message -> payload.message.message_id
  if (typeLower === 'chat.message') {
    const msgId = payload?.message?.message_id || payload?.message_id || payload?.id;
    if (msgId) return String(msgId);
  }

  // 7. chat.message_sent / chat.message_error -> payload.send_id
  if (typeLower === 'chat.message_sent' || typeLower === 'chat.message_error') {
    const sendId = payload?.send_id || payload?.id;
    if (sendId) return String(sendId);
  }

  // Fallback: use x-om-webhook-id or fallback string
  if (webhookDeliveryId) {
    return String(webhookDeliveryId);
  }

  return String(payload?.id || `fallback_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);
}

export function extractEventDetails(payload: any) {
  const eventType = payload?.type || payload?.event || 'unknown';

  const accountId =
    payload?.account?.account_id ||
    payload?.account_id ||
    null;

  const platformAccountId =
    payload?.account?.platform_account_id ||
    payload?.platform_account_id ||
    null;

  const rawTs =
    payload?.created_at ||
    payload?.purchased_at ||
    payload?.tipped_at ||
    payload?.updated_at ||
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

