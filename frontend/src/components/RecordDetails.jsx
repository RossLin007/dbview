import React, { useState, useEffect } from 'react';
import { ChevronLeft, Calendar, Clock, MapPin, Users, FileText, MessageSquare, List } from 'lucide-react';
import { fetchWithAuth } from '../utils/api';

// A simple, pure React Markdown formatter for rendering AI results cleanly
function SimpleMarkdown({ text }) {
  if (!text) return null;
  
  const lines = text.split('\n');
  return (
    <div className="markdown-body">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        
        // Headers
        if (trimmed.startsWith('### ')) {
          return <h3 key={idx}>{trimmed.substring(4)}</h3>;
        }
        if (trimmed.startsWith('## ')) {
          return <h2 key={idx}>{trimmed.substring(3)}</h2>;
        }
        if (trimmed.startsWith('# ')) {
          return <h1 key={idx}>{trimmed.substring(2)}</h1>;
        }
        
        // Bullet points
        if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
          // Parse bold markers inside list item
          const content = trimmed.substring(2);
          return <li key={idx} style={{ marginLeft: '1rem', listStyleType: 'disc' }}>{parseBoldText(content)}</li>;
        }

        // Ordered list item
        const numMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numMatch) {
          return <li key={idx} style={{ marginLeft: '1.2rem', listStyleType: 'decimal' }}>{parseBoldText(numMatch[2])}</li>;
        }

        // Blockquotes
        if (trimmed.startsWith('> ')) {
          return <blockquote key={idx}>{parseBoldText(trimmed.substring(2))}</blockquote>;
        }

        // Empty lines
        if (trimmed === '') {
          return <div key={idx} style={{ height: '0.5rem' }}></div>;
        }

        // Standard paragraphs
        return <p key={idx}>{parseBoldText(line)}</p>;
      })}
    </div>
  );
}

// Inline formatting helper for **bold** text
function parseBoldText(text) {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  if (parts.length === 1) return text;
  
  return parts.map((part, idx) => {
    // Odd indices match the bolded content
    if (idx % 2 === 1) {
      return <strong key={idx} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{part}</strong>;
    }
    return part;
  });
}

function cleanSpeakerName(name) {
  if (!name || typeof name !== 'string') return name || '';
  let cleaned = name
    .replace(/\\n/g, '')
    .replace(/\\r/g, '')
    .replace(/\\t/g, '')
    .replace(/\\/g, '')
    .trim();
  cleaned = cleaned.replace(/^[\\/\s]+/, '');
  if (/^n[\u4e00-\u9fa5]/.test(cleaned)) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
}

// Parsing function to split "SpeakerName(HH:MM:SS): message" block into structured nodes
function parseDialogue(text) {
  if (!text) return [];
  const normalized = text
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t');
  const lines = normalized.split('\n');
  const result = [];
  let currentSpeaker = null;
  let currentTime = null;
  let currentContent = [];

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    // Regex matching "Speaker Name (00:00:00): content"
    const match = line.match(/^([^(\n]+)\((\d{2}:\d{2}:\d{2}|\d{2}:\d{2})\):\s*(.*)$/);
    if (match) {
      if (currentSpeaker) {
        result.push({
          speaker: cleanSpeakerName(currentSpeaker),
          time: currentTime,
          content: currentContent.join('\n').replace(/\\+$/, '').replace(/['\"'\s,;，；\\]+$/, '').trim()
        });
      }
      currentSpeaker = cleanSpeakerName(match[1].trim());
      currentTime = match[2];
      currentContent = [match[3].replace(/\\+$/, '').replace(/['\"'\s,;，；\\]+$/, '').trim()];
    } else {
      if (currentSpeaker) {
        currentContent.push(line.replace(/\\+$/, '').replace(/['\"'\s,;，；\\]+$/, '').trim());
      }
    }
  }
  if (currentSpeaker) {
    result.push({
      speaker: cleanSpeakerName(currentSpeaker),
      time: currentTime,
      content: currentContent.join('\n').replace(/\\+$/, '').replace(/['\"'\s,;，；\\]+$/, '').trim()
    });
  }
  return result;
}

export default function RecordDetails({ recordId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('analysis');
  const [speakerFilter, setSpeakerFilter] = useState('');

  useEffect(() => {
    const fetchRecordDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetchWithAuth(`/api/records/${recordId}`);
        if (!response.ok) {
          throw new Error('Failed to load meeting details.');
        }
        const resJson = await response.json();
        setData(resJson);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchRecordDetails();
  }, [recordId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '6rem 0', gap: '1rem' }}>
        <div style={{ border: '3px solid var(--border-color)', borderTop: '3px solid var(--primary)', borderRadius: '50%', width: '32px', height: '32px', animation: 'spin 1s linear infinite' }}></div>
        <span style={{ color: 'var(--text-secondary)' }}>正在拉取会议详情与AI分析...</span>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card" style={{ borderColor: 'var(--accent-rose)', padding: '2rem', textAlign: 'center' }}>
        <p style={{ color: '#fda4af', fontWeight: 600 }}>无法加载会议信息</p>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>{error || '没有找到有效数据。'}</p>
        <button className="btn" style={{ marginTop: '1.25rem' }} onClick={onBack}>返回列表</button>
      </div>
    );
  }

  const { record, dialogues, utterances, analysis } = data;

  const subject = record.topic?.subject || '生命晨读';
  const title = record.topic?.title || '未命名晨读会';
  const place = record.place;
  const startStr = record.time?.start_time;
  const durationStr = record.time?.duration;
  const participants = record.participants || [];

  // Helper date conversions
  const dateStr = startStr ? new Date(parseInt(startStr)).toLocaleDateString('zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long', timeZone: 'Asia/Shanghai'
  }) : '未知日期';
  const timeStr = startStr ? new Date(parseInt(startStr)).toLocaleTimeString('zh-CN', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai'
  }) : '未知时间';

  const formatDuration = (msStr) => {
    if (!msStr) return '';
    const ms = parseInt(msStr);
    if (isNaN(ms)) return '';
    const mins = Math.floor(ms / 1000 / 60);
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return hrs > 0 ? `${hrs}小时${remainingMins}分钟` : `${remainingMins}分钟`;
  };

  // Group dialogues by speakers to assign consistent color bubbles
  const speakerColors = {};
  const palette = ['#818cf8', '#34d399', '#fbbf24', '#f472b6', '#22d3ee', '#fb7185', '#a78bfa'];
  let colorIdx = 0;

  const getSpeakerColor = (name) => {
    if (!speakerColors[name]) {
      speakerColors[name] = palette[colorIdx % palette.length];
      colorIdx++;
    }
    return speakerColors[name];
  };

  // Parse Dialogue String from dialogues rows
  const parsedDialogueLines = dialogues.length > 0 && dialogues[0].content 
    ? parseDialogue(dialogues[0].content) 
    : (record.remarks?.dialogue_content ? parseDialogue(record.remarks.dialogue_content) : []);

  // Filter speakers list
  const uniqueSpeakers = Array.from(new Set(parsedDialogueLines.map(line => line.speaker)));

  // Filtered utterances
  const filteredUtterances = utterances.filter(ut => {
    if (!speakerFilter) return true;
    return ut.speaker.toLowerCase().includes(speakerFilter.toLowerCase());
  });

  return (
    <div className="detail-layout">
      {/* Back Header */}
      <div>
        <button className="btn" style={{ padding: '0.4rem 0.8rem', marginBottom: '1rem' }} onClick={onBack}>
          <ChevronLeft size={16} /> 返回会议列表
        </button>
      </div>

      {/* Main Header Card */}
      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <span className="badge badge-primary" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>{subject}</span>
          {record.topic?.numOfDate && (
            <span className="badge badge-warning" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>{record.topic.numOfDate}</span>
          )}
          <span className="badge" style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}>{record.topic?.category === 'feishu_meeting' ? '飞书会议' : '腾讯会议'}</span>
        </div>
        
        <div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1.3 }}>{title}</h2>
        </div>

        <div className="detail-meta">
          <div className="detail-meta-item">
            <Calendar size={15} style={{ color: 'var(--primary)' }} />
            <span>{dateStr} {timeStr}</span>
          </div>
          <div className="detail-meta-item">
            <Clock size={15} style={{ color: 'var(--primary)' }} />
            <span>时长 {formatDuration(durationStr)}</span>
          </div>
          {place && (
            <div className="detail-meta-item">
              <MapPin size={15} style={{ color: 'var(--primary)' }} />
              <a href={place} target="_blank" rel="noreferrer" style={{ color: 'var(--primary)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '300px' }}>
                查看录像链接
              </a>
            </div>
          )}
        </div>

        <div>
          <span className="form-label" style={{ display: 'block', marginBottom: '0.5rem' }}>参会人员 ({participants.length}人)</span>
          <div className="participant-tags">
            {participants.map((person, idx) => (
              <span key={idx} className="badge" style={{ backgroundColor: 'var(--bg-card-hover)', color: 'var(--text-secondary)' }}>
                {person.trim()}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="tabs-header">
        <button
          className={`tab-btn ${activeTab === 'analysis' ? 'active' : ''}`}
          onClick={() => setActiveTab('analysis')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <FileText size={16} />
            <span>AI 洞察分析 ({analysis.length})</span>
          </div>
        </button>
        <button
          className={`tab-btn ${activeTab === 'dialogue' ? 'active' : ''}`}
          onClick={() => setActiveTab('dialogue')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MessageSquare size={16} />
            <span>对话逐字稿 ({parsedDialogueLines.length}条)</span>
          </div>
        </button>
        <button
          className={`tab-btn ${activeTab === 'utterance' ? 'active' : ''}`}
          onClick={() => setActiveTab('utterance')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <List size={16} />
            <span>个人发言概要 ({utterances.length})</span>
          </div>
        </button>
      </div>

      {/* Tab Panels */}
      <div style={{ minHeight: '300px' }}>
        {activeTab === 'analysis' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            {analysis.length === 0 ? (
              <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                暂无AI分析洞察。可能该场会议尚未由AI进行后期复盘。
              </div>
            ) : (
              analysis.map((item) => {
                let typeTitle = 'AI 分析报告';
                let accentBorder = 'var(--primary)';

                if (item.analysis_target_type === 'ai_analysis_dialogue_from_coach') {
                  typeTitle = '🌟 生命教练深度洞察复盘';
                  accentBorder = 'var(--accent-amber)';
                } else if (item.analysis_target_type === 'ai_analysis_dialogue_meeting_summary') {
                  typeTitle = '📝 晨读营核心精要与课题总结';
                  accentBorder = 'var(--primary)';
                } else if (item.analysis_target_type === 'special_utterance-analysis-summary') {
                  typeTitle = '🗣️ 发言段落深度解构';
                  accentBorder = 'var(--accent-emerald)';
                } else if (item.analysis_target_type === 'full_utterance-analysis-full_utterance_analysis') {
                  typeTitle = '🔍 完整发言结构分析';
                  accentBorder = 'var(--border-color)';
                }

                return (
                  <div key={item.analysis_id} className="card" style={{ borderLeft: `4px solid ${accentBorder}`, padding: '1.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
                      <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{typeTitle}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        分析时间: {new Date(item.analyzed_at).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                    <SimpleMarkdown text={item.analysis_result} />
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeTab === 'dialogue' && (
          <div className="card" style={{ padding: '1.5rem' }}>
            {parsedDialogueLines.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                暂无对话逐字稿。
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Speaker Filters in dialogue */}
                {uniqueSpeakers.length > 1 && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '0.5rem' }}>
                    <button
                      className={`btn ${speakerFilter === '' ? 'btn-primary' : ''}`}
                      style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                      onClick={() => setSpeakerFilter('')}
                    >
                      全部发言人
                    </button>
                    {uniqueSpeakers.map(name => (
                      <button
                        key={name}
                        className={`btn ${speakerFilter === name ? 'btn-primary' : ''}`}
                        style={{ padding: '0.25rem 0.6rem', fontSize: '0.75rem' }}
                        onClick={() => setSpeakerFilter(name)}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                )}

                <div className="chat-container">
                  {parsedDialogueLines
                    .filter(line => !speakerFilter || line.speaker === speakerFilter)
                    .map((line, idx) => {
                      // Alternate bubble sides based on speaker or default left layout
                      const isLeft = line.speaker !== '刘伟伟'; 
                      return (
                        <div key={idx} className={`chat-bubble ${isLeft ? 'left' : 'right'}`}>
                          <div className="chat-sender">
                            <span style={{ color: getSpeakerColor(line.speaker) }}>{line.speaker}</span>
                            <span className="chat-time">{line.time}</span>
                          </div>
                          <div className="chat-bubble-inner">
                            {line.content}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'utterance' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div className="card" style={{ padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <span className="form-label" style={{ margin: 0 }}>过滤发言人:</span>
              <input
                type="text"
                placeholder="搜索发言人姓名..."
                className="input"
                value={speakerFilter}
                onChange={(e) => setSpeakerFilter(e.target.value)}
                style={{ maxWidth: '240px', padding: '0.4rem 0.8rem' }}
              />
            </div>

            {filteredUtterances.length === 0 ? (
              <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                未查询到匹配的发言记录。
              </div>
            ) : (
              filteredUtterances.map((ut) => (
                <div key={ut.utterance_id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 700, color: getSpeakerColor(ut.speaker), fontSize: '1rem' }}>{ut.speaker}</span>
                      <span className="badge badge-success" style={{ fontSize: '0.65rem' }}>{ut.type === 'special_utterance' ? '润色剪辑' : '原始发言'}</span>
                    </div>
                    {ut.place && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>地点: {ut.place}</span>}
                  </div>
                  <p style={{ fontSize: '0.925rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{ut.content}</p>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
