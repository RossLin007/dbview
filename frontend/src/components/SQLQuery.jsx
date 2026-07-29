import React, { useState } from 'react';
import { Play, Download, AlertTriangle, CheckCircle, Database } from 'lucide-react';

export default function SQLQuery() {
  const [sql, setSql] = useState('SELECT record_id, topic->>\'title\' as title, topic->>\'numOfDate\' as day, cardinality(participants) as num_participants FROM public.records ORDER BY created_at DESC LIMIT 10;');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const templates = [
    {
      label: '🏆 参会最活跃学员排行',
      query: `SELECT \n  trim(p) as "姓名", \n  COUNT(*) as "参会场次"\nFROM public.records, unnest(participants) p \nWHERE trim(p) <> '' \nGROUP BY trim(p) \nORDER BY "参会场次" DESC \nLIMIT 15;`
    },
    {
      label: '📊 会议分类与总时长统计',
      query: `SELECT \n  COALESCE(topic->>'category', '其他') as "分类", \n  COUNT(*) as "会议场次", \n  ROUND(SUM(COALESCE(CAST(time->>'duration' AS BIGINT), 0)) / 1000 / 60 / 60, 2) as "总时长(小时)"\nFROM public.records \nGROUP BY topic->>'category';`
    },
    {
      label: '🔍 模糊搜索主题含“习惯”的记录',
      query: `SELECT \n  record_id as "会议ID",\n  topic->>'title' as "会议标题", \n  topic->>'numOfDate' as "日期/天数", \n  created_at as "导入时间" \nFROM public.records \nWHERE topic->>'title' LIKE '%习惯%' OR topic->>'subject' LIKE '%习惯%'\nLIMIT 10;`
    },
    {
      label: '📈 晨读营每月会议趋势',
      query: `SELECT \n  to_char(to_timestamp(CAST(time->>'start_time' AS BIGINT) / 1000), 'YYYY-MM') as "月份", \n  COUNT(*) as "总场次"\nFROM public.records \nWHERE time->>'start_time' IS NOT NULL AND time->>'start_time' <> 'null'\nGROUP BY "月份" \nORDER BY "月份" ASC;`
    },
    {
      label: '💡 最近 5 条生命教练 AI 深度复盘',
      query: `SELECT \n  analysis_id as "分析ID", \n  record_id as "会议ID", \n  analyzed_at as "复盘时间", \n  SUBSTRING(analysis_result, 1, 120) || '...' as "分析简要"\nFROM public.analysis \nWHERE analysis_target_type = 'ai_analysis_dialogue_from_coach' \nORDER BY analyzed_at DESC \nLIMIT 5;`
    }
  ];

  const handleExecute = async () => {
    setLoading(true);
    setError(null);
    setResults(null);

    // Basic frontend safety warning
    const cleaned = sql.trim().toLowerCase();
    if (!cleaned.startsWith('select') && !cleaned.startsWith('with')) {
      setError({
        title: '查询已被拦截',
        message: '安全限制：为了保护晨读营数据库的数据完整性，此处仅允许执行 SELECT 或者 WITH 读取查询。'
      });
      setLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sql })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || '查询失败');
      }

      setResults(data);
    } catch (err) {
      console.error(err);
      setError({
        title: '数据库执行错误',
        message: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!results || results.rows.length === 0) return;

    const headers = results.columns.join(',');
    const rows = results.rows.map(row => 
      results.columns.map(col => {
        let val = row[col];
        if (val === null || val === undefined) return '';
        // Escape strings containing commas/quotes
        const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
        if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
          return `"${strVal.replace(/"/g, '""')}"`;
        }
        return strVal;
      }).join(',')
    );

    const csvContent = '\uFEFF' + [headers, ...rows].join('\n'); // Add UTF-8 BOM for Excel Chinese characters compatibility
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `query_result_${new Date().getTime()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s ease-out' }}>
      <div>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em' }}>SQL 自定义查询器</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.25rem' }}>
          提供对 postgres 数据库的高级直接查询接口。仅支持只读 SELECT 查询操作。
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: '1.5rem', alignItems: 'start' }}>
        {/* Editor Box */}
        <div className="card sql-editor-container">
          <span className="form-label">SQL 语句输入</span>
          <textarea
            className="sql-textarea"
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            spellCheck="false"
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Database size={12} />
              当前数据库: postgres
            </span>
            <button
              className="btn btn-primary"
              onClick={handleExecute}
              disabled={loading || !sql.trim()}
            >
              <Play size={16} />
              执行查询
            </button>
          </div>
        </div>

        {/* Templates Panel */}
        <div className="card" style={{ height: '100%' }}>
          <span className="form-label" style={{ display: 'block', marginBottom: '0.75rem' }}>常用查询模版</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {templates.map((tpl, idx) => (
              <button
                key={idx}
                className="sql-template-btn"
                onClick={() => setSql(tpl.query)}
              >
                {tpl.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Query Message Alerts */}
      {error && (
        <div className="query-status-banner error">
          <AlertTriangle size={18} />
          <div>
            <span style={{ fontWeight: 700, display: 'block' }}>{error.title}</span>
            <span style={{ fontSize: '0.85rem' }}>{error.message}</span>
          </div>
        </div>
      )}

      {/* Loading Overlay */}
      {loading && (
        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4rem 0', gap: '1rem' }}>
          <div style={{ border: '3px solid var(--border-color)', borderTop: '3px solid var(--primary)', borderRadius: '50%', width: '28px', height: '28px', animation: 'spin 1s linear infinite' }}></div>
          <span style={{ color: 'var(--text-secondary)' }}>正在对数据库执行查询操作...</span>
        </div>
      )}

      {/* Results Display */}
      {results && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-emerald)' }}>
              <CheckCircle size={16} />
              <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>
                执行成功: 检索出 {results.rowCount} 行记录 (耗时 {results.executionTimeMs} ms)
              </span>
            </div>
            {results.rows.length > 0 && (
              <button className="btn" style={{ padding: '0.35rem 0.75rem' }} onClick={handleExportCSV}>
                <Download size={14} />
                导出 CSV 文件
              </button>
            )}
          </div>

          {results.rows.length === 0 ? (
            <div style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              查询完成，但返回了 0 行数据。
            </div>
          ) : (
            <div className="data-table-container" style={{ maxHeight: '400px' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    {results.columns.map((col, idx) => (
                      <th key={idx}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {results.rows.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      {results.columns.map((col, colIdx) => {
                        const val = row[col];
                        let renderedVal = '';
                        if (val === null || val === undefined) {
                          renderedVal = <em style={{ color: 'var(--text-muted)' }}>null</em>;
                        } else if (typeof val === 'object') {
                          renderedVal = JSON.stringify(val);
                        } else {
                          renderedVal = String(val);
                        }
                        return (
                          <td key={colIdx} style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: '300px' }}>
                            {renderedVal}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
