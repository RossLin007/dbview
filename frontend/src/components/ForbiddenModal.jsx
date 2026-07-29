import React from 'react';
import { ShieldAlert, LogOut, Mail, RefreshCw, Lock } from 'lucide-react';
import { useAuth } from '../AuthContext';

export default function ForbiddenModal({ forbiddenMessage, onRetry }) {
  const { user, signOut } = useAuth();

  return (
    <div className="login-overlay">
      <div className="login-card glass-panel" style={{ textAlign: 'center' }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 16,
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#dc2626',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.25rem'
        }}>
          <ShieldAlert size={30} />
        </div>

        <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.4rem' }}>
          账号未经访问授权
        </h2>

        <p style={{ fontSize: '0.88rem', color: '#64748b', marginBottom: '1.25rem', lineHeight: 1.5 }}>
          您的 Supabase 账号 <strong style={{ color: '#0f172a' }}>{user?.email}</strong> 已验证通过，但尚未加入 DBView 数据的授权白名单。
        </p>

        <div style={{
          background: '#fffbeb',
          border: '1px solid #fde68a',
          borderRadius: 12,
          padding: '0.9rem',
          fontSize: '0.82rem',
          color: '#92400e',
          textAlign: 'left',
          marginBottom: '1.5rem',
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-start'
        }}>
          <Lock size={16} style={{ flexShrink: 0, marginTop: 2, color: '#d97706' }} />
          <span>
            {forbiddenMessage || '为了确保数据库隐私与安全，系统仅允许受信任名单中的账号查询。'}
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {onRetry && (
            <button
              type="button"
              className="submit-btn primary-gradient"
              onClick={onRetry}
            >
              <RefreshCw size={16} />
              <span>重新检测授权状态</span>
            </button>
          )}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <a
              href={`mailto:lin.atai@gmail.com?subject=${encodeURIComponent('申请 DBView 访问权限')}&body=${encodeURIComponent(`您好，请为我的账号 ${user?.email} 开通 DBView 访问白名单权限。`)}`}
              className="tab-btn"
              style={{
                flex: 1,
                border: '1.5px solid #e2e8f0',
                textDecoration: 'none',
                color: '#334155',
                padding: '0.7rem'
              }}
            >
              <Mail size={16} />
              <span>申请开通</span>
            </a>

            <button
              type="button"
              className="tab-btn"
              onClick={signOut}
              style={{
                flex: 1,
                border: '1.5px solid #fee2e2',
                color: '#dc2626',
                background: '#fef2f2',
                padding: '0.7rem'
              }}
            >
              <LogOut size={16} />
              <span>退出登录</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
