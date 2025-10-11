// server.js (Phase1+ latest)

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// 静的ファイル（public/index.html など）
app.use(express.static('public'));

// --- PostgreSQL 接続 ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // Render の Environment に設定
  ssl: { rejectUnauthorized: false }          // Render/Neon 等のSSL必須環境
});

// 起動時：テーブル準備
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
  } catch (err) {
    console.error('❌ DB init error:', err);
    process.exit(1);
  }
})();

// --- Socket.IO ---
io.on('connection', async (socket) => {
  // 接続直後：最新→古い順で直近50件（フロントは上に積む設計）
  try {
    const { rows } = await pool.query(
      'SELECT id, name, text, created_at FROM messages ORDER BY id DESC LIMIT 50'
    );
    rows.forEach(row => socket.emit('msg', row)); // id/created_at 付きで送る
    console.log(`ℹ️ history rows sent: ${rows.length}`);
  } catch (e) {
    console.error('❌ fetch history error:', e);
  }

  // ニックネーム設定（任意）
  socket.on('join', (name) => {
    socket.data.name = (name || 'guest').toString().trim().slice(0, 30) || 'guest';
    socket.broadcast.emit('sys', `${socket.data.name} が参加しました`);
  });

  // メッセージ受信 → DB保存 → id付きで全員に配信
  socket.on('msg', async (text) => {
    const name = socket.data.name || 'guest';
    const safe = (text ?? '').toString().slice(0, 500);
    if (!safe) return;

    try {
      const r = await pool.query(
        'INSERT INTO messages(name, text) VALUES ($1, $2) RETURNING id, name, text, created_at',
        [name, safe]
      );
      const msg = r.rows[0];
      io.emit('msg', msg); // {id,name,text,created_at}
      console.log('📝 inserted:', msg.id, name, safe.slice(0, 30));
    } catch (e) {
      console.error('❌ insert error:', e);
    }
  });

  // 切断通知（join済みのときのみ）
  socket.on('disconnect', () => {
    if (socket.data.name) io.emit('sys', `${socket.data.name} が退出しました`);
  });
});

// --- 起動 ---
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`Hobby Chat server running: http://localhost:${PORT}`);
});
