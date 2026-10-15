import React, { useEffect, useRef, useState } from 'react';
import { LogOut, UserRound } from 'lucide-react';
import { signOut, SignedInUser } from '../AuthGate';

export default function AccountMenu({ user }: { user: SignedInUser }) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setOpen(false); trigger.current?.focus(); }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);

  return <div className="ct-account-menu" ref={container} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
  }}>
    <button ref={trigger} type="button" className="ct-profile-trigger" aria-label="Мой профиль" title="Мой профиль" aria-expanded={open} aria-controls="account-details" onClick={() => setOpen(value => !value)}><UserRound size={18} /></button>
    {open && <section id="account-details" className="ct-profile-popover" aria-label="Мой профиль">
      <strong>{user.username}</strong><span>{user.role === 'owner' ? 'Владелец' : 'Администратор'}</span>
      <button type="button" onClick={() => { void signOut().catch(error => alert(error.message)); }}><LogOut size={16} />Выйти из аккаунта</button>
    </section>}
  </div>;
}
