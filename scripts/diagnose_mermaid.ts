import { getSupabaseClient } from '../api/_lib/supabase.js';

async function main() {
  const supabase = await getSupabaseClient();
  if (!supabase) {
    console.error('Supabase client could not be initialized (no credentials).');
    process.exit(1);
  }

  // 1. Find all accounts or search for Mermaid
  console.log('--- Step 0: Finding Mermaid account ---');
  const { data: recentEvents, error: err0 } = await supabase
    .from('om_webhook_events')
    .select('account_id, platform_account_id, payload')
    .limit(100);

  if (err0) {
    console.error('Error fetching sample events:', err0);
  }

  // Look through payloads for account names or "Mermaid"
  const accountMap = new Map();
  recentEvents?.forEach(e => {
    const p = e.payload?.payload || e.payload || {};
    const acc = p.account || {};
    const name = acc.name || acc.username || p.account_name || '';
    const accId = e.account_id || acc.id || p.account_id;
    const platId = e.platform_account_id || acc.platform_account_id || p.platform_account_id;
    if (name || accId) {
      accountMap.set(accId, { name, accId, platId });
    }
  });

  console.log('Discovered accounts from recent webhook payloads:');
  console.log(Array.from(accountMap.values()));

  // Let's also check all distinct account_id in om_webhook_events
  const { data: allAccs } = await supabase
    .from('om_webhook_events')
    .select('account_id, platform_account_id')
    .limit(500);
  
  const accIds = Array.from(new Set(allAccs?.map(a => a.account_id).filter(Boolean)));
  console.log('Distinct account_ids in om_webhook_events:', accIds);

  // Let's search for "Mermaid" specifically in payload
  const { data: mermaidEvents, error: mErr } = await supabase
    .from('om_webhook_events')
    .select('id, event_type, account_id, platform_account_id, payload, event_timestamp, received_at')
    .ilike('payload::text', '%mermaid%')
    .order('received_at', { ascending: false })
    .limit(20);

  console.log('\n--- Events containing "mermaid":', mermaidEvents?.length);
  if (mermaidEvents && mermaidEvents.length > 0) {
    console.log('Mermaid sample event:');
    console.log('account_id:', mermaidEvents[0].account_id);
    console.log('platform_account_id:', mermaidEvents[0].platform_account_id);
    console.log('Full payload sample:\n', JSON.stringify(mermaidEvents[0].payload, null, 2));
  }

  // If we find Mermaid account_id:
  const targetAccId = mermaidEvents?.[0]?.account_id || accIds[0];
  console.log(`\n========================================`);
  console.log(`Executing SQL Query for account_id = '${targetAccId}'`);
  console.log(`========================================\n`);

  const { data: rows, error: qErr } = await supabase
    .from('om_webhook_events')
    .select('id, event_type, account_id, platform_account_id, payload, event_timestamp, received_at')
    .eq('event_type', 'chat.message')
    .eq('account_id', targetAccId)
    .order('received_at', { ascending: false })
    .limit(20);

  if (qErr) {
    console.error('Query error:', qErr);
    return;
  }

  console.log(`Found ${rows?.length} rows for chat.message:\n`);

  const tableData = rows?.map(r => {
    const p = r.payload?.payload || r.payload || {};
    const msg = p.message || {};
    const acc = p.account || {};

    const from_id = msg.from_id ?? p.from_id ?? null;
    const fan_id = msg.fan_id ?? p.fan_id ?? null;
    const payload_platform_account_id = acc.platform_account_id ?? p.platform_account_id ?? null;
    const sender = p.sender ?? msg.sender ?? null;
    const is_incoming_flag = p.is_incoming ?? msg.is_incoming ?? null;
    const direction = p.direction ?? msg.direction ?? null;

    // Old logic:
    const old_isIncoming = Boolean(
      (from_id && fan_id && String(from_id) === String(fan_id)) ||
      is_incoming_flag === true ||
      direction === 'in' ||
      sender === 'fan'
    );
    const old_isOutgoing = !old_isIncoming;

    // New proposed logic:
    const new_isOutgoing = Boolean(
      (from_id && payload_platform_account_id && String(from_id) === String(payload_platform_account_id)) ||
      (from_id && r.platform_account_id && String(from_id) === String(r.platform_account_id)) ||
      sender === 'operator' ||
      sender === 'creator' ||
      sender === 'model' ||
      direction === 'out'
    );
    const new_isIncoming = Boolean(
      (from_id && fan_id && String(from_id) === String(fan_id)) ||
      sender === 'fan' ||
      direction === 'in' ||
      is_incoming_flag === true
    );

    return {
      id: r.id,
      event_type: r.event_type,
      account_id: r.account_id,
      platform_account_id: r.platform_account_id,
      from_id,
      fan_id,
      payload_platform_account_id,
      event_timestamp: r.event_timestamp,
      received_at: r.received_at,
      raw_msg_keys: Object.keys(msg),
      raw_p_keys: Object.keys(p),
      sender,
      old_isOutgoing,
      new_isOutgoing,
      new_isIncoming,
      text_preview: (msg.text || p.text || '').slice(0, 30)
    };
  });

  console.table(tableData);
  console.log('\nFull JSON representation of the first 3 rows:');
  console.log(JSON.stringify(rows?.slice(0, 3), null, 2));
}

main().catch(console.error);
