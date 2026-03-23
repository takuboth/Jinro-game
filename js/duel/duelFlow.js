import { CONFIG, MODES, PUBLIC_KIND, PHASES, DEATH, ROLES } from "../config.js";
import {
  hiddenReserveCandidates,
  isLineAlive,
  colorFromRole,
  pickCpuLynchTarget,
  pickCpuReserveTarget,
  pickCpuBiteTarget,
  pickCpuGuardTarget,
} from "../utils.js";
import { revealPendingReportsForActor } from "./duelReports.js";
import {
  clearRoundReservations,
  judgeAfterResolution,
  killSlot,
} from "./duelJudge.js";
import { DUEL_TURN_FLOW, getNextPhase, isLastPhase } from "./duelFlowDef.js";

export function getOpponentId(actorId) {
  return actorId === 0 ? 1 : 0;
}

export function getLynchTargetId(game, actorId) {
  return game.mode === MODES.VILLAGER ? actorId : getOpponentId(actorId);
}

export function getReserveTargetId(game, actorId) {
  return game.mode === MODES.VILLAGER ? actorId : getOpponentId(actorId);
}

export function getGuardTargetId(game, actorId) {
  return game.mode === MODES.VILLAGER ? actorId : getOpponentId(actorId);
}

export function getBiteTargetId(game, actorId) {
  return game.mode === MODES.VILLAGER ? getOpponentId(actorId) : actorId;
}

function allAliveActorsReservedGuard(game) {
  const alive = game.players.filter(p => p.alive).map(p => p.id);
  return alive.every(id => game.roundGuardActors.includes(id));
}

function allAliveActorsReservedBite(game) {
  const alive = game.players.filter(p => p.alive).map(p => p.id);
  return alive.every(id => game.roundBiteActors.includes(id));
}

export function nextTurn(game, logPush) {
  game.turn = getOpponentId(game.turn);
  game.phase = DUEL_TURN_FLOW[0];

  clearRoundReservations(game);
  revealPendingReportsForActor(game, game.turn, logPush, getReserveTargetId);
}

function finishRoundAndMove(game, logPush) {
  judgeAfterResolution(game, logPush);
  if (!game.over) {
    nextTurn(game, logPush);
  }
}

function moveToNextActorOrResolve(game, logPush) {
  game.turn = getOpponentId(game.turn);
  game.phase = DUEL_TURN_FLOW[0];
  revealPendingReportsForActor(game, game.turn, logPush, getReserveTargetId);
}

export function advancePhase(game, logPush) {
  if (game.over) return;

  if (!isLastPhase(game.phase)) {
    const next = getNextPhase(game.phase);
    if (next) {
      game.phase = next;
    }
    return;
  }

  // 最終フェーズ(BITE)を終えた時だけラウンド処理
  if (allAliveActorsReservedGuard(game) && allAliveActorsReservedBite(game)) {
    finishRoundAndMove(game, logPush);
  } else {
    moveToNextActorOrResolve(game, logPush);
  }
}

export function applyLynch(game, actorId, targetId, slotIndex, logPush) {
  if (game.over) return;

  const target = game.players[targetId];
  const slot = target?.slots?.[slotIndex];
  if (!target || !slot || slot.dead) return;

  killSlot(game, targetId, slotIndex, DEATH.LYNCH, logPush);
  game.lastLynchedSlot = slot;

  game.players[actorId].pendingMedium = {
    targetId,
    slotIndex,
    color: colorFromRole(slot.role),
  };

  logPush(game, `P${actorId + 1} 吊り → P${targetId + 1} S${slotIndex + 1}`);
  advancePhase(game, logPush);
}

export function applyReserve(game, actorId, lineKind, targetId, slotIndex, logPush) {
  if (game.over) return;

  const actor = game.players[actorId];
  const target = game.players[targetId];
  const slot = target?.slots?.[slotIndex];
  if (!target || !slot || slot.dead || slot.isPublic) return;
  if (!isLineAlive(target, lineKind)) return;

  if (lineKind === PUBLIC_KIND.A) {
    if (actor.seenA[slotIndex]) return;
    actor.seenA[slotIndex] = true;
    actor.pendingA = { targetId, slotIndex };
    logPush(game, `P${actorId + 1} 占A予約 → P${targetId + 1} S${slotIndex + 1}`);
  } else {
    if (actor.seenB[slotIndex]) return;
    actor.seenB[slotIndex] = true;
    actor.pendingB = { targetId, slotIndex };
    logPush(game, `P${actorId + 1} 占B予約 → P${targetId + 1} S${slotIndex + 1}`);
  }

  advancePhase(game, logPush);
}

export function applyGuard(game, actorId, targetId, slotIndex, logPush) {
  if (game.over) return;

  const target = game.players[targetId];
  const requested = target?.slots?.[slotIndex];
  if (!target || !requested || requested.dead) return;

  game.pendingGuards.push({ actorId, targetId, slotIndex });
  if (!game.roundGuardActors.includes(actorId)) {
    game.roundGuardActors.push(actorId);
  }

  logPush(game, `P${actorId + 1} 守り予約 → P${targetId + 1} S${slotIndex + 1}`);
  advancePhase(game, logPush);
}

export function applyBite(game, actorId, targetId, slotIndex, logPush) {
  if (game.over) return;

  const target = game.players[targetId];
  const slot = target?.slots?.[slotIndex];
  if (!target || !slot || slot.dead || slot.role === ROLES.WOLF) return;

  game.pendingBites.push({ actorId, targetId, slotIndex });
  if (!game.roundBiteActors.includes(actorId)) {
    game.roundBiteActors.push(actorId);
  }

  logPush(game, `P${actorId + 1} 噛み予約 → P${targetId + 1} S${slotIndex + 1}`);
  advancePhase(game, logPush);
}

export function canAbsentOk(game) {
  if (game.over) return false;
  if (game.turn !== CONFIG.humanPlayerId) return false;

  const actorId = game.turn;
  const actor = game.players[actorId];
  if (!actor?.alive) return false;

  const reserveTargetId = getReserveTargetId(game, actorId);
  const guardTargetId = getGuardTargetId(game, actorId);
  const biteTargetId = getBiteTargetId(game, actorId);

  if (game.phase === PHASES.RESERVE_A) {
    const target = game.players[reserveTargetId];
    if (!isLineAlive(target, PUBLIC_KIND.A)) return true;
    return hiddenReserveCandidates(target, actor.seenA).length === 0;
  }

  if (game.phase === PHASES.RESERVE_B) {
    const target = game.players[reserveTargetId];
    if (!isLineAlive(target, PUBLIC_KIND.B)) return true;
    return hiddenReserveCandidates(target, actor.seenB).length === 0;
  }

  if (game.phase === PHASES.GUARD) {
    const target = game.players[guardTargetId];
    const canGuardAny = target.slots.some(slot => !slot.dead);
    return !canGuardAny;
  }

  if (game.phase === PHASES.BITE) {
    const target = game.players[biteTargetId];
    const canBiteAny = target.slots.some(slot => !slot.dead && slot.role !== ROLES.WOLF);
    return !canBiteAny;
  }

  return false;
}

export function doAbsentOk(game, logPush) {
  if (!canAbsentOk(game)) return;

  const actorId = game.turn;

  if (game.phase === PHASES.RESERVE_A) {
    logPush(game, `P${actorId + 1} 占A予約 → 対象なしでスキップ`);
    advancePhase(game, logPush);
    return;
  }

  if (game.phase === PHASES.RESERVE_B) {
    logPush(game, `P${actorId + 1} 占B予約 → 対象なしでスキップ`);
    advancePhase(game, logPush);
    return;
  }

  if (game.phase === PHASES.GUARD) {
    logPush(game, `P${actorId + 1} 守り予約 → 対象なしでスキップ`);
    if (!game.roundGuardActors.includes(actorId)) {
      game.roundGuardActors.push(actorId);
    }
    advancePhase(game, logPush);
    return;
  }

  if (game.phase === PHASES.BITE) {
    logPush(game, `P${actorId + 1} 噛み予約 → 対象なしでスキップ`);
    if (!game.roundBiteActors.includes(actorId)) {
      game.roundBiteActors.push(actorId);
    }
    advancePhase(game, logPush);
  }
}

export function isHumanTurn(game) {
  if (!CONFIG.autoPlayers) return true;
  if (game.over || !game.players[CONFIG.humanPlayerId]?.alive) return false;
  return game.turn === CONFIG.humanPlayerId;
}

export function cpuDoOneImmediate(game, logPush) {
  if (game.over) return;

  const actorId = game.turn;
  const actor = game.players[actorId];
  if (!actor || !actor.alive) return;

  const lynchTargetId = getLynchTargetId(game, actorId);
  const reserveTargetId = getReserveTargetId(game, actorId);
  const guardTargetId = getGuardTargetId(game, actorId);
  const biteTargetId = getBiteTargetId(game, actorId);

  if (game.phase === PHASES.LYNCH) {
    const pick = pickCpuLynchTarget(game.players[lynchTargetId]);
    if (pick == null) {
      logPush(game, `CPU P${actorId + 1} 吊り → 対象なし`);
      advancePhase(game, logPush);
      return;
    }
    applyLynch(game, actorId, lynchTargetId, pick, logPush);
    return;
  }

  if (game.phase === PHASES.RESERVE_A) {
    const target = game.players[reserveTargetId];
    if (!isLineAlive(target, PUBLIC_KIND.A)) {
      logPush(game, `CPU P${actorId + 1} 占A予約 → 占A死亡でスキップ`);
      advancePhase(game, logPush);
      return;
    }

    const alreadyB = actor.pendingB?.slotIndex ?? null;
    const pick = pickCpuReserveTarget(target, actor.seenA, alreadyB);

    if (pick == null) {
      logPush(game, `CPU P${actorId + 1} 占A予約 → 対象なし`);
      advancePhase(game, logPush);
      return;
    }
    applyReserve(game, actorId, PUBLIC_KIND.A, reserveTargetId, pick, logPush);
    return;
  }

  if (game.phase === PHASES.RESERVE_B) {
    const target = game.players[reserveTargetId];
    if (!isLineAlive(target, PUBLIC_KIND.B)) {
      logPush(game, `CPU P${actorId + 1} 占B予約 → 占B死亡でスキップ`);
      advancePhase(game, logPush);
      return;
    }

    const alreadyA = actor.pendingA?.slotIndex ?? null;
    const pick = pickCpuReserveTarget(target, actor.seenB, alreadyA);

    if (pick == null) {
      logPush(game, `CPU P${actorId + 1} 占B予約 → 対象なし`);
      advancePhase(game, logPush);
      return;
    }
    applyReserve(game, actorId, PUBLIC_KIND.B, reserveTargetId, pick, logPush);
    return;
  }

  if (game.phase === PHASES.GUARD) {
    const target = game.players[guardTargetId];
    const pick = pickCpuGuardTarget(target, game);

    if (pick == null) {
      logPush(game, `CPU P${actorId + 1} 守り予約 → 対象なし`);
      if (!game.roundGuardActors.includes(actorId)) {
        game.roundGuardActors.push(actorId);
      }
      advancePhase(game, logPush);
      return;
    }

    applyGuard(game, actorId, guardTargetId, pick, logPush);
    return;
  }

  if (game.phase === PHASES.BITE) {
    const target = game.players[biteTargetId];
    const pick = pickCpuBiteTarget(target, game);

    if (pick == null) {
      logPush(game, `CPU P${actorId + 1} 噛み予約 → 対象なし`);
      if (!game.roundBiteActors.includes(actorId)) {
        game.roundBiteActors.push(actorId);
      }
      advancePhase(game, logPush);
      return;
    }

    applyBite(game, actorId, biteTargetId, pick, logPush);
  }
}
