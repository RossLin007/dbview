import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured, applyRuntimeSupabaseConfig } from './supabaseClient';

const AuthContext = createContext({
  user: null,
  session: null,
  loading: true,
  isConfigured: false,
  signUpWithEmail: async () => {},
  signInWithEmail: async () => {},
  signOut: async () => {},
  getAccessToken: async () => null,
});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(isSupabaseConfigured);

  useEffect(() => {
    let activeSubscription = null;

    const initAuth = async () => {
      let isReady = isSupabaseConfigured;

      // 如果客户端在打包时没有环境变量，尝试向后端 /api/config 获取运行时配置
      if (!isReady) {
        try {
          const res = await fetch('/api/config');
          if (res.ok) {
            const data = await res.json();
            if (data.supabaseUrl && data.supabaseAnonKey) {
              isReady = applyRuntimeSupabaseConfig(data.supabaseUrl, data.supabaseAnonKey);
            }
          }
        } catch (err) {
          console.warn('[Supabase Auth] Failed to fetch runtime config:', err);
        }
      }

      setConfigured(isReady);

      if (!isReady) {
        setLoading(false);
        return;
      }

      // 获取当前 Session
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setSession(session);
        setUser(session?.user ?? null);
      } catch (err) {
        console.error('[Supabase Auth] Error getting session:', err);
      } finally {
        setLoading(false);
      }

      // 监听 Auth 状态变动
      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      });

      activeSubscription = subscription;
    };

    initAuth();

    return () => {
      if (activeSubscription) {
        activeSubscription.unsubscribe();
      }
    };
  }, []);

  const signUpWithEmail = async (email, password) => {
    if (!configured) {
      throw new Error('Supabase Auth 未正确配置凭证，请先配置 .env 文件');
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const signInWithEmail = async (email, password) => {
    if (!configured) {
      throw new Error('Supabase Auth 未正确配置凭证，请先配置 .env 文件');
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    if (configured) {
      await supabase.auth.signOut();
    }
    setSession(null);
    setUser(null);
  };

  const getAccessToken = () => {
    return session?.access_token || null;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isConfigured: configured,
        signUpWithEmail,
        signInWithEmail,
        signOut,
        getAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
