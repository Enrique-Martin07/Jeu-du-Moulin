const PLAYER = { NONE: 0, BLUE: 1, RED: 2 };

const NODE_POSITIONS = [
  { x: 10, y: 10 },
  { x: 50, y: 10 },
  { x: 90, y: 10 },
  { x: 90, y: 50 },
  { x: 90, y: 90 },
  { x: 50, y: 90 },
  { x: 10, y: 90 },
  { x: 10, y: 50 },
  { x: 23, y: 23 },
  { x: 50, y: 23 },
  { x: 77, y: 23 },
  { x: 77, y: 50 },
  { x: 77, y: 77 },
  { x: 50, y: 77 },
  { x: 23, y: 77 },
  { x: 23, y: 50 },
  { x: 36, y: 36 },
  { x: 50, y: 36 },
  { x: 64, y: 36 },
  { x: 64, y: 50 },
  { x: 64, y: 64 },
  { x: 50, y: 64 },
  { x: 36, y: 64 },
  { x: 36, y: 50 },
];

const ADJACENCY = [
  [1, 7],
  [0, 2, 9],
  [1, 3],
  [2, 4, 11],
  [3, 5],
  [4, 6, 13],
  [5, 7],
  [0, 6, 15],
  [9, 15],
  [1, 8, 10, 17],
  [9, 11],
  [3, 10, 12, 19],
  [11, 13],
  [5, 12, 14, 21],
  [13, 15],
  [7, 8, 14, 23],
  [17, 23],
  [9, 16, 18],
  [17, 19],
  [11, 18, 20],
  [19, 21],
  [13, 20, 22],
  [21, 23],
  [15, 16, 22],
];

const MILLS = [
  [0, 1, 2],
  [2, 3, 4],
  [4, 5, 6],
  [6, 7, 0],
  [8, 9, 10],
  [10, 11, 12],
  [12, 13, 14],
  [14, 15, 8],
  [16, 17, 18],
  [18, 19, 20],
  [20, 21, 22],
  [22, 23, 16],
  [1, 9, 17],
  [3, 11, 19],
  [5, 13, 21],
  [7, 15, 23],
];

let state = {
  board: Array(24).fill(PLAYER.NONE),
  currentPlayer: PLAYER.BLUE,
  reserves: { [PLAYER.BLUE]: 9, [PLAYER.RED]: 9 },
  selectedNode: null,
  isRemoving: false,
  gameOver: false,
  winner: null,
};

let activeMode = "local"; // 'local', 'ai', 'online'
let myRole = PLAYER.BLUE;
let peer = null;
let conn = null;
let pendingConn = null;

const canvas = document.getElementById("board-canvas");
const ctx = canvas.getContext("2d");
const nodesContainer = document.getElementById("nodes-container");
const statusText = document.getElementById("status-text");
const phaseText = document.getElementById("phase-text");
const blueReserveEl = document.getElementById("blue-reserve");
const blueOnBoardEl = document.getElementById("blue-on-board");
const redReserveEl = document.getElementById("red-reserve");
const redOnBoardEl = document.getElementById("red-on-board");
const cardBlue = document.getElementById("card-blue");
const cardRed = document.getElementById("card-red");

function switchGameMode(mode) {
  activeMode = mode;

  // Buttons highlight
  ["ai", "local", "online"].forEach((m) => {
    const btn = document.getElementById(`btn-mode-${m}`);
    if (m === mode) {
      btn.className =
        "flex-1 py-2 text-xs font-bold rounded-lg transition bg-sky-600 text-white shadow";
    } else {
      btn.className =
        "flex-1 py-2 text-xs font-bold rounded-lg transition text-slate-300 hover:text-white hover:bg-slate-700/50";
    }
  });

  const onlineBar = document.getElementById("online-bar");
  const invitePanel = document.getElementById("invite-panel");
  const redLabel = document.getElementById("red-label");

  if (mode === "online") {
    onlineBar.classList.remove("hidden");
    invitePanel.classList.remove("hidden");
    redLabel.textContent = "Joueur Rouge (Invité)";
    enableChat(true);
    if (!peer) initPeer();
  } else {
    onlineBar.classList.add("hidden");
    invitePanel.classList.add("hidden");
    enableChat(false);
    redLabel.textContent = mode === "ai" ? "Ordinateur (IA)" : "Joueur Rouge";
  }

  initGame();
}

const btnRestart = document.getElementById("btn-restart");
if (btnRestart) {
  btnRestart.addEventListener("click", () => {
    initGame();
    if (activeMode === "online" && conn && conn.open) {
      conn.send({ type: "RESTART" });
    }
  });
}

function initPeer() {
  const randomId = "moulin-" + Math.floor(1000 + Math.random() * 9000);
  peer = new Peer(randomId, {
    host: "0.peerjs.com",
    port: 443,
    secure: true,
  });

  peer.on("open", (id) => {
    document.getElementById("my-peer-id").textContent = id;
    document.getElementById("peer-status-dot").className =
      "inline-block w-3 h-3 rounded-full bg-emerald-500";
    document.getElementById("peer-status-text").textContent =
      "Connecté au réseau";
  });

  peer.on("connection", (connection) => {
    pendingConn = connection;
    document.getElementById("inviter-id").textContent = connection.peer;
    document.getElementById("modal-invitation").classList.remove("hidden");
  });

  peer.on("error", (err) => {
    document.getElementById("peer-status-dot").className =
      "inline-block w-3 h-3 rounded-full bg-rose-500";
    document.getElementById("peer-status-text").textContent = "Erreur réseau";
  });
}

document.getElementById("btn-copy-id").addEventListener("click", () => {
  const idText = document.getElementById("my-peer-id").textContent;
  if (idText !== "---") {
    navigator.clipboard.writeText(idText);
    const copyBtn = document.getElementById("btn-copy-id");
    copyBtn.innerHTML = `<i class="fa-solid fa-check text-emerald-400"></i>`;
    setTimeout(
      () => (copyBtn.innerHTML = `<i class="fa-regular fa-copy"></i>`),
      2000,
    );
  }
});

document.getElementById("btn-invite").addEventListener("click", () => {
  const targetId = document.getElementById("target-peer-id").value.trim();
  if (!targetId) return;
  statusText.textContent = "Envoi de l'invitation...";
  conn = peer.connect(targetId);
  myRole = PLAYER.BLUE;
  setupConnectionHandlers();
});

document.getElementById("btn-accept-invite").addEventListener("click", () => {
  document.getElementById("modal-invitation").classList.add("hidden");
  conn = pendingConn;
  myRole = PLAYER.RED;
  setupConnectionHandlers();
});

document.getElementById("btn-decline-invite").addEventListener("click", () => {
  document.getElementById("modal-invitation").classList.add("hidden");
  if (pendingConn) {
    pendingConn.send({ type: "DECLINE" });
    pendingConn.close();
    pendingConn = null;
  }
});

function setupConnectionHandlers() {
  conn.on("open", () => {
    addChatMessage(
      "Système",
      "Partie connectée ! Vous jouez les " +
        (myRole === PLAYER.BLUE ? "Bleus" : "Rouges") +
        ".",
    );
    document.getElementById("invite-panel").classList.add("hidden");
    if (myRole === PLAYER.BLUE) {
      initGame();
      broadcastGameState();
    }
  });

  conn.on("data", (data) => {
    if (data.type === "DECLINE") {
      alert("L'adversaire a décliné l'invitation.");
      return;
    }
    if (data.type === "RESTART") {
      initGame();
      return;
    }

    if (data.type === "GAME_STATE") {
      state = data.state;
      updateUI();
    }
    if (data.type === "CHAT") {
      addChatMessage("Adversaire", data.message);
    }
  });
}

function broadcastGameState() {
  if (activeMode === "online" && conn && conn.open) {
    conn.send({ type: "GAME_STATE", state: state });
  }
}

const chatForm = document.getElementById("chat-form");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");
const chatSendBtn = document.getElementById("chat-send-btn");

function enableChat(enabled) {
  chatInput.disabled = !enabled;
  chatSendBtn.disabled = !enabled;
}

chatForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const msg = chatInput.value.trim();
  if (msg && activeMode === "online" && conn) {
    addChatMessage("Moi", msg);
    conn.send({ type: "CHAT", message: msg });
    chatInput.value = "";
  }
});

function addChatMessage(sender, text) {
  const msgDiv = document.createElement("div");
  msgDiv.className = "mb-1";
  let color = "text-slate-300";
  if (sender === "Moi") color = "text-sky-400 font-semibold";
  if (sender === "Adversaire") color = "text-rose-400 font-semibold";
  if (sender === "Système") color = "text-amber-400 italic";

  msgDiv.innerHTML = `<span class="${color}">${sender} :</span> ${escapeHtml(text)}`;
  chatMessages.appendChild(msgDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function initGame() {
  state.board = Array(24).fill(PLAYER.NONE);
  state.currentPlayer = PLAYER.BLUE;
  state.reserves[PLAYER.BLUE] = 9;
  state.reserves[PLAYER.RED] = 9;
  state.selectedNode = null;
  state.isRemoving = false;
  state.gameOver = false;
  state.winner = null;

  setupCanvas();
  renderNodes();
  updateUI();
}

function setupCanvas() {
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * window.devicePixelRatio;
  canvas.height = rect.height * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  drawBoardLines();
}

window.addEventListener("resize", setupCanvas);

function drawBoardLines() {
  const rect = canvas.getBoundingClientRect();
  const w = rect.width;
  const h = rect.height;

  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = "#475569";
  ctx.lineWidth = 3;

  ADJACENCY.forEach((neighbors, nodeIdx) => {
    const posA = NODE_POSITIONS[nodeIdx];
    neighbors.forEach((neighborIdx) => {
      if (nodeIdx < neighborIdx) {
        const posB = NODE_POSITIONS[neighborIdx];
        ctx.beginPath();
        ctx.moveTo((posA.x / 100) * w, (posA.y / 100) * h);
        ctx.lineTo((posB.x / 100) * w, (posB.y / 100) * h);
        ctx.stroke();
      }
    });
  });
}

function renderNodes() {
  nodesContainer.innerHTML = "";
  NODE_POSITIONS.forEach((pos, idx) => {
    const nodeDiv = document.createElement("div");
    nodeDiv.className = "point-node";
    nodeDiv.style.left = `${pos.x}%`;
    nodeDiv.style.top = `${pos.y}%`;
    nodeDiv.dataset.id = idx;

    nodeDiv.addEventListener("click", () => handleNodeClick(idx));
    nodesContainer.appendChild(nodeDiv);
  });
}

function handleNodeClick(index) {
  if (state.gameOver) return;

  if (activeMode === "online" && state.currentPlayer !== myRole) {
    flashStatus("Ce n'est pas votre tour !");
    return;
  }

  if (activeMode === "ai" && state.currentPlayer === PLAYER.RED) {
    return; // Empêche le clic pendant le tour du bot
  }

  playSound("click");

  processMove(index);
  broadcastGameState();
}

function processMove(index) {
  const occupant = state.board[index];

  if (state.isRemoving) {
    const opponent = getOpponent(state.currentPlayer);
    if (occupant === opponent) {
      if (canRemovePiece(index, opponent)) {
        state.board[index] = PLAYER.NONE;
        state.isRemoving = false;

        if (checkWinConditions(opponent)) {
          state.gameOver = true;
          state.winner = state.currentPlayer;
          updateUI();
          return;
        }

        switchTurn();
      } else {
        flashStatus("Invalide ! Ce pion est dans un moulin intact.");
      }
    }
    return;
  }

  if (state.reserves[state.currentPlayer] > 0) {
    if (occupant === PLAYER.NONE) {
      state.board[index] = state.currentPlayer;
      state.reserves[state.currentPlayer]--;

      if (checkMillCreated(index, state.currentPlayer)) {
        state.isRemoving = true;
        playSound("mill");
      } else {
        switchTurn();
      }
    }
    updateUI();
    return;
  }

  const countOnBoard = getPieceCountOnBoard(state.currentPlayer);
  const isFlying = countOnBoard === 3;

  if (state.selectedNode === null) {
    if (occupant === state.currentPlayer) {
      if (!isFlying && getValidMoves(index).length === 0) {
        flashStatus("Ce pion n'a aucun déplacement possible.");
        return;
      }
      state.selectedNode = index;
    }
  } else {
    if (index === state.selectedNode) {
      state.selectedNode = null;
    } else if (occupant === state.currentPlayer) {
      state.selectedNode = index;
    } else if (occupant === PLAYER.NONE) {
      const validMoves = isFlying
        ? getEmptyNodes()
        : getValidMoves(state.selectedNode);
      if (validMoves.includes(index)) {
        state.board[index] = state.currentPlayer;
        state.board[state.selectedNode] = PLAYER.NONE;
        state.selectedNode = null;

        if (checkMillCreated(index, state.currentPlayer)) {
          state.isRemoving = true;
          playSound("mill");
        } else {
          switchTurn();
        }
      }
    }
  }

  updateUI();
}

function switchTurn() {
  state.currentPlayer = getOpponent(state.currentPlayer);

  if (state.reserves[state.currentPlayer] === 0) {
    if (!hasAnyValidMoves(state.currentPlayer)) {
      state.gameOver = true;
      state.winner = getOpponent(state.currentPlayer);
    }
  }

  updateUI();

  if (
    activeMode === "ai" &&
    state.currentPlayer === PLAYER.RED &&
    !state.gameOver
  ) {
    setTimeout(triggerAIMove, 600);
  }
}

function triggerAIMove() {
  if (state.isRemoving) {
    const opponentPieces = getPieceIndices(PLAYER.BLUE);
    const removable = opponentPieces.filter((idx) =>
      canRemovePiece(idx, PLAYER.BLUE),
    );
    const target =
      removable.length > 0
        ? removable[Math.floor(Math.random() * removable.length)]
        : opponentPieces[0];

    state.board[target] = PLAYER.NONE;
    state.isRemoving = false;

    if (checkWinConditions(PLAYER.BLUE)) {
      state.gameOver = true;
      state.winner = PLAYER.RED;
      updateUI();
      return;
    }
    switchTurn();
    return;
  }

  if (state.reserves[PLAYER.RED] > 0) {
    const empties = getEmptyNodes();
    const randPos = empties[Math.floor(Math.random() * empties.length)];
    state.board[randPos] = PLAYER.RED;
    state.reserves[PLAYER.RED]--;

    if (checkMillCreated(randPos, PLAYER.RED)) {
      state.isRemoving = true;
      playSound("mill");
      setTimeout(triggerAIMove, 400);
    } else {
      switchTurn();
    }
  } else {
    const redPieces = getPieceIndices(PLAYER.RED);
    const isFlying = redPieces.length === 3;
    let moved = false;

    for (let p of redPieces) {
      const moves = isFlying ? getEmptyNodes() : getValidMoves(p);
      if (moves.length > 0) {
        const target = moves[Math.floor(Math.random() * moves.length)];
        state.board[target] = PLAYER.RED;
        state.board[p] = PLAYER.NONE;
        moved = true;

        if (checkMillCreated(target, PLAYER.RED)) {
          state.isRemoving = true;
          playSound("mill");
          setTimeout(triggerAIMove, 400);
        } else {
          switchTurn();
        }
        break;
      }
    }
  }
  updateUI();
}

function canRemovePiece(index, opponent) {
  if (!isPartOfMill(index, opponent)) return true;
  const allOpponentIndices = getPieceIndices(opponent);
  return allOpponentIndices.every((idx) => isPartOfMill(idx, opponent));
}

function checkMillCreated(index, player) {
  return MILLS.some((mill) => {
    if (mill.includes(index)) {
      return mill.every((i) => state.board[i] === player);
    }
    return false;
  });
}

function isPartOfMill(index, player) {
  if (state.board[index] !== player) return false;
  return checkMillCreated(index, player);
}

function getValidMoves(index) {
  return ADJACENCY[index].filter((adj) => state.board[adj] === PLAYER.NONE);
}

function getEmptyNodes() {
  return state.board
    .map((val, idx) => (val === PLAYER.NONE ? idx : null))
    .filter((val) => val !== null);
}

function getPieceIndices(player) {
  return state.board
    .map((val, idx) => (val === player ? idx : null))
    .filter((val) => val !== null);
}

function getPieceCountOnBoard(player) {
  return getPieceIndices(player).length;
}

function hasAnyValidMoves(player) {
  const pieces = getPieceIndices(player);
  if (pieces.length === 3) return true;
  return pieces.some((idx) => getValidMoves(idx).length > 0);
}

function getOpponent(player) {
  return player === PLAYER.BLUE ? PLAYER.RED : PLAYER.BLUE;
}

function checkWinConditions(opponent) {
  return state.reserves[opponent] === 0 && getPieceCountOnBoard(opponent) < 3;
}

function updateUI() {
  blueReserveEl.textContent = state.reserves[PLAYER.BLUE];
  blueOnBoardEl.textContent = getPieceCountOnBoard(PLAYER.BLUE);
  redReserveEl.textContent = state.reserves[PLAYER.RED];
  redOnBoardEl.textContent = getPieceCountOnBoard(PLAYER.RED);

  if (state.currentPlayer === PLAYER.BLUE) {
    cardBlue.classList.add("border-sky-500/80", "bg-slate-800/80");
    cardRed.classList.remove("border-rose-500/80", "bg-slate-800/80");
    cardRed.classList.add("border-transparent");
  } else {
    cardRed.classList.add("border-rose-500/80", "bg-slate-800/80");
    cardBlue.classList.remove("border-sky-500/80", "bg-slate-800/80");
    cardBlue.classList.add("border-transparent");
  }

  if (state.gameOver) {
    const winnerName =
      state.winner === PLAYER.BLUE
        ? "Joueur Bleu"
        : activeMode === "ai"
          ? "L'Ordinateur"
          : "Joueur Rouge";
    if (state.winner === myRole) {
      playSound("win");
    } else {
      playSound("lose");
    }
    statusText.className = "text-lg font-bold text-emerald-400";
    statusText.innerHTML = `<i class="fa-solid fa-trophy mr-2"></i> Victoire : ${winnerName} !`;
    phaseText.textContent =
      "Partie terminée. Cliquez sur recommencer pour rejouer.";
  } else if (state.isRemoving) {
    const curName =
      state.currentPlayer === PLAYER.BLUE
        ? "Bleu"
        : activeMode === "ai"
          ? "IA"
          : "Rouge";
    statusText.className = "text-base font-bold text-amber-400 animate-pulse";
    statusText.innerHTML = `<i class="fa-solid fa-bolt mr-1"></i> MOULIN ! (${curName}) : Retirez un pion adverse.`;
    phaseText.textContent = "Cliquez sur un pion ennemi à éliminer.";
  } else {
    const curName =
      state.currentPlayer === PLAYER.BLUE
        ? "Joueur Bleu"
        : activeMode === "ai"
          ? "Ordinateur"
          : "Joueur Rouge";
    const isMyTurn =
      activeMode === "online" ? state.currentPlayer === myRole : true;
    const turnNotice =
      activeMode === "online"
        ? isMyTurn
          ? " (C'est votre tour !)"
          : " (Tour adverse...)"
        : "";

    const colorClass =
      state.currentPlayer === PLAYER.BLUE ? "text-sky-400" : "text-rose-400";
    statusText.className = `text-base font-semibold ${colorClass}`;
    statusText.textContent = `Tour : ${curName}${turnNotice}`;

    const reserve = state.reserves[state.currentPlayer];
    const boardCount = getPieceCountOnBoard(state.currentPlayer);

    if (reserve > 0) {
      phaseText.textContent = `Phase 1 : Placez un pion (${reserve} en réserve).`;
    } else if (boardCount === 3) {
      phaseText.textContent = `Phase 3 (Vol) : Sautez où vous voulez.`;
    } else {
      phaseText.textContent = `Phase 2 : Déplacez un pion vers une case voisine.`;
    }
  }

  const nodes = nodesContainer.children;
  const isFlying =
    state.reserves[state.currentPlayer] === 0 &&
    getPieceCountOnBoard(state.currentPlayer) === 3;
  const validTargets =
    state.selectedNode !== null && !state.isRemoving
      ? isFlying
        ? getEmptyNodes()
        : getValidMoves(state.selectedNode)
      : [];

  for (let i = 0; i < 24; i++) {
    const nodeEl = nodes[i];
    nodeEl.innerHTML = "";
    nodeEl.classList.remove("valid-target");

    const val = state.board[i];

    if (val !== PLAYER.NONE) {
      const piece = document.createElement("div");
      piece.className = `piece ${val === PLAYER.BLUE ? "blue" : "red"}`;

      if (i === state.selectedNode) piece.classList.add("selected");

      if (state.isRemoving && val === getOpponent(state.currentPlayer)) {
        if (canRemovePiece(i, val)) piece.classList.add("removable");
      }

      nodeEl.appendChild(piece);
    } else if (validTargets.includes(i)) {
      nodeEl.classList.add("valid-target");
    }
  }
}

function flashStatus(msg) {
  phaseText.textContent = msg;
  phaseText.classList.add("text-amber-400", "font-bold");
  setTimeout(() => {
    phaseText.classList.remove("text-amber-400", "font-bold");
    updateUI();
  }, 1800);
}

function playSound(type) {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === "click") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(400, now);
      osc.frequency.exponentialRampToValueAtTime(800, now + 0.08);
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === "mill") {
      osc.type = "triangle";
      osc.frequency.setValueAtTime(523.25, now); // Do
      osc.frequency.setValueAtTime(659.25, now + 0.1); // Mi
      osc.frequency.setValueAtTime(783.99, now + 0.2); // Sol
      gainNode.gain.setValueAtTime(0.15, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    } else if (type === "win") {
      osc.type = "square";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554.37, now + 0.15);
      osc.frequency.setValueAtTime(659.25, now + 0.3);
      osc.frequency.setValueAtTime(880, now + 0.45);
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.7);
      osc.start(now);
      osc.stop(now + 0.7);
    } else if (type === "lose") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.4);
      gainNode.gain.setValueAtTime(0.1, now);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      osc.start(now);
      osc.stop(now + 0.4);
    }
  } catch (e) {
    // Sécurité au cas où le navigateur bloque l'audio
  }
}

switchGameMode("local");
