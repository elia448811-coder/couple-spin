import { useState } from 'react';
import { signOutUser } from '../utils/userAuth';

type LogoutButtonProps = {
  className?: string;
};

export function LogoutButton({ className = '' }: LogoutButtonProps) {
  const [busy, setBusy] = useState(false);

  const handleLogout = async () => {
    if (busy) return;
    setBusy(true);
    const result = await signOutUser();
    if (!result.ok) {
      setBusy(false);
      return;
    }
    window.location.reload();
  };

  return (
    <button
      type="button"
      className={`logout-top-btn pressable ${className}`.trim()}
      onClick={() => void handleLogout()}
      disabled={busy}
      aria-label="התנתקות מהחשבון"
      title="התנתקות"
    >
      <span className="logout-top-btn__icon" aria-hidden>
        ⎋
      </span>
      <span className="logout-top-btn__label">{busy ? '…' : 'התנתק'}</span>
    </button>
  );
}
