// --- WEB WORKER : IA DIVINITÉ ABSOLUE (Alpha-Beta Profondeur 6 + Transposition Table) ---

let currentGameVariant = "9";
let transpositionTable = new Map(); // Cache de mémoire pour éviter les calculs redondants

const ADJACENCY_9 = [
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

const ADJACENCY_6 = [
  [1, 7],
  [0, 2, 9],
  [1, 3],
  [2, 4, 11],
  [3, 5],
  [4, 6, 13],
  [5, 7],
  [0, 6, 15],
  [9, 15],
  [1, 8, 10],
  [9, 11],
  [3, 10, 12],
  [11, 13],
  [5, 12, 14],
  [13, 15],
  [7, 8, 14],
];

const MILLS_9 = [
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

const MILLS_6 = [
  [0, 1, 2],
  [2, 3, 4],
  [4, 5, 6],
  [6, 7, 0],
  [8, 9, 10],
  [10, 11, 12],
  [12, 13, 14],
  [14, 15, 8],
  [1, 9],
  [3, 11],
  [5, 13],
  [7, 15],
];

const PLAYER = { NONE: 0, BLUE: 1, RED: 2 };

self.onmessage = function (e) {
  const { state, variant } = e.data;
  currentGameVariant = variant;
  transpositionTable.clear(); // Nettoyer le cache à chaque tour pour repartir sur du frais

  // Adaptation dynamique de la profondeur : 5 en début de partie, 6 en milieu/fin pour voir tous les pièges
  const totalPieces = state.board.filter((v) => v !== PLAYER.NONE).length;
  const depth = totalPieces <= 10 ? 6 : 5;

  const bestMove = getBestAlphaBetaMove(state, depth);
  self.postMessage(bestMove);
};

function getBestAlphaBetaMove(currentState, depth) {
  let bestScore = -Infinity;
  let bestMove = null;
  const possibleMoves = getAllPossibleMoves(currentState, PLAYER.RED);

  // Tri ultra-agressif des coups : on teste en priorité ceux qui ferment un moulin
  possibleMoves.sort((a, b) => {
    let aMill = checkMillCreatedInState(currentState, a.to, PLAYER.RED)
      ? 50
      : 0;
    let bMill = checkMillCreatedInState(currentState, b.to, PLAYER.RED)
      ? 50
      : 0;
    return bMill - aMill;
  });

  for (let move of possibleMoves) {
    let nextState = simulateMove(currentState, move, PLAYER.RED);
    let score = alphaBeta(nextState, depth - 1, -Infinity, Infinity, false);
    if (score > bestScore) {
      bestScore = score;
      bestMove = move;
    }
  }
  return bestMove || possibleMoves[0];
}

function alphaBeta(nodeState, depth, alpha, beta, maximizingPlayer) {
  // Clé de hachage simple pour la table de transposition
  const boardKey =
    nodeState.board.join("") +
    "-" +
    nodeState.reserves[PLAYER.RED] +
    "-" +
    nodeState.reserves[PLAYER.BLUE] +
    "-" +
    depth;
  if (transpositionTable.has(boardKey)) {
    return transpositionTable.get(boardKey);
  }

  if (depth === 0 || nodeState.gameOver) {
    let evalScore = evaluateBoardSkynet(nodeState);
    transpositionTable.set(boardKey, evalScore);
    return evalScore;
  }

  const moves = getAllPossibleMoves(
    nodeState,
    maximizingPlayer ? PLAYER.RED : PLAYER.BLUE,
  );

  if (maximizingPlayer) {
    let maxEval = -Infinity;
    for (let move of moves) {
      let nextState = simulateMove(nodeState, move, PLAYER.RED);
      let evaluation = alphaBeta(nextState, depth - 1, alpha, beta, false);
      maxEval = Math.max(maxEval, evaluation);
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break; // Coupure Alpha-Beta
    }
    transpositionTable.set(boardKey, maxEval);
    return maxEval;
  } else {
    let minEval = Infinity;
    for (let move of moves) {
      let nextState = simulateMove(nodeState, move, PLAYER.BLUE);
      let evaluation = alphaBeta(nextState, depth - 1, alpha, beta, true);
      minEval = Math.min(minEval, evaluation);
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break; // Coupure Alpha-Beta
    }
    transpositionTable.set(boardKey, minEval);
    return minEval;
  }
}

function getAllPossibleMoves(st, player) {
  let moves = [];
  const size = currentGameVariant === "6" ? 16 : 24;

  if (st.reserves[player] > 0) {
    for (let i = 0; i < size; i++) {
      if (st.board[i] === PLAYER.NONE) {
        moves.push({ from: null, to: i });
      }
    }
  } else {
    const pieces = st.board
      .map((val, idx) => (val === player ? idx : null))
      .filter((val) => val !== null);
    const isFlying = pieces.length === 3;
    const adjacency = currentGameVariant === "6" ? ADJACENCY_6 : ADJACENCY_9;

    for (let p of pieces) {
      const targets = isFlying
        ? st.board
            .map((val, idx) => (val === PLAYER.NONE ? idx : null))
            .filter((val) => val !== null)
        : adjacency[p].filter((adj) => st.board[adj] === PLAYER.NONE);

      for (let t of targets) {
        moves.push({ from: p, to: t });
      }
    }
  }
  return moves;
}

function simulateMove(st, move, player) {
  let newState = JSON.parse(JSON.stringify(st));
  if (move.from !== null) {
    newState.board[move.from] = PLAYER.NONE;
  } else {
    newState.reserves[player]--;
  }
  newState.board[move.to] = player;

  if (checkMillCreatedInState(newState, move.to, player)) {
    const opponent = player === PLAYER.RED ? PLAYER.BLUE : PLAYER.RED;
    const opponentPieces = newState.board
      .map((val, idx) => (val === opponent ? idx : null))
      .filter((val) => val !== null);

    if (opponentPieces.length > 0) {
      const nonMillPieces = opponentPieces.filter(
        (idx) => !isPartOfMillInState(newState, idx, opponent),
      );
      const targetToRemove =
        nonMillPieces.length > 0 ? nonMillPieces[0] : opponentPieces[0];
      newState.board[targetToRemove] = PLAYER.NONE;
    }
  }
  return newState;
}

function checkMillCreatedInState(st, index, player) {
  const mills = currentGameVariant === "6" ? MILLS_6 : MILLS_9;
  return mills.some((mill) => {
    if (mill.includes(index)) {
      return mill.every((i) => st.board[i] === player);
    }
    return false;
  });
}

function isPartOfMillInState(st, index, player) {
  if (st.board[index] !== player) return false;
  return checkMillCreatedInState(st, index, player);
}

// Détection des menaces de moulin (2 sur 3)
function countPotentialMills(st, player) {
  let count = 0;
  const mills = currentGameVariant === "6" ? MILLS_6 : MILLS_9;
  mills.forEach((mill) => {
    let playerPieces = mill.filter((i) => st.board[i] === player).length;
    let emptySpots = mill.filter((i) => st.board[i] === PLAYER.NONE).length;
    if (playerPieces === 2 && emptySpots === 1) count++;
  });
  return count;
}

// --- ÉVALUATION SKYNET (NIVEAU IMPITOYABLE) ---
function evaluateBoardSkynet(st) {
  const redOnBoard = st.board.filter((v) => v === PLAYER.RED).length;
  const blueOnBoard = st.board.filter((v) => v === PLAYER.BLUE).length;
  const redRes = st.reserves[PLAYER.RED];
  const blueRes = st.reserves[PLAYER.BLUE];

  // Victoire / Défaite mathématique absolue
  if (blueRes === 0 && blueOnBoard < 3) return 100000;
  if (redRes === 0 && redOnBoard < 3) return -100000;

  let redMills = 0;
  let blueMills = 0;
  const mills = currentGameVariant === "6" ? MILLS_6 : MILLS_9;
  mills.forEach((mill) => {
    if (mill.every((i) => st.board[i] === PLAYER.RED)) redMills++;
    if (mill.every((i) => st.board[i] === PLAYER.BLUE)) blueMills++;
  });

  const redPot = countPotentialMills(st, PLAYER.RED);
  const bluePot = countPotentialMills(st, PLAYER.BLUE);

  const redMoves = getAllPossibleMoves(st, PLAYER.RED).length;
  const blueMoves = getAllPossibleMoves(st, PLAYER.BLUE).length;

  // Formule Skynet : Poids massif sur les moulins fermés, les menaces et l'asphyxie totale des mouvements
  let score =
    redOnBoard * 30 +
    redRes * 25 +
    redMills * 200 +
    redPot * 80 +
    redMoves * 5 -
    (blueOnBoard * 30 +
      blueRes * 25 +
      blueMills * 200 +
      bluePot * 80 +
      blueMoves * 5);

  return score;
}
