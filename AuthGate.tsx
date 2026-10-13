import React, { useEffect, useRef, useState } from 'react';
import { ICONS } from './constants';

export type SignedInUser = { id: string; username: string; role: 'admin' | 'owner'; cloudUrl: string };
export async function signOut() {
  const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'logout' }) });
  if (!response.ok) throw new Error('Не удалось выйти. Проверьте соединение.');
  localStorage.removeItem('continental_auth');
  localStorage.removeItem('continental_role');
  window.location.reload();
}

export default function AuthGate({ children }: { children: (user: SignedInUser) => React.ReactNode }) {
  const [user, setUser] = useState<SignedInUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const loginGeneration = useRef(0);

  useEffect(() => {
    let alive = true, checking = false;
    const check = async () => {
      if (checking) return;
      checking = true;
      const generation = loginGeneration.current;
      try {
        let response = await fetch('/api/auth', { cache: 'no-store' });
        if (response.status === 401) response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refresh' }) });
        const data = await response.json();
        if (!alive || generation !== loginGeneration.current) return;
        if (response.ok) { setUser(data.user); setError(''); }
        else if (response.status === 401 || response.status === 403) { setUser(null); }
        else setError(data.error || 'Сервис входа недоступен. Повторите попытку.');
      } catch { if (alive) setError('Не удалось проверить вход. Проверьте соединение.'); }
      finally { checking = false; if (alive) setLoading(false); }
    };
    void check();
    const timer = window.setInterval(() => void check(), 60000);
    window.addEventListener('focus', check);
    return () => { alive = false; clearInterval(timer); window.removeEventListener('focus', check); };
  }, []);

  const login = async (event: React.FormEvent) => {
    event.preventDefault(); loginGeneration.current++; setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'login', username, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Не удалось войти');
      setPassword(''); setUser(data.user);
    } catch (err) { setError(err instanceof Error ? err.message : 'Не удалось войти'); }
    finally { setBusy(false); }
  };

  if (user) return <>{children(user)}</>;
  return <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
    <div className="w-full max-w-md glass-card p-8 border border-slate-800/50 rounded-3xl shadow-2xl">
      <div className="flex flex-col items-center gap-6">
        <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20"><ICONS.Lock className="text-white" size={32} /></div>
        <div className="text-center"><h1 className="text-2xl font-bold text-white mb-2">Continental Vault</h1><p className="text-slate-400 text-sm">{loading ? 'Проверяем вход…' : 'Вход в рабочий кабинет'}</p></div>
        {!loading && <form onSubmit={login} className="w-full space-y-4">
          <label className="block text-sm text-slate-300">Username<input type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required value={username} onChange={e => setUsername(e.target.value)} className="mt-2 w-full bg-slate-900/50 border border-slate-700 text-white px-4 py-3 rounded-xl" /></label>
          <label className="block text-sm text-slate-300">Пароль<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} className="mt-2 w-full bg-slate-900/50 border border-slate-700 text-white px-4 py-3 rounded-xl" /></label>
          {error && <p role="alert" className="text-rose-400 text-sm">{error}</p>}
          <button type="submit" disabled={busy} className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold py-3 rounded-xl">{busy ? 'Входим…' : 'Войти'}</button>
        </form>}
      </div>
    </div>
  </div>;
}
