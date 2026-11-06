import React, { createContext, useContext, useEffect, useState } from 'react';
import { getToken, setToken, clearToken } from './authClient';

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

  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      // 用本地 token 向后端校验有效性
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setSession({ access_token: token });
          setUser(data.user ?? null);
        } else {
          clearToken();
        }
      } catch (err) {
        console.warn('[Auth] Failed to verify local token:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    initAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const applyAuthResult = (data) => {
    if (!data?.token) throw new Error('服务器响应缺少 token');
    setToken(data.token);
    setSession({ access_token: data.token });
    setUser(data.user ?? null);
    return data;
  };

  const signUpWithEmail = async (email, password) => {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || '注册失败，请重试');
    }
    return applyAuthResult(data);
  };

  const signInWithEmail = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.message || '登录失败，请检查邮箱与密码');
    }
    return applyAuthResult(data);
  };

  const signOut = async () => {
    clearToken();
    setSession(null);
    setUser(null);
  };

  const getAccessToken = () => {
    return getToken();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isConfigured: true,
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
