import { CONFIG, MODES, ROLES, PHASES, MARK, DEATH, PUBLIC_KIND } from "./config.js";
import {
  shuffle,
  nowStamp,
  pickRandom,
  colorFromRole,
  hasAliveRole,
  countAliveWolves,
  countAliveNonWolves,
  getTrueLineKind,
  getFakeLineKind,
  isLineAlive,
  sameTarget,
  makeEmptySeenMap,
  hiddenReserveCandidates,
  pickCpuLynchTarget,
  pickCpuReserveTarget,
  pickCpuBiteTarget,
  pickCpuGuardTarget,
} from "./utils.js";

export function logPush(game, text) {
  game.log.push(`[${nowStamp()}] ${text}`);
}

function makePublicSlots() {
  const seerMad = shuffle([ROLES.SEER, ROLES.MAD]);
  return [
    {
      role: seerMad[0],
      isPublic: true,
      publicKind: PUBLIC_KIND.A,
      dead: false,
      seerA: MARK.NONE,
      seerB: MARK.NONE,
      medium: MARK.NONE,
      deathReason: DEATH.NONE,
    },
    {
      role: seerMad[1],
      isPublic: true,
      publicKind: PUBLIC_KIND.B,
      dead: false,
      seerA: MARK.NONE,
      seerB: MARK.NONE,
      medium: MARK.NONE,
      deathReason: DEATH.NONE,
    },
    {
      role: ROLES.MEDIUM,
      isPublic: true,
      publicKind: PUBLIC_KIND.MEDIUM,
      dead: false,
      seerA: MARK.NONE,
      seerB: MARK.NONE,
      medium: MARK.NONE,
      deathReason: DEATH.NONE,
    },
  ];
}

function makeHiddenSlots() {
  const deck = shuffle(CONFIG.hiddenDeck);
  return deck.map(role => ({
    role,
    isPublic: false,
    publicKind: null,
    dead: false,
    seerA: MARK.NONE,
    seerB: MARK.NONE,
    medium: MARK.NONE,
    deathReason: DEATH.NONE,
  }));
}

function makePlayer(id) {
  return {
    id,
    alive: true,
    escaped: false,
    resultText: "",

    slots: [...makePublicSlots(), ...makeHiddenSlots()],

    seenA: makeEmptySeenMap(),
    seenB: makeEmptySeenMap(),

    pendingA: null,
    pendingB: null,
    pendingMedium: null,

    // 解決済みの守り
    guardIncomingSlot: null,
  };
}

export function makeNewGame(mode = CONFIG.defaultMode) {
  const players = [];
  for (let i = 0; i < CONFIG.playerCount; i++) {
    players.push(makePlayer(i));
  }

  const game = {
    mode,
    players,
    turn: 0,
    phase: PHASES.LYNCH,
    over: false,
    winners: [],
    log: [],
    lastLynchedSlot: null,

    // 予約
    pendingGuards: [],
    roundGuardActors: [],
    pendingBites: [],
    roundBiteActors: [],

    // タイマン用
    duelPendingResult: null,
    // {
    //   triggerPlayerId,
    //   opponentId,
    //   type: "WIN" | "LOSE",
    //   settleTurnPlayerId
    // }
  };

  applyInitialReservations(game);
  logPush(game, `${mode === MODES.WOLF ? "人狼" : "村人"}モード開始 / 初期占い結果を配置`);

  return game;
}

function applyInitialReservations(game) {
  for (let actorId = 0; actorId < game.players.length; actorId++) {
    setInitialReservationsForActor(game, actorId);
    revealPendingReportsForActor(game, actorId);

    game.players[actorId].pendingA = null;
    game.players[actorId].pendingB = null;
  }
}

function setInitialReservationsForActor(game, actorId) {
  const targetId = getReserveTargetId(game, actorId);
  if (targetId == null) return;

  const actor = game.players[actorId];
  const targetPlayer = game.players[targetId];

  const hidden = targetPlayer.slots
    .map((slot, index) => ({ slot, index }))
    .filter(x => !x.slot.dead && !x.slot.isPublic);

  const fakeCandidates = hidden;
  const fakePick = pickRandom(fakeCandidates);
  if (!fakePick) return;

  const trueCandidates = hidden.filter(x =>
    x.index !== fakePick.index &&
    x.slot.role !== ROLES.WOLF
  );
  if (!trueCandidates.length) return;

  const truePick = pickRandom(trueCandidates);
  if (!truePick) return;

  const trueKind = getTrueLineKind(targetPlayer);
  const fakeKind = getFakeLineKind(targetPlayer);

  if (trueKind === PUBLIC_KIND.A) {
    actor.pendingA = { targetId, slotIndex: truePick.index };
    actor.seenA[truePick.index] = true;
  } else {
    actor.pendingB = { targetId, slotIndex: truePick.index };
    actor.seenB[truePick.index] = true;
  }

  if (fakeKind === PUBLIC_KIND.A) {
    actor.pendingA = { targetId, slotIndex: fakePick.index };
    actor.seenA[fakePick.index] = true;
  } else {
    actor.pendingB = { targetId, slotIndex: fakePick.index };
    actor.seenB[fakePick.index] = true;
  }
}

export function leftPlayerIndex(game, actorId) {
  return nextAliveIndex(game, actorId, -1);
}

export function rightPlayerIndex(game, actorId) {
  return nextAliveIndex(game, actorId, +1);
}

function nextAliveIndex(game, from, dir) {
  const n = game.players.length;
  for (let step = 1; step < n; step++) {
    const idx = (from + dir * step + n) % n;
    if (game.players[idx].alive) return idx;
  }
  return null;
}

function aliveIds(game) {
  return game.players.filter(p => p.alive).map(p => p.id);
}

function allAliveActorsReservedGuard(game) {
  const ids = aliveIds(game);
  return ids.every(id => game.roundGuardActors.includes(id));
}

function allAliveActorsReservedBite(game) {
  const ids = aliveIds(game);
  return ids.every(id => game.roundBiteActors.includes(id));
}

export function getLynchTargetId(game, actorId) {
  if (game.mode === MODES.VILLAGER) return actorId;
  return leftPlayerIndex(game, actorId);
}

export function getReserveTargetId(game, actorId) {
  if (game.mode === MODES.VILLAGER) return actorId;
  return leftPlayerIndex(game, actorId);
}

// 村人モードは自分を守る / 人狼モードは相手を守る
export function getGuardTargetId(game, actorId) {
  if (game.mode === MODES.VILLAGER) return actorId;
  return rightPlayerIndex(game, actorId);
}

export function getBiteTargetId(game, actorId) {
  if (game.mode === MODES.VILLAGER) return rightPlayerIndex(game, actorId);
  return actorId;
}

function getOpponentId(game, actorId) {
  return game.players.find(p => p.id !== actorId)?.id ?? null;
}

function nextTurn(game) {
  const next = nextAliveIndex(game, game.turn, +1);
  if (next == null) {
    game.over = true;
    game.phase = PHASES.END;
    return;
  }

  game.turn = next;
  game.phase = PHASES.LYNCH;

  revealPendingReportsForActor(game, game.turn);

  for (const p of game.players) {
    p.guardIncomingSlot = null;
  }
  game.pendingGuards = [];
  game.roundGuardActors = [];
  game.pendingBites = [];
  game.roundBiteActors = [];
}

function killSlot(game, playerId, slotIndex, reason) {
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

function clearOnFinish(player) {
  player.guardIncomingSlot = null;
}

function getDuelResultState(game, player) {
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

function finishGameAsDraw(game) {
  for (const p of game.players) {
    p.alive = false;
    p.escaped = false;
    p.resultText = "DRAW";
    clearOnFinish(p);
  }

  game.winners = [];
  game.over = true;
  game.phase = PHASES.END;
  logPush(game, "ゲーム終了 / 結果: DRAW");
}

function finishGameByPending(game, pending) {
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
  game.phase = PHASES.END;
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
    .filter(x =>
      !x.slot.dead &&
      x.slot.role === ROLES.VILLAGER
    );

  if (!villagerCandidates.length) {
    return null;
  }

  const picked = pickRandom(villagerCandidates);
  return picked ? picked.index : null;
}

function resolvePendingGuards(game) {
  for (const p of game.players) {
    p.guardIncomingSlot = null;
  }

  if (!game.pendingGuards.length) return;

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

  game.pendingGuards = [];
  game.roundGuardActors = [];
}

function resolvePendingBites(game) {
  if (!game.pendingBites.length) return;

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
      killSlot(game, targetId, slotIndex, DEATH.BITE);
      logPush(game, `P${actorId + 1} 噛み → P${targetId + 1} S${slotIndex + 1}`);
    }
  }

  game.pendingBites = [];
  game.roundBiteActors = [];
}

// ラウンド解決後にだけ勝敗を見る
function checkDuelResultAfterResolution(game) {
  if (CONFIG.playerCount !== 2) return false;

  const p0 = game.players[0];
  const p1 = game.players[1];
  const s0 = getDuelResultState(game, p0);
  const s1 = getDuelResultState(game, p1);

  // 既に予約があるなら、今回で最終確定
  if (game.duelPendingResult) {
    const pending = game.duelPendingResult;
    const settlePlayer = game.players[pending.settleTurnPlayerId];
    const settleState = getDuelResultState(game, settlePlayer);

    if (settleState === pending.type) {
      finishGameAsDraw(game);
      return true;
    }

    finishGameByPending(game, pending);
    return true;
  }

  // 新規予約
  // 自分と相手のどちらか一方でも WIN/LOSE が出たら予約
  // 両者同時に同種ならその場でDRAW
  if (s0 !== "NONE" && s0 === s1) {
    finishGameAsDraw(game);
    return true;
  }

  if (s0 !== "NONE") {
    game.duelPendingResult = {
      triggerPlayerId: 0,
      opponentId: 1,
      type: s0,
      settleTurnPlayerId: 1,
    };
    logPush(game, `P1 ${s0 === "WIN" ? "勝利条件" : "敗北条件"}成立 / P2 に最終手番`);
    return false;
  }

  if (s1 !== "NONE") {
    game.duelPendingResult = {
      triggerPlayerId: 1,
      opponentId: 0,
      type: s1,
      settleTurnPlayerId: 0,
    };
    logPush(game, `P2 ${s1 === "WIN" ? "勝利条件" : "敗北条件"}成立 / P1 に最終手番`);
    return false;
  }

  return false;
}

function finalizePlayerState(game, player) {
  if (!player.alive) return;

  const state = getDuelResultState(game, player);
  if (state === "NONE") return;

  setFinalPlayerResult(player, state);
  if (state === "WIN") {
    if (!game.winners.includes(player.id)) game.winners.push(player.id);
  }
}

function judgeAfterResolution(game) {
  resolvePendingGuards(game);
  resolvePendingBites(game);

  if (CONFIG.playerCount === 2) {
    if (checkDuelResultAfterResolution(game)) return;
    return;
  }

  for (const player of game.players) {
    if (player.alive) finalizePlayerState(game, player);
  }

  const aliveCount = game.players.filter(p => p.alive).length;
  if (aliveCount === 0) {
    game.over = true;
    game.phase = PHASES.END;
    logPush(
      game,
      `ゲーム終了 / 勝者: ${
        game.winners.length ? game.winners.map(id => `P${id + 1}`).join(", ") : "なし"
      }`
    );
  }
}

function revealPendingReportsForActor(game, actorId) {
  const actor = game.players[actorId];
  if (!actor || !actor.alive) return;

  const targetId = getReserveTargetId(game, actorId);
  if (targetId == null) {
    actor.pendingA = null;
    actor.pendingB = null;
    actor.pendingMedium = null;
    return;
  }

  const targetPlayer = game.players[targetId];
  const trueKind = getTrueLineKind(targetPlayer);
  const fakeKind = getFakeLineKind(targetPlayer);

  const pendingByKind = {
    [PUBLIC_KIND.A]: actor.pendingA,
    [PUBLIC_KIND.B]: actor.pendingB,
  };

  const truePending = pendingByKind[trueKind];
  const fakePending = pendingByKind[fakeKind];

  let trueColor = null;
  const trueLineAlive = isLineAlive(targetPlayer, trueKind);

  if (truePending && trueLineAlive) {
    const tgtPlayer = game.players[truePending.targetId];
    const tgtSlot = tgtPlayer?.slots?.[truePending.slotIndex];
    if (tgtSlot) {
      trueColor = colorFromRole(tgtSlot.role);

      if (trueKind === PUBLIC_KIND.A) tgtSlot.seerA = trueColor;
      else tgtSlot.seerB = trueColor;

      logPush(
        game,
        `P${actorId + 1} ${trueKind === PUBLIC_KIND.A ? "占A" : "占B"}結果 → P${truePending.targetId + 1} S${truePending.slotIndex + 1} = ${trueColor === MARK.BLACK ? "黒" : "白"}`
      );
    }
  }

  if (fakePending && isLineAlive(targetPlayer, fakeKind)) {
    const tgtPlayer = game.players[fakePending.targetId];
    const tgtSlot = tgtPlayer?.slots?.[fakePending.slotIndex];

    if (tgtSlot) {
      let fakeColor = MARK.WHITE;

      if (trueColor !== null) {
        const opponentBlack =
          (fakeKind === PUBLIC_KIND.A && tgtSlot.seerB === MARK.BLACK) ||
          (fakeKind === PUBLIC_KIND.B && tgtSlot.seerA === MARK.BLACK);

        if (opponentBlack) {
          fakeColor = MARK.WHITE;
        } else {
          const same = sameTarget(fakePending, truePending);
          fakeColor = same
            ? (trueColor === MARK.BLACK ? MARK.WHITE : MARK.BLACK)
            : trueColor;
        }
      }

      if (fakeKind === PUBLIC_KIND.A) tgtSlot.seerA = fakeColor;
      else tgtSlot.seerB = fakeColor;

      logPush(
        game,
        `P${actorId + 1} ${fakeKind === PUBLIC_KIND.A ? "占A" : "占B"}結果 → P${fakePending.targetId + 1} S${fakePending.slotIndex + 1} = ${fakeColor === MARK.BLACK ? "黒" : "白"}`
      );
    }
  }

  if (actor.pendingMedium && isLineAlive(targetPlayer, PUBLIC_KIND.MEDIUM)) {
    const tgtPlayer = game.players[actor.pendingMedium.targetId];
    const tgtSlot = tgtPlayer?.slots?.[actor.pendingMedium.slotIndex];
    if (tgtSlot) {
      tgtSlot.medium = actor.pendingMedium.color;
      logPush(
        game,
        `P${actorId + 1} 霊媒結果 → P${actor.pendingMedium.targetId + 1} S${actor.pendingMedium.slotIndex + 1} = ${actor.pendingMedium.color === MARK.BLACK ? "黒" : "白"}`
      );
    }
  }

  actor.pendingA = null;
  actor.pendingB = null;
  actor.pendingMedium = null;
}

function advancePhase(game) {
  if (game.over) return;

  if (game.phase === PHASES.LYNCH) {
    game.phase = PHASES.RESERVE_A;
    return;
  }
  if (game.phase === PHASES.RESERVE_A) {
    game.phase = PHASES.RESERVE_B;
    return;
  }
  if (game.phase === PHASES.RESERVE_B) {
    game.phase = PHASES.GUARD;
    return;
  }
  if (game.phase === PHASES.GUARD) {
    game.phase = PHASES.BITE;
    return;
  }
  if (game.phase === PHASES.BITE) {
    if (allAliveActorsReservedGuard(game) && allAliveActorsReservedBite(game)) {
      judgeAfterResolution(game);
      if (!game.over) nextTurn(game);
    } else {
      const next = nextAliveIndex(game, game.turn, +1);
      if (next == null) {
        judgeAfterResolution(game);
        if (!game.over) nextTurn(game);
      } else {
        game.turn = next;
        game.phase = PHASES.LYNCH;
        revealPendingReportsForActor(game, game.turn);
      }
    }
    return;
  }
}

export function applyLynch(game, actorId, targetId, slotIndex) {
  if (game.over) return;

  const target = game.players[targetId];
  const slot = target?.slots?.[slotIndex];
  if (!target || !slot || slot.dead) return;

  killSlot(game, targetId, slotIndex, DEATH.LYNCH);
  game.lastLynchedSlot = slot;

  game.players[actorId].pendingMedium = {
    targetId,
    slotIndex,
    color: colorFromRole(slot.role),
  };

  logPush(game, `P${actorId + 1} 吊り → P${targetId + 1} S${slotIndex + 1}`);
  advancePhase(game);
}

export function applyReserve(game, actorId, lineKind, targetId, slotIndex) {
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

  advancePhase(game);
}

export function applyGuard(game, actorId, targetId, slotIndex) {
  if (game.over) return;

  const target = game.players[targetId];
  const requested = target?.slots?.[slotIndex];
  if (!target || !requested || requested.dead) return;

  game.pendingGuards.push({ actorId, targetId, slotIndex });
  if (!game.roundGuardActors.includes(actorId)) {
    game.roundGuardActors.push(actorId);
  }

  logPush(game, `P${actorId + 1} 守り予約 → P${targetId + 1} S${slotIndex + 1}`);
  advancePhase(game);
}

export function applyBite(game, actorId, targetId, slotIndex) {
  if (game.over) return;

  const target = game.players[targetId];
  const slot = target?.slots?.[slotIndex];
  if (!target || !slot || slot.dead || slot.role === ROLES.WOLF) return;

  game.pendingBites.push({ actorId, targetId, slotIndex });
  if (!game.roundBiteActors.includes(actorId)) {
    game.roundBiteActors.push(actorId);
  }

  logPush(game, `P${actorId + 1} 噛み予約 → P${targetId + 1} S${slotIndex + 1}`);
  advancePhase(game);
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
    if (reserveTargetId == null) return true;
    const target = game.players[reserveTargetId];
    if (!isLineAlive(target, PUBLIC_KIND.A)) return true;
    return hiddenReserveCandidates(target, actor.seenA).length === 0;
  }

  if (game.phase === PHASES.RESERVE_B) {
    if (reserveTargetId == null) return true;
    const target = game.players[reserveTargetId];
    if (!isLineAlive(target, PUBLIC_KIND.B)) return true;
    return hiddenReserveCandidates(target, actor.seenB).length === 0;
  }

  if (game.phase === PHASES.GUARD) {
    if (guardTargetId == null) return true;

    const target = game.players[guardTargetId];
    const canGuardAny = target.slots.some((slot) => {
      if (slot.dead) return false;
      if (slot.role !== ROLES.GUARD) return true;
      return target.slots.some(s => !s.dead && s.role === ROLES.VILLAGER);
    });

    return !canGuardAny;
  }

  if (game.phase === PHASES.BITE) {
    if (biteTargetId == null) return true;

    const target = game.players[biteTargetId];
    const canBiteAny = target.slots.some(slot => !slot.dead && slot.role !== ROLES.WOLF);

    return !canBiteAny;
  }

  return false;
}

export function doAbsentOk(game) {
  if (!canAbsentOk(game)) return;

  const actorId = game.turn;

  if (game.phase === PHASES.RESERVE_A) {
    logPush(game, `P${actorId + 1} 占A予約 → 対象なしでスキップ`);
    advancePhase(game);
    return;
  }

  if (game.phase === PHASES.RESERVE_B) {
    logPush(game, `P${actorId + 1} 占B予約 → 対象なしでスキップ`);
    advancePhase(game);
    return;
  }

  if (game.phase === PHASES.GUARD) {
    logPush(game, `P${actorId + 1} 守り予約 → 対象なしでスキップ`);
    if (!game.roundGuardActors.includes(actorId)) {
      game.roundGuardActors.push(actorId);
    }
    advancePhase(game);
    return;
  }

  if (game.phase === PHASES.BITE) {
    logPush(game, `P${actorId + 1} 噛み予約 → 対象なしでスキップ`);
    if (!game.roundBiteActors.includes(actorId)) {
      game.roundBiteActors.push(actorId);
    }
    advancePhase(game);
  }
}

export function isHumanTurn(game) {
  if (!CONFIG.autoPlayers) return true;
  if (game.over || game.phase === PHASES.END) return true;

  const human = game.players[CONFIG.humanPlayerId];
  if (!human || !human.alive) return false;

  return game.turn === CONFIG.humanPlayerId;
}

export function cpuDoOneImmediate(game) {
  if (game.over) return;

  const actorId = game.turn;
  const actor = game.players[actorId];
  if (!actor || !actor.alive) return;

  const lynchTargetId = getLynchTargetId(game, actorId);
  const reserveTargetId = getReserveTargetId(game, actorId);
  const guardTargetId = getGuardTargetId(game, actorId);
  const biteTargetId = getBiteTargetId(game, actorId);

  if (game.phase === PHASES.LYNCH) {
    if (lynchTargetId == null) {
      logPush(game, `CPU P${actorId + 1} 吊り → 対象なし`);
      advancePhase(game);
      return;
    }
    const pick = pickCpuLynchTarget(game.players[lynchTargetId]);
    if (pick == null) {
      logPush(game, `CPU P${actorId + 1} 吊り → 対象なし`);
      advancePhase(game);
      return;
    }
    applyLynch(game, actorId, lynchTargetId, pick);
    return;
  }

  if (game.phase === PHASES.RESERVE_A) {
    if (reserveTargetId == null) {
      advancePhase(game);
      return;
    }
    const target = game.players[reserveTargetId];
    if (!isLineAlive(target, PUBLIC_KIND.A)) {
      logPush(game, `CPU P${actorId + 1} 占A予約 → 占A死亡でスキップ`);
      advancePhase(game);
      return;
    }

    const alreadyB = actor.pendingB?.slotIndex ?? null;
    const pick = pickCpuReserveTarget(target, actor.seenA, alreadyB);

    if (pick == null) {
      logPush(game, `CPU P${actorId + 1} 占A予約 → 対象なし`);
      advancePhase(game);
      return;
    }
    applyReserve(game, actorId, PUBLIC_KIND.A, reserveTargetId, pick);
    return;
  }

  if (game.phase === PHASES.RESERVE_B) {
    if (reserveTargetId == null) {
      advancePhase(game);
      return;
    }
    const target = game.players[reserveTargetId];
    if (!isLineAlive(target, PUBLIC_KIND.B)) {
      logPush(game, `CPU P${actorId + 1} 占B予約 → 占B死亡でスキップ`);
      advancePhase(game);
      return;
    }

    const alreadyA = actor.pendingA?.slotIndex ?? null;
    const pick = pickCpuReserveTarget(target, actor.seenB, alreadyA);

    if (pick == null) {
      logPush(game, `CPU P${actorId + 1} 占B予約 → 対象なし`);
      advancePhase(game);
      return;
    }
    applyReserve(game, actorId, PUBLIC_KIND.B, reserveTargetId, pick);
    return;
  }

  if (game.phase === PHASES.GUARD) {
    if (guardTargetId == null) {
      logPush(game, `CPU P${actorId + 1} 守り予約 → 対象なし`);
      if (!game.roundGuardActors.includes(actorId)) {
        game.roundGuardActors.push(actorId);
      }
      advancePhase(game);
      return;
    }

    const target = game.players[guardTargetId];
    const pick = pickCpuGuardTarget(target, game);

    if (pick == null) {
      logPush(game, `CPU P${actorId + 1} 守り予約 → 対象なし`);
      if (!game.roundGuardActors.includes(actorId)) {
        game.roundGuardActors.push(actorId);
      }
      advancePhase(game);
      return;
    }

    applyGuard(game, actorId, guardTargetId, pick);
    return;
  }

  if (game.phase === PHASES.BITE) {
    if (biteTargetId == null) {
      logPush(game, `CPU P${actorId + 1} 噛み予約 → 対象なし`);
      if (!game.roundBiteActors.includes(actorId)) {
        game.roundBiteActors.push(actorId);
      }
      advancePhase(game);
      return;
    }

    const pick = pickCpuBiteTarget(game.players[biteTargetId], game);
    if (pick == null) {
      logPush(game, `CPU P${actorId + 1} 噛み予約 → 対象なし`);
      if (!game.roundBiteActors.includes(actorId)) {
        game.roundBiteActors.push(actorId);
      }
      advancePhase(game);
      return;
    }

    applyBite(game, actorId, biteTargetId, pick);
    return;
  }
}

export function runAutoUntilHumanTurn(game) {
  if (!CONFIG.autoPlayers) return;

  let steps = 0;
  while (!game.over && game.phase !== PHASES.END && !isHumanTurn(game)) {
    steps += 1;
    if (steps > CONFIG.autoSafetySteps) {
      logPush(game, "自動停止: safetySteps超過");
      break;
    }
    cpuDoOneImmediate(game);
  }
}

export function applyHumanPick(game, viewAsId, playerId, slotIndex) {
  if (game.over) return;
  if (game.turn !== CONFIG.humanPlayerId) return;

  const actorId = game.turn;
  const actor = game.players[actorId];
  if (!actor || !actor.alive) return;

  const lynchTargetId = getLynchTargetId(game, actorId);
  const reserveTargetId = getReserveTargetId(game, actorId);
  const guardTargetId = getGuardTargetId(game, actorId);
  const biteTargetId = getBiteTargetId(game, actorId);

  if (game.phase === PHASES.LYNCH) {
    if (lynchTargetId == null || playerId !== lynchTargetId) return;
    applyLynch(game, actorId, playerId, slotIndex);
    return;
  }

  if (game.phase === PHASES.RESERVE_A) {
    if (reserveTargetId == null || playerId !== reserveTargetId) return;
    applyReserve(game, actorId, PUBLIC_KIND.A, playerId, slotIndex);
    return;
  }

  if (game.phase === PHASES.RESERVE_B) {
    if (reserveTargetId == null || playerId !== reserveTargetId) return;
    applyReserve(game, actorId, PUBLIC_KIND.B, playerId, slotIndex);
    return;
  }

  if (game.phase === PHASES.GUARD) {
    if (guardTargetId == null || playerId !== guardTargetId) return;
    applyGuard(game, actorId, playerId, slotIndex);
    return;
  }

  if (game.phase === PHASES.BITE) {
    if (biteTargetId == null || playerId !== biteTargetId) return;
    applyBite(game, actorId, playerId, slotIndex);
  }
}

export function phaseLabel(phase) {
  if (phase === PHASES.LYNCH) return "吊り";
  if (phase === PHASES.RESERVE_A) return "占A予約";
  if (phase === PHASES.RESERVE_B) return "占B予約";
  if (phase === PHASES.GUARD) return "守り予約";
  if (phase === PHASES.BITE) return "噛み予約";
  if (phase === PHASES.END) return "終了";
  return "";
}
