const socket = io({ transports: ['websocket', 'polling'] });

// 页面元素
const screens = {
  home: document.getElementById('home-screen'),
  waiting: document.getElementById('waiting-screen'),
  game: document.getElementById('game-screen'),
};
const els = {
  btnCreate: document.getElementById('btn-create'),
  btnJoin: document.getElementById('btn-join'),
  inputRoom: document.getElementById('input-room'),
  homeError: document.getElementById('home-error'),
  waitingRoomId: document.getElementById('waiting-room-id'),
  btnCancelWait: document.getElementById('btn-cancel-wait'),
  gameRoomId: document.getElementById('game-room-id'),
  btnLeave: document.getElementById('btn-leave'),
  board: document.getElementById('board'),
  statusText: document.getElementById('status-text'),
  btnSurrender: document.getElementById('btn-surrender'),
  overlay: document.getElementById('game-overlay'),
  overlayTitle: document.getElementById('overlay-title'),
  overlayDesc: document.getElementById('overlay-desc'),
  btnRestart: document.getElementById('btn-restart'),
  btnBack: document.getElementById('btn-back'),
  player1Card: document.getElementById('player1-card'),
  player2Card: document.getElementById('player2-card'),
  timer1: document.getElementById('timer1'),
  timer2: document.getElementById('timer2'),
};

// 状态
let myPlayerNumber = null;
let currentPlayer = 1;
let boardData = [];
let isGameActive = false;

// 初始化棋盘
function initBoard() {
  els.board.innerHTML = '';
  boardData = Array.from({ length: 15 }, () => Array(15).fill(0));
  for (let r = 0; r < 15; r++) {
    for (let c = 0; c < 15; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.addEventListener('click', () => handleCellClick(r, c));
      els.board.appendChild(cell);
    }
  }
}

function handleCellClick(r, c) {
  if (!isGameActive) return;
  if (currentPlayer !== myPlayerNumber) return;
  if (boardData[r][c] !== 0) return;
  socket.emit('place-piece', { row: r, col: c });
}

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
}

function setTimerDisplay(player, time) {
  const el = player === 1 ? els.timer1 : els.timer2;
  el.textContent = time;
  el.classList.remove('warning', 'danger');
  if (time <= 10) el.classList.add('danger');
  else if (time <= 20) el.classList.add('warning');
}

function updateActivePlayer(player) {
  currentPlayer = player;
  els.player1Card.classList.toggle('active', player === 1);
  els.player2Card.classList.toggle('active', player === 2);
  els.statusText.textContent = player === myPlayerNumber ? '轮到你了' : '对方思考中...';
}

function showOverlay(title, desc) {
  els.overlayTitle.textContent = title;
  els.overlayDesc.textContent = desc;
  els.overlay.classList.remove('hidden');
}

function hideOverlay() {
  els.overlay.classList.add('hidden');
}

// 事件绑定
els.btnCreate.addEventListener('click', () => {
  els.homeError.textContent = '';
  socket.emit('create-room');
});

els.btnJoin.addEventListener('click', () => {
  const roomId = els.inputRoom.value.trim();
  if (!/^\d{4}$/.test(roomId)) {
    els.homeError.textContent = '请输入4位数字房间号';
    return;
  }
  els.homeError.textContent = '';
  socket.emit('join-room', roomId);
});

els.btnCancelWait.addEventListener('click', () => {
  socket.emit('leave-room');
  showScreen('home');
});

els.btnLeave.addEventListener('click', () => {
  socket.emit('leave-room');
  showScreen('home');
});

els.btnSurrender.addEventListener('click', () => {
  if (!isGameActive) return;
  if (confirm('确定要认输吗？')) {
    socket.emit('surrender');
  }
});

els.btnRestart.addEventListener('click', () => {
  socket.emit('restart-game');
});

els.btnBack.addEventListener('click', () => {
  socket.emit('leave-room');
  showScreen('home');
});

// Socket 事件
socket.on('room-created', ({ roomId, playerNumber }) => {
  myPlayerNumber = playerNumber;
  els.waitingRoomId.textContent = roomId;
  showScreen('waiting');
});

socket.on('room-joined', ({ roomId, playerNumber }) => {
  myPlayerNumber = playerNumber;
  els.gameRoomId.textContent = roomId;
  showScreen('waiting'); // 稍等两端同步
});

socket.on('game-start', ({ firstPlayer }) => {
  initBoard();
  isGameActive = true;
  currentPlayer = firstPlayer;
  updateActivePlayer(firstPlayer);
  hideOverlay();
  els.btnSurrender.disabled = false;
  showScreen('game');
});

socket.on('piece-placed', ({ row, col, player, isAuto }) => {
  boardData[row][col] = player;
  const index = row * 15 + col;
  const cell = els.board.children[index];

  const piece = document.createElement('div');
  piece.className = `piece ${player === 1 ? 'black' : 'white'}`;
  cell.appendChild(piece);

  // 清除上一个 last-move 标记
  document.querySelectorAll('.last-move').forEach(el => el.classList.remove('last-move'));
  cell.classList.add('last-move');

  if (isAuto) {
    const name = player === myPlayerNumber ? '我方' : '对方';
    els.statusText.textContent = `${name}超时，已自动落子`;
  }
});

socket.on('switch-turn', ({ currentPlayer: cp }) => {
  updateActivePlayer(cp);
});

socket.on('sync-timer', ({ timeLeft, currentPlayer: cp }) => {
  setTimerDisplay(1, cp === 1 ? timeLeft : TURN_TIME);
  setTimerDisplay(2, cp === 2 ? timeLeft : TURN_TIME);
});

socket.on('game-over', ({ winner, reason }) => {
  isGameActive = false;
  els.btnSurrender.disabled = true;
  if (winner === 0) {
    showOverlay('平局！', reason);
  } else {
    const isWin = winner === myPlayerNumber;
    showOverlay(isWin ? '你赢了！' : '你输了！', reason);
    if (isWin) {
      myPlayerNumber === 1 ? els.player1Card.classList.add('win') : els.player2Card.classList.add('win');
    } else {
      myPlayerNumber === 1 ? els.player2Card.classList.add('win') : els.player1Card.classList.add('win');
    }
  }
});

socket.on('game-restart', ({ firstPlayer }) => {
  initBoard();
  isGameActive = true;
  currentPlayer = firstPlayer;
  updateActivePlayer(firstPlayer);
  hideOverlay();
  els.player1Card.classList.remove('win');
  els.player2Card.classList.remove('win');
  els.btnSurrender.disabled = false;
});

socket.on('error-msg', (msg) => {
  els.homeError.textContent = msg;
});

socket.on('player-left', () => {
  isGameActive = false;
  showOverlay('对方已离开', '房间已关闭');
  els.btnRestart.style.display = 'none';
});

socket.on('disconnect', () => {
  showOverlay('连接断开', '请刷新页面重试');
});

// 固定常量
const TURN_TIME = 30;
initBoard();
