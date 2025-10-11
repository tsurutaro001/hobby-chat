const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const { Pool } = require('pg');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static('public'));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

(async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
  console.log('✅ DB ready');
})();

io.on('connection', async (socket) => {
  try {
    // 直近50件を取り出してから ASC に並べ替えて送る
    const { rows } = await pool.query(`
      SELECT id, name, text, created_at
      FROM (
        SELECT id, name, text, created_at
        FROM messages
        ORDER BY id DESC
        LIMIT 50
      ) t
      ORDER BY id ASC
    `);
    rows.forEach(row => socket.emit('msg', row));
  } catch (e) {
    console.error('❌ fetch history error:', e);
  }

  socket.on('join', (name) => {
    socket.data.name = (name || 'guest').toString().trim().slice(0,30) || 'guest';
    socket.broadcast.emit('sys', `${socket.data.name} が参加しました`);
  });

  socket.on('msg', async (text) => {
    const name = socket.data.name || 'guest';
    const safe = (text ?? '').toString().slice(0,500);
    if (!safe) return;
    try {
      const r = await pool.query(
        'INSERT INTO messages(name, text) VALUES($1,$2) RETURNING id,name,text,created_at',
        [name, safe]
      );
      io.emit('msg', r.rows[0]); // ← サーバからの1件のみを描画させる
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
server.listen(PORT, HOST, () => console.log(`http://localhost:${PORT}`));
