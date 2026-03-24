import { MODES } from "../config.js";
import { countAliveWolves, countAliveNonWolves, countAliveFoxes } from "../utils.js";

export function getDuelResultState(game, player) {
  const wolves = countAliveWolves(player);
  const nonWolves = countAliveNonWolves(player);

  if (game.mode === MODES.WOLF) {
    if (wolves === 0) return "LOSE";
    if (wolves >= nonWolves && player.slots.some(s => !s.dead)) return "WIN";
    return "NONE";
  }

  if (wolves === 0) return "WIN";
  if (wolves >= nonWolves && player.slots.some(s => !s.dead)) return "LOSE";
  return "NONE";
}

export function readBothPlayerStates(game) {
  const p0 = game.players[0];
  const p1 = game.players[1];

  return {
    p0,
    p1,
    s0: getDuelResultState(game, p0),
    s1: getDuelResultState(game, p1),
    foxAlive: countAliveFoxes(p0) > 0 || countAliveFoxes(p1) > 0,
  };
}

export function makePendingResult(triggerPlayerId, opponentId, type, settleTurnPlayerId) {
  return {
    triggerPlayerId,
    opponentId,
    type,
    settleTurnPlayerId,
  };
}

export function shouldFinishAsDrawFromStates(s0, s1) {
  return s0 !== "NONE" && s0 === s1;
}

export function resolveNewPendingFromStates(s0, s1, foxAlive) {
  if (s0 !== "NONE" || s1 !== "NONE") {
    if (foxAlive) {
      return { kind: "DOUBLE_LOSE" };
    }
  }

  if (shouldFinishAsDrawFromStates(s0, s1)) {
    return { kind: "DRAW_NOW" };
  }

  if (s0 !== "NONE") {
    return {
      kind: "PENDING",
      pending: makePendingResult(0, 1, s0, 1),
    };
  }

  if (s1 !== "NONE") {
    return {
      kind: "PENDING",
      pending: makePendingResult(1, 0, s1, 0),
    };
  }

  return { kind: "NONE" };
}

export function resolveSettledPending(game) {
  const pending = game.duelPendingResult;
  if (!pending) {
    return { kind: "NONE" };
  }

  const settlePlayer = game.players[pending.settleTurnPlayerId];
  const settleState = getDuelResultState(game, settlePlayer);

  const foxAlive =
    countAliveFoxes(game.players[0]) > 0 ||
    countAliveFoxes(game.players[1]) > 0;

  if ((settleState !== "NONE" || pending.type !== "NONE") && foxAlive) {
    return { kind: "DOUBLE_LOSE" };
  }

  if (settleState === pending.type) {
    return { kind: "DRAW" };
  }

  return {
    kind: "FINAL",
    pending,
  };
}
