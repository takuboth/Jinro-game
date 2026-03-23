import { CONFIG } from "../config.js";
import { nowStamp } from "../utils.js";
import { makeNewGameBase, applyInitialReservationsSeed } from "./duelSetup.js";
import { revealPendingReportsForActor } from "./duelReports.js";
import {
  getOpponentId,
  getLynchTargetId,
  getReserveTargetId,
  getGuardTargetId,
  getBiteTargetId,
  applyLynch,
  applyReserve,
  applyGuard,
  applyBite,
  canAbsentOk,
  doAbsentOk,
  isHumanTurn,
  cpuDoOneImmediate,
} from "./duelFlow.js";

export function logPush(game, text) {
  game.log.push(`[${nowStamp()}] ${text}`);
}

export function makeNewGame(mode = CONFIG.defaultMode) {
  const game = makeNewGameBase(mode);

  applyInitialReservationsSeed(game);
  for (let actorId = 0; actorId < game.players.length; actorId++) {
    revealPendingReportsForActor(game, actorId, logPush, getReserveTargetId);
  }

  logPush(game, `${mode === "WOLF" ? "人狼" : "村人"}モード開始 / 初期占い結果を配置`);
  return game;
}

export {
  getOpponentId,
  getLynchTargetId,
  getReserveTargetId,
  getGuardTargetId,
  getBiteTargetId,
  canAbsentOk,
  doAbsentOk,
  isHumanTurn,
};

export function cpuDoOneImmediateWrapped(game) {
  return cpuDoOneImmediate(game, logPush);
}

export function runAutoUntilHumanTurn(game) {
  if (!CONFIG.autoPlayers) return;

  let steps = 0;
  while (!game.over && !isHumanTurn(game)) {
    steps += 1;
    if (steps > CONFIG.autoSafetySteps) {
      logPush(game, "自動停止: safetySteps超過");
      break;
    }
    cpuDoOneImmediate(game, logPush);
  }
}

export function applyHumanPick(game, viewAsId, playerId, slotIndex) {
  if (game.over) return;
  if (game.turn !== CONFIG.humanPlayerId) return;

  const actorId = game.turn;

  const lynchTargetId = getLynchTargetId(game, actorId);
  const reserveTargetId = getReserveTargetId(game, actorId);
  const guardTargetId = getGuardTargetId(game, actorId);
  const biteTargetId = getBiteTargetId(game, actorId);

  if (game.phase === "LYNCH") {
    if (playerId !== lynchTargetId) return;
    applyLynch(game, actorId, playerId, slotIndex, logPush);
    return;
  }

  if (game.phase === "RESERVE_A") {
    if (playerId !== reserveTargetId) return;
    applyReserve(game, actorId, "A", playerId, slotIndex, logPush);
    return;
  }

  if (game.phase === "RESERVE_B") {
    if (playerId !== reserveTargetId) return;
    applyReserve(game, actorId, "B", playerId, slotIndex, logPush);
    return;
  }

  if (game.phase === "GUARD") {
    if (playerId !== guardTargetId) return;
    applyGuard(game, actorId, playerId, slotIndex, logPush);
    return;
  }

  if (game.phase === "BITE") {
    if (playerId !== biteTargetId) return;
    applyBite(game, actorId, playerId, slotIndex, logPush);
  }
}

export function phaseLabel(phase) {
  if (phase === "LYNCH") return "吊り";
  if (phase === "RESERVE_A") return "占A予約";
  if (phase === "RESERVE_B") return "占B予約";
  if (phase === "GUARD") return "守り予約";
  if (phase === "BITE") return "噛み予約";
  if (phase === "END") return "終了";
  return "";
}
