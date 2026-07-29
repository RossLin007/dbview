import React, { useState, useEffect } from 'react';
import { Search, Calendar, Users, Filter, Clock, MapPin, ArrowRight } from 'lucide-react';
import { fetchWithAuth } from '../utils/api';

export default function RecordList({ onSelectRecord }) {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter States
  const [searchText, setSearchText] = useState('');
  const [category, setCategory] = useState('');
  const [participant, setParticipant] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination State
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, totalRecords: 0 });

  const fetchRecords = async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams({
        page,
        limit: 12,
        search: searchText,
        category,
        participant,
        startDate,
        endDate
      });
      const response = await fetchWithAuth(`/api/records?${queryParams.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch records: ${response.statusText}`);
      }
      const data = await response.json();
      setRecords(data.records);
      setPagination(data.pagination);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
  }, [page, category]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchRecords();
  };

  const handleClearFilters = () => {
    setSearchText('');
    setCategory('');
    setParticipant('');
    setStartDate('');
    setEndDate('');
    setPage(1);
    // Since we're clearing, let's fetch with empty query parameters immediately
    setTimeout(() => {
      fetchRecords();
    }, 0);
  };

  // Helper to format UNIX timestamps to Readable Dates
  const formatDate = (startTimeStr) => {
    if (!startTimeStr) return '未知时间';
    const timestamp = parseInt(startTimeStr);
    if (isNaN(timestamp)) return '无效日期';
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Asia/Shanghai'
    });
  };

  // Helper to format duration in MS to hours, minutes
  const formatDuration = (durationStr) => {
    if (!durationStr) return '0分钟';
    const ms = parseInt(durationStr);
    if (isNaN(ms)) return '0分钟';
    const totalMinutes = Math.floor(ms / 1000 / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0) {
      return `${hours}小时 ${minutes}分钟`;
    }
    return `${minutes}分钟`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>会议记录浏览器</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
            共检索到 {pagination.totalRecords} 场晨读交流记录
          </p>
        </div>
      </div>

      {/* Advanced Filters */}
      <form onSubmit={handleSearchSubmit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          
          <div className="form-group">
            <label className="form-label">关键字搜索</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="主题、会议号、地点..."
                className="input"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ paddingLeft: '2.25rem' }}
              />
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">成员过滤</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                placeholder="参会人员姓名..."
                className="input"
                value={participant}
                onChange={(e) => setParticipant(e.target.value)}
                style={{ paddingLeft: '2.25rem' }}
              />
              <Users size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">会议类别</label>
            <select
              className="input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">全部类别</option>
              <option value="meeting">腾讯会议 (meeting)</option>
              <option value="feishu_meeting">飞书会议 (feishu_meeting)</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">开始日期</label>
            <input
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label className="form-label">结束日期</label>
            <input
              type="date"
              className="input"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
          <button type="button" className="btn" onClick={handleClearFilters}>
            清空条件
          </button>
          <button type="submit" className="btn btn-primary">
            <Filter size={16} />
            开始筛选
          </button>
        </div>
      </form>

      {/* Records Table Grid */}
      {loading ? (
        <div style={{ padding: '4rem', textRendering: 'optimizeSpeed', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
          <div style={{ border: '3px solid var(--border-color)', borderTop: '3px solid var(--primary)', borderRadius: '50%', width: '32px', height: '32px', animation: 'spin 1s linear infinite' }}></div>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>正在查询数据库...</span>
          <style>{`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      ) : error ? (
        <div className="card" style={{ borderColor: 'var(--accent-rose)', padding: '2rem', textAlign: 'center' }}>
          <p style={{ color: 'var(--accent-rose)', fontWeight: 600 }}>数据库查询失败</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>{error}</p>
        </div>
      ) : records.length === 0 ? (
        <div className="card" style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <p style={{ fontSize: '1.1rem', fontWeight: 600 }}>未查询到任何会议记录</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>请尝试调整您的过滤条件或搜索关键字。</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div className="data-table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '40%' }}>会议主题与内容</th>
                  <th style={{ width: '20%' }}>开始时间</th>
                  <th style={{ width: '15%' }}>时长</th>
                  <th style={{ width: '15%' }}>参会人数</th>
                  <th style={{ width: '10%', textAlign: 'right' }}>操作</th>
                </tr>
              </thead>
              <tbody>
                {records.map((record) => {
                  const subject = record.topic?.subject || '生命晨读';
                  const title = record.topic?.title || '未命名晨读会';
                  const numOfDate = record.topic?.numOfDate || '';
                  const durationStr = record.time?.duration;
                  const startStr = record.time?.start_time;
                  const participantsCount = record.participants ? record.participants.length : 0;
                  const categoryName = record.topic?.category === 'feishu_meeting' ? '飞书' : '腾讯会议';

                  return (
                    <tr key={record.record_id}>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.925rem' }}>{title}</span>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span className="badge badge-primary">{subject}</span>
                            {numOfDate && <span className="badge badge-warning">{numOfDate}</span>}
                            <span className="badge">{categoryName}</span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)' }}>
                          <Calendar size={14} style={{ opacity: 0.7 }} />
                          <span>{formatDate(startStr)}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)' }}>
                          <Clock size={14} style={{ opacity: 0.7 }} />
                          <span>{formatDuration(durationStr)}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--text-secondary)' }}>
                          <Users size={14} style={{ opacity: 0.7 }} />
                          <span>{participantsCount} 人</span>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn"
                          style={{ padding: '0.35rem 0.65rem', border: '1px solid rgba(99, 102, 241, 0.3)' }}
                          onClick={() => onSelectRecord(record.record_id)}
                        >
                          详情 <ArrowRight size={14} style={{ color: 'var(--primary)' }} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                第 {pagination.page} / {pagination.totalPages} 页
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="btn"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  上一页
                </button>
                <button
                  className="btn"
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages}
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
