import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, Loader2, Database, ChevronDown, ChevronUp, Sparkles, AlertCircle } from 'lucide-react';

export default function NaturalLanguageQuery() {
  const [messages, setMessages] = useState([
    {
      role: 'system',
      text: '你好！我是晨读营数据库的智能查询助手。你可以直接问我任何关于晨读营的问题，我会自动查询数据库并回答你。',
      examples: [
        '林泰君昨天说了什么？',
        '林泰君今年一共发言多少次？',
        '谁和林泰君讨论 AI 最多？',
        '晨读营近半年的热门主题趋势',
        '最近一个月，哪些书友最适合参加生命教练课程？',
      ],
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleAsk = async (question) => {
    const q = question || input.trim();
    if (!q || loading) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    setLoading(true);

    try {
      const response = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: '抱歉，查询出错了：' + (data.message || data.error || '未知错误'),
            error: true,
          },
        ]);
        setLoading(false);
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.answer,
          sql: data.sql,
          result: data.result,
          question: data.question,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: '网络错误，请检查连接后重试。',
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAsk();
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        height: '100%',
        animation: 'fadeIn 0.3s ease-out',
      }}
    >
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Sparkles size={22} style={{ color: 'var(--primary)' }} />
          智能自然语言查询
        </h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          用中文直接提问，AI 自动理解并查询数据库，返回自然语言答案。
        </p>
      </div>

      {/* Chat Area */}
      <div
        className="card"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 0,
        }}
      >
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.25rem',
          }}
        >
          {messages.map((msg, idx) => (
            <div key={idx}>
              {/* System Welcome */}
              {msg.role === 'system' && (
                <div
                  style={{
                    backgroundColor: 'rgba(99, 102, 241, 0.06)',
                    border: '1px solid rgba(99, 102, 241, 0.15)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, var(--primary), #a855f7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: '0.9rem',
                      }}
                    >
                      AI
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>智能查询助手</span>
                  </div>
                  <p style={{ fontSize: '0.925rem', lineHeight: 1.6, color: 'var(--text-secondary)' }}>{msg.text}</p>
                  {msg.examples && (
                    <div style={{ marginTop: '1rem' }}>
                      <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>试试这样问：</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {msg.examples.map((ex, i) => (
                          <button
                            key={i}
                            onClick={() => handleAsk(ex)}
                            style={{
                              textAlign: 'left',
                              padding: '0.5rem 0.75rem',
                              borderRadius: '8px',
                              border: '1px solid var(--border-color)',
                              background: 'var(--bg-card)',
                              color: 'var(--text-secondary)',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              transition: 'all 0.2s ease',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = 'var(--primary)';
                              e.currentTarget.style.color = 'var(--text-primary)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = 'var(--border-color)';
                              e.currentTarget.style.color = 'var(--text-secondary)';
                            }}
                          >
                            💬 {ex}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* User Message */}
              {msg.role === 'user' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <div
                    style={{
                      maxWidth: '80%',
                      backgroundColor: 'rgba(99, 102, 241, 0.1)',
                      border: '1px solid rgba(99, 102, 241, 0.2)',
                      borderRadius: '12px 12px 2px 12px',
                      padding: '0.75rem 1rem',
                      fontSize: '0.925rem',
                      lineHeight: 1.5,
                      color: 'var(--text-primary)',
                    }}
                  >
                    {msg.text}
                  </div>
                </div>
              )}

              {/* Assistant Response */}
              {msg.role === 'assistant' && (
                <div
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    padding: '1.25rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: '8px',
                        background: msg.error
                          ? 'linear-gradient(135deg, #f43f5e, #fb7185)'
                          : 'linear-gradient(135deg, var(--primary), #a855f7)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: '0.9rem',
                      }}
                    >
                      {msg.error ? '!' : 'AI'}
                    </div>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                      {msg.error ? '查询出错' : '智能查询助手'}
                    </span>
                  </div>

                  {/* Answer text */}
                  <p
                    style={{
                      fontSize: '0.925rem',
                      lineHeight: 1.7,
                      color: msg.error ? 'var(--accent-rose)' : 'var(--text-primary)',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {msg.text}
                  </p>

                  {/* SQL details collapsible */}
                  {msg.sql && (
                    <SqlDetail sql={msg.sql} result={msg.result} />
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '1rem 0',
                color: 'var(--text-muted)',
                fontSize: '0.9rem',
              }}
            >
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
              <span>正在理解问题并查询数据库...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div
          style={{
            borderTop: '1px solid var(--border-color)',
            padding: '1rem 1.5rem',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'flex-end',
          }}
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的问题，例如：林泰君昨天说了什么？"
            rows={2}
            style={{
              flex: 1,
              padding: '0.75rem 1rem',
              borderRadius: '10px',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-main)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-sans)',
              fontSize: '0.925rem',
              lineHeight: 1.5,
              resize: 'none',
              outline: 'none',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--primary)')}
            onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
          />
          <button
            className="btn btn-primary"
            onClick={() => handleAsk()}
            disabled={loading || !input.trim()}
            style={{ height: '44px', padding: '0 1.25rem', flexShrink: 0 }}
          >
            <Send size={16} />
            发送
          </button>
        </div>
      </div>
    </div>
  );
}

function SqlDetail({ sql, result }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ marginTop: '1rem', borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          padding: '0.4rem 0.6rem',
          borderRadius: '6px',
          border: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-main)',
          color: 'var(--text-muted)',
          cursor: 'pointer',
          fontSize: '0.8rem',
          fontFamily: 'var(--font-mono)',
        }}
      >
        <Database size={14} />
        <span>查看生成的 SQL 与查询结果</span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {/* SQL */}
          <div>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
              生成的 SQL：
            </span>
            <pre
              style={{
                backgroundColor: 'var(--bg-main)',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                padding: '0.75rem',
                fontSize: '0.8rem',
                fontFamily: 'var(--font-mono)',
                color: 'var(--accent-emerald)',
                overflowX: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: 1.5,
              }}
            >
              {sql}
            </pre>
          </div>

          {/* Result table */}
          {result && result.rows && result.rows.length > 0 && (
            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                查询结果（{result.rowCount} 行，耗时 {result.executionTimeMs}ms）：
              </span>
              <div className="data-table-container" style={{ maxHeight: '250px' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      {result.columns.map((col, i) => (
                        <th key={i}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.rows.map((row, ri) => (
                      <tr key={ri}>
                        {result.columns.map((col, ci) => {
                          let val = row[col];
                          let rendered = '';
                          if (val === null || val === undefined) {
                            rendered = <em style={{ color: 'var(--text-muted)' }}>null</em>;
                          } else if (typeof val === 'object') {
                            rendered = JSON.stringify(val);
                          } else {
                            rendered = String(val);
                          }
                          return (
                            <td
                              key={ci}
                              style={{
                                fontFamily: 'var(--font-mono)',
                                fontSize: '0.78rem',
                                whiteSpace: 'nowrap',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                                maxWidth: '250px',
                              }}
                            >
                              {rendered}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {result && result.rows && result.rows.length === 0 && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0.5rem 0' }}>
              查询结果为空，没有找到匹配的数据。
            </div>
          )}
        </div>
      )}
    </div>
  );
}
