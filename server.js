// server.js
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// 固定メンバー（フロントの <select> と一致）
const ALLOWED_NAMES = ['なおき', 'りさ', 'さな', 'りと'];

// 静的配信 & ルート/ヘルス
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));
app.get('/', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));
app.get('/healthz', (_req, res) => res.type('text').send('ok'));

// DB接続（DATABASE_URLが無い環境でも落ちないようにtry/catch）
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// 起動時：テーブル作成（失敗してもプロセスは落とさない）
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        text TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    console.log('✅ DB ready');
  } catch (e) {
    console.error('❌ DB init error:', e);
  }
})();

// Socket.IO
io.on('connection', async (socket) => {
  // 履歴：最新50件 → 古→新（ASC）で送る（フロントは append で「最新は下」）
  try {
    const { rows } = await pool.query(`
      SELECT id,name,text,created_at FROM (
        SELECT id,name,text,created_at
        FROM messages
        ORDER BY id DESC
        LIMIT 50
      ) t ORDER BY id ASC
    `);
    rows.forEach(row => socket.emit('msg', row));
    console.log(`ℹ️ history rows sent: ${rows.length}`);
  } catch (e) {
    console.error('❌ fetch history error:', e);
  }

  // 参加（許可名のみ／不正は guest）
  socket.on('join', (name) => {
    const n = (name || '').toString().trim();
    if (!ALLOWED_NAMES.includes(n)) {
      socket.data.name = 'guest';
      socket.emit('sys', 'メンバー未選択のため guest で参加しました');
      return;
    }
    socket.data.name = n;
    socket.broadcast.emit('sys', `${socket.data.name} が参加しました`);
  });

  // メッセージ保存 & 配信（例外は握りつぶしてサーバは落とさない）
  socket.on('msg', async (text) => {
    const name = socket.data.name || 'guest';
    const safe = (text ?? '').toString().slice(0, 500);
    if (!safe) return;
    try {
      const r = await pool.query(
        'INSERT INTO messages(name, text) VALUES($1, $2) RETURNING id, name, text, created_at',
        [name, safe]
      );
      const msg = r.rows[0];
      io.emit('msg', msg);
      console.log('📝 inserted:', msg.id, name, safe.slice(0, 30));
    } catch (e) {
      console.error('❌ insert error:', e);
      socket.emit('sys', 'メッセージ保存に失敗しました');
    }
  });

  // 履歴削除（名前権限 + 任意トークン + 例外ハンドリング）
  socket.on('clear', async (payload = {}) => {
    try {
      // 例：なおき だけ削除可（必要なら増やしてください）
      const allowedClear = ['なおき'];
      const okName = allowedClear.includes(socket.data?.name);

      // 二段チェック：管理トークン（Render/Environment に ADMIN_TOKEN を設定している場合のみ有効）
      const adminToken = process.env.ADMIN_TOKEN || '';
      const okToken = adminToken ? (payload.token === adminToken) : true;

      if (!okName || !okToken) return; // 権限なしは静かに無視

      await pool.query('TRUNCATE TABLE messages RESTART IDENTITY;');
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

// 開発中の再起動ループ抑止（保険）
process.on('unhandledRejection', (err) => console.error('unhandledRejection:', err));
process.on('uncaughtException', (err) => console.error('uncaughtException:', err));

// 起動
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`Hobby Chat server running: http://localhost:${PORT}`);
});