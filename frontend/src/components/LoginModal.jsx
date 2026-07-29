import React, { useState } from 'react';
import { useAuth } from '../AuthContext';
import { 
  Database, 
  Mail, 
  Lock, 
  LogIn, 
  UserPlus, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2,
  Sparkles,
  ExternalLink
} from 'lucide-react';

export default function LoginModal() {
  const { isConfigured, signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!email || !password) {
      setErrorMsg('请填写完整的邮箱与密码');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setErrorMsg('两次输入的密码不一致');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('密码长度不能少于 6 位');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'login') {
        await signInWithEmail(email, password);
        setSuccessMsg('登录成功！正在跳转...');
      } else {
        await signUpWithEmail(email, password);
        setSuccessMsg('注册成功！如果配置了邮箱验证，请检查您的收件箱。');
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-overlay">
      <div className="login-card glass-panel">
        <div className="login-header">
          <div className="login-brand">
            <div className="brand-logo shadow-glow">
              <Database size={28} className="text-accent" />
            </div>
            <div className="brand-text">
              <h2>dbview</h2>
              <span className="brand-badge">Enterprise Edition</span>
            </div>
          </div>
          <p className="login-subtitle">可视化数据库管理 & 智能 NL-to-SQL 平台</p>
        </div>

        {!isConfigured && (
          <div className="config-alert">
            <AlertCircle size={20} className="alert-icon" />
            <div className="alert-content">
              <h4>Supabase 未接入实测凭证</h4>
              <p>
                项目已集成 Supabase Auth 框架。请在 <code>.env</code> 文件中配置 
                <code>VITE_SUPABASE_URL</code> 和 <code>VITE_SUPABASE_ANON_KEY</code> 后刷新页面。
              </p>
              <a 
                href="https://supabase.com/dashboard" 
                target="_blank" 
                rel="noreferrer"
                className="config-link"
              >
                获取 Supabase Key <ExternalLink size={12} />
              </a>
            </div>
          </div>
        )}

        <div className="tab-switcher">
          <button
            type="button"
            className={`tab-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => {
              setMode('login');
              setErrorMsg('');
              setSuccessMsg('');
            }}
          >
            <LogIn size={16} />
            <span>账号登录</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => {
              setMode('signup');
              setErrorMsg('');
              setSuccessMsg('');
            }}
          >
            <UserPlus size={16} />
            <span>注册新账号</span>
          </button>
        </div>

        {errorMsg && (
          <div className="status-banner error">
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="status-banner success">
            <CheckCircle2 size={16} />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="input-group">
            <label>工作电子邮箱</label>
            <div className="input-wrapper">
              <Mail size={18} className="field-icon" />
              <input
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="input-group">
            <label>密码</label>
            <div className="input-wrapper">
              <Lock size={18} className="field-icon" />
              <input
                type="password"
                placeholder="密码 (至少 6 位)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          {mode === 'signup' && (
            <div className="input-group">
              <label>确认密码</label>
              <div className="input-wrapper">
                <Lock size={18} className="field-icon" />
                <input
                  type="password"
                  placeholder="重复输入密码"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="submit-btn primary-gradient"
            disabled={loading}
          >
            {loading ? (
              <span className="spinner"></span>
            ) : mode === 'login' ? (
              <>
                <LogIn size={18} />
                <span>立即登录</span>
              </>
            ) : (
              <>
                <UserPlus size={18} />
                <span>创建账号</span>
              </>
            )}
          </button>
        </form>

        <div className="login-footer">
          <div className="security-tag">
            <ShieldCheck size={14} />
            <span>Supabase Auth JWT 端到端加密保护</span>
          </div>
        </div>
      </div>
    </div>
  );
}
