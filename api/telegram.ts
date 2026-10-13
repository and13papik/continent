import { json, readBody, requireSession } from './_lib/auth.js';

const ACTIONS = new Set(['sendMessage', 'sendPhoto', 'editMessageText']);
export default async function handler(req: any, res: any) {
  if (!await requireSession(req, res)) return;
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'Method not allowed' });
  const input = readBody(req);
  const action = input.action || (input.type === 'photo' ? 'sendPhoto' : 'sendMessage');
  if (!ACTIONS.has(action)) return json(res, 400, { ok: false, error: 'Недопустимая операция' });
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const defaultChat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !defaultChat) return json(res, 503, { ok: false, error: 'Telegram ещё не настроен на сервере' });
  const allowedChats = new Set([defaultChat, ...(process.env.TELEGRAM_ALLOWED_CHAT_IDS || '').split(',').map(v => v.trim()).filter(Boolean)]);
  const chat = String(input.chat_id || defaultChat);
  if (!allowedChats.has(chat)) return json(res, 403, { ok: false, error: 'Этот чат не разрешён' });
  const text = input.text || input.caption || '';
  if (typeof text !== 'string' || text.length > (action === 'sendPhoto' ? 1024 : 4096)) return json(res, 400, { ok: false, error: 'Недопустимая длина сообщения' });
  let replyMarkup: any;
  if (input.reply_markup || input.replyMarkup) {
    try { replyMarkup = typeof (input.reply_markup || input.replyMarkup) === 'string' ? JSON.parse(input.reply_markup || input.replyMarkup) : (input.reply_markup || input.replyMarkup); }
    catch { return json(res, 400, { ok: false, error: 'Некорректные кнопки' }); }
    if (JSON.stringify(replyMarkup).length > 4096) return json(res, 400, { ok: false, error: 'Слишком много кнопок' });
  }
  let body: FormData | string;
  let headers: Record<string, string> | undefined;
  if (action === 'sendPhoto') {
    const match = typeof input.image === 'string' && input.image.match(/^data:image\/(png|jpeg|jpg);base64,([A-Za-z0-9+/=]+)$/);
    if (!match || input.image.length > 3_800_000) return json(res, 400, { ok: false, error: 'Некорректное или слишком большое изображение' });
    const bytes = Buffer.from(match[2], 'base64');
    body = new FormData();
    body.append('chat_id', chat);
    body.append('photo', new Blob([new Uint8Array(bytes)], { type: `image/${match[1]}` }), 'report.jpg');
    body.append('caption', text);
    body.append('parse_mode', 'HTML');
    if (replyMarkup) body.append('reply_markup', JSON.stringify(replyMarkup));
  } else {
    if (action === 'editMessageText' && (!Number.isSafeInteger(input.message_id) || input.message_id <= 0)) return json(res, 400, { ok: false, error: 'Некорректный номер сообщения' });
    headers = { 'Content-Type': 'application/json' };
    body = JSON.stringify({ chat_id: chat, text, parse_mode: 'HTML', ...(action === 'editMessageText' ? { message_id: input.message_id } : {}), ...(replyMarkup ? { reply_markup: replyMarkup } : {}) });
  }
  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/${action}`, { method: 'POST', headers, body, signal: AbortSignal.timeout(20000), redirect: 'error' });
    const data = await response.json();
    if (!response.ok || !data.ok) return json(res, 502, { ok: false, error: 'Telegram не подтвердил отправку. Проверьте чат перед повтором.' });
    return json(res, 200, { ok: true, result: { message_id: data.result?.message_id } });
  } catch {
    // Fetch errors can contain the request URL, which includes the token. Never echo them.
    return json(res, 502, { ok: false, error: 'Не удалось подтвердить отправку. Проверьте чат перед повтором.' });
  }
}
