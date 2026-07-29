import express from 'express';
import pg from 'pg';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import nlRouter from './server-nl.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config();


const app = express();
const PORT = process.env.BACKEND_PORT || process.env.PORT || 3301;



app.use(cors());
app.use(express.json());

// Supabase Auth Configuration & Middleware
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

const isSupabaseServerConfigured = 
  Boolean(SUPABASE_URL) && 
  Boolean(SUPABASE_ANON_KEY) && 
  SUPABASE_URL !== 'https://your-project.supabase.co' &&
  SUPABASE_ANON_KEY !== 'your-anon-key';

const supabaseServer = isSupabaseServerConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false }
    })
  : null;

const requireAuth = async (req, res, next) => {
  // If Supabase credentials are not configured yet, skip auth check with a dev notice
  if (!isSupabaseServerConfigured) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const { data: { user }, error } = await supabaseServer.auth.getUser(token);
    if (error || !user) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid or expired token' });
    }

    // 白名单权限校验 (ALLOWED_EMAILS)
    const allowedEmailsStr = process.env.ALLOWED_EMAILS || '';
    const allowedEmails = allowedEmailsStr
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    if (allowedEmails.length > 0) {
      const userEmail = user.email ? user.email.toLowerCase() : '';
      if (!allowedEmails.includes(userEmail)) {
        return res.status(403).json({
          error: 'Forbidden',
          code: 'NOT_IN_ALLOWLIST',
          message: `您的账号 (${user.email}) 未在访问授权白名单中，请联系管理员开通权限。`
        });
      }
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized', message: err.message });
  }
};

// Health check endpoint (unprotected for Docker & Load Balancer probes)
app.get('/api/health', async (req, res) => {
  try {
    const dbRes = await pool.query('SELECT 1 AS alive');
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      database: dbRes.rows[0]?.alive === 1 ? 'connected' : 'degraded'
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      database: 'disconnected',
      message: err.message
    });
  }
});

// Config endpoint for frontend runtime Supabase credential injection
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  });
});


// Protect all /api routes with Supabase JWT authentication middleware
app.use('/api', requireAuth);


// Database configuration
const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/postgres';
const pool = new pg.Pool({
  connectionString: DATABASE_URL,
  ssl: false,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  options: '-c timezone=Asia/Shanghai',
});


pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client (auto-recovering):', err.message);
});

// Test connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('Error acquiring database client:', err.stack);
  } else {
    console.log('Database connection pool established successfully with keepAlive enabled.');
    release();
  }
});

// Helper to sanitize custom SQL queries to only allow SELECT
function isSafeSelectQuery(sql) {
  const cleaned = sql.trim().toLowerCase();
  if (!cleaned.startsWith('select') && !cleaned.startsWith('with')) {
    return { safe: false, reason: 'Query must start with SELECT or WITH' };
  }

  // Look for dangerous keywords as independent words (using regex boundaries)
  const dangerousKeywords = [
    'insert', 'update', 'delete', 'drop', 'alter', 'create', 'truncate', 
    'replace', 'grant', 'revoke', 'execute', 'copy', 'vacuum', 'analyze', 
    'into', 'schema', 'database', 'pg_sleep', 'pg_read_file', 'pg_write_file'
  ];

  for (const keyword of dangerousKeywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(cleaned)) {
      return { safe: false, reason: `Query contains disallowed keyword: "${keyword.toUpperCase()}"` };
    }
  }

  return { safe: true };
}

// 1. GET /api/records - paginated & filterable list of records
app.get('/api/records', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const { search, startDate, endDate, participant, category } = req.query;

    let whereClauses = [];
    let params = [];
    let paramIndex = 1;

    if (search) {
      whereClauses.push(`(
        topic->>'title' ILIKE $${paramIndex} OR 
        topic->>'subject' ILIKE $${paramIndex} OR
        place ILIKE $${paramIndex}
      )`);
      params.push(`%${search}%`);
      paramIndex++;
    }

    if (participant) {
      whereClauses.push(`$${paramIndex} = ANY(participants)`);
      params.push(participant);
      paramIndex++;
    }

    if (category) {
      whereClauses.push(`topic->>'category' = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    if (startDate) {
      const startMs = new Date(startDate).getTime();
      if (!isNaN(startMs)) {
        whereClauses.push(`CAST(time->>'start_time' AS BIGINT) >= $${paramIndex}`);
        params.push(startMs);
        paramIndex++;
      }
    }

    if (endDate) {
      // Set end date to end of that day (23:59:59.999)
      const endMs = new Date(endDate).getTime() + (24 * 60 * 60 * 1000 - 1);
      if (!isNaN(endMs)) {
        whereClauses.push(`CAST(time->>'start_time' AS BIGINT) <= $${paramIndex}`);
        params.push(endMs);
        paramIndex++;
      }
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Query records count
    const countQuery = `SELECT COUNT(*) FROM public.records ${whereSql}`;
    const countRes = await pool.query(countQuery, params);
    const totalRecords = parseInt(countRes.rows[0].count);

    // Query records data
    const selectQuery = `
      SELECT 
        record_id,
        time,
        place,
        participants,
        topic,
        created_at
      FROM public.records 
      ${whereSql} 
      ORDER BY CAST(time->>'start_time' AS BIGINT) DESC 
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;
    const dataParams = [...params, limit, offset];
    const dataRes = await pool.query(selectQuery, dataParams);

    res.json({
      records: dataRes.rows,
      pagination: {
        page,
        limit,
        totalRecords,
        totalPages: Math.ceil(totalRecords / limit)
      }
    });
  } catch (err) {
    console.error('Error fetching records:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 2. GET /api/records/:id - fetch record details, dialogues, utterances, analysis
app.get('/api/records/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch primary record details
    const recordRes = await pool.query('SELECT * FROM public.records WHERE record_id = $1', [id]);
    if (recordRes.rows.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    const record = recordRes.rows[0];

    // Fetch dialogue turns
    const dialogueRes = await pool.query(
      'SELECT * FROM public.dialogues WHERE record_id = $1 ORDER BY created_at ASC', 
      [id]
    );

    // Fetch speaker utterances
    const utteranceRes = await pool.query(
      'SELECT * FROM public.utterances WHERE record_id = $1 ORDER BY created_at ASC', 
      [id]
    );

    // Fetch AI analyses
    const analysisRes = await pool.query(
      'SELECT * FROM public.analysis WHERE record_id = $1 ORDER BY analyzed_at DESC', 
      [id]
    );

    res.json({
      record,
      dialogues: dialogueRes.rows,
      utterances: utteranceRes.rows,
      analysis: analysisRes.rows
    });
  } catch (err) {
    console.error(`Error fetching record ${req.params.id}:`, err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 3. POST /api/query - custom read-only SQL query explorer
app.post('/api/query', async (req, res) => {
  const { sql } = req.body;
  if (!sql) {
    return res.status(400).json({ error: 'SQL query parameter is required' });
  }

  // Safety check
  const safety = isSafeSelectQuery(sql);
  if (!safety.safe) {
    return res.status(403).json({ error: 'Query Rejected', message: safety.reason });
  }

  const startTime = Date.now();
  try {
    const result = await pool.query(sql);
    const executionTimeMs = Date.now() - startTime;

    res.json({
      columns: result.fields ? result.fields.map(f => f.name) : [],
      rows: result.rows,
      rowCount: result.rowCount,
      executionTimeMs
    });
  } catch (err) {
    console.error('Error executing custom SQL:', err);
    res.status(400).json({ error: 'Database Error', message: err.message });
  }
});

// 4. GET /api/analytics - high-level overview analytics
app.get('/api/analytics', async (req, res) => {
  try {
    // 1. Total meetings count
    const totalCountRes = await pool.query('SELECT COUNT(*) FROM public.records');
    const totalMeetings = parseInt(totalCountRes.rows[0].count);

    // 2. Total duration
    const totalDurationRes = await pool.query(
      "SELECT SUM(COALESCE(CAST(time->>'duration' AS BIGINT), 0)) FROM public.records"
    );
    const totalDurationMs = parseInt(totalDurationRes.rows[0].sum || 0);

    // 3. Total unique participants
    const uniqueParticipantsRes = await pool.query(
      'SELECT COUNT(DISTINCT p) FROM public.records, unnest(participants) p'
    );
    const totalParticipants = parseInt(uniqueParticipantsRes.rows[0].count);

    // 4. Category distribution
    const categoryRes = await pool.query(`
      SELECT 
        COALESCE(topic->>'category', 'unknown') as category, 
        COUNT(*) as count 
      FROM public.records 
      GROUP BY topic->>'category'
      ORDER BY count DESC
    `);

    // 5. Active participants ranking
    const activeParticipantsRes = await pool.query(`
      SELECT 
        trim(p) as name, 
        COUNT(*) as count 
      FROM public.records, unnest(participants) p 
      WHERE trim(p) <> ''
      GROUP BY trim(p) 
      ORDER BY count DESC 
      LIMIT 12
    `);

    // 6. Meetings over time (monthly trend)
    const trendRes = await pool.query(`
      SELECT 
        to_char(to_timestamp(CAST(time->>'start_time' AS BIGINT) / 1000), 'YYYY-MM') as month, 
        COUNT(*) as count 
      FROM public.records 
      WHERE time->>'start_time' IS NOT NULL AND time->>'start_time' <> 'null'
      GROUP BY month 
      ORDER BY month ASC
    `);

    res.json({
      totalMeetings,
      totalDurationMs,
      totalParticipants,
      categories: categoryRes.rows,
      topParticipants: activeParticipantsRes.rows,
      monthlyTrend: trendRes.rows
    });
  } catch (err) {
    console.error('Error fetching analytics:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 5. GET /api/members - list all normalized members with activity stats
app.get('/api/members', async (req, res) => {
  try {
    const membersQuery = `
      SELECT 
        COALESCE(sa.speaker_display, sa.speaker_norm, trim(p)) AS name,
        COUNT(DISTINCT r.record_id) AS meeting_count,
        COUNT(u.utterance_id) AS utterance_count,
        MAX(r.created_at) AS last_active
      FROM public.records r
      CROSS JOIN unnest(r.participants) p
      LEFT JOIN public.speaker_aliases sa ON sa.alias = lower(trim(p)) AND sa.status = 'active'
      LEFT JOIN public.utterances u ON u.record_id = r.record_id AND (u.speaker ILIKE trim(p) OR lower(u.speaker) = lower(sa.alias))
      WHERE trim(p) <> ''
      GROUP BY COALESCE(sa.speaker_display, sa.speaker_norm, trim(p))
      ORDER BY meeting_count DESC, utterance_count DESC
    `;
    const result = await pool.query(membersQuery);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching members:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 6. GET /api/members/:name - detailed profile, facts, and utterances of a member
app.get('/api/members/:name', async (req, res) => {
  try {
    const { name } = req.params;

    // Speaker Profiles
    const profilesRes = await pool.query(
      `SELECT * FROM public.speaker_profiles WHERE speaker_name ILIKE $1 ORDER BY created_at DESC LIMIT 5`,
      [`%${name}%`]
    );

    // Extracted Facts
    const factsRes = await pool.query(
      `SELECT * FROM public.facts WHERE speaker ILIKE $1 ORDER BY created_at DESC LIMIT 10`,
      [`%${name}%`]
    );

    // Recent Utterances
    const utterancesRes = await pool.query(
      `SELECT u.*, r.topic->>'title' as meeting_title 
       FROM public.utterances u
       JOIN public.records r ON u.record_id = r.record_id
       WHERE u.speaker ILIKE $1
       ORDER BY (u.time->>'start_time')::bigint DESC LIMIT 15`,
      [`%${name}%`]
    );

    // Aliases
    const aliasesRes = await pool.query(
      `SELECT * FROM public.speaker_aliases WHERE speaker_norm ILIKE $1 OR speaker_display ILIKE $1 OR alias ILIKE $1`,
      [`%${name}%`]
    );

    res.json({
      name,
      profiles: profilesRes.rows,
      facts: factsRes.rows,
      utterances: utterancesRes.rows,
      aliases: aliasesRes.rows
    });
  } catch (err) {
    console.error(`Error fetching profile for member ${req.params.name}:`, err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// 7. GET /api/relationships - interaction co-occurrence & frequency matrix
app.get('/api/relationships', async (req, res) => {
  try {
    const { target } = req.query;
    let whereClause = '';
    let params = [];

    if (target) {
      whereClause = `WHERE array_to_string(r.participants, ',') ILIKE $1 AND u.speaker NOT ILIKE $1`;
      params.push(`%${target}%`);
    } else {
      whereClause = `WHERE u.speaker IS NOT NULL AND u.speaker <> ''`;
    }

    const relQuery = `
      SELECT 
        COALESCE(sa.speaker_display, sa.speaker_norm, u.speaker) AS speaker,
        COUNT(*) AS interaction_count,
        COUNT(DISTINCT u.record_id) AS co_meeting_count
      FROM public.utterances u
      JOIN public.records r ON u.record_id = r.record_id
      LEFT JOIN public.speaker_aliases sa ON sa.alias = lower(u.speaker) AND sa.status = 'active'
      ${whereClause}
      GROUP BY COALESCE(sa.speaker_display, sa.speaker_norm, u.speaker)
      ORDER BY interaction_count DESC
      LIMIT 20
    `;

    const result = await pool.query(relQuery, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching relationships:', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  }
});

// Natural Language Query endpoint
app.use('/api', nlRouter);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT} (bound to 0.0.0.0)`);
});

