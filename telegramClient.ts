/** Telegram credentials stay on the server. Keep the existing Telegram response shape. */
export async function telegramFetch(action: 'sendMessage' | 'sendPhoto' | 'editMessageText', options: RequestInit): Promise<Response> {
  const payload: Record<string, unknown> = { action };
  if (options.body instanceof FormData) {
    for (const [name, value] of options.body.entries()) {
      if (value instanceof Blob) {
        if (value.size > 2_800_000) throw new Error('Изображение слишком большое. Уменьшите размер отчёта.');
        const bytes = new Uint8Array(await value.arrayBuffer());
        let binary = '';
        for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
        payload.image = `data:${value.type};base64,${btoa(binary)}`;
      } else payload[name] = value;
    }
  } else if (typeof options.body === 'string') Object.assign(payload, JSON.parse(options.body), { action });
  return fetch('/api/telegram', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: options.signal });
}
