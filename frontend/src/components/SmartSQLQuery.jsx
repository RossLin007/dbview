import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Sparkles, Play, Download, AlertTriangle, CheckCircle, Database, Send, Loader2, Copy, Check, ChevronDown, ChevronUp, Code2, Maximize2, Minimize2, Eye, X, LayoutGrid, Table, User, Calendar, MessageSquare, Search, TrendingUp, BookOpen, Award, ArrowRight } from 'lucide-react';
import { fetchWithAuth } from '../utils/api';



// 1. 英文字段名自动中文化映射表 (支持模糊匹配与多种命名习惯)
const COLUMN_LABEL_MAP = {
  meeting_title: '会议主题',
  speaker: '发言人',
  content: '发言逐字稿内容',
  share_content: '发言/分享内容',
  special_utterance: 'AI精选分享要点',
  full_utterance: '发言逐字稿',
  start_time: '发言/会议时间',
  created_at: '记录创建时间',
  topic: '会议主题',
  participants: '参会学员列表',
  duration: '时长(小时)',
  extracted_facts: '学员特质档案',
  speaker_name: '书友姓名',
  utterance_id: '段落ID',
  record_id: '会议ID'
};

function getColumnChineseLabel(col) {
  if (!col) return col;
  const colClean = col.toLowerCase().trim();
  if (COLUMN_LABEL_MAP[colClean]) return COLUMN_LABEL_MAP[colClean];

  if (colClean.includes('share') || colClean.includes('content') || colClean.includes('utterance')) return '发言/分享内容';
  if (colClean.includes('title') || colClean.includes('topic')) return '会议主题';
  if (colClean.includes('speaker') || colClean.includes('user') || colClean.includes('person')) return '发言人';
  if (colClean.includes('time') || colClean.includes('date') || colClean.includes('created')) return '发言/会议时间';

  return col;
}

function isContentColumn(col) {
  if (!col) return false;
  const colClean = col.toLowerCase().trim();
  return (
    colClean.includes('内容') || colClean.includes('结论') || colClean.includes('分析') ||
    colClean.includes('发言') || colClean.includes('特质') || colClean.includes('分享') ||
    colClean.includes('要点') || colClean.includes('档案') || colClean.includes('解读') ||
    colClean.includes('content') || colClean.includes('share') || colClean.includes('speech') ||
    colClean.includes('utterance') || colClean.includes('facts') || colClean.includes('summary') ||
    colClean.includes('text')
  );
}

// 2. 时间格式化函数：将 ISO 字符串或时间戳转为中文化可读时间 (如 2026年6月28日 11:30)
function formatReadableTime(val) {
  if (!val) return '';
  const d = new Date(val);
  if (isNaN(d.getTime())) return String(val);

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');

  // 计算相对时间
  const now = new Date('2026-07-21T00:00:00Z');
  const diffDays = Math.floor((now - d) / (1000 * 60 * 60 * 24));

  let relativeStr = '';
  if (diffDays === 0) relativeStr = ' (今天)';
  else if (diffDays === 1) relativeStr = ' (昨天)';
  else if (diffDays === 2) relativeStr = ' (前天)';
  else if (diffDays > 2 && diffDays <= 30) relativeStr = ` (${diffDays} 天前)`;
  else if (diffDays > 30) relativeStr = ` (${Math.floor(diffDays / 30)} 个月前)`;

  return `${year}年${month}月${day}日 ${hours}:${minutes}${relativeStr}`;
}

// 2.1 智能多列智能匹配抽取函数 (防止反人类的 Raw JSON.stringify 暴露)
function extractRowValues(row) {
  if (!row || typeof row !== 'object') {
    return { speaker: '参会学员', topic: '晨读营研讨', time: '', content: String(row || '') };
  }

  const keys = Object.keys(row);
  
  // 1. Speaker
  let speaker = row['发言人'] || row['书友'] || row['speaker'] || row['speaker_name'];
  if (!speaker) {
    const k = keys.find(key => /发言人|书友|speaker|user|person/i.test(key));
    if (k) speaker = row[k];
  }

  // 2. Topic
  let topic = row['会议主题'] || row['meeting_title'] || row['topic'];
  if (!topic) {
    const k = keys.find(key => /主题|topic|title/i.test(key));
    if (k) topic = row[k];
  }

  // 3. Time
  let time = row['发言时间'] || row['会议时间'] || row['发言/会议时间'] || row['start_time'] || row['created_at'];
  if (!time) {
    const k = keys.find(key => /时间|date|time|created/i.test(key));
    if (k) time = row[k];
  }

  // 4. Content
  let content = row['发言内容'] || row['发言/分享内容'] || row['发言要点内容'] || row['分享内容'] || row['content'] || row['share_content'] || row['full_utterance'] || row['extracted_facts'];
  if (!content) {
    const k = keys.find(key => /内容|发言|content|utterance|fact|share/i.test(key));
    if (k) content = row[k];
  }

  // 如果依然未匹配到明确的 content 字段，挑选最长文本列，避免暴露 raw JSON.stringify(row)
  if (!content) {
    const stringValues = keys
      .map(k => row[k])
      .filter(v => typeof v === 'string' && v.trim().length > 0 && !v.includes('2026-') && v !== speaker && v !== topic);
    if (stringValues.length > 0) {
      stringValues.sort((a, b) => b.length - a.length);
      content = stringValues[0];
    }
  }

  return {
    speaker: cleanSpeakerName(String(speaker || '参会学员')),
    topic: String(topic || '晨读营研讨'),
    time: time || '',
    content: String(content || row['发言内容'] || '')
  };
}

// 3. 发言人姓名清洗 helper (去除前导 '\\', 'n' 前缀等换行拆分残余)
function cleanSpeakerName(name) {
  if (!name || typeof name !== 'string') return name || '';
  let cleaned = name
    .replace(/\\n/g, '')
    .replace(/\\r/g, '')
    .replace(/\\t/g, '')
    .replace(/\\/g, '')
    .trim();
  cleaned = cleaned.replace(/^[\\/\s]+/, '');
  // 如果包含了换行拆分造成的 'n' 前缀 (如 n林泰君 -> 林泰君)
  if (/^n[\u4e00-\u9fa5]/.test(cleaned)) {
    cleaned = cleaned.slice(1);
  }
  return cleaned;
}

// 4. 发言段落去噪函数：剔除 "徐海远(00:14:49):" 这类冗余头缀
function cleanSpeechText(text) {
  if (!text || typeof text !== 'string') return text;
  let cleaned = text
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\+$/, '')
    .trim();
  cleaned = cleaned.replace(/[\u4e00-\u9fa5a-zA-Z0-9_-]+\((\d{2}:\d{2}:\d{2}|\d{2}:\d{2})\):\s*/g, '⏱️ [$1] ').trim();
  return cleaned.replace(/\\+$/, '').replace(/[\s\\]+$/, '').trim();
}

// 5. 发言段落解析函数：解析 JSON 结构或 "发言人(00:00:00): 内容" 逐字稿对话流
function parseDialogueTurns(text, row = {}) {
  if (!text || typeof text !== 'string') {
    return { meta: {}, turns: [], paragraphs: [], plainText: String(text || '') };
  }

  // 统一转义字符处理（把字面量的 '\n' / '\r' / '\t' / 尾部斜杠等解码清洗）
  let cleaned = text
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\+$/, '')
    .trim();

  // 提取 Header 元数据
  let extractedMeta = {};
  if (row['会议主题'] || row['meeting_title'] || row['topic']) {
    extractedMeta['会议主题'] = row['会议主题'] || row['meeting_title'] || row['topic'];
  }
  if (row['发言人'] || row['书友'] || row['speaker'] || row['speaker_name']) {
    extractedMeta['发言人'] = cleanSpeakerName(row['发言人'] || row['书友'] || row['speaker'] || row['speaker_name']);
  }
  if (row['发言时间'] || row['会议时间'] || row['start_time'] || row['created_at']) {
    extractedMeta['时间'] = formatReadableTime(row['发言时间'] || row['会议时间'] || row['start_time'] || row['created_at']);
  }

  const topicMatch = cleaned.match(/['\"'\s]*会议主题:['\"'\s]*([^',]+)/);
  if (topicMatch && !extractedMeta['会议主题']) extractedMeta['会议主题'] = topicMatch[1].trim();

  const speakerMatch = cleaned.match(/['\"'\s]*发言人:['\"'\s]*([^',]+)/);
  if (speakerMatch && !extractedMeta['发言人']) extractedMeta['发言人'] = cleanSpeakerName(speakerMatch[1]);

  // 提取发言人及时间戳 "王乐添(00:04:59):" 或 "林泰君(00:12):"
  const regex = /([\u4e00-\u9fa5a-zA-Z0-9_-]+)\((\d{2}:\d{2}:\d{2}|\d{2}:\d{2})\):\s*/g;
  const matches = [...cleaned.matchAll(regex)];

  if (matches.length === 0) {
    cleaned = cleaned.replace(/^['\"'\s]*发言内容原文:['\"'\s]*/, '').replace(/['\"'\s]+$/, '');
    const paragraphs = cleaned
      .split(/\n+/)
      .map(p => p.replace(/\\+$/, '').replace(/['\"'\s,;，；\\]+$/, '').trim())
      .filter(Boolean);
    return { meta: extractedMeta, turns: [], paragraphs, plainText: cleaned };
  }

  const turns = [];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    let speaker = cleanSpeakerName(m[1]);
    const timestamp = m[2];
    const startIndex = m.index + m[0].length;
    const endIndex = (i + 1 < matches.length) ? matches[i + 1].index : cleaned.length;
    let turnText = cleaned.slice(startIndex, endIndex).trim();
    // 彻底清理尾部残余的 \n, \\, \ 以及尾随符号
    turnText = turnText
      .replace(/\\n/g, '')
      .replace(/\\+$/, '')
      .replace(/['\"'\s,;，；\\]+$/, '')
      .trim();

    turns.push({ speaker, timestamp, text: turnText });
  }

  return { meta: extractedMeta, turns, paragraphs: [], plainText: cleaned };
}

// 5. 关键词搜索高亮组件 helper
function highlightText(text, keyword) {
  if (!keyword || !keyword.trim() || !text) return text;
  const parts = text.split(new RegExp(`(${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
  return parts.map((part, i) =>
    part.toLowerCase() === keyword.toLowerCase() ? (
      <mark key={i} style={{ backgroundColor: 'rgba(245, 158, 11, 0.3)', color: '#fbbf24', padding: '0 3px', borderRadius: '3px', fontWeight: 600 }}>
        {part}
      </mark>
    ) : part
  );
}

export default function SmartSQLQuery() {
  const [questionInput, setQuestionInput] = useState('');
  const [sql, setSql] = useState('SELECT u.speaker AS "发言人", u.content AS "发言内容", r.topic->>\'title\' AS "会议主题", u.created_at AS "发言时间" FROM public.records r JOIN public.utterances u ON r.record_id = u.record_id WHERE u.speaker ILIKE \'%林泰君%\' ORDER BY u.created_at DESC LIMIT 10;');
  const [results, setResults] = useState(null);
  const [aiAnswer, setAiAnswer] = useState('');
  const [metaInfo, setMetaInfo] = useState(null);
  const [isFallback, setIsFallback] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [showSqlEditor, setShowSqlEditor] = useState(false);
  const [isAiCardExpanded, setIsAiCardExpanded] = useState(true);
  const [activeModalRow, setActiveModalRow] = useState(null);
  const [copiedModalText, setCopiedModalText] = useState(false);
  const [modalSearchText, setModalSearchText] = useState('');
  const [viewMode, setViewMode] = useState('card'); // 'card' 对话卡片视图 | 'table' 经典明细表格

  const scenarioCategories = [
    { label: '🔍 查询型', question: '林泰君昨天说了什么？', tag: '查询型' },
    { label: '📊 统计型', question: '林泰君今年一共发言多少次？', tag: '统计型' },
    { label: '📈 分析型', question: '林泰君最近三个月关注的话题发生了哪些变化？', tag: '分析型' },
    { label: '🤝 关系型', question: '谁和林泰君讨论 AI 最多？', tag: '关系型' },
    { label: '🔥 趋势型', question: '晨读营近半年的热门主题趋势。', tag: '趋势型' },
    { label: '💡 推荐型', question: '根据最近一个月的讨论，哪些书友最适合参加生命教练课程？', tag: '推荐型' },
  ];

  const sqlTemplates = [
    {
      label: '🗣️ 林泰君最新发言内容',
      query: `SELECT \n  COALESCE(sa.speaker_display, sa.speaker_norm, u.speaker) AS "发言人", \n  u.content AS "发言内容", \n  r.topic->>'title' AS "会议主题", \n  u.created_at AS "发言时间"\nFROM public.records r \nJOIN public.utterances u ON r.record_id = u.record_id \nLEFT JOIN public.speaker_aliases sa ON sa.alias = lower(u.speaker) AND sa.status = 'active'\nWHERE u.speaker ILIKE '%林泰君%'\nORDER BY u.created_at DESC \nLIMIT 15;`
    },
    {
      label: '🏆 参会最活跃学员排行',
      query: `SELECT \n  COALESCE(sa.speaker_display, sa.speaker_norm, trim(p)) as "书友", \n  COUNT(*) as "参会场次"\nFROM public.records, unnest(participants) p \nLEFT JOIN public.speaker_aliases sa ON sa.alias = lower(trim(p)) AND sa.status = 'active'\nWHERE trim(p) <> '' \nGROUP BY COALESCE(sa.speaker_display, sa.speaker_norm, trim(p)) \nORDER BY "参会场次" DESC \nLIMIT 15;`
    },
    {
      label: '💬 谁与林泰君互动讨论最多',
      query: `SELECT \n  COALESCE(sa.speaker_display, sa.speaker_norm, u.speaker) AS "互动书友", \n  COUNT(*) AS "讨论互动次数"\nFROM public.utterances u \nJOIN public.records r ON u.record_id = r.record_id \nLEFT JOIN public.speaker_aliases sa ON sa.alias = lower(u.speaker) AND sa.status = 'active'\nWHERE array_to_string(r.participants, ',') ILIKE '%林泰君%' \n  AND u.speaker NOT ILIKE '%林泰君%' \n  AND u.speaker IS NOT NULL AND u.speaker <> '' \nGROUP BY COALESCE(sa.speaker_display, sa.speaker_norm, u.speaker) \nORDER BY "讨论互动次数" DESC \nLIMIT 10;`
    },
    {
      label: '📊 会议分类与总时长统计',
      query: `SELECT \n  COALESCE(topic->>'category', '其他') as "分类", \n  COUNT(*) as "会议场次", \n  ROUND(SUM(COALESCE(CAST(time->>'duration' AS BIGINT), 0)) / 1000 / 60 / 60, 2) as "总时长(小时)"\nFROM public.records \nGROUP BY topic->>'category';`
    },
    {
      label: '💡 适合生命教练深度推荐学员档案',
      query: `SELECT \n  sp.speaker_name AS "书友姓名", \n  sp.extracted_facts AS "AI萃取特质与关注点", \n  r.topic->>'title' as "近期参与会议"\nFROM public.speaker_profiles sp\nLEFT JOIN public.records r ON sp.record_id = r.record_id\nORDER BY sp.updated_at DESC \nLIMIT 10;`
    }
  ];

  const [queryStage, setQueryStage] = useState({ step: 1, progress: 15, label: '🧠 正在分析提问意图与剥离称谓后缀...' });

  const queryStages = [
    { step: 1, icon: '🧠', shortLabel: '1. 意图与称谓解析', label: '🧠 正在分析提问意图与剥离尊称后缀...' },
    { step: 2, icon: '📐', shortLabel: '2. Schema 与 SQL 构建', label: '📐 正在结合 11 张数据表 Schema 与 speaker_aliases 构建 SQL...' },
    { step: 3, icon: '⚡', shortLabel: '3. PostgreSQL 数据检索', label: '⚡ 正在从 PostgreSQL 数据库中检索符合条件的发言与会议记录...' },
    { step: 4, icon: '🪄', shortLabel: '4. AI 归纳与要点提炼', label: '🪄 大模型正在归纳核心要点并提取发言原话金句...' },
  ];

  // AI自然语言转 SQL 并执行
  const handleNlAsk = async (questionStr) => {
    const q = questionStr || questionInput.trim();
    if (!q || loading) return;

    setQuestionInput(q);
    setLoading(true);
    setError(null);
    setQueryStage({ step: 1, progress: 20, label: queryStages[0].label });

    // 动态进度条定时器
    const t1 = setTimeout(() => setQueryStage({ step: 2, progress: 50, label: queryStages[1].label }), 2000);
    const t2 = setTimeout(() => setQueryStage({ step: 3, progress: 75, label: queryStages[2].label }), 6000);
    const t3 = setTimeout(() => setQueryStage({ step: 4, progress: 92, label: queryStages[3].label }), 13000);

    try {
      const response = await fetchWithAuth('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || data.error || '自然语言查询失败');
      }

      setSql(data.sql);
      setAiAnswer(data.answer);
      setResults(data.result);
      setIsFallback(data.isFallback);
      setMetaInfo({
        scenarioName: data.scenarioName,
        executionStrategy: data.executionStrategy,
        reasoningSteps: data.reasoningSteps || []
      });
    } catch (err) {
      console.error(err);
      setError({
        title: '自然语言查询出错',
        message: err.message
      });
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      setLoading(false);
    }
  };

  // 手动执行 SQL 查询
  const handleExecuteSql = async (overrideSql) => {
    const targetSql = overrideSql || sql;
    if (!targetSql.trim() || loading) return;

    const cleaned = targetSql.trim().toLowerCase();
    if (!cleaned.startsWith('select') && !cleaned.startsWith('with')) {
      setError({
        title: '查询已被拦截',
        message: '安全限制：此处仅允许执行 SELECT 或者 WITH 只读查询。'
      });
      return;
    }

    setLoading(true);
    setError(null);
    setAiAnswer('');
    setIsFallback(false);
    setMetaInfo(null);

    try {
      const response = await fetchWithAuth('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: targetSql })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || '查询失败');
      }

      setResults(data);
    } catch (err) {
      console.error(err);
      setError({
        title: '数据库 SQL 执行错误',
        message: err.message
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTemplate = (query) => {
    setSql(query);
    handleExecuteSql(query);
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExportCSV = () => {
    if (!results || results.rows.length === 0) return;

    const headers = results.columns.join(',');
    const rows = results.rows.map(row => 
      results.columns.map(col => {
        let val = row[col];
        if (val === null || val === undefined) return '';
        const strVal = typeof val === 'object' ? JSON.stringify(val) : String(val);
        if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
          return `"${strVal.replace(/"/g, '""')}"`;
        }
        return strVal;
      }).join(',')
    );

    const csvContent = '\uFEFF' + [headers, ...rows].join('\n');
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: '100%', animation: 'fadeIn 0.3s ease-out' }}>
      
      {/* 1. 紧凑型顶部命令/查询栏 */}
      <div className="card" style={{ padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', background: 'var(--bg-card)', border: '1px solid var(--border-color)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Sparkles size={20} style={{ color: 'var(--primary)' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0, letterSpacing: '-0.01em' }}>
              生命教练 AI 数据库探索器
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {/* 模版下拉选择 */}
            <select
              onChange={(e) => {
                if (e.target.value) {
                  handleSelectTemplate(e.target.value);
                  e.target.value = '';
                }
              }}
              defaultValue=""
              style={{
                fontSize: '0.8rem',
                padding: '0.35rem 0.6rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              <option value="" disabled>📋 选择常用 SQL 模版...</option>
              {sqlTemplates.map((tpl, i) => (
                <option key={i} value={tpl.query}>{tpl.label}</option>
              ))}
            </select>

            {/* 折叠/展开 SQL 编辑器按钮 */}
            <button
              onClick={() => setShowSqlEditor(!showSqlEditor)}
              style={{
                fontSize: '0.8rem',
                padding: '0.35rem 0.65rem',
                borderRadius: '6px',
                border: '1px solid var(--border-color)',
                backgroundColor: showSqlEditor ? 'rgba(99, 102, 241, 0.1)' : 'var(--bg-main)',
                color: showSqlEditor ? 'var(--primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: 500,
                transition: 'all 0.2s ease',
              }}
            >
              <Code2 size={14} />
              <span>{showSqlEditor ? '收起 SQL 调试框' : '查看/编辑 SQL'}</span>
              {showSqlEditor ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>

        {/* 自然语言输入框 */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <input
            type="text"
            className="input"
            value={questionInput}
            onChange={(e) => setQuestionInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleNlAsk()}
            placeholder="输入自然语言提问（如：哪些书友最适合参加生命教练课程？或 林泰君昨天说了什么？）"
            style={{ flex: 1, fontSize: '0.9rem', padding: '0.6rem 0.85rem' }}
          />
          <button
            className="btn btn-primary"
            onClick={() => handleNlAsk()}
            disabled={loading || !questionInput.trim()}
            style={{ height: '38px', padding: '0 1rem' }}
          >
            {loading ? <Loader2 size={15} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={15} />}
            AI 生成并查询
          </button>
        </div>

        {/* 6 大场景快捷提问 Prompt 标签 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', alignItems: 'center' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '0.2rem' }}>6大需求场景提问:</span>
          {scenarioCategories.map((sc, idx) => (
            <button
              key={idx}
              onClick={() => handleNlAsk(sc.question)}
              style={{
                fontSize: '0.75rem',
                padding: '0.2rem 0.55rem',
                borderRadius: '5px',
                border: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-main)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.color = 'var(--primary)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-color)';
                e.currentTarget.style.color = 'var(--text-secondary)';
              }}
            >
              {sc.label}
            </button>
          ))}
        </div>

        {/* 抽屉/可折叠 SQL 编辑器 */}
        {showSqlEditor && (
          <div style={{ marginTop: '0.5rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem', animation: 'fadeIn 0.2s ease-out' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Database size={12} />
                SQL 调试指令 (含 speaker_aliases 归一逻辑)
              </span>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={handleCopySql}
                  style={{
                    fontSize: '0.75rem',
                    padding: '0.2rem 0.5rem',
                    borderRadius: '4px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  {copied ? <Check size={12} style={{ color: '#10b981' }} /> : <Copy size={12} />}
                  {copied ? '已复制' : '复制 SQL'}
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => handleExecuteSql()}
                  disabled={loading || !sql.trim()}
                  style={{ fontSize: '0.75rem', height: '26px', padding: '0 0.6rem' }}
                >
                  <Play size={12} />
                  手动执行 SQL
                </button>
              </div>
            </div>
            <textarea
              className="sql-textarea"
              value={sql}
              onChange={(e) => setSql(e.target.value)}
              spellCheck="false"
              rows={3}
              style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}
            />
          </div>
        )}
      </div>

      {/* 2. 动态检索 4 阶段进度条卡片 */}
      {loading && (
        <div
          className="card"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid rgba(99, 102, 241, 0.35)',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
            animation: 'fadeIn 0.2s ease-out',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
              <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                {queryStage.label}
              </span>
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
              {queryStage.progress}%
            </span>
          </div>

          {/* 动态 Progress Bar */}
          <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-main)', borderRadius: '3px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${queryStage.progress}%`,
                height: '100%',
                background: 'linear-gradient(90deg, var(--primary), #a855f7)',
                borderRadius: '3px',
                transition: 'width 0.4s ease'
              }}
            />
          </div>

          {/* 4 阶段节点导航 Pills */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', marginTop: '0.1rem' }}>
            {queryStages.map((stg, idx) => {
              const isActive = queryStage.step === idx + 1;
              const isDone = queryStage.step > idx + 1;
              return (
                <div
                  key={idx}
                  style={{
                    padding: '0.4rem 0.55rem',
                    borderRadius: '6px',
                    border: isActive ? '1px solid var(--primary)' : isDone ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid var(--border-color)',
                    backgroundColor: isActive ? 'rgba(99, 102, 241, 0.12)' : isDone ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-main)',
                    color: isActive ? 'var(--primary)' : isDone ? '#10b981' : 'var(--text-muted)',
                    fontSize: '0.725rem',
                    fontWeight: isActive ? 600 : 400,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.35rem',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <span>{isDone ? '✓' : stg.icon}</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stg.shortLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. 错误 Banner */}
      {error && (
        <div className="query-status-banner error" style={{ margin: 0, flexShrink: 0 }}>
          <AlertTriangle size={18} />
          <div>
            <span style={{ fontWeight: 700, display: 'block' }}>{error.title}</span>
            <span style={{ fontSize: '0.85rem' }}>{error.message}</span>
          </div>
        </div>
      )}

      {/* 3. AI 智能解读区域 (使用 ReactMarkdown 排版，支持可折叠展开/收起) */}
      {aiAnswer && (
        <div
          className="card"
          style={{
            backgroundColor: 'var(--bg-card)',
            border: '1px solid rgba(99, 102, 241, 0.25)',
            borderRadius: '10px',
            padding: '1rem 1.25rem',
            animation: 'fadeIn 0.2s ease-out',
            flexShrink: 0,
            position: 'relative'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '6px',
                  background: 'linear-gradient(135deg, var(--primary), #a855f7)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                }}
              >
                AI
              </div>
              <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>AI 智能分析解读</span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {metaInfo && metaInfo.scenarioName && (
                <span style={{ fontSize: '0.725rem', padding: '0.15rem 0.5rem', borderRadius: '12px', background: 'rgba(99, 102, 241, 0.12)', color: 'var(--primary)', fontWeight: 600 }}>
                  🎯 {metaInfo.scenarioName}
                </span>
              )}
              {metaInfo && metaInfo.executionStrategy && (
                <span style={{ fontSize: '0.725rem', padding: '0.15rem 0.5rem', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.12)', color: '#10b981', fontWeight: 600 }}>
                  ⚡ {metaInfo.executionStrategy} 策略
                </span>
              )}
              <button
                className="btn"
                style={{ padding: '0.2rem 0.55rem', fontSize: '0.75rem', color: 'var(--primary)' }}
                onClick={() => setIsAiCardExpanded(!isAiCardExpanded)}
              >
                {isAiCardExpanded ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
                {isAiCardExpanded ? '收起解读' : '展开完整解读'}
              </button>
            </div>
          </div>

          <div
            style={{
              maxHeight: isAiCardExpanded ? 'none' : '170px',
              overflowY: isAiCardExpanded ? 'visible' : 'hidden',
              position: 'relative',
              transition: 'max-height 0.3s ease'
            }}
          >
            <div className="ai-markdown-container">
              <ReactMarkdown>{aiAnswer}</ReactMarkdown>
            </div>

            {!isAiCardExpanded && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '60px',
                  background: 'linear-gradient(to bottom, transparent, var(--bg-card))',
                  display: 'flex',
                  alignItems: 'flex-end',
                  justifyContent: 'center',
                  paddingBottom: '2px'
                }}
              >
                <button
                  className="btn"
                  style={{
                    fontSize: '0.725rem',
                    padding: '0.2rem 0.75rem',
                    borderRadius: '12px',
                    backgroundColor: 'var(--primary)',
                    color: '#fff',
                    boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)'
                  }}
                  onClick={() => setIsAiCardExpanded(true)}
                >
                  <ChevronDown size={14} /> 展开查看完整 AI 解读
                </button>
              </div>
            )}
          </div>

          {metaInfo && metaInfo.reasoningSteps && metaInfo.reasoningSteps.length > 0 && (
            <div style={{ marginTop: '0.75rem', paddingTop: '0.6rem', borderTop: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span style={{ fontWeight: 600 }}>AI 检索执行轨迹:</span> {metaInfo.reasoningSteps.join(' ➔ ')}
            </div>
          )}
        </div>
      )}

      {/* 4. 【核心占比区域】 明细查询与双视图呈现 (卡片/表格) */}
      <div className="card" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '1rem 1.25rem', minHeight: '420px' }}>
        {/* 表格/卡片 视图切换工具栏 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <CheckCircle size={16} style={{ color: 'var(--accent-emerald)' }} />
            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {results ? `查询数据明细 (共 ${results.rowCount} 行记录，耗时 ${results.executionTimeMs} ms)` : '数据明细表'}
            </span>
          </div>

          {results && results.rows && results.rows.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              {/* 视图切换按钮 */}
              <div style={{ display: 'flex', backgroundColor: 'var(--bg-main)', padding: '0.15rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                <button
                  className="btn"
                  style={{
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                    backgroundColor: viewMode === 'card' ? 'var(--primary)' : 'transparent',
                    color: viewMode === 'card' ? '#fff' : 'var(--text-muted)',
                    border: 'none'
                  }}
                  onClick={() => setViewMode('card')}
                >
                  <LayoutGrid size={13} />
                  对话卡片
                </button>
                <button
                  className="btn"
                  style={{
                    padding: '0.2rem 0.5rem',
                    fontSize: '0.75rem',
                    borderRadius: '4px',
                    backgroundColor: viewMode === 'table' ? 'var(--primary)' : 'transparent',
                    color: viewMode === 'table' ? '#fff' : 'var(--text-muted)',
                    border: 'none'
                  }}
                  onClick={() => setViewMode('table')}
                >
                  <Table size={13} />
                  经典表格
                </button>
              </div>

              <button className="btn" style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem' }} onClick={handleExportCSV}>
                <Download size={14} />
                导出 CSV
              </button>
            </div>
          )}
        </div>

        {/* 核心数据主体 */}
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: 'var(--text-muted)' }}>
            <Loader2 size={22} style={{ animation: 'spin 1s linear infinite', color: 'var(--primary)' }} />
            <span style={{ fontSize: '0.9rem' }}>正在从 PostgreSQL 检索数据...</span>
          </div>
        ) : !results ? (
          <div className="discovery-container">
            <div className="discovery-badge">
              <Sparkles size={14} />
              <span>光明 · 自然 · 美好 · 智能探索罗盘</span>
            </div>
            <h2 className="discovery-title">探索生命成长与晨读营数据大景</h2>
            <p className="discovery-subtitle">
              输入自然语言询问，或直接点击下方精心挑选的探索卡片，一键唤醒 AI 智能 SQL 数据检索。
            </p>

            <div className="discovery-grid">
              <div 
                className="discovery-card"
                onClick={() => {
                  handleNlAsk("请统计发言次数最多的前10位书友，按发言总次数降序排列");
                }}
              >
                <div className="discovery-card-icon icon-purple">
                  <TrendingUp size={22} />
                </div>
                <div className="discovery-card-title">📊 学员活跃度榜单</div>
                <div className="discovery-card-desc">
                  统计发言最积极的书友、出勤次数与交流参与度分析。
                </div>
                <div className="discovery-card-action">
                  <span>直接探索</span>
                  <ArrowRight size={14} />
                </div>
              </div>

              <div 
                className="discovery-card"
                onClick={() => {
                  handleNlAsk("请查询所有涉及生命教练、个人成长或心智突破相关主题的会议与发言记录");
                }}
              >
                <div className="discovery-card-icon icon-emerald">
                  <BookOpen size={22} />
                </div>
                <div className="discovery-card-title">🌿 生命教练金句与突破</div>
                <div className="discovery-card-desc">
                  提炼关于心智成长、教练对话与生命转变的精彩讨论。
                </div>
                <div className="discovery-card-action">
                  <span>直接探索</span>
                  <ArrowRight size={14} />
                </div>
              </div>

              <div 
                className="discovery-card"
                onClick={() => {
                  handleNlAsk("请列出参与会议次数最多的前10场会议主题及其包含的学员人数");
                }}
              >
                <div className="discovery-card-icon icon-amber">
                  <Award size={22} />
                </div>
                <div className="discovery-card-title">🏆 热门会议主题全览</div>
                <div className="discovery-card-desc">
                  分析最受关注的晨读会主题、参会规模与互动热度。
                </div>
                <div className="discovery-card-action">
                  <span>直接探索</span>
                  <ArrowRight size={14} />
                </div>
              </div>
            </div>
          </div>
        ) : results.rows && results.rows.length === 0 ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            查询完成，未查到匹配的数据。
          </div>
        ) : viewMode === 'card' ? (
          /* 4.1 对话卡片视图 (推荐阅读与查看) */
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', paddingRight: '0.25rem' }}>
            {results.rows.map((row, rowIdx) => {
              // 智能多列提取与解包 (杜绝暴露 raw JSON)
              const { speaker: speakerVal, topic: topicVal, time: timeVal, content: contentVal } = extractRowValues(row);

              const formattedTime = formatReadableTime(timeVal);
              const cleanedContent = cleanSpeechText(String(contentVal));

              return (
                <div
                  key={rowIdx}
                  style={{
                    backgroundColor: 'var(--bg-main)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '0.85rem 1.1rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.4)'}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border-color)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <div
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: '50%',
                          backgroundColor: 'rgba(99, 102, 241, 0.15)',
                          color: 'var(--primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          fontWeight: 700
                        }}
                      >
                        {speakerVal.slice(0, 1)}
                      </div>
                      <span style={{ fontWeight: 700, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                        {speakerVal}
                      </span>
                      <span style={{ fontSize: '0.725rem', padding: '0.1rem 0.45rem', borderRadius: '10px', backgroundColor: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' }}>
                        {topicVal}
                      </span>
                    </div>

                    {formattedTime && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Calendar size={12} /> {formattedTime}
                      </span>
                    )}
                  </div>

                  <div style={{ fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--text-primary)', wordBreak: 'break-word', marginTop: '0.25rem' }}>
                    {cleanedContent.length > 180 ? (
                      <div>
                        <span>{cleanedContent.slice(0, 180)}... </span>
                        <button
                          className="btn"
                          style={{ padding: '0.1rem 0.4rem', fontSize: '0.725rem', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                          onClick={() => setActiveModalRow({ row, col: '发言内容', content: String(contentVal) })}
                        >
                          <Eye size={11} /> 展开全文
                        </button>
                      </div>
                    ) : (
                      cleanedContent
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* 4.2 经典数据表格视图 (中文化列名 + 防止重叠) */
          <div className="data-table-container" style={{ flex: 1, overflow: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
            <table className="data-table" style={{ width: '100%', tableLayout: 'auto' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 2, backgroundColor: 'var(--bg-card)' }}>
                <tr>
                  {results.columns.map((col, idx) => (
                    <th key={idx} style={{ padding: '0.75rem 1rem', whiteSpace: 'nowrap' }}>
                      {getColumnChineseLabel(col)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {results.rows.map((row, rowIdx) => (
                  <tr key={rowIdx}>
                    {results.columns.map((col, colIdx) => {
                      const val = row[col];
                      const isContentCol = isContentColumn(col);
                      const colClean = col.toLowerCase();
                      const isTimeCol = colClean.includes('时间') || colClean.includes('time') || colClean.includes('date') || colClean.includes('created');

                      let renderedVal = '';
                      if (val === null || val === undefined) {
                        renderedVal = <em style={{ color: 'var(--text-muted)' }}>null</em>;
                      } else if (isTimeCol) {
                        renderedVal = <span style={{ color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatReadableTime(val)}</span>;
                      } else if (typeof val === 'object') {
                        renderedVal = JSON.stringify(val);
                      } else {
                        const strVal = String(val);
                        if (isContentCol && strVal.length > 50) {
                          const cleaned = cleanSpeechText(strVal);
                          renderedVal = (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', overflow: 'hidden' }}>
                              <div
                                style={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  maxHeight: '3.2em',
                                  lineHeight: 1.5,
                                  color: 'var(--text-primary)',
                                  wordBreak: 'break-word'
                                }}
                              >
                                {cleaned}
                              </div>
                              <button
                                className="btn"
                                style={{
                                  alignSelf: 'flex-start',
                                  padding: '0.15rem 0.45rem',
                                  fontSize: '0.725rem',
                                  borderRadius: '4px',
                                  color: 'var(--primary)',
                                  backgroundColor: 'rgba(99, 102, 241, 0.1)',
                                  border: '1px solid rgba(99, 102, 241, 0.2)'
                                }}
                                onClick={() => setActiveModalRow({ row, col, content: strVal })}
                              >
                                <Eye size={12} /> 查看全文
                              </button>
                            </div>
                          );
                        } else {
                          renderedVal = strVal;
                        }
                      }

                      return (
                        <td
                          key={colIdx}
                          style={{
                            fontFamily: isTimeCol ? 'var(--font-mono)' : 'var(--font-sans)',
                            fontSize: '0.825rem',
                            whiteSpace: isContentCol ? 'normal' : 'nowrap',
                            wordBreak: 'break-word',
                            overflow: 'hidden',
                            maxWidth: isContentCol ? '420px' : '200px',
                            minWidth: isTimeCol ? '180px' : isContentCol ? '260px' : '100px',
                            lineHeight: 1.5,
                            padding: '0.65rem 0.85rem',
                            verticalAlign: 'top'
                          }}
                        >
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

      {/* 5. 发言原文 / 详情 FullTextModal 模态弹窗 */}
      {activeModalRow && (() => {
        const parsed = parseDialogueTurns(activeModalRow.content, activeModalRow.row);
        const modalSpeaker = cleanSpeakerName(activeModalRow.row['发言人'] || activeModalRow.row['书友'] || parsed.meta['发言人'] || '发言书友');
        const modalTopic = activeModalRow.row['会议主题'] || parsed.meta['会议主题'] || '晨读营交流';
        const modalTime = activeModalRow.row['发言时间'] || activeModalRow.row['会议时间'] || parsed.meta['时间'];

        // 针对模态弹窗进行实时文本搜索过滤
        const filteredTurns = parsed.turns.filter(t => 
          !modalSearchText || 
          t.speaker.toLowerCase().includes(modalSearchText.toLowerCase()) || 
          t.text.toLowerCase().includes(modalSearchText.toLowerCase()) || 
          t.timestamp.includes(modalSearchText)
        );

        return (
          <div className="modal-overlay" onClick={() => { setActiveModalRow(null); setModalSearchText(''); }}>
            <div 
              className="modal-content" 
              onClick={(e) => e.stopPropagation()} 
              style={{ maxWidth: '840px', maxHeight: '88vh', width: '92%' }}
            >
              {/* 弹窗 Header */}
              <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <div style={{ width: 34, height: 34, borderRadius: '50%', background: 'linear-gradient(135deg, var(--primary), #a855f7)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: 700 }}>
                    {modalSpeaker.slice(0, 1)}
                  </div>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span>{modalSpeaker} · 发言内容原文详情</span>
                      {parsed.turns.length > 0 && (
                        <span style={{ fontSize: '0.725rem', padding: '0.1rem 0.45rem', borderRadius: '10px', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', fontWeight: 600 }}>
                          共 {parsed.turns.length} 段发言
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.775rem', color: 'var(--text-muted)', marginTop: '0.1rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span>📖 会议: {modalTopic}</span>
                      {modalTime && <span>🕒 时间: {formatReadableTime(modalTime)}</span>}
                    </div>
                  </div>
                </div>
                <button className="btn" style={{ padding: '0.25rem 0.45rem' }} onClick={() => { setActiveModalRow(null); setModalSearchText(''); }}>
                  <X size={18} />
                </button>
              </div>

              {/* 弹窗顶部搜索过滤栏 */}
              <div style={{ padding: '0.65rem 1.25rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-main)', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <Search size={14} style={{ position: 'absolute', left: '0.65rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                  <input
                    type="text"
                    className="input"
                    placeholder="🔍 搜索发言关键词 / 时间段 (如: 预售, 00:04)..."
                    value={modalSearchText}
                    onChange={(e) => setModalSearchText(e.target.value)}
                    style={{ paddingLeft: '2rem', height: '32px', fontSize: '0.825rem', borderRadius: '6px' }}
                  />
                </div>
                {modalSearchText && (
                  <button className="btn" style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }} onClick={() => setModalSearchText('')}>
                    清空搜索
                  </button>
                )}
              </div>

              {/* 弹窗 Body: 对话 Chat Cards 布局 / 结构化呈现 */}
              <div style={{ padding: '1.25rem', overflowY: 'auto', flex: 1, backgroundColor: 'var(--bg-main)', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                {parsed.turns.length > 0 ? (
                  filteredTurns.length > 0 ? (
                    filteredTurns.map((turn, idx) => {
                      const isHighlighted = modalSearchText && turn.text.toLowerCase().includes(modalSearchText.toLowerCase());
                      return (
                        <div
                          key={idx}
                          style={{
                            backgroundColor: isHighlighted ? 'rgba(99, 102, 241, 0.12)' : 'var(--bg-card)',
                            border: isHighlighted ? '1px solid var(--primary)' : '1px solid var(--border-color)',
                            borderRadius: '10px',
                            padding: '0.85rem 1.1rem',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '0.4rem',
                            transition: 'all 0.2s ease',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                              <div style={{ width: 22, height: 22, borderRadius: '50%', backgroundColor: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.7rem', fontWeight: 700 }}>
                                {turn.speaker.slice(0, 1)}
                              </div>
                              <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                                {turn.speaker}
                              </span>
                              <span style={{ fontSize: '0.7rem', padding: '0.05rem 0.35rem', borderRadius: '4px', backgroundColor: 'var(--bg-main)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                                #{idx + 1}
                              </span>
                            </div>
                            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--primary)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                              ⏱️ {turn.timestamp}
                            </span>
                          </div>

                          <div style={{ fontSize: '0.9rem', lineHeight: 1.65, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                            {highlightText(turn.text, modalSearchText)}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      未找到包含 "{modalSearchText}" 的发言段落
                    </div>
                  )
                ) : parsed.paragraphs && parsed.paragraphs.length > 0 ? (
                  parsed.paragraphs.map((para, idx) => (
                    <div
                      key={idx}
                      style={{
                        backgroundColor: 'var(--bg-card)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        padding: '0.85rem 1rem',
                        fontSize: '0.9rem',
                        lineHeight: 1.65,
                        color: 'var(--text-primary)'
                      }}
                    >
                      {highlightText(para, modalSearchText)}
                    </div>
                  ))
                ) : (
                  <div style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '1rem', fontSize: '0.9rem', lineHeight: 1.7, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                    {parsed.plainText}
                  </div>
                )}
              </div>

              {/* 弹窗 Footer 栏 */}
              <div style={{ padding: '0.85rem 1.25rem', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-card)' }}>
                <span style={{ fontSize: '0.775rem', color: 'var(--text-muted)' }}>
                  💡 提示：点击“复制原文”可一键导出清晰文本逐字稿
                </span>

                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn"
                    onClick={() => {
                      const textToCopy = parsed.turns.length > 0
                        ? parsed.turns.map(t => `${t.speaker}(${t.timestamp}): ${t.text}`).join('\n')
                        : parsed.plainText;
                      navigator.clipboard.writeText(textToCopy);
                      setCopiedModalText(true);
                      setTimeout(() => setCopiedModalText(false), 2000);
                    }}
                  >
                    {copiedModalText ? <Check size={14} style={{ color: '#10b981' }} /> : <Copy size={14} />}
                    {copiedModalText ? '已复制格式化原文' : '复制原文'}
                  </button>
                  <button className="btn btn-primary" onClick={() => { setActiveModalRow(null); setModalSearchText(''); }}>
                    关闭窗口
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
}
