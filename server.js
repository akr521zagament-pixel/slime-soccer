// server.js — Slime Soccer LAN サーバー
// 起動方法: node server.js
// 必要: Node.js (https://nodejs.org)
// ws モジュールのインストール: npm install ws

const { WebSocketServer } = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 3000;

// HTTPサーバー（index.htmlを配信）
const httpServer = http.createServer((req, res) => {
  const filePath = path.join(__dirname, 'index.html');
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('index.html が見つかりません');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
});

// WebSocketサーバー
const wss = new WebSocketServer({ server: httpServer });

// ルーム管理
const rooms = {};

function generateRoomCode() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

wss.on('connection', (ws) => {
  ws.roomCode = null;
  ws.playerSide = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }

    if (msg.type === 'create_room') {
      const code = generateRoomCode();
      rooms[code] = { host: ws, guest: null };
      ws.roomCode = code;
      ws.playerSide = 'left';
      ws.send(JSON.stringify({ type: 'room_created', code }));
      console.log(`ルーム作成: ${code}`);

    } else if (msg.type === 'join_room') {
      const code = msg.code.toUpperCase();
      const room = rooms[code];
      if (!room) {
        ws.send(JSON.stringify({ type: 'error', message: 'ルームが見つかりません' }));
        return;
      }
      if (room.guest) {
        ws.send(JSON.stringify({ type: 'error', message: 'ルームが満員です' }));
        return;
      }
      room.guest = ws;
      ws.roomCode = code;
      ws.playerSide = 'right';
      ws.send(JSON.stringify({ type: 'joined', side: 'right' }));
      room.host.send(JSON.stringify({ type: 'guest_joined' }));
      console.log(`ルーム参加: ${code}`);

    } else if (msg.type === 'game_state') {
      const room = rooms[ws.roomCode];
      if (!room) return;
      const opponent = ws.playerSide === 'left' ? room.guest : room.host;
      if (opponent && opponent.readyState === 1) {
        opponent.send(JSON.stringify(msg));
      }

    } else if (msg.type === 'input') {
      const room = rooms[ws.roomCode];
      if (!room) return;
      const opponent = ws.playerSide === 'left' ? room.guest : room.host;
      if (opponent && opponent.readyState === 1) {
        opponent.send(JSON.stringify(msg));
      }
    }
  });

  ws.on('close', () => {
    const code = ws.roomCode;
    if (!code || !rooms[code]) return;
    const room = rooms[code];
    const opponent = ws.playerSide === 'left' ? room.guest : room.host;
    if (opponent && opponent.readyState === 1) {
      opponent.send(JSON.stringify({ type: 'opponent_disconnected' }));
    }
    delete rooms[code];
    console.log(`ルーム削除: ${code}`);
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  const { networkInterfaces } = require('os');
  const nets = networkInterfaces();
  console.log('\n🎮 Slime Soccer サーバー起動！');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        console.log(`📡 同じWi-Fiの人はこのURLでアクセス:`);
        console.log(`   http://${net.address}:${PORT}`);
      }
    }
  }
  console.log(`💻 自分はこちら: http://localhost:${PORT}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
});