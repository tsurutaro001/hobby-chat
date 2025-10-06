const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// 静的ファイル配信（public/index.html）
app.use(express.static('public'));

io.on('connection', (socket) => {
  socket.on('join', (name) => {
    socket.data.name = (name || 'guest').toString().trim().slice(0, 30) || 'guest';
    socket.broadcast.emit('sys', `${socket.data.name} が参加しました`);
  });
  socket.on('msg', (text) => {
    const name = socket.data.name || 'guest';
    const safe = (text ?? '').toString().slice(0, 500);
    if (!safe) return;
    io.emit('msg', { name, text: safe });
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
