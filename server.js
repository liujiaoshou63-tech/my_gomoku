const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

app.use(express.static('public'));

const BOARD_SIZE = 15;
const TURN_TIME = 30;

const rooms = new Map();

function generateRoomId() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

function createBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(0));
}

function checkWin(board, row, col, player) {
  const directions = [
    [0, 1],   // 横向
    [1, 0],   // 纵向
    [1, 1],   // 主对角线
    [1, -1]   // 副对角线
  ];

  for (const [dr, dc] of directions) {
    let count = 1;

    // 正向
    for (let i = 1; i < 5; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
        count++;
      } else {
        break;
      }
    }

    // 反向
    for (let i = 1; i < 5; i++) {
      const r = row - dr * i;
      const c = col - dc * i;
      if (r >= 0 && r < BOARD_SIZE && c >= 0 && c < BOARD_SIZE && board[r][c] === player) {
        count++;
      } else {
        break;
      }
    }

    if (count >= 5) return true;
  }
  return false;
}

function getEmptyCells(board) {
  const cells = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let c = 0; c < BOARD_SIZE; c++) {
      if (board[r][c] === 0) cells.push([r, c]);
    }
  }
  return cells;
}

function startTurnTimer(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  clearInterval(room.timer);
  room.timeLeft = TURN_TIME;

  io.to(roomId).emit('sync-timer', { timeLeft: room.timeLeft, currentPlayer: room.currentPlayer });

  room.timer = setInterval(() => {
    room.timeLeft--;
    io.to(roomId).emit('sync-timer', { timeLeft: room.timeLeft, currentPlayer: room.currentPlayer });

    if (room.timeLeft <= 0) {
      clearInterval(room.timer);

      // 超时自动随机落子
      const emptyCells = getEmptyCells(room.board);
      if (emptyCells.length === 0) {
        room.status = 'ended';
        io.to(roomId).emit('game-over', { winner: 0, reason: '平局' });
        return;
      }

      const [row, col] = emptyCells[Math.floor(Math.random() * emptyCells.length)];
      placePiece(roomId, row, col, true);
    }
  }, 1000);
}

function placePiece(roomId, row, col, isAuto = false) {
  const room = rooms.get(roomId);
  if (!room || room.status !== 'playing') return;
  if (room.board[row][col] !== 0) return;

  const player = room.currentPlayer;
  room.board[row][col] = player;

  io.to(roomId).emit('piece-placed', { row, col, player, isAuto });

  // 检查胜负
  if (checkWin(room.board, row, col, player)) {
    clearInterval(room.timer);
    room.status = 'ended';
    io.to(roomId).emit('game-over', { winner: player, reason: '五子连珠' });
    return;
  }

  // 检查平局
  if (getEmptyCells(room.board).length === 0) {
    clearInterval(room.timer);
    room.status = 'ended';
    io.to(roomId).emit('game-over', { winner: 0, reason: '平局' });
    return;
  }

  // 切换玩家
  room.currentPlayer = room.currentPlayer === 1 ? 2 : 1;
  io.to(roomId).emit('switch-turn', { currentPlayer: room.currentPlayer });
  startTurnTimer(roomId);
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // 创建房间
  socket.on('create-room', () => {
    let roomId;
    do {
      roomId = generateRoomId();
    } while (rooms.has(roomId));

    rooms.set(roomId, {
      id: roomId,
      board: createBoard(),
      players: [socket.id],
      currentPlayer: 1,
      status: 'waiting',
      timer: null,
      timeLeft: TURN_TIME
    });

    socket.join(roomId);
    socket.playerNumber = 1;
    socket.roomId = roomId;
    socket.emit('room-created', { roomId, playerNumber: 1 });
  });

  // 加入房间
  socket.on('join-room', (roomId) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error-msg', '房间不存在');
      return;
    }
    if (room.players.length >= 2) {
      socket.emit('error-msg', '房间已满');
      return;
    }
    if (room.status !== 'waiting') {
      socket.emit('error-msg', '游戏已开始');
      return;
    }

    room.players.push(socket.id);
    socket.join(roomId);
    socket.playerNumber = 2;
    socket.roomId = roomId;
    socket.emit('room-joined', { roomId, playerNumber: 2 });

    // 双方就绪，开始游戏
    room.status = 'playing';
    io.to(roomId).emit('game-start', { firstPlayer: 1 });
    startTurnTimer(roomId);
  });

  // 落子
  socket.on('place-piece', ({ row, col }) => {
    const room = rooms.get(socket.roomId);
    if (!room) return;
    if (room.status !== 'playing') return;
    if (room.currentPlayer !== socket.playerNumber) return;
    placePiece(socket.roomId, row, col);
  });

  // 认输
  socket.on('surrender', () => {
    const room = rooms.get(socket.roomId);
    if (!room || room.status !== 'playing') return;
    clearInterval(room.timer);
    room.status = 'ended';
    const winner = socket.playerNumber === 1 ? 2 : 1;
    io.to(socket.roomId).emit('game-over', { winner, reason: '对方认输' });
  });

  // 再来一局
  socket.on('restart-game', () => {
    const room = rooms.get(socket.roomId);
    if (!room) return;
    room.board = createBoard();
    room.currentPlayer = 1;
    room.status = 'playing';
    room.timeLeft = TURN_TIME;
    clearInterval(room.timer);
    io.to(socket.roomId).emit('game-restart', { firstPlayer: 1 });
    startTurnTimer(socket.roomId);
  });

  // 离开房间 / 断开连接
  socket.on('leave-room', () => cleanupPlayer(socket));
  socket.on('disconnect', () => cleanupPlayer(socket));
});

function cleanupPlayer(socket) {
  if (!socket.roomId) return;
  const room = rooms.get(socket.roomId);
  if (!room) return;

  clearInterval(room.timer);
  io.to(socket.roomId).emit('player-left', { playerNumber: socket.playerNumber });
  io.in(socket.roomId).socketsLeave(socket.roomId);
  rooms.delete(socket.roomId);
}

const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
