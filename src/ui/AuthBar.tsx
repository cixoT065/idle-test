import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../store/useAuth';

/** Minimal magic-link auth UI. Hidden entirely when Supabase isn't configured. */
export function AuthBar() {
  const { configured, session, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  if (!configured) {
    return <div style={{ fontSize: 12, color: 'var(--disabled-text-color)' }}>Cloud sync: offline (configure Supabase)</div>;
  }
  if (loading) return <div style={{ fontSize: 12 }}>Checking session…</div>;

  if (session) {
    return (
      <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>☁ Synced as {session.user.email}</span>
        <button className="button-secondary" onClick={() => supabase!.auth.signOut()}>Sign out</button>
      </div>
    );
  }

  return (
    <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {sent ? (
        <span>Check your email for a sign-in link.</span>
      ) : (
        <>
          <input type="email" placeholder="email for cloud save" value={email} onChange={(e) => setEmail(e.target.value)} />
          <button
            className="button-secondary"
            disabled={!email}
            onClick={async () => {
              const { error } = await supabase!.auth.signInWithOtp({ email });
              if (!error) setSent(true);
            }}
          >
            Sign in / Cloud save
          </button>
        </>
      )}
    </div>
  );
}
