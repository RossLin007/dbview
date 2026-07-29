import React from 'react';
import { BarChart3, Users, Clock, Calendar, ShieldAlert } from 'lucide-react';

export default function Analytics({ stats, loadingStats, errorStats }) {
  if (loadingStats) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 0', gap: '1rem' }}>
        <div style={{ border: '3px solid var(--border-color)', borderTop: '3px solid var(--primary)', borderRadius: '50%', width: '32px', height: '32px', animation: 'spin 1s linear infinite' }}></div>
        <span style={{ color: 'var(--text-secondary)' }}>正在统计晨读营全库数据...</span>
      </div>
    );
  }

  if (errorStats || !stats) {
    return (
      <div className="card" style={{ borderColor: 'var(--accent-rose)', padding: '2rem', textAlign: 'center' }}>
        <ShieldAlert size={36} style={{ color: 'var(--accent-rose)', marginBottom: '0.75rem' }} />
        <p style={{ color: 'var(--accent-rose)', fontWeight: 600 }}>无法加载统计数据</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>{errorStats || '拉取后台聚合失败。'}</p>
      </div>
    );
  }

  // Formatting helpers
  const formatHours = (ms) => {
    if (!ms) return '0';
    return (ms / 1000 / 60 / 60).toFixed(1);
  };

  // Find max values for percentage calculations in CSS bars
  const maxCategory = Math.max(...stats.categories.map(c => c.count), 1);
  const maxParticipant = Math.max(...stats.topParticipants.map(p => p.count), 1);
  const maxTrend = Math.max(...stats.monthlyTrend.map(t => t.count), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.75rem', animation: 'fadeIn 0.3s ease-out' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>晨读营数据分析大屏</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          基于历史晨读营会议记录的自动统计分析面板，反映团队学习活跃度。
        </p>
      </div>

      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="card metric-card">
          <div className="metric-icon-wrapper" style={{ backgroundColor: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)' }}>
            <Calendar size={22} />
          </div>
          <div className="metric-info">
            <span className="metric-value">{stats.totalMeetings}</span>
            <span className="metric-label">晨读会总数</span>
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-icon-wrapper" style={{ backgroundColor: 'rgba(16, 185, 129, 0.15)', color: 'var(--accent-emerald)' }}>
            <Clock size={22} />
          </div>
          <div className="metric-info">
            <span className="metric-value">{formatHours(stats.totalDurationMs)}</span>
            <span className="metric-label">总交流时长 (小时)</span>
          </div>
        </div>

        <div className="card metric-card">
          <div className="metric-icon-wrapper" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: 'var(--accent-amber)' }}>
            <Users size={22} />
          </div>
          <div className="metric-info">
            <span className="metric-value">{stats.totalParticipants}</span>
            <span className="metric-label">覆盖学员总人数</span>
          </div>
        </div>
      </div>

      {/* Charts Layout */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        
        {/* Monthly Trend CSS Bar Chart */}
        <div className="card">
          <span className="card-title" style={{ display: 'block', marginBottom: '1rem' }}>📈 晨读频次趋势 (月度)</span>
          <div className="chart-bar-container">
            {stats.monthlyTrend.slice(-10).map((item, idx) => (
              <div key={idx} className="chart-bar-row">
                <span className="chart-bar-label" style={{ width: '80px' }}>{item.month}</span>
                <div className="chart-bar-track">
                  <div 
                    className="chart-bar-fill" 
                    style={{ width: `${(item.count / maxTrend) * 100}%` }}
                  ></div>
                </div>
                <span className="chart-bar-value">{item.count}次</span>
              </div>
            ))}
          </div>
        </div>

        {/* Category distribution */}
        <div className="card">
          <span className="card-title" style={{ display: 'block', marginBottom: '1rem' }}>🏷️ 会议系统分布</span>
          <div className="chart-bar-container">
            {stats.categories.map((item, idx) => {
              const label = item.category === 'feishu_meeting' ? '飞书会议 (feishu)' : '腾讯会议 (meeting)';
              return (
                <div key={idx} className="chart-bar-row">
                  <span className="chart-bar-label">{label}</span>
                  <div className="chart-bar-track">
                    <div 
                      className="chart-bar-fill" 
                      style={{ 
                        width: `${(item.count / maxCategory) * 100}%`,
                        background: 'linear-gradient(90deg, #10b981, #3b82f6)'
                      }}
                    ></div>
                  </div>
                  <span className="chart-bar-value">{item.count}场</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Active Participants Rank */}
        <div className="card" style={{ gridColumn: 'span 2' }}>
          <span className="card-title" style={{ display: 'block', marginBottom: '1.25rem' }}>🔥 晨读营最活跃的学员前 10 名 (参会次数)</span>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            
            {/* Top 5 Column */}
            <div className="chart-bar-container">
              {stats.topParticipants.slice(0, 5).map((item, idx) => (
                <div key={idx} className="chart-bar-row">
                  <span className="chart-bar-label" style={{ width: '100px', fontWeight: 600 }}>
                    #{idx + 1} {item.name}
                  </span>
                  <div className="chart-bar-track">
                    <div 
                      className="chart-bar-fill" 
                      style={{ 
                        width: `${(item.count / maxParticipant) * 100}%`,
                        background: 'linear-gradient(90deg, #6366f1, #a855f7)'
                      }}
                    ></div>
                  </div>
                  <span className="chart-bar-value">{item.count}次</span>
                </div>
              ))}
            </div>

            {/* Top 6-10 Column */}
            <div className="chart-bar-container">
              {stats.topParticipants.slice(5, 10).map((item, idx) => (
                <div key={idx} className="chart-bar-row">
                  <span className="chart-bar-label" style={{ width: '100px', fontWeight: 600 }}>
                    #{idx + 6} {item.name}
                  </span>
                  <div className="chart-bar-track">
                    <div 
                      className="chart-bar-fill" 
                      style={{ 
                        width: `${(item.count / maxParticipant) * 100}%`,
                        background: 'linear-gradient(90deg, #a855f7, #ec4899)'
                      }}
                    ></div>
                  </div>
                  <span className="chart-bar-value">{item.count}次</span>
                </div>
              ))}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
