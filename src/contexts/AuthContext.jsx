import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const __DEV__ = import.meta.env.DEV;
const log = (...a) => { if (__DEV__) console.log('[CRM]', ...a); };
const warn = (...a) => { if (__DEV__) console.warn('[CRM]', ...a); };

const AuthContext = createContext({});
export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const profileIdRef = useRef(null); // tracks which userId we already fetched/are fetching
  const mountedRef = useRef(true);

  const fetchProfile = useCallback(async (userId) => {
    // Skip if already fetched or currently fetching this user's profile
    if (profileIdRef.current === userId) return;
    profileIdRef.current = userId;

    try {
      log('Fetching profile for:', userId);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (!mountedRef.current) return;

      if (error && error.code === 'PGRST116') {
        // Profile row missing — create one
        const { data: userData } = await supabase.auth.getUser();
        if (userData?.user) {
          const { data: newProfile, error: insertErr } = await supabase
            .from('profiles')
            .insert([{
              id: userId,
              email: userData.user.email,
              first_name: userData.user.email.split('@')[0],
              last_name: '',
              role: 'user'
            }])
            .select()
            .single();

          if (!mountedRef.current) return;

          if (!insertErr && newProfile) {
            log('Profile created:', newProfile.email, 'role:', newProfile.role);
            setProfile(newProfile);
          } else {
            // Trigger may have created it — retry
            const { data: retry } = await supabase.from('profiles').select('*').eq('id', userId).single();
            if (mountedRef.current) {
              if (retry) {
                log('Profile found on retry:', retry.email, 'role:', retry.role);
                setProfile(retry);
              } else {
                setAuthError('Impossible de créer le profil');
              }
            }
          }
        }
      } else if (error) {
        warn('Profile fetch error:', error);
        if (mountedRef.current) setAuthError(error.message);
      } else if (data) {
        log('Profile loaded:', data.email, 'role:', data.role, 'active:', data.active);
        setProfile(data);
      }
    } catch (e) {
      warn('Profile exception:', e);
      if (mountedRef.current) setAuthError(e.message);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    let initialDone = false;

    // Safety timeout — never leave user stuck on loading screen
    const timeout = setTimeout(() => {
      if (mountedRef.current && loading) {
        warn('Auth safety timeout triggered');
        setLoading(false);
      }
    }, 12000);

    // 1) Get existing session
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mountedRef.current) return;
      initialDone = true;
      if (error) {
        warn('getSession error:', error);
        setLoading(false);
        return;
      }
      if (session?.user) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    }).catch(e => {
      warn('getSession exception:', e);
      if (mountedRef.current) { initialDone = true; setLoading(false); }
    });

    // 2) Listen for auth state changes — but IGNORE the initial event
    //    because getSession() already handles it above
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mountedRef.current) return;

      // Skip INITIAL_SESSION — getSession already handles it
      if (event === 'INITIAL_SESSION') return;

      log('Auth event:', event);

      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        // Reset profileIdRef so we fetch the new user's profile
        profileIdRef.current = null;
        fetchProfile(session.user.id);
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setProfile(null);
        profileIdRef.current = null;
        setLoading(false);
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        setUser(session.user);
        // Don't re-fetch profile on token refresh — it's the same user
      }
    });

    return () => {
      mountedRef.current = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = async (email, password) => {
    setAuthError(null);
    setLoading(true);
    profileIdRef.current = null; // reset so profile gets fetched
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setLoading(false); throw error; }
  };

  const signUp = async (email, password, metadata = {}) => {
    const { error } = await supabase.auth.signUp({ email, password, options: { data: metadata } });
    if (error) throw error;
  };

  const signOut = async () => {
    profileIdRef.current = null;
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
  };

  const isAdmin = profile?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, profile, loading, isAdmin, authError, signIn, signUp, signOut, fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
