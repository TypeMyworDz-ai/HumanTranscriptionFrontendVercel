import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { hasSupabaseConfig, supabase } from './supabaseClient';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [ready, setReady] = useState(!hasSupabaseConfig);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadProfile = useCallback(async (user) => {
    if (!supabase || !user) {
      setProfile(null);
      return;
    }
    const { data, error: profileError } = await supabase
      .from('profiles')
      .select('id, role, display_name, email, country_code, status')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      setError(profileError.message);
      return;
    }

    setProfile(data || {
      id: user.id,
      role: 'client',
      display_name: user.user_metadata?.full_name || user.email?.split('@')[0] || 'Client',
      email: user.email || '',
      status: 'active',
    });
  }, []);

  useEffect(() => {
    if (!supabase) return undefined;

    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session?.user) loadProfile(data.session.user);
      setReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setError('');
      if (nextSession?.user) {
        window.setTimeout(() => loadProfile(nextSession.user), 0);
      } else {
        setProfile(null);
      }
      setReady(true);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo(() => ({
    session,
    profile,
    ready,
    error,
    notice,
    clearMessages: () => { setError(''); setNotice(''); },
    async signIn(email, password) {
      setError('');
      setNotice('');
      const result = await supabase.auth.signInWithPassword({ email, password });
      if (result.error) setError(result.error.message);
      return result;
    },
    async signUp(email, password, displayName) {
      setError('');
      setNotice('');
      const result = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: displayName, role: 'client' } },
      });
      if (result.error) setError(result.error.message);
      else if (!result.data.session) setNotice('Check your email to confirm the account, then sign in here.');
      return result;
    },
    async signOut() {
      if (supabase) await supabase.auth.signOut();
    },
  }), [session, profile, ready, error, notice]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
