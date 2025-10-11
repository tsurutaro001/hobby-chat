// server.js
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// 静的配信とルート
const PUBLIC_DIR = path.join(__dirname, 'public');
app.use(express.static(PUBLIC_DIR));
app.get('/', (_req, res) => res.sendFile(path.join(PUBLIC_DIR, 'index.html')));

// DB
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 起動時にテーブル準備
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
    process.exit(1);
  }
})();

// Socket.IO
io.on('connection', async (socket) => {
  try {
    // 直近50件を抽出 → ASCで送る（クライアントはprependで最新が上）
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

  socket.on('join', (name) => {
    socket.data.name = (name || 'guest').toString().trim().slice(0,30) || 'guest';
    socket.broadcast.emit('sys', `${socket.data.name} が参加しました`);
  });

  // メッセージ保存→id付きで配信（クライアントはサーバから届いた1件のみ描画）
  socket.on('msg', async (text) => {
    const name = socket.data.name || 'guest';
    const safe = (text ?? '').toString().slice(0,500);
    if (!safe) return;
    try {
      const r = await pool.query(
        'INSERT INTO messages(name,text) VALUES($1,$2) RETURNING id,name,text,created_at',
        [name, safe]
      );
      const msg = r.rows[0];
      io.emit('msg', msg);
      console.log('📝 inserted:', msg.id, name, safe.slice(0,30));
    } catch (e) {
      console.error('❌ insert error:', e);
    }
  });

  // 履歴削除（簡易版：誰でも実行可）※本番は権限チェック推奨
  socket.on('clear', async () => {
    try {
      await pool.query('TRUNCATE TABLE messages RESTART IDENTITY;');
      io.emit('cleared');
      console.log('🧹 history cleared');
    } catch (e) {
      console.error('❌ clear error:', e);
    }
  });

  socket.on('disconnect', () => {
    if (socket.data.name) io.emit('sys', `${socket.data.name} が退出しました`);
  });

  // 権限管理 *追加
  socket.on('clear', async () => {
    const allowed = ['admin', 'naoki']; // 許可ニックネーム
    if (!allowed.includes(socket.data.name)) return; // 権限なしは無視
    await pool.query('TRUNCATE TABLE messages RESTART IDENTITY;');
    io.emit('cleared');
  });
});

// 起動
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`Hobby Chat server running: http://localhost:${PORT}`);
});