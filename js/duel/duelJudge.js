import { CONFIG, MODES, ROLES, DEATH } from "../config.js";
import {
  countAliveWolves,
  countAliveNonWolves,
  hasAliveRole,
  pickRandom,
} from "../utils.js";

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

  if (requested.role !== ROLES.GUARD) {
    return requestedSlotIndex;
  }

  const villagerCandidates = targetPlayer.slots
    .map((slot, index) => ({ slot, index }))
    .filter(x => !x.slot.dead && x.slot.role === ROLES.VILLAGER);

  if (!villagerCandidates.length) {
    return null;
  }

  const picked = pickRandom(villagerCandidates);
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
    if (slot.role === ROLES.WOLF) continue;

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

export function judgeAfterResolution(game, logPush) {
  resolvePendingGuards(game, logPush);
  resolvePendingBites(game, logPush);

  const p0 = game.players[0];
  const p1 = game.players[1];
  const s0 = getDuelResultState(game, p0);
  const s1 = getDuelResultState(game, p1);

  if (game.duelPendingResult) {
    const pending = game.duelPendingResult;
    const settlePlayer = game.players[pending.settleTurnPlayerId];
    const settleState = getDuelResultState(game, settlePlayer);

    if (settleState === pending.type) {
      finishGameAsDraw(game, logPush);
      return;
    }

    finishGameByPending(game, pending, logPush);
    return;
  }

  if (s0 !== "NONE" && s0 === s1) {
    finishGameAsDraw(game, logPush);
    return;
  }

  if (s0 !== "NONE") {
    game.duelPendingResult = {
      triggerPlayerId: 0,
      opponentId: 1,
      type: s0,
      settleTurnPlayerId: 1,
    };
    logPush(game, `P1 ${s0 === "WIN" ? "勝利条件" : "敗北条件"}成立 / P2 に最終手番`);
    return;
  }

  if (s1 !== "NONE") {
    game.duelPendingResult = {
      triggerPlayerId: 1,
      opponentId: 0,
      type: s1,
      settleTurnPlayerId: 0,
    };
    logPush(game, `P2 ${s1 === "WIN" ? "勝利条件" : "敗北条件"}成立 / P1 に最終手番`);
  }
}
