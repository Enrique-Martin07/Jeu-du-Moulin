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
let aiDifficulty = "easy"; // 'easy', 'medium', 'hard'
let myRole = PLAYER.BLUE;
let peer = null;
let conn = null;
let pendingConn = null;
let opponentName = "Adversaire";

// --- Variables pour le système d'Annulation (Undo) ---
let undoHistory = [];
let undoCounts = { [PLAYER.BLUE]: 3, [PLAYER.RED]: 3 };

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

const modal = document.getElementById("winModal");
const modalTitle = document.getElementById("modalTitle");
const modalMessage = document.getElementById("modalMessage");
const modalIcon = document.getElementById("modalIcon");

function getMyPseudo() {
  const input = document.getElementById("player-pseudo");
  return input && input.value.trim()
    ? input.value.trim().substring(0, 15)
    : myRole === PLAYER.BLUE
      ? "Joueur Bleu"
      : "Joueur Rouge";
}

function setAIDifficulty(level) {
  aiDifficulty = level;
  ["easy", "medium", "hard"].forEach((lvl) => {
    const btn = document.getElementById(`btn-diff-${lvl}`);
    if (lvl === level) {
      btn.className =
        "flex-1 py-1.5 text-xs font-bold rounded-lg transition bg-sky-600 text-white shadow";
    } else {
      btn.className =
        "flex-1 py-1.5 text-xs font-bold rounded-lg transition text-slate-300 hover:text-white hover:bg-slate-700/50";
    }
  });
  initGame();
}

function showWinModal(winnerName, isVictory) {
  if (isVictory) {
    modalTitle.textContent = "Victoire ! 🏆";
    modalMessage.textContent = `${winnerName} a gagné la partie.`;
    modalIcon.innerHTML =
      '<i class="fa-solid fa-trophy text-amber-400 animate-bounce"></i>';
  } else {
    modalTitle.textContent = "Défaite... 💀";
    modalMessage.textContent = `${winnerName} a remporté la partie.`;
    modalIcon.innerHTML =
      '<i class="fa-solid fa-face-frown text-rose-400"></i>';
  }
  modal.classList.remove("hidden");
}

function hideWinModal() {
  modal.classList.add("hidden");
}

function switchGameMode(mode) {
  activeMode = mode;

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
  const pseudoContainer = document.getElementById("pseudo-container");
  const difficultyContainer = document.getElementById("difficulty-container");
  const chatCard = document.getElementById("chat-card");
  const redLabel = document.getElementById("red-label");

  if (mode === "online") {
    onlineBar.classList.remove("hidden");
    invitePanel.classList.remove("hidden");
    pseudoContainer.classList.remove("hidden");
    difficultyContainer.classList.add("hidden");
    chatCard.classList.remove("hidden");
    redLabel.textContent = "Joueur Rouge (Invité)";
    enableChat(true);
    if (!peer) initPeer();
  } else if (mode === "ai") {
    onlineBar.classList.add("hidden");
    invitePanel.classList.add("hidden");
    pseudoContainer.classList.add("hidden");
    difficultyContainer.classList.remove("hidden");
    chatCard.classList.add("hidden");
    enableChat(false);
    redLabel.textContent = "Ordinateur (IA)";
  } else {
    onlineBar.classList.add("hidden");
    invitePanel.classList.add("hidden");
    pseudoContainer.classList.add("hidden");
    difficultyContainer.classList.add("hidden");
    chatCard.classList.add("hidden");
    enableChat(false);
    redLabel.textContent = "Joueur Rouge";
  }

  initGame();
}

const btnRestart = document.getElementById("btn-restart");
if (btnRestart) {
  btnRestart.addEventListener("click", () => {
    hideWinModal();
    initGame();
    if (activeMode === "online" && conn && conn.open) {
      conn.send({ type: "RESTART" });
    }
  });
}

function resetGame() {
  hideWinModal();
  initGame();
  if (activeMode === "online" && conn && conn.open) {
    conn.send({ type: "RESTART" });
  }
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
  const myPseudo = getMyPseudo();

  conn.on("open", () => {
    addChatMessage(
      "Système",
      "Partie connectée ! Vous jouez les " +
        (myRole === PLAYER.BLUE ? "Bleus" : "Rouges") +
        ".",
    );
    document.getElementById("invite-panel").classList.add("hidden");

    conn.send({ type: "PSEUDO", pseudo: myPseudo });

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
    if (data.type === "PSEUDO") {
      opponentName = data.pseudo;
      updateUI();
      addChatMessage("Système", `${opponentName} a rejoint la partie.`);
      return;
    }
    if (data.type === "GAME_STATE") {
      state = data.state;
      updateUI();
    }
    if (data.type === "UNDO") {
      undoCounts = data.undoCounts;
      if (data.state) state = data.state;
      updateUndoButtonUI();
      updateUI();
      flashStatus("L'adversaire a annulé un coup !");
      return;
    }
    if (data.type === "CHAT") {
      addChatMessage(opponentName, data.message);
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
    const myPseudo = getMyPseudo();
    addChatMessage(myPseudo, msg);
    conn.send({ type: "CHAT", message: msg });
    chatInput.value = "";
  }
});

function addChatMessage(sender, text) {
  const msgDiv = document.createElement("div");
  msgDiv.className = "mb-1";
  let color = "text-slate-300";
  const myPseudo = getMyPseudo();

  if (sender === myPseudo || sender === "Moi")
    color = "text-sky-400 font-semibold";
  if (sender === opponentName || sender === "Adversaire")
    color = "text-rose-400 font-semibold";
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

  undoHistory = [];
  undoCounts = { [PLAYER.BLUE]: 3, [PLAYER.RED]: 3 };
  updateUndoButtonUI();

  setupCanvas();
  renderNodes();
  updateUI();
}

// --- Fonction d'Annulation (Undo) ---
function undoMove() {
  if (state.gameOver) return;

  if (activeMode === "online" && state.currentPlayer !== myRole) {
    flashStatus("Ce n'est pas votre tour d'annuler !");
    return;
  }

  const playerToUndo = state.currentPlayer;

  if (undoCounts[playerToUndo] <= 0) {
    flashStatus("Plus d'annulations disponibles (3/3 utilisées) !");
    return;
  }

  if (undoHistory.length === 0) {
    flashStatus("Aucun coup à annuler pour le moment.");
    return;
  }

  if (activeMode === "ai" && undoHistory.length >= 2) {
    undoHistory.pop();
    const previousState = undoHistory.pop();
    state = previousState.state;
  } else {
    const previousRecord = undoHistory.pop();
    state = previousRecord.state;
  }

  undoCounts[playerToUndo]--;
  updateUndoButtonUI();
  playSound("click");
  updateUI();
  flashStatus("Coup annulé avec succès !");

  if (activeMode === "online" && conn && conn.open) {
    broadcastGameState();
    conn.send({ type: "UNDO", undoCounts: undoCounts, state: state });
  }
}

function updateUndoButtonUI() {
  const undoCountEl = document.getElementById("undo-count");
  const btnUndo = document.getElementById("btn-undo");

  if (undoCountEl) {
    const currentP = activeMode === "online" ? myRole : state.currentPlayer;
    undoCountEl.textContent =
      undoCounts[currentP] !== undefined ? undoCounts[currentP] : 3;
  }

  if (btnUndo) {
    btnUndo.className =
      "flex-1 text-xs font-semibold py-2.5 rounded-xl border-2 transition flex items-center justify-center gap-2 shadow";
    const activePlayerTheme =
      state.currentPlayer === PLAYER.BLUE
        ? currentTheme.player1
        : currentTheme.player2;

    // Adaptation spéciale pour le mode monochrome pour garder une parfaite visibilité
    if (currentTheme === colorThemes.monochrome) {
      btnUndo.classList.add(
        "bg-slate-800",
        "border-slate-400",
        "text-slate-200",
      );
    } else {
      btnUndo.classList.add(
        activePlayerTheme.bg,
        activePlayerTheme.border,
        "text-white",
      );
    }
  }
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
    return;
  }

  playSound("click");

  undoHistory.push({
    state: JSON.parse(JSON.stringify(state)),
    player: state.currentPlayer,
  });

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
  updateUndoButtonUI();

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
    let targetPos = null;

    if (aiDifficulty !== "easy") {
      for (let pos of empties) {
        state.board[pos] = PLAYER.RED;
        if (checkMillCreated(pos, PLAYER.RED)) {
          targetPos = pos;
          state.board[pos] = PLAYER.NONE;
          break;
        }
        state.board[pos] = PLAYER.NONE;
      }

      if (targetPos === null && aiDifficulty === "hard") {
        for (let pos of empties) {
          state.board[pos] = PLAYER.BLUE;
          if (checkMillCreated(pos, PLAYER.BLUE)) {
            targetPos = pos;
            state.board[pos] = PLAYER.NONE;
            break;
          }
          state.board[pos] = PLAYER.NONE;
        }
      }
    }

    if (targetPos === null) {
      targetPos = empties[Math.floor(Math.random() * empties.length)];
    }

    state.board[targetPos] = PLAYER.RED;
    state.reserves[PLAYER.RED]--;

    if (checkMillCreated(targetPos, PLAYER.RED)) {
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

    if (aiDifficulty !== "easy") {
      for (let p of redPieces) {
        const moves = isFlying ? getEmptyNodes() : getValidMoves(p);
        for (let target of moves) {
          state.board[target] = PLAYER.RED;
          state.board[p] = PLAYER.NONE;
          if (checkMillCreated(target, PLAYER.RED)) {
            moved = true;
            state.isRemoving = true;
            playSound("mill");
            setTimeout(triggerAIMove, 400);
            updateUI();
            return;
          }
          state.board[p] = PLAYER.RED;
          state.board[target] = PLAYER.RED; // Corrigé ici (réinitialisation correcte)
        }
      }
    }

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

const colorThemes = {
  classic: {
    player1: {
      bg: "bg-blue-600",
      border: "border-blue-400",
      text: "text-blue-400",
    },
    player2: {
      bg: "bg-red-600",
      border: "border-red-400",
      text: "text-red-400",
    },
  },
  emerald: {
    player1: {
      bg: "bg-emerald-600",
      border: "border-emerald-400",
      text: "text-emerald-400",
    },
    player2: {
      bg: "bg-orange-600",
      border: "border-orange-400",
      text: "text-orange-400",
    },
  },
  monochrome: {
    player1: {
      bg: "bg-slate-900",
      border: "border-slate-500",
      text: "text-slate-300",
    },
    player2: { bg: "bg-slate-100", border: "border-white", text: "text-white" },
  },
  neon: {
    player1: {
      bg: "bg-cyan-500",
      border: "border-cyan-300",
      text: "text-cyan-300",
    },
    player2: {
      bg: "bg-fuchsia-600",
      border: "border-fuchsia-400",
      text: "text-fuchsia-400",
    },
  },
};

let currentTheme = colorThemes.classic;

function changeTheme(themeName) {
  if (colorThemes[themeName]) {
    currentTheme = colorThemes[themeName];

    const allBorders = [
      "border-blue-400",
      "border-red-400",
      "border-emerald-400",
      "border-orange-400",
      "border-slate-500",
      "border-white",
      "border-cyan-300",
      "border-fuchsia-400",
    ];
    cardBlue.classList.remove(...allBorders);
    cardRed.classList.remove(...allBorders);

    updateUI();
    updateUndoButtonUI();
  }
}

function updateUI() {
  blueReserveEl.textContent = state.reserves[PLAYER.BLUE];
  blueOnBoardEl.textContent = getPieceCountOnBoard(PLAYER.BLUE);
  redReserveEl.textContent = state.reserves[PLAYER.RED];
  redOnBoardEl.textContent = getPieceCountOnBoard(PLAYER.RED);

  const myPseudo = getMyPseudo();
  const blueLabelEl = document.getElementById("blue-label");
  const redLabelEl = document.getElementById("red-label");

  if (activeMode === "online") {
    if (myRole === PLAYER.BLUE) {
      blueLabelEl.textContent = myPseudo;
      redLabelEl.textContent = opponentName;
    } else {
      blueLabelEl.textContent = opponentName;
      redLabelEl.textContent = myPseudo;
    }
  } else if (activeMode === "local") {
    if (currentTheme === colorThemes.emerald) {
      blueLabelEl.textContent = "Joueur Vert";
      redLabelEl.textContent = "Joueur Orange";
    } else if (currentTheme === colorThemes.monochrome) {
      blueLabelEl.textContent = "Joueur Noir";
      redLabelEl.textContent = "Joueur Blanc";
    } else if (currentTheme === colorThemes.neon) {
      blueLabelEl.textContent = "Joueur Cyan";
      redLabelEl.textContent = "Joueur Rose";
    } else {
      blueLabelEl.textContent = "Joueur Bleu";
      redLabelEl.textContent = "Joueur Rouge";
    }
  } else {
    blueLabelEl.textContent = "Joueur";
    redLabelEl.textContent = "Ordinateur (IA)";
  }

  if (state.currentPlayer === PLAYER.BLUE) {
    cardBlue.classList.add(
      currentTheme.player1.border,
      "shadow-lg",
      "animate-pulse",
    );
    cardBlue.classList.remove("border-transparent");

    cardRed.classList.remove(
      currentTheme.player2.border,
      "shadow-lg",
      "animate-pulse",
    );
    cardRed.classList.add("border-transparent");
  } else {
    cardRed.classList.add(
      currentTheme.player2.border,
      "shadow-lg",
      "animate-pulse",
    );
    cardRed.classList.remove("border-transparent");

    cardBlue.classList.remove(
      currentTheme.player1.border,
      "shadow-lg",
      "animate-pulse",
    );
    cardBlue.classList.add("border-transparent");
  }

  if (state.gameOver) {
    let winnerDisplay = "Joueur Bleu";
    if (state.winner === PLAYER.RED) {
      winnerDisplay =
        activeMode === "ai"
          ? "L'Ordinateur"
          : activeMode === "online"
            ? opponentName
            : currentTheme === colorThemes.emerald
              ? "Joueur Orange"
              : currentTheme === colorThemes.monochrome
                ? "Joueur Blanc"
                : currentTheme === colorThemes.neon
                  ? "Joueur Rose"
                  : "Joueur Rouge";
    } else {
      winnerDisplay =
        activeMode === "online" && myRole === PLAYER.BLUE
          ? myPseudo
          : activeMode === "local"
            ? currentTheme === colorThemes.emerald
              ? "Joueur Vert"
              : currentTheme === colorThemes.monochrome
                ? "Joueur Noir"
                : currentTheme === colorThemes.neon
                  ? "Joueur Cyan"
                  : "Joueur Bleu"
            : "Joueur";
    }

    const isVictory =
      state.winner === myRole ||
      (activeMode === "local" && state.winner === PLAYER.BLUE) ||
      (activeMode === "ai" && state.winner === PLAYER.BLUE);

    if (isVictory) {
      playSound("win");
      modalTitle.textContent = "Victoire ! 🏆";
      modalMessage.textContent = `${winnerDisplay} a gagné la partie.`;
      modalIcon.innerHTML =
        '<i class="fa-solid fa-trophy text-amber-400 animate-bounce"></i>';
    } else {
      playSound("lose");
      modalTitle.textContent = "Défaite... 💀";
      modalMessage.textContent = `${winnerDisplay} a remporté la partie.`;
      modalIcon.innerHTML =
        '<i class="fa-solid fa-face-frown text-rose-400"></i>';
    }
    modal.classList.remove("hidden");
  } else if (state.isRemoving) {
    let curName = "";
    if (activeMode === "local") {
      if (state.currentPlayer === PLAYER.BLUE) {
        curName =
          currentTheme === colorThemes.emerald
            ? "Vert"
            : currentTheme === colorThemes.monochrome
              ? "Noir"
              : currentTheme === colorThemes.neon
                ? "Cyan"
                : "Bleu";
      } else {
        curName =
          currentTheme === colorThemes.emerald
            ? "Orange"
            : currentTheme === colorThemes.monochrome
              ? "Blanc"
              : currentTheme === colorThemes.neon
                ? "Rose"
                : "Rouge";
      }
    } else if (activeMode === "ai") {
      curName = state.currentPlayer === PLAYER.BLUE ? "Joueur" : "IA";
    } else {
      curName = state.currentPlayer === myRole ? myPseudo : opponentName;
    }

    statusText.className = "text-base font-bold text-amber-400 animate-pulse";
    statusText.innerHTML = `<i class="fa-solid fa-bolt mr-1"></i> MOULIN ! (${curName}) : Retirez un pion adverse.`;
    phaseText.textContent = "Cliquez sur un pion ennemi à éliminer.";
  } else {
    let curName = "";
    if (activeMode === "local") {
      if (state.currentPlayer === PLAYER.BLUE) {
        if (currentTheme === colorThemes.emerald) curName = "Joueur Vert";
        else if (currentTheme === colorThemes.monochrome)
          curName = "Joueur Noir";
        else if (currentTheme === colorThemes.neon) curName = "Joueur Cyan";
        else curName = "Joueur Bleu";
      } else {
        if (currentTheme === colorThemes.emerald) curName = "Joueur Orange";
        else if (currentTheme === colorThemes.monochrome)
          curName = "Joueur Blanc";
        else if (currentTheme === colorThemes.neon) curName = "Joueur Rose";
        else curName = "Joueur Rouge";
      }
    } else if (activeMode === "ai") {
      curName = state.currentPlayer === PLAYER.BLUE ? "Joueur" : "Ordinateur";
    } else {
      curName = state.currentPlayer === myRole ? myPseudo : opponentName;
    }

    const isMyTurn =
      activeMode === "online" ? state.currentPlayer === myRole : true;
    const turnNotice =
      activeMode === "online"
        ? isMyTurn
          ? " (C'est votre tour !)"
          : " (Tour adverse...)"
        : "";

    const colorClass =
      state.currentPlayer === PLAYER.BLUE
        ? currentTheme.player1.text
        : currentTheme.player2.text;
    statusText.className = `text-base font-semibold ${colorClass}`;
    statusText.textContent = `Tour : ${curName}${turnNotice}`;

    const p1Dot = document.getElementById("p1-dot");
    const p2Dot = document.getElementById("p2-dot");

    if (p1Dot)
      p1Dot.className = `w-6 h-6 rounded-full ${currentTheme.player1.bg} shadow`;
    if (p2Dot)
      p2Dot.className = `w-6 h-6 rounded-full ${currentTheme.player2.bg} shadow`;

    const p1Stats = document.getElementById("p1-stats");
    const p2Stats = document.getElementById("p2-stats");

    if (p1Stats)
      p1Stats.className = `text-xs font-bold ${currentTheme.player1.text} mt-0.5`;
    if (p2Stats)
      p2Stats.className = `text-xs font-bold ${currentTheme.player2.text} mt-0.5`;

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
      const pColor =
        val === PLAYER.BLUE ? currentTheme.player1 : currentTheme.player2;
      piece.className = `piece ${pColor.bg} border-2 ${pColor.border}`;

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
      osc.frequency.setValueAtTime(523.25, now);
      osc.frequency.setValueAtTime(659.25, now + 0.1);
      osc.frequency.setValueAtTime(783.99, now + 0.2);
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
    // Sécurité audio
  }
}

// --- MISE À JOUR EN DIRECT DU PSEUDO EN LIGNE ---
const pseudoInput = document.getElementById("player-pseudo");
if (pseudoInput) {
  pseudoInput.addEventListener("input", () => {
    updateUI();
    if (activeMode === "online" && conn && conn.open) {
      conn.send({ type: "PSEUDO", pseudo: getMyPseudo() });
    }
  });
}

// Animation d'entrée au chargement de la page
window.addEventListener("load", () => {
  setTimeout(() => {
    const introScreen = document.getElementById("intro-screen");
    if (introScreen) {
      introScreen.classList.add("opacity-0", "pointer-events-none");
      setTimeout(() => introScreen.remove(), 700);
    }
  }, 1200);
});

switchGameMode("local");

// --- ENREGISTREMENT DU SERVICE WORKER (MODE HORS LIGNE / PWA) ---
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./sw.js")
      .then((reg) => console.log("Service Worker actif ! Scope:", reg.scope))
      .catch((err) => console.error("Erreur Service Worker:", err));
  });
}
