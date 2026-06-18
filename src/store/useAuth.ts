import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useGameStore } from './gameStore';

export interface AuthState {
  configured: boolean;
  session: Session | null;
  loading: boolean;
}

/** Tracks the Supabase session and keeps the SaveManager's user in sync. */
export function useAuth(): AuthState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const setCloudUser = useGameStore((s) => s.setCloudUser);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCloudUser(data.session?.user.id ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setCloudUser(s?.user.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [setCloudUser]);

  return { configured: isSupabaseConfigured, session, loading };
}
