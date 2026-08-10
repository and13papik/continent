import { verifyOmWebhookSignature, computeDedupKey, extractEventDetails } from './_lib/om-webhook-utils.js';
import { getSupabaseClient } from './_lib/supabase.js';

export const config = {
  api: {
    bodyParser: false,
  },
};

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

async function getRawBody(req: any): Promise<string> {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf-8');
  if (req.body && typeof req.body === 'object') {
    return JSON.stringify(req.body);
  }

  return new Promise((resolve, reject) => {
    let chunks: any[] = [];
    req.on('data', (chunk: any) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', (err: any) => reject(err));
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { success: false, error: 'Method not allowed' });
  }

  try {
    const rawBody = await getRawBody(req);
    const headers = req.headers || {};

    const signatureHeader = headers['x-om-webhook-signature'] || headers['X-Om-Webhook-Signature'];
    const timestampHeader = headers['x-om-webhook-timestamp'] || headers['X-Om-Webhook-Timestamp'];
    const deliveryId = headers['x-om-webhook-id'] || headers['X-Om-Webhook-Id'] || null;

    const secret = process.env.WEBHOOK_SECRET || process.env.OM_WEBHOOK_SECRET || '';

    // Verify signature
    const { isValid, error: sigError } = verifyOmWebhookSignature(
      rawBody,
      signatureHeader,
      timestampHeader,
      secret
    );

    let parsedPayload: any = {};
    try {
      parsedPayload = JSON.parse(rawBody);
    } catch (e) {
      parsedPayload = {};
    }

    const { eventType, accountId, platformAccountId, eventTimestamp } = extractEventDetails(parsedPayload);
    const dedupKey = computeDedupKey(eventType, parsedPayload, deliveryId);

    if (!isValid) {
      console.warn(`[Webhook] Invalid signature attempt: ${sigError}`);
      return sendJson(res, 401, {
        success: false,
        error: `Unauthorized: ${sigError}`
      });
    }

    // Save event to Supabase
    const supabase = await getSupabaseClient();
    if (!supabase) {
      console.error('[Webhook] Supabase client is not configured. Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY in environment variables or Vercel KV.');
      return sendJson(res, 500, { 
        success: false, 
        error: 'Database client not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Vercel Environment Variables.' 
      });
    }

    const { error: dbError } = await supabase
      .from('om_webhook_events')
      .upsert(
        {
          event_type: eventType,
          dedup_key: dedupKey,
          account_id: accountId,
          platform_account_id: platformAccountId,
          payload: parsedPayload,
          webhook_delivery_id: deliveryId,
          event_timestamp: eventTimestamp,
          signature_valid: true,
          processed: false
        },
        { onConflict: 'event_type,dedup_key', ignoreDuplicates: true }
      );

    if (dbError) {
      console.error('[Webhook] Supabase insert error:', dbError);
      return sendJson(res, 500, { success: false, error: `Database insert failed: ${dbError.message}` });
    }

    // Return 200 OK immediately after successful DB write
    return sendJson(res, 200, { success: true, received: true });
  } catch (err: any) {
    console.error('[Webhook] Exception in webhook handler:', err);
    return sendJson(res, 500, { success: false, error: err.message || 'Internal server error' });
  }
}
