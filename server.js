const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static('public'));

// --- DB接続（Render/Neon等のクラウド向けにSSLを有効） ---
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// 起動時にテーブルを用意
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
  }
})();

// ソケット
io.on('connection', async (socket) => {
  // 接続直後に直近50件の履歴を送る
  try {
    const { rows } = await pool.query(
      'SELECT name, text FROM messages ORDER BY id DESC LIMIT 50'
    );
    console.log(`ℹ️  history rows: ${rows.length}`);
    rows.reverse().forEach(msg => socket.emit('msg', msg));
  } catch (e) {
    console.error('❌ fetch history error:', e);
  }

  socket.on('join', (name) => {
    socket.data.name = (name || 'guest').toString().trim().slice(0,30) || 'guest';
    socket.broadcast.emit('sys', `${socket.data.name} が参加しました`);
  });

  socket.on('msg', async (text) => {
    const name = socket.data.name || 'guest';
    const safe = (text ?? '').toString().slice(0, 500);
    if (!safe) return;

    io.emit('msg', { name, text: safe }); // 配信
    try {
      await pool.query('INSERT INTO messages(name, text) VALUES($1, $2)', [name, safe]);
      console.log('📝 inserted:', name, safe.slice(0,30));
    } catch (e) {
      console.error('❌ insert error:', e);
    }
  });

  socket.on('disconnect', () => {
    if (socket.data.name) io.emit('sys', `${socket.data.name} が退出しました`);
  });
});

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '0.0.0.0';
server.listen(PORT, HOST, () => {
  console.log(`http://localhost:${PORT}`);
});
