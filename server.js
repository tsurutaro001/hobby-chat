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
  ssl: process