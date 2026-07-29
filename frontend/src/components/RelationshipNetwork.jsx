import React, { useState, useEffect } from 'react';
import { Users, Search, MessageCircle, Flame, ArrowRight, Loader2, Sparkles } from 'lucide-react';
import { fetchWithAuth } from '../utils/api';

export default function RelationshipNetwork() {
  const [targetMember, setTargetMember] = useState('林泰君');
  const [relationships, setRelationships] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRelationships(targetMember);
  }, [targetMember]);

  const fetchRelationships = async (name) => {
    setLoading(true);
    try {
      const url = name ? `/api/relationships?target=${encodeURIComponent(name)}` : '/api/relationships';
      const res = await fetchWithAuth(url);
      const data = await res.json();
      setRelationships(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error fetching relationships:', err);
    } finally {
      setLoading(false);
    }
  };

  const quickPersons = ['林泰君', '康雯娟', '徐燕', '全伟', '厉瑞男', '李阳'];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', height: '100%', animation: 'fadeIn 0.3s ease-out' }}>
      
      {/* 顶部控制与搜索 */}
      <div className="card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Users size={22} style={{ color: 'var(--primary)' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>书友互动关系网络挖掘</h2>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>解答“谁和某位书友讨论交流最多”等关系型问题</span>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              className="input"
              value={targetMember}
              onChange={(e) => setTargetMember(e.target.value)}
              placeholder="输入目标书友姓名（如：林泰君）..."
              style={{ paddingLeft: '2.2rem', fontSize: '0.9rem' }}
            />
          </div>
          <button className="btn btn-primary" onClick={() => fetchRelationships(targetMember)}>
            <Sparkles size={16} />
            挖掘互动关系
          </button>
        </div>

        {/* 快捷推荐人名 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>热门探索书友:</span>
          {quickPersons.map((p, idx) => (
            <button
              key={idx}
              onClick={() => setTargetMember(p)}
              style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.6rem',
                borderRadius: '5px',
                border: '1px solid var(--border-color)',
                backgroundColor: targetMember === p ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-main)',
                color: targetMember === p ? 'var(--primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: targetMember === p ? 600 : 400
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* 核心互动榜单与数据矩阵 */}
      <div className="card" style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Flame size={18} style={{ color: '#ef4444' }} />
          与 【{targetMember || '全站书友'}】 讨论频次最高的书友排行榜
        </h3>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '0.5rem' }}>
            <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
            <span>正在挖掘会议共现与发言交互矩阵...</span>
          </div>
        ) : relationships.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            未查询到匹配的互动数据
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {relationships.map((rel, idx) => (
              <div
                key={idx}
                style={{
                  padding: '1rem',
                  borderRadius: '10px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'var(--bg-main)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem',
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                      #{idx + 1}
                    </div>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{rel.speaker}</span>
                  </div>
                  <span style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '6px', background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', fontWeight: 600 }}>
                    高频互动
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around', background: 'var(--bg-card)', padding: '0.6rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--primary)' }}>{rel.interaction_count}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>发言讨论次数</div>
                  </div>
                  <div style={{ width: '1px', height: '24px', background: 'var(--border-color)' }} />
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700, color: '#10b981' }}>{rel.co_meeting_count}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>共同参与会议</div>
                  </div>
                </div>

                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <MessageCircle size={14} />
                  <span>与 {targetMember} 在晨读营线上交流活跃</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
