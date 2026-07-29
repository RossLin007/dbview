import express from 'express';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();


const router = express.Router();
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/postgres';
const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: false,
  options: '-c timezone=Asia/Shanghai'
});

const getLlmTimeout = () => parseInt(process.env.LLM_TIMEOUT_MS) || 60000;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-xxx',
  baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  timeout: getLlmTimeout(),
});

const SCHEMA_CACHE = { tables: [], lastFetched: 0 };
const CACHE_TTL = 60000;

async function getTableDDL() {
  if (Date.now() - SCHEMA_CACHE.lastFetched < CACHE_TTL && SCHEMA_CACHE.tables.length > 0) {
    return SCHEMA_CACHE.tables;
  }

  const schemaRes = await pool.query(
    'SELECT c.table_name, c.column_name, c.data_type, c.is_nullable, ' +
    'col_description(pg_class.oid, c.ordinal_position) as description ' +
    'FROM information_schema.columns c ' +
    'JOIN pg_class ON pg_class.relname = c.table_name ' +
    'JOIN pg_namespace n ON n.oid = pg_class.relnamespace AND n.nspname = c.table_schema ' +
    "WHERE c.table_schema = 'public' " +
    "AND c.table_name NOT LIKE 'pg_%' AND c.table_name NOT LIKE '_prisma_%' " +
    'ORDER BY c.table_name, c.ordinal_position'
  );

  const tableMap = {};
  for (const row of schemaRes.rows) {
    if (!tableMap[row.table_name]) tableMap[row.table_name] = [];
    tableMap[row.table_name].push({
      column: row.column_name,
      type: row.data_type,
      nullable: row.is_nullable === 'YES',
      description: row.description || '',
    });
  }

  const fkRes = await pool.query(
    'SELECT tc.table_name, kcu.column_name, ' +
    'ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name ' +
    'FROM information_schema.table_constraints tc ' +
    'JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name ' +
    'JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name ' +
    "WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'"
  );

  const fkMap = {};
  for (const row of fkRes.rows) {
    if (!fkMap[row.table_name]) fkMap[row.table_name] = [];
    fkMap[row.table_name].push({
      column: row.column_name,
      references: row.foreign_table_name + '(' + row.foreign_column_name + ')',
    });
  }

  const tables = Object.entries(tableMap).map(([tableName, columns]) => {
    let ddl = 'TABLE ' + tableName + ' (\n';
    for (const col of columns) {
      ddl += '  ' + col.column + ' ' + col.type + (col.nullable ? '' : ' NOT NULL');
      if (col.description) ddl += '  -- ' + col.description;
      ddl += '\n';
    }
    if (fkMap[tableName]) {
      for (const fk of fkMap[tableName]) {
        ddl += '  FOREIGN KEY (' + fk.column + ') REFERENCES ' + fk.references + '\n';
      }
    }
    ddl += ')';
    return { tableName, ddl, columns };
  });

  SCHEMA_CACHE.tables = tables;
  SCHEMA_CACHE.lastFetched = Date.now();
  return tables;
}

// 意图分类（6 大场景判断 + 实体解析）
function detectQueryIntent(question) {
  const q = question.toLowerCase();

  if (q.includes('生命教练') || q.includes('课程') || q.includes('最适合') || q.includes('推荐参加') || q.includes('谁适合')) {
    return { type: 'RECOMMEND', name: '推理推荐型', strategy: 'HYBRID' };
  }
  if (q.includes('谁和') || q.includes('谁与') || q.includes('讨论') || q.includes('互动') || q.includes('交流最多') || q.includes('最多')) {
    return { type: 'RELATION', name: '关系挖掘型', strategy: 'SQL' };
  }
  if (q.includes('趋势') || q.includes('热门') || q.includes('分类') || q.includes('主题') || q.includes('变化趋势') || (q.includes('近半年') && !q.includes('说了'))) {
    return { type: 'TREND', name: '趋势分析型', strategy: 'SQL' };
  }
  if (q.includes('变化') || q.includes('关注') || q.includes('话题') || (q.includes('近三个月') && !q.includes('说了')) || q.includes('档案')) {
    return { type: 'ANALYSIS', name: '演变分析型', strategy: 'HYBRID' };
  }
  if (q.includes('多少次') || q.includes('一共') || q.includes('统计') || q.includes('总数') || q.includes('场次') || q.includes('计数')) {
    return { type: 'STAT', name: '数据统计型', strategy: 'SQL' };
  }

  return { type: 'QUERY', name: '内容检索型', strategy: 'SQL' };
}

// 帮助函数：从自然语言解析时间条件表达式 (含无年份月日自动补充当前年份)
function parseTimeCondition(question, tableAlias = 'r') {
  const q = question.toLowerCase();

  // 1. 匹配完整年月日 (如 "2026年7月12日", "2026-07-12", "2026.7.12", "2026/7/12")
  const fullDateMatch = q.match(/(\d{4})[年\-\.\/](\d{1,2})[月\-\.\/](\d{1,2})[日号]?/);
  if (fullDateMatch) {
    const year = fullDateMatch[1];
    const month = fullDateMatch[2].padStart(2, '0');
    const day = fullDateMatch[3].padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    return `to_timestamp(CAST(${tableAlias}.time->>'start_time' AS BIGINT) / 1000)::date = '${dateStr}'::date`;
  }

  // 2. 匹配无年份的月日 (如 "7月12日", "7月12号", "7.12", "07-12") -> 自动补充当前北京时间年份
  const monthDayMatch = q.match(/(\d{1,2})[月\-\.\/](\d{1,2})[日号]?/);
  if (monthDayMatch) {
    const currentYear = new Date().toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric' }).replace(/\D/g, '') || '2026';
    const month = monthDayMatch[1].padStart(2, '0');
    const day = monthDayMatch[2].padStart(2, '0');
    const dateStr = `${currentYear}-${month}-${day}`;
    return `to_timestamp(CAST(${tableAlias}.time->>'start_time' AS BIGINT) / 1000)::date = '${dateStr}'::date`;
  }

  // 3. 相对时间匹配 (昨天/今天/前天/近3个月/今年...)
  if (q.includes('昨天')) {
    return `to_timestamp(CAST(${tableAlias}.time->>'start_time' AS BIGINT) / 1000)::date = (CURRENT_DATE - INTERVAL '1 day')::date`;
  }
  if (q.includes('今天')) {
    return `to_timestamp(CAST(${tableAlias}.time->>'start_time' AS BIGINT) / 1000)::date = CURRENT_DATE::date`;
  }
  if (q.includes('前天')) {
    return `to_timestamp(CAST(${tableAlias}.time->>'start_time' AS BIGINT) / 1000)::date = (CURRENT_DATE - INTERVAL '2 days')::date`;
  }
  if (q.includes('近3个月') || q.includes('近三个月') || q.includes('最近三个月')) {
    return `to_timestamp(CAST(${tableAlias}.time->>'start_time' AS BIGINT) / 1000) >= (CURRENT_DATE - INTERVAL '3 months')`;
  }
  if (q.includes('近半年') || q.includes('最近半年') || q.includes('近6个月')) {
    return `to_timestamp(CAST(${tableAlias}.time->>'start_time' AS BIGINT) / 1000) >= (CURRENT_DATE - INTERVAL '6 months')`;
  }
  if (q.includes('近1个月') || q.includes('近一个月') || q.includes('最近一个月')) {
    return `to_timestamp(CAST(${tableAlias}.time->>'start_time' AS BIGINT) / 1000) >= (CURRENT_DATE - INTERVAL '1 month')`;
  }
  if (q.includes('今年')) {
    return `to_timestamp(CAST(${tableAlias}.time->>'start_time' AS BIGINT) / 1000) >= date_trunc('year', CURRENT_TIMESTAMP)`;
  }
  return null;
}

// 帮助函数：寻找问题中的发言人（自动剔除 姐/哥/兄/妹/弟/老师/教练/书友 等尊称后缀）
function findPersonInQuestion(question) {
  const knownPersons = [
    '林泰君', '康雯娟', '徐燕', '全伟', '伟伟', '刘伟伟', '厉瑞男', '瑞男',
    '徐海远', '海远', 'Carrie', 'Vela', '祖伟', '张敏', '汪汪', '狮子', '李阳', '顾倩',
    'Pyo', '话梅', '莹子', '朱冬伊', '陈东一', '王刚', '刘弦', '王晓寅'
  ];

  for (const p of knownPersons) {
    if (question.includes(p)) return p;
  }

  // 剔除“姐/哥/兄/妹/弟/老师/教练/书友/总/君”后二次尝试匹配
  const cleanQ = question.replace(/(姐|哥|兄|妹|弟|老师|教练|书友|总|君)/g, '');
  for (const p of knownPersons) {
    if (cleanQ.includes(p)) return p;
  }

  return null;
}

// 帮助函数：过滤掉常见停用词、时间词、日期字符串、人名及尊称，提取真正的语义搜索关键词
function extractCleanKeywords(question, personName) {
  let kw = question;
  if (personName) {
    kw = kw.replaceAll(personName, '');
  }
  // 剥离完整日期与无年份月日 (如 2026年7月12日, 7月12日, 7.12)
  kw = kw.replace(/\d{4}[年\-\.\/]\d{1,2}[月\-\.\/]\d{1,2}[日号]?/g, '');
  kw = kw.replace(/\d{1,2}[月\-\.\/]\d{1,2}[日号]?/g, '');

  const filterWords = [
    '昨天', '今天', '前天', '今年', '最近', '近半年', '近三个月', '近一个月', '最近一个月',
    '有哪些', '是什么', '帮我查', '查询', '找找', '有哪些会议', '会议列表', '会议记录', '会议',
    '说了什么', '说了啥', '讲了什么', '表达', '发言', '多少次', '推荐', '谁和', '谁与', '讨论', '内容',
    '姐', '哥', '妹', '弟', '老师', '教练', '书友', '总', '君'
  ];
  for (const w of filterWords) {
    kw = kw.replaceAll(w, '');
  }
  return kw.replace(/[？?！!询查请问记录多少个条]/g, '').trim();
}

// 智能 Fallback SQL 生成器（包含精确时间解析、称谓剥离、表选择与 speaker_aliases 归一化）
function fallbackNlToSQL(question, intent) {
  const q = question.toLowerCase().trim();

  const personName = findPersonInQuestion(question);
  const timeCondR = parseTimeCondition(question, 'r');
  const timeCondU = parseTimeCondition(question, 'u');
  const cleanKw = extractCleanKeywords(question, personName);

  // 场景 0: 明确查询“会议列表/有哪些会议” (直接查 records 表)
  const isMeetingListQuery = (q.includes('会议') || q.includes('开会')) && (q.includes('有哪些') || q.includes('列表') || q.includes('记录') || q.includes('主题')) && !q.includes('说了') && !q.includes('发言');
  if (isMeetingListQuery) {
    let whereClauses = ["r.time->>'start_time' IS NOT NULL AND r.time->>'start_time' <> 'null'"];
    if (timeCondR) whereClauses.push(timeCondR);
    if (personName) whereClauses.push(`array_to_string(r.participants, ',') ILIKE '%${personName}%'`);
    if (cleanKw) whereClauses.push(`(r.topic->>'title' ILIKE '%${cleanKw}%' OR r.topic->>'subject' ILIKE '%${cleanKw}%')`);

    return `SELECT 
  r.topic->>'title' AS "会议主题",
  COALESCE(r.topic->>'category', '晨读营交流') AS "会议分类",
  to_char(to_timestamp(CAST(r.time->>'start_time' AS BIGINT) / 1000), 'YYYY-MM-DD HH24:MI:SS') AS "会议时间",
  array_to_string(r.participants, ', ') AS "参会学员"
FROM public.records r
WHERE ${whereClauses.join(' AND ')}
ORDER BY CAST(r.time->>'start_time' AS BIGINT) DESC
LIMIT 20;`;
  }

  // 场景 1: 推理推荐型（生命教练课程推荐）
  if (intent.type === 'RECOMMEND') {
    return `SELECT 
  sp.speaker_name AS "书友姓名",
  sp.extracted_facts AS "书友核心特质与关注点",
  r.topic->>'title' AS "近期参与会议",
  sp.updated_at AS "档案更新时间"
FROM public.speaker_profiles sp
LEFT JOIN public.records r ON sp.record_id = r.record_id
ORDER BY sp.updated_at DESC
LIMIT 15;`;
  }

  // 场景 2: 关系挖掘型（谁和某人讨论最多）
  if (intent.type === 'RELATION') {
    const targetName = personName || '林泰君';
    let whereClauses = [
      `array_to_string(r.participants, ',') ILIKE '%${targetName}%'`,
      `u.speaker NOT ILIKE '%${targetName}%'`,
      `u.speaker IS NOT NULL AND u.speaker <> ''`
    ];
    if (timeCondR) whereClauses.push(timeCondR);

    return `SELECT 
  COALESCE(sa.speaker_display, sa.speaker_norm, u.speaker) AS "互动书友",
  COUNT(*) AS "讨论互动频次",
  COUNT(DISTINCT u.record_id) AS "共同参与会议数"
FROM public.utterances u
JOIN public.records r ON u.record_id = r.record_id
LEFT JOIN public.speaker_aliases sa ON sa.alias = lower(u.speaker) AND sa.status = 'active'
WHERE ${whereClauses.join(' AND ')}
GROUP BY COALESCE(sa.speaker_display, sa.speaker_norm, u.speaker)
ORDER BY "讨论互动频次" DESC
LIMIT 12;`;
  }

  // 场景 3: 趋势型（热门主题与分类）
  if (intent.type === 'TREND') {
    let whereClauses = ["time->>'start_time' IS NOT NULL AND time->>'start_time' <> 'null'"];
    if (timeCondR) whereClauses.push(timeCondR);

    return `SELECT 
  COALESCE(topic->>'category', '晨读主题交流') AS "主题分类",
  COUNT(*) AS "会议场次",
  MIN(to_timestamp(CAST(time->>'start_time' AS BIGINT) / 1000)::date) AS "最早记录日期",
  MAX(to_timestamp(CAST(time->>'start_time' AS BIGINT) / 1000)::date) AS "最近记录日期"
FROM public.records
WHERE ${whereClauses.join(' AND ')}
GROUP BY topic->>'category'
ORDER BY "会议场次" DESC;`;
  }

  // 场景 4: 分析型（话题演变与关注点）
  if (intent.type === 'ANALYSIS' && personName) {
    let whereClauses = [`(u.speaker ILIKE '%${personName}%' OR lower(sa.speaker_norm) ILIKE '%${personName}%')`];
    if (timeCondU) whereClauses.push(timeCondU);

    return `SELECT 
  COALESCE(sa.speaker_display, sa.speaker_norm, u.speaker) AS "发言人",
  r.topic->>'title' AS "会议主题",
  u.content AS "发言要点内容",
  to_char(to_timestamp(CAST(u.time->>'start_time' AS BIGINT) / 1000), 'YYYY-MM-DD HH24:MI:SS') AS "发言时间"
FROM public.utterances u
JOIN public.records r ON u.record_id = r.record_id
LEFT JOIN public.speaker_aliases sa ON sa.alias = lower(u.speaker) AND sa.status = 'active'
WHERE ${whereClauses.join(' AND ')}
ORDER BY (u.time->>'start_time')::bigint DESC
LIMIT 20;`;
  }

  // 场景 5: 统计型（发言频次 / 参会统计）
  if (intent.type === 'STAT') {
    if (personName) {
      let whereClauses = [`(u.speaker ILIKE '%${personName}%' OR lower(sa.speaker_norm) ILIKE '%${personName}%')`];
      if (timeCondU) whereClauses.push(timeCondU);
      return `SELECT 
  COALESCE(sa.speaker_display, sa.speaker_norm, u.speaker) AS "发言人",
  COUNT(*) AS "总发言段落数",
  COUNT(DISTINCT u.record_id) AS "参与会议场次"
FROM public.utterances u
LEFT JOIN public.speaker_aliases sa ON sa.alias = lower(u.speaker) AND sa.status = 'active'
WHERE ${whereClauses.join(' AND ')}
GROUP BY COALESCE(sa.speaker_display, sa.speaker_norm, u.speaker);`;
    }

    let whereClauses = ["trim(p) <> ''"];
    if (timeCondR) whereClauses.push(timeCondR);
    return `SELECT 
  COALESCE(sa.speaker_display, sa.speaker_norm, trim(p)) AS "书友",
  COUNT(*) AS "参会次数"
FROM public.records r, unnest(participants) p
LEFT JOIN public.speaker_aliases sa ON sa.alias = lower(trim(p)) AND sa.status = 'active'
WHERE ${whereClauses.join(' AND ')}
GROUP BY COALESCE(sa.speaker_display, sa.speaker_norm, trim(p))
ORDER BY "参会次数" DESC
LIMIT 20;`;
  }

  // 场景 6: 查询型（具体发言逐字稿 / 人名发言 / 语义关键词）
  let whereClauses = [];
  if (timeCondU) whereClauses.push(timeCondU);
  if (personName) whereClauses.push(`(u.speaker ILIKE '%${personName}%' OR lower(sa.speaker_norm) ILIKE '%${personName}%')`);
  if (cleanKw) whereClauses.push(`(u.content ILIKE '%${cleanKw}%' OR r.topic->>'title' ILIKE '%${cleanKw}%')`);

  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  return `SELECT 
  COALESCE(sa.speaker_display, sa.speaker_norm, u.speaker) AS "发言人",
  u.content AS "发言内容",
  r.topic->>'title' AS "会议主题",
  to_char(to_timestamp(CAST(u.time->>'start_time' AS BIGINT) / 1000), 'YYYY-MM-DD HH24:MI:SS') AS "发言时间"
FROM public.records r
JOIN public.utterances u ON r.record_id = u.record_id
LEFT JOIN public.speaker_aliases sa ON sa.alias = lower(u.speaker) AND sa.status = 'active'
${whereSql}
ORDER BY (u.time->>'start_time')::bigint DESC
LIMIT 20;`;
}

function getBeijingDateInfo() {
  const now = new Date();
  const beijingDateStr = now.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
  const beijingYear = beijingDateStr.split('-')[0] || '2026';
  return { beijingDateStr, beijingYear };
}

function getSystemPrompt() {
  const { beijingDateStr, beijingYear } = getBeijingDateInfo();
  return `你是一个数据库与 RAG 专家，负责将生命教练线上晨读营用户的中文自然语言问题转换为 PostgreSQL SQL 查询。

## 数据库 Schema
<schema>
{tables_ddl}
</schema>

## 业务核心规则与字段习惯
1. 仅输出只读 SQL (SELECT 或 WITH)，不要包含任何 markdown 代码块标记或其他解释。
2. 参会发言人别名标准归一化与简称匹配（极度重要）：
   - 当用户使用带称谓或简称（如 "徐燕姐" -> "徐燕"、"海远兄" -> "海远"、"张敏老师" -> "张敏"）时，必须自动剔除 "姐"、"哥"、"兄"、"老师" 等尊称后缀。
   - 在查询发言人 utterances 时，通过 LEFT JOIN speaker_aliases 进行别名归一：
     LEFT JOIN public.speaker_aliases sa ON sa.alias = lower(u.speaker) AND sa.status = 'active'
   - **发言人过滤表达式（必须且只能使用 ILIKE '%核心名%' 模糊匹配，严禁使用等值 = '海远'，因为数据库全名为 '徐海远'）**：
     WHERE (u.speaker ILIKE '%核心名%' OR sa.alias ILIKE '%核心名%' OR sa.speaker_display ILIKE '%核心名%')
   - **核心注意：speaker_norm 字段存储的是拼音（如 'xu_haiyuan'），严禁在 sa.speaker_norm 上进行中文等值匹配，严禁构造子查询 CTE 导致匹配失败！**
3. 时间字段解析（极度重要，基准时区：北京时间 UTC+8 / Asia/Shanghai）：
   - 数据库连接与查询会话均已统一设为北京时间 (Asia/Shanghai, UTC+8)。
   - records.time / utterances.time 为 JSONB，包含 start_time (毫秒时间戳)。
   - 当用户使用 "7月12日"、"7月12号" 等省略年份的日期时，必须自动补全当前年份 (\${beijingYear}年)：
     WHERE to_timestamp(CAST(r.time->>'start_time' AS BIGINT) / 1000)::date = '\${beijingYear}-07-12'::date
   - 当用户使用 "\${beijingYear}年7月12日" 时：
     WHERE to_timestamp(CAST(r.time->>'start_time' AS BIGINT) / 1000)::date = '\${beijingYear}-07-12'::date
   - 当用户提问包含 "昨天" 时：WHERE to_timestamp(CAST(r.time->>'start_time' AS BIGINT) / 1000)::date = (CURRENT_DATE - INTERVAL '1 day')::date
   - 当用户提问包含 "今天" 时：WHERE to_timestamp(CAST(r.time->>'start_time' AS BIGINT) / 1000)::date = CURRENT_DATE::date
   - 当用户提问包含 "今年" 时：WHERE to_timestamp(CAST(r.time->>'start_time' AS BIGINT) / 1000) >= date_trunc('year', CURRENT_TIMESTAMP)
   - 当用户提问包含 "最近三个月" 时：WHERE to_timestamp(CAST(r.time->>'start_time' AS BIGINT) / 1000) >= CURRENT_DATE - INTERVAL '3 months'
   - **严禁把 "7月12日"、"昨天"、"有哪些会议" 当作文本在 WHERE content ILIKE 中模糊匹配！**
4. 数据表选择规则：
   - 若用户询问 "有哪些会议" / "开过哪些会" / "会议列表"，请直接查询 public.records r 表（查询 r.topic->>'title', r.participants 等），不要 JOIN utterances。
   - 若用户询问 "说了什么" / "发言内容" / "讲了什么" / 人员状态，请查询 public.records r JOIN public.utterances u ON r.record_id = u.record_id。优先查询 public.utterances/records，**严禁单独查询 public.facts 表**（因为 facts 表无精确会议时间戳）。
5. **排序与最新数据规则（极度重要）**：
   - 查询结果必须统一按会议/发言时间倒序排列：ORDER BY CAST(u.time->>'start_time' AS BIGINT) DESC 或 ORDER BY CAST(r.time->>'start_time' AS BIGINT) DESC，确保最新的记录（如 7 月份）优先排在最上方！
6. LIMIT 默认 20。
7. 当前日期（北京时间）：${beijingDateStr}。
8. **输出列别名规范与时间格式化（极度重要：严禁输出 Share_content 等英文别名，必须全部标注友好中文别名）**：
   - 提取会议标题：r.topic->>'title' AS "会议主题"
   - 提取发言人：COALESCE(sa.speaker_display, sa.speaker_norm, u.speaker) AS "发言人"
   - 提取发言内容：u.content AS "发言/分享内容"
   - 提取发言/会议时间：必须使用 \`to_char(to_timestamp(CAST(u.time->>'start_time' AS BIGINT) / 1000), 'YYYY-MM-DD HH24:MI:SS') AS "发言/会议时间"\` 或者 \`to_char(to_timestamp(CAST(r.time->>'start_time' AS BIGINT) / 1000), 'YYYY-MM-DD HH24:MI:SS') AS "发言/会议时间"\`;
`;
}

function withTimeout(promise, ms = getLlmTimeout()) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`LLM 请求超时 (${Math.round(ms / 1000)}s)`)), ms))
  ]);
}

async function nlToSQL(question, intent) {
  const tables = await getTableDDL();
  const tablesDDL = tables.map(t => t.ddl).join('\n\n');
  const prompt = getSystemPrompt().replace('{tables_ddl}', tablesDDL);

  const response = await withTimeout(openai.chat.completions.create({
    model: process.env.LLM_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: prompt },
      { role: 'user', content: `[意图类型：${intent.name}] 问题：${question}` }
    ],
    temperature: 0.1,
    max_tokens: 1000,
  }));

  let sql = response.choices[0].message.content.trim();
  sql = sql.replace(/```sql\s*/i, '').replace(/```\s*/i, '').replace(/```\s*$/i, '').trim();
  if (!sql.endsWith(';')) sql += ';';
  return sql;
}

async function sqlResultsToAnswer(question, intent, sql, results) {
  // 性能极速优化：只截取前 6 条代表性记录，且将长文本裁切至 200 字以内，避免发送上万 token 导致 LLM 归一提炼超时
  const condensedRows = (results.rows || []).slice(0, 6).map(row => {
    const cleanedRow = {};
    for (const key of Object.keys(row)) {
      const val = row[key];
      if (typeof val === 'string' && val.length > 200) {
        cleanedRow[key] = val.slice(0, 200) + '...';
      } else {
        cleanedRow[key] = val;
      }
    }
    return cleanedRow;
  });

  const condensedPayload = {
    rowCount: results.rowCount,
    sampleRows: condensedRows
  };

  const prompt = `你是一个生命教练与晨读营数据分析助手。请将数据库查询结果用专业、亲和的自然语言回答教练的问题。

用户提问：${question}
意图类型：${intent.name}
查询记录总数：${results.rowCount} 条
代表性样本数据 (JSON)：${JSON.stringify(condensedPayload, null, 2)}

回答要求：
1. 回答须贴合生命教练晨读营上下文。
2. 保持回答简明扼要、重点突出（200字以内），文字亲和温暖。
3. 若包含发言人与发言内容，优先提炼核心金句或发言要点。
4. 若为推荐型或关系型问题，直接输出结论。`;

  // 针对 Step 4 AI 总结设为 8 秒快速超时，限制 400 token 生成，快速响应
  const response = await withTimeout(openai.chat.completions.create({
    model: process.env.LLM_MODEL || 'gpt-4o-mini',
    messages: [
      { role: 'system', content: '你是一个专业的生命教练数据分析助手。用清晰、结构化、提纲挈领的中文简短回答。' },
      { role: 'user', content: prompt }
    ],
    temperature: 0.3,
    max_tokens: 400,
  }), 8000);
  return response.choices[0].message.content.trim();
}

router.post('/ask', async (req, res) => {
  const { question } = req.body;
  if (!question || !question.trim()) {
    return res.status(400).json({ error: '请输入您的问题' });
  }

  // 称谓预处理：自动将 "徐燕姐"、"张敏老师"、"海远兄" 规范化为标准姓名 "徐燕"、"张敏"、"海远"
  const person = findPersonInQuestion(question);
  let sanitizedQuestion = question;
  if (person) {
    sanitizedQuestion = question.replace(new RegExp(`${person}(姐|哥|兄|妹|弟|老师|教练|书友|总|君)`, 'g'), person);
  }

  const intent = detectQueryIntent(sanitizedQuestion);
  let sql = '';
  let isFallback = false;
  let reasoningSteps = [];

  reasoningSteps.push(`1. 识别用户意图：${intent.name} (${intent.type})，判定执行策略：${intent.strategy}`);

  const isConfigured = process.env.OPENAI_API_KEY &&
    process.env.OPENAI_API_KEY !== 'sk-xxx' &&
    process.env.OPENAI_BASE_URL &&
    process.env.OPENAI_BASE_URL !== 'https://api.openai.com/v1';

  if (isConfigured) {
    try {
      sql = await nlToSQL(sanitizedQuestion, intent);
      reasoningSteps.push(`2. LLM 自动理解 11 张 Schema，结合 speaker_aliases 生成通用 SQL`);
    } catch (err) {
      console.warn('LLM nlToSQL failed or timed out, using fallback rules:', err.message);
      isFallback = true;
      sql = fallbackNlToSQL(sanitizedQuestion, intent);
      reasoningSteps.push(`2. 大模型响应超时，已降级使用场景智能 SQL 规则生成引擎`);
    }
  } else {
    isFallback = true;
    sql = fallbackNlToSQL(sanitizedQuestion, intent);
    reasoningSteps.push(`2. 启用内置智能 SQL 规则与 speaker_aliases 归一匹配引擎`);
  }

  const cleaned = sql.trim().toLowerCase();
  if (!cleaned.startsWith('select') && !cleaned.startsWith('with')) {
    return res.status(403).json({ sql, message: '安全拦截：系统仅允许 SELECT 或 WITH 只读查询' });
  }

  try {
    const startTime = Date.now();
    const result = await pool.query(sql);
    const executionTimeMs = Date.now() - startTime;

    reasoningSteps.push(`3. PostgreSQL 执行成功，检索出 ${result.rowCount} 条数据，耗时 ${executionTimeMs}ms`);

    const queryResult = {
      columns: result.fields ? result.fields.map(f => f.name) : [],
      rows: result.rows,
      rowCount: result.rowCount,
      executionTimeMs,
    };

    let answer = '';
    if (!isFallback) {
      try {
        answer = await sqlResultsToAnswer(question, intent, sql, queryResult);
        reasoningSteps.push(`4. 大模型汇总查询结果与发言要点，生成自然语言分析回答`);
      } catch (err) {
        console.warn('LLM summary failed, using default text answer:', err.message);
        answer = `查询成功，共找到 ${queryResult.rowCount} 条相关记录。`;
      }
    } else {
      answer = `[${intent.name}] 共检索到 ${queryResult.rowCount} 条记录。` +
        (process.env.OPENAI_BASE_URL === 'https://api.openai.com/v1' || !process.env.OPENAI_BASE_URL ? '（提示：默认 OpenAI API 接口未连通，已启用基于数据库规则引擎与 speaker_aliases 归一生成的 SQL。可在 .env 中配置 DeepSeek / OpenAI API 扩展 LLM 智能能力。）' : '');
    }

    res.json({
      question,
      intent: intent.type,
      scenarioName: intent.name,
      executionStrategy: intent.strategy,
      sql,
      answer,
      result: queryResult,
      isFallback,
      reasoningSteps,
    });
  } catch (err) {
    console.error('Error executing SQL query:', err);
    res.status(500).json({ error: '查询处理失败', message: err.message, sql, intent: intent.type });
  }
});

export default router;
