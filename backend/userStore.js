import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 本地账号存储：JSON 文件（外部 Postgres 为只读副本，无法建表）
// 生产环境通过 docker volume 持久化该目录
const DATA_DIR = process.env.AUTH_DATA_DIR || path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'app_users.json');

async function loadUsers() {
  try {
    const raw = await fs.readFile(USERS_FILE, 'utf8');
    const users = JSON.parse(raw);
    return Array.isArray(users) ? users : [];
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('[Auth] Failed to read users file:', err.message);
    }
    return [];
  }
}

async function saveUsers(users) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  const tmpFile = `${USERS_FILE}.${process.pid}.tmp`;
  await fs.writeFile(tmpFile, JSON.stringify(users, null, 2), 'utf8');
  await fs.rename(tmpFile, USERS_FILE);
}

export async function findUserByEmail(email) {
  const users = await loadUsers();
  return users.find((u) => u.email === email) || null;
}

export async function createUser({ email, passwordHash }) {
  const users = await loadUsers();
  const user = {
    id: crypto.randomUUID(),
    email,
    password_hash: passwordHash,
    created_at: new Date().toISOString()
  };
  users.push(user);
  await saveUsers(users);
  return { id: user.id, email: user.email };
}

export async function verifyUserPassword(user, password) {
  const { default: bcrypt } = await import('bcryptjs');
  return bcrypt.compare(password, user.password_hash);
}

export async function hashPassword(password) {
  const { default: bcrypt } = await import('bcryptjs');
  return bcrypt.hash(password, 10);
}
