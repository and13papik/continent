/** Always use the authenticated, same-origin server. Never transmit saved database keys. */
export function cloudFetch(input: string | URL, options: RequestInit = {}) {
  const source = new URL(String(input));
  if (source.pathname !== '/rest/v1/app_storage') throw new Error('Unsupported cloud resource');
  const headers = new Headers();
  if (options.method === 'PATCH') {
    headers.set('Content-Type', 'application/json');
    headers.set('Prefer', 'return=representation');
  }
  let body = options.body;
  if (typeof body === 'string') {
    const parsed = JSON.parse(body);
    if (parsed.state) {
      const { syncKey, dbUrl, ...state } = parsed.state;
      parsed.state = state;
      body = JSON.stringify(parsed);
    }
  }
  return fetch(`/api/cloud?${source.searchParams}`, { ...options, headers, body, credentials: 'same-origin', cache: 'no-store' });
}
