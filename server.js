// server.js
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// 固定メンバー（フロントと一致）
const MEMBERS = ['なおき', 'りさ', 'さな', 'りと'];

// 静的配信 & ルート/ヘルス
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));
app.get('/', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
app.get('/healthz', (_req, res) => res.type('text').send('ok'));

// DB接続
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// 起動時：テーブル作成＆列追加
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        text TEXT NOT NULL DEFAULT '',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        image_base64 TEXT,
        image_mime TEXT
      );
    `);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS last_reads (
        name TEXT PRIMARY KEY,
        last_message_id INTEGER REFERENCES messages(id) ON DELETE SET NULL
      );
    `);
    await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_base64 TEXT;`);
    await pool.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS image_mime TEXT;`);
    console.log('✅ DB ready');
  } catch (e) {
    console.error('❌ DB init error:', e);
  }
})();

// 画像クリーニング（3日超の画像データを削除）
async function cleanupOldImages() {
  try {
    const r = await pool.query(`
      WITH old AS (
        SELECT id FROM messages
        WHERE image_base64 IS NOT NULL
          AND created_at < NOW() - INTERVAL '3 days'
      )
      UPDATE messages m
         SET image_base64 = NULL, image_mime = NULL
      FROM old
      WHERE m.id = old.id;
    `);
    console.log('🧼 image cleanup done');
  } catch (e) {
    console.error('❌ image cleanup error:', e);
  }
}
// 起動時＋1時間ごとに実行
cleanupOldImages();
setInterval(cleanupOldImages, 60 * 60 * 1000);

// ヘルパ
const allowedName = (n) => MEMBERS.includes((n || '').toString().trim());
const clamp = (s, n) => (s ?? '').toString().slice(0, n);

// Socket.IO
io.on('connection', async (socket) => {
  // 履歴：最新50件 → 古→新（ASC）で送信
  try {
    const { rows } = await pool.query(`
      SELECT id,name,text,created_at,image_base64,image_mime FROM (
        SELECT id,name,text,created_at,image_base64,image_mime
        FROM messages
        ORDER BY id DESC
        LIMIT 50
      ) t ORDER BY id ASC;
    `);
    rows.forEach(row => socket.emit('msg', row));
    const reads = await pool.query(`SELECT name,last_message_id FROM last_reads;`);
    socket.emit('reads_bulk', reads.rows);
    console.log(`ℹ️ history rows sent: ${rows.length}, reads sent: ${reads.rowCount}`);
  } catch (e) {
    console.error('❌ fetch history error:', e);
  }

  // 参加
  socket.on('join', (name) => {
    const n = (name || '').toString().trim();
    if (!allowedName(n)) {
      socket.data.name = 'guest';
      socket.emit('sys', 'メンバー未選択のため guest で参加しました');
      return;
    }
    socket.data.name = n;
    socket.broadcast.emit('sys', `${socket.data.name} が参加しました`);
  });

  // テキスト送信
  socket.on('msg', async (text) => {
    const name = socket.data.name || 'guest';
    const safe = clamp(text, 2000);
    if (!safe) return;
    try {
      const r = await pool.query(
        `INSERT INTO messages(name, text) VALUES($1,$2)
         RETURNING id,name,text,created_at,image_base64,image_mime`,
        [name, safe]
      );
      io.emit('msg', r.rows[0]);
    } catch (e) {
      console.error('❌ insert text error:', e);
      socket.emit('sys', 'メッセージ保存に失敗しました');
    }
  });

  // 画像送信（~700KBまでのPNG/JPEG/GIF/WebP）
  socket.on('upload_image', async (payload = {}) => {
    try {
      const name = socket.data.name || 'guest';
      const dataURL = String(payload.dataURL || '');
      const m = dataURL.match(/^data:(image\/(png|jpeg|gif|webp));base64,([A-Za-z0-9+/=]+)$/);
      if (!m) return socket.emit('sys', '画像は PNG/JPEG/GIF/WebP のみ対応です');
      if (dataURL.length > 950_000) return socket.emit('sys', '画像が大きすぎます（~700KBまで）');
      const mime = m[1];

      const r = await pool.query(
        `INSERT INTO messages(name,text,image_base64,image_mime)
         VALUES($1,'',$2,$3)
         RETURNING id,name,text,created_at,image_base64,image_mime`,
        [name, dataURL, mime]
      );
      io.emit('msg', r.rows[0]);
    } catch (e) {
      console.error('❌ upload_image error:', e);
      socket.emit('sys', '画像の保存に失敗しました');
    }
  });

  // 既読更新（NULL対策: COALESCE）
  socket.on('read_upto', async (lastId) => {
    try {
      const name = socket.data?.name;
      if (!allowedName(name)) return;
      const id = Number(lastId) || 0;
      await pool.query(`
        INSERT INTO last_reads(name,last_message_id)
        VALUES($1,$2)
        ON CONFLICT (name) DO UPDATE
        SET last_message_id = GREATEST(
          COALESCE(last_reads.last_message_id, 0),
          EXCLUDED.last_message_id
        );
      `, [name, id]);
      io.emit('reads', { name, last_message_id: id });
    } catch (e) {
      console.error('❌ read_upto error:', e);
    }
  });

  // 履歴削除（名前権限 + 任意トークン）
  socket.on('clear', async (payload = {}) => {
    try {
      const allowedClear = ['なおき'];
      const okName = allowedClear.includes(socket.data?.name);
      const adminToken = process.env.ADMIN_TOKEN || '';
      const okToken = adminToken ? (payload.token === adminToken) : true;
      if (!okName || !okToken) return;

      await pool.query('TRUNCATE TABLE messages RESTART IDENTITY;');
      await pool.query('UPDATE last_reads SET last_message_id = NULL;');
      io.emit('cleared');
      console.log('🧹 history cleared by', socket.data.name);
    } catch (e) {
      console.error('❌ clear error:', e);
      socket.emit('sys', '履歴削除に失敗しました（サーバログ参照）');
    }
  });

  socket.on('disconnect', () => {
    if (socket.data.name && socket.data.name !== 'guest') {
      io.emit('sys', `${socket.data.name} が退出しました`);
    }
  });
});

// 例外握り（開発時のループ抑止）
process.on('unhandledRejection', (err) => console.error('unhandledRejection:', err));
process.on('uncaughtException', (err) => console.error('uncaughtException:', err));

// 起動
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`Hobby Chat server running: http://localhost:${PORT}`);
});