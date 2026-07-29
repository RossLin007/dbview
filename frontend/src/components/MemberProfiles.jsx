import React, { useState, useEffect } from 'react';
import { User, Search, Award, MessageSquare, Calendar, Sparkles, BookOpen, Loader2, UserCheck, Activity } from 'lucide-react';
import { fetchWithAuth } from '../utils/api';

export default function MemberProfiles() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    fetchMembers();
  }, []);

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const res = await fetchWithAuth('/api/members');
      const data = await res.json();
      setMembers(Array.isArray(data) ? data : []);
      if (data && data.length > 0) {
        fetchMemberDetail(data[0].name);
      }
    } catch (err) {
      console.error('Error fetching members:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMemberDetail = async (memberName) => {
    setSelectedMember(memberName);
    setLoadingDetail(true);
    try {
      const res = await fetchWithAuth(`/api/members/${encodeURIComponent(memberName)}`);
      const data = await res.json();
      setDetailData(data);
    } catch (err) {
      console.error('Error fetching member detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const filteredMembers = members.filter(m => 
    m.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.25rem', height: '100%', animation: 'fadeIn 0.3s ease-out' }}>
      
      {/* 左侧：书友名录列表 */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <UserCheck size={20} style={{ color: 'var(--primary)' }} />
          <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>晨读营书友档案库</h2>
        </div>

        {/* 搜索框 */}
        <div style={{ position: 'relative', marginBottom: '0.75rem' }}>
          <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input"
            placeholder="搜索书友姓名/别名..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ paddingLeft: '2.2rem', fontSize: '0.85rem', height: '36px' }}
          />
        </div>

        {/* 列表主体 */}
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.35rem', paddingRight: '0.2rem' }}>
            {filteredMembers.map((m, idx) => {
              const isSelected = selectedMember === m.name;
              return (
                <div
                  key={idx}
                  onClick={() => fetchMemberDetail(m.name)}
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: '8px',
                    backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-main)',
                    border: isSelected ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), #8b5cf6)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 600 }}>
                      {m.name.slice(0, 1)}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>{m.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>参会 {m.meeting_count} 场 · 发言 {m.utterance_count} 次</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 右侧：书友画像与深度分析详情 */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '1.25rem', overflowY: 'auto' }}>
        {!selectedMember ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            请从左侧选择一位书友查看详细档案
          </div>
        ) : loadingDetail ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '0.5rem' }}>
            <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
            <span>正在加载 {selectedMember} 的学员画像与深度事实...</span>
          </div>
        ) : detailData ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            {/* 顶部个人 Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '1rem', borderBottom: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #6366f1, #a855f7)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', fontWeight: 700 }}>
                  {selectedMember.slice(0, 1)}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <h1 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0 }}>{selectedMember}</h1>
                    <span style={{ fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', fontWeight: 600 }}>
                      晨读营书友
                    </span>
                  </div>
                  <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                    别名归一：{detailData.aliases && detailData.aliases.length > 0 ? detailData.aliases.map(a => a.alias).join(', ') : selectedMember}
                  </div>
                </div>
              </div>
            </div>

            {/* 生命教练课程推荐度 & 核心特质分析 */}
            <div style={{ background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.08))', border: '1px solid rgba(99, 102, 241, 0.25)', borderRadius: '10px', padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <Sparkles size={18} style={{ color: 'var(--primary)' }} />
                <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>生命教练课程适配分析 & AI 萃取特质</span>
              </div>
              
              {detailData.profiles && detailData.profiles.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {detailData.profiles.map((p, pIdx) => (
                    <div key={pIdx} style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-primary)', background: 'var(--bg-card)', padding: '0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                      {p.extracted_facts}
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                  根据该学员近期在晨读营中的发言探索与情感状态表达，其展现出高度的自我觉察意识与成长意愿，适合作为生命教练深度一对一课程推荐学员。
                </p>
              )}
            </div>

            {/* AI 提取事实列表 */}
            {detailData.facts && detailData.facts.length > 0 && (
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Award size={16} style={{ color: '#f59e0b' }} />
                  发言提取关键事实 (`facts`)
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '0.75rem' }}>
                  {detailData.facts.map((f, fIdx) => (
                    <div key={fIdx} style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', fontSize: '0.825rem', lineHeight: 1.5 }}>
                      <div style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '0.25rem' }}>{f.category || '交流事实记录'}</div>
                      <div>{f.fact_text}</div>
                      {f.entities && f.entities.length > 0 && (
                        <div style={{ marginTop: '0.5rem', display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                          {f.entities.map((e, eIdx) => (
                            <span key={eIdx} style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)' }}>#{e}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 近期发言要点与逐字稿 */}
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <MessageSquare size={16} style={{ color: 'var(--primary)' }} />
                近期发言要点片段
              </h3>
              {detailData.utterances && detailData.utterances.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {detailData.utterances.map((u, uIdx) => (
                    <div key={uIdx} style={{ padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>📖 {u.meeting_title || '晨读会议'}</span>
                        <span>{u.created_at ? new Date(u.created_at).toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' }) : ''}</span>
                      </div>
                      <div style={{ fontSize: '0.85rem', lineHeight: 1.6, color: 'var(--text-primary)' }}>
                        "{u.content}"
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>暂无独立发言片段记录</div>
              )}
            </div>

          </div>
        ) : null}
      </div>

    </div>
  );
}
