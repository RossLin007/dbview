import React from 'react';
import { Database, Search, BarChart3, Sparkles, Sun, Moon, UserCheck, LogOut } from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useAuth } from '../AuthContext';

function ThemeToggleCompact() {
  const { theme, setTheme } = useTheme();

  const modes = [
    { key: 'light', icon: Sun, label: '切换浅色模式' },
    { key: 'dark', icon: Moon, label: '切换深色模式' },
  ];

  return (
    <div className="theme-toggle-compact">
      {modes.map((mode) => {
        const Icon = mode.icon;
        const active = theme === mode.key;
        return (
          <button
            key={mode.key}
            onClick={() => setTheme(mode.key)}
            className={`theme-btn ${active ? 'active' : ''}`}
            title={mode.label}
          >
            <Icon size={12} />
          </button>
        );
      })}
    </div>
  );
}

export default function Sidebar({ activeTab, setActiveTab, stats, loadingStats }) {
  const { user, signOut } = useAuth();

  const menuItems = [
    { id: 'sql', label: '智能 AI 探索器', icon: Sparkles },
    { id: 'members', label: '书友档案库', icon: UserCheck },
    { id: 'meetings', label: '会议浏览器', icon: Search },
    { id: 'analytics', label: '晨读营数据大屏', icon: BarChart3 }
  ];

  const userInitial = user?.email ? user.email.charAt(0).toUpperCase() : 'U';

  const tooltipText = stats 
    ? `会议总数: ${stats.totalMeetings} 场 | 学员: ${stats.totalParticipants} 人 | Version 1.0.0`
    : '数据库连接正常 | Version 1.0.0';

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">
          <Database size={18} />
        </div>
        <span className="sidebar-title">DBView 浏览器</span>
      </div>

      <nav style={{ flex: 1 }}>
        <ul className="sidebar-menu">
          {menuItems.map(item => {
            const Icon = item.icon;
            return (
              <li
                key={item.id}
                className={`menu-item ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* 凝练收纳的底部微型操作盘 */}
      <div className="sidebar-footer-compact">
        {/* 系统连接与容量气泡 */}
        <div className="status-pill-bar" title={tooltipText}>
          <div className="status-dot-emerald"></div>
          <span className="status-pill-text">
            {loadingStats 
              ? '数据库连通中...' 
              : stats 
                ? `数据库正常 · ${stats.totalMeetings} 场会议`
                : '数据库连接正常'}
          </span>
        </div>

        {/* 极简 Profile 与快捷按键组 */}
        {user && (
          <div className="compact-profile-card">
            <div className="user-avatar-small">{userInitial}</div>
            <span className="user-email-short" title={user.email}>{user.email}</span>
            
            <div className="quick-actions-group">
              <ThemeToggleCompact />
              <button 
                type="button" 
                className="logout-icon-btn-compact" 
                onClick={signOut}
                title="退出登录"
              >
                <LogOut size={13} />
              </button>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
