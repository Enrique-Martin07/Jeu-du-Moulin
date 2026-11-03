// --- WEB WORKER : SKYNET GOD MODE (IA IMPITOYABLE & SADIQUE) ---

let currentGameVariant = "9";
let transpositionTable = new Map();

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
  transpositionTable.clear();

  const totalPieces = state.board.filter((v) => v !== PLAYER.NONE).length;
  // Profondeur accrue (6 coups minimum)
  const depth = totalPieces <= 12 ? 6 : 5;

  const bestMove = getBestAlphaBetaMove(state, depth);
  self.postMessage(bestMove);
};

function getBestAlphaBetaMove(currentState, depth) {
  let bestScore = -Infinity;
  let bestMove = null;
  const possibleMoves = getAllPossibleMoves(currentState, PLAYER.RED);

  // Tri hyper-agressif des coups : prioriser l'activation des pièges et des moulins
  possibleMoves.sort((a, b) => {
    let aMill = checkMillCreatedInState(currentState, a.to, PLAYER.RED)
      ? 500
      : 0;
    let bMill = checkMillCreatedInState(currentState, b.to, PLAYER.RED)
      ? 500
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
    let evalScore = evaluateBoardGodMode(nodeState);
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
      if (beta <= alpha) break;
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
      if (beta <= alpha) break;
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

      // Retirer la pièce adverse qui ruine le plus sa structure (ou qui détruit une menace potentielle)
      let targetToRemove = nonMillPieces[0] || opponentPieces[0];
      let bestRemovalScore = -Infinity;

      const candidates =
        nonMillPieces.length > 0 ? nonMillPieces : opponentPieces;
      for (let cand of candidates) {
        let tempState = JSON.parse(JSON.stringify(newState));
        tempState.board[cand] = PLAYER.NONE;
        let score = countPotentialMills(tempState, opponent) * -100;
        if (score > bestRemovalScore) {
          bestRemovalScore = score;
          targetToRemove = cand;
        }
      }

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

// Compte les opportunités de créer un moulin (2 pions + 1 case vide)
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

// --- ÉVALUATION SADIQUE (GOD MODE) ---
function evaluateBoardGodMode(st) {
  const redPieces =
    st.board.filter((v) => v === PLAYER.RED).length + st.reserves[PLAYER.RED];
  const bluePieces =
    st.board.filter((v) => v === PLAYER.BLUE).length + st.reserves[PLAYER.BLUE];

  const blueOnBoard = st.board.filter((v) => v === PLAYER.BLUE).length;
  const redOnBoard = st.board.filter((v) => v === PLAYER.RED).length;

  // Victoire immédiate
  if (st.reserves[PLAYER.BLUE] === 0 && blueOnBoard < 3) return 10000000;
  if (st.reserves[PLAYER.RED] === 0 && redOnBoard < 3) return -10000000;

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

  // Détection de fourches (double menaces simultanées)
  const redForks = redPot >= 2 ? 1500 : 0;
  const blueForks = bluePot >= 2 ? 1500 : 0;

  // Asphyxie : pénaliser drastiquement l'adversaire s'il a très peu de coups possibles
  const asphyxiaBonus = blueMoves === 0 ? 500000 : (20 - blueMoves) * 150;

  let score =
    (redPieces - bluePieces) * 5000 +
    (redMills - blueMills) * 2000 +
    (redPot - bluePot) * 800 +
    (redForks - blueForks) +
    asphyxiaBonus +
    redMoves * 30;

  return score;
}
