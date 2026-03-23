import { ROLES, DEATH } from "../config.js";
import { hasAliveRole, pickRandom } from "../utils.js";
import { canBeBitten, canGuardSelfTarget } from "../roles.js";
import {
  readBothPlayerStates,
  resolveNewPendingFromStates,
  resolveSettledPending,
} from "./duelWin.js";

export function clearRoundReservations(game) {
  for (const p of game.players) {
    p.guardIncomingSlot = null;
  }
  game.pendingGuards = [];
  game.roundGuardActors = [];
  game.pendingBites = [];
  game.roundBiteActors = [];
}

export function clearOnFinish(player) {
  player.guardIncomingSlot = null;
}

export function killSlot(game, playerId, slotIndex, reason, logPush) {
  const player = game.players[playerId];
  if (!player.alive) return false;

  const slot = player.slots[slotIndex];
  if (!slot || slot.dead) return false;

  slot.dead = true;
  slot.deathReason = reason;

  logPush(
    game,
    `P${playerId + 1} S${slotIndex + 1} ${reason === DEATH.LYNCH ? "吊り死亡" : "噛み死亡"}`
  );

  return true;
}

function setFinalPlayerResult(player, result) {
  player.alive = false;
  player.escaped = result === "WIN";
  player.resultText = result;
  clearOnFinish(player);
}

function finishGameAsDraw(game, logPush) {
  for (const p of game.players) {
    p.alive = false;
    p.escaped = false;
    p.resultText = "DRAW";
    clearOnFinish(p);
  }

  game.winners = [];
  game.over = true;
  logPush(game, "ゲーム終了 / 結果: DRAW");
}

function finishGameByPending(game, pending, logPush) {
  const trigger = game.players[pending.triggerPlayerId];
  const opponent = game.players[pending.opponentId];

  if (pending.type === "WIN") {
    setFinalPlayerResult(trigger, "WIN");
    setFinalPlayerResult(opponent, "LOSE");
    game.winners = [trigger.id];
    logPush(game, `P${trigger.id + 1} 勝利 / P${opponent.id + 1} 敗北`);
  } else {
    setFinalPlayerResult(trigger, "LOSE");
    setFinalPlayerResult(opponent, "WIN");
    game.winners = [opponent.id];
    logPush(game, `P${opponent.id + 1} 勝利 / P${trigger.id + 1} 敗北`);
  }

  game.over = true;
  logPush(
    game,
    `ゲーム終了 / 勝者: ${game.winners.length ? game.winners.map(id => `P${id + 1}`).join(", ") : "なし"}`
  );
}

function resolveGuardSlotIndex(targetPlayer, requestedSlotIndex) {
  const requested = targetPlayer?.slots?.[requestedSlotIndex];
  if (!requested || requested.dead) return null;

  if (canGuardSelfTarget(requested.role)) {
    return requestedSlotIndex;
  }

  const fallbackCandidates = targetPlayer.slots
    .map((slot, index) => ({ slot, index }))
    .filter(x =>
      !x.slot.dead &&
      canGuardSelfTarget(x.slot.role)
    );

  if (!fallbackCandidates.length) {
    return null;
  }

  const picked = pickRandom(fallbackCandidates);
  return picked ? picked.index : null;
}

export function resolvePendingGuards(game, logPush) {
  for (const p of game.players) {
    p.guardIncomingSlot = null;
  }

  for (const guard of game.pendingGuards) {
    const { actorId, targetId, slotIndex } = guard;
    const target = game.players[targetId];
    if (!target || !target.alive) continue;

    const resolvedSlotIndex = resolveGuardSlotIndex(target, slotIndex);
    if (resolvedSlotIndex == null) {
      logPush(game, `P${actorId + 1} 守り確定 → なし`);
      continue;
    }

    target.guardIncomingSlot = resolvedSlotIndex;

    if (resolvedSlotIndex !== slotIndex) {
      logPush(
        game,
        `P${actorId + 1} 守り確定 → P${targetId + 1} S${slotIndex + 1}は狩人のため、P${targetId + 1} S${resolvedSlotIndex + 1}へ変更`
      );
    } else {
      logPush(game, `P${actorId + 1} 守り確定 → P${targetId + 1} S${resolvedSlotIndex + 1}`);
    }
  }
}

export function resolvePendingBites(game, logPush) {
  for (const bite of game.pendingBites) {
    const { actorId, targetId, slotIndex } = bite;

    const target = game.players[targetId];
    const slot = target?.slots?.[slotIndex];

    if (!target || !target.alive || !slot || slot.dead) continue;
    if (!canBeBitten(slot.role)) continue;

    const guardActive =
      hasAliveRole(target, ROLES.GUARD) &&
      target.guardIncomingSlot === slotIndex;

    if (guardActive) {
      logPush(game, `P${actorId + 1} 噛み → P${targetId + 1} S${slotIndex + 1}（ガードで不発）`);
    } else {
      killSlot(game, targetId, slotIndex, DEATH.BITE, logPush);
      logPush(game, `P${actorId + 1} 噛み → P${targetId + 1} S${slotIndex + 1}`);
    }
  }
}

function resolveEndStateAfterResolution(game, logPush) {
  if (game.duelPendingResult) {
    const settled = resolveSettledPending(game);

    if (settled.kind === "DRAW") {
      finishGameAsDraw(game, logPush);
      return;
    }

    if (settled.kind === "FINAL") {
      finishGameByPending(game, settled.pending, logPush);
      return;
    }

    return;
  }

  const { s0, s1 } = readBothPlayerStates(game);
  const next = resolveNewPendingFromStates(s0, s1);

  if (next.kind === "DRAW_NOW") {
    finishGameAsDraw(game, logPush);
    return;
  }

  if (next.kind === "PENDING") {
    game.duelPendingResult = next.pending;
    const triggerId = next.pending.triggerPlayerId;
    const settleId = next.pending.settleTurnPlayerId;
    logPush(
      game,
      `P${triggerId + 1} ${next.pending.type === "WIN" ? "勝利条件" : "敗北条件"}成立 / P${settleId + 1} に最終手番`
    );
  }
}

export function judgeAfterResolution(game, logPush) {
  resolvePendingGuards(game, logPush);
  resolvePendingBites(game, logPush);
  resolveEndStateAfterResolution(game, logPush);
}
