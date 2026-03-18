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

    slots: [...makePublicSlots(), ...makeHiddenSlots()],

    seenA: makeEmptySeenMap(),
    seenB: makeEmptySeenMap(),

    pendingA: null,
    pendingB: null,
    pendingMedium: null,

    guardIncomingSlot: null,

    lastGuardTargetId: null,
    lastGuardSlot: null,
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

    pendingBites: [],
    roundBiteActors: [],
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

export function getGuardTargetId(game, actorId) {
  if (game.mode === MODES.VILLAGER) return actorId;
  return rightPlayerIndex(game, actorId);
}

export function getBiteTargetId(game, actorId) {
  if (game.mode === MODES.VILLAGER) return rightPlayerIndex(game, actorId);
  return actorId;
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

  // 新しいラウンド開始
  if (game.mode === MODES.VILLAGER) {
    game.pendingBites = [];
    game.roundBiteActors = [];
  }
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

function finalizePlayerState(game, player) {
  if (!player.alive) return;

  const wolves = countAliveWolves(player);
  const nonWolves = countAliveNonWolves(player);

  if (game.mode === MODES.WOLF) {
    if (wolves >= nonWolves && player.slots.some(s => !s.dead)) {
      player.alive = false;
      player.escaped = true;
      clearOnFinish(player);
      if (!game.winners.includes(player.id)) game.winners.push(player.id);
      logPush(game, `P${player.id + 1} 勝ち抜け`);
      return;
    }

    if (wolves === 0) {
      player.alive = false;
      player.escaped = false;
      clearOnFinish(player);
      logPush(game, `P${player.id + 1} リタイア`);
    }
    return;
  }

  if (wolves === 0) {
    player.alive = false;
    player.escaped = true;
    clearOnFinish(player);
    if (!game.winners.includes(player.id)) game.winners.push(player.id);
    logPush(game, `P${player.id + 1} 勝利`);
    return;
  }

  if (wolves >= nonWolves && player.slots.some(s => !s.dead)) {
    player.alive = false;
    player.escaped = false;
    clearOnFinish(player);
    logPush(game, `P${player.id + 1} 敗北`);
  }
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

function judgeAfterGuard(game) {
  resolvePendingBites(game);

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

    // 真占いが生きているときだけ真色を有効にする
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

  // 偽占い
  if (fakePending && isLineAlive(targetPlayer, fakeKind)) {
    const tgtPlayer = game.players[fakePending.targetId];
    const tgtSlot = tgtPlayer?.slots?.[fakePending.slotIndex];

    if (tgtSlot) {
      let fakeColor = MARK.WHITE;

      // 真占いが生きているときだけ、真結果依存ロジックを使う
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

  if (fakePending && trueColor !== null && isLineAlive(targetPlayer, fakeKind)) {
    const tgtPlayer = game.players[fakePending.targetId];
    const tgtSlot = tgtPlayer?.slots?.[fakePending.slotIndex];

    if (tgtSlot) {
      const opponentBlack =
        (fakeKind === PUBLIC_KIND.A && tgtSlot.seerB === MARK.BLACK) ||
        (fakeKind === PUBLIC_KIND.B && tgtSlot.seerA === MARK.BLACK);

      let fakeColor;
      if (opponentBlack) {
        fakeColor = MARK.WHITE;
      } else {
        const same = sameTarget(fakePending, truePending);
        fakeColor = same
          ? (trueColor === MARK.BLACK ? MARK.WHITE : MARK.BLACK)
          : trueColor;
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

  if (game.mode === MODES.WOLF) {
    if (game.phase === PHASES.RESERVE_B) {
      game.phase = PHASES.BITE;
      return;
    }
    if (game.phase === PHASES.BITE) {
      game.phase = PHASES.GUARD;
      return;
    }
    if (game.phase === PHASES.GUARD) {
      judgeAfterGuard(game);
      if (!game.over) nextTurn(game);
      return;
    }
  } else {
    if (game.phase === PHASES.RESERVE_B) {
      game.phase = PHASES.GUARD;
      return;
    }
    if (game.phase === PHASES.GUARD) {
      game.phase = PHASES.BITE;
      return;
    }
    if (game.phase === PHASES.BITE) {
      // 村人モードは全員が噛み予約するまで次の人へ
      if (allAliveActorsReservedBite(game)) {
        judgeAfterGuard(game);
        if (!game.over) nextTurn(game);
      } else {
        const next = nextAliveIndex(game, game.turn, +1);
        if (next == null) {
          judgeAfterGuard(game);
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
}

function judgeSoloVillagerAfterLynch(game, actorId) {
  if (game.mode !== MODES.VILLAGER) return false;

  const alivePlayers = game.players.filter(p => p.alive);
  if (alivePlayers.length !== 1) return false;
  if (alivePlayers[0].id !== actorId) return false;

  const player = game.players[actorId];
  const wolves = countAliveWolves(player);

  // ラスト1人の村人モードは、吊り後に狼が0でなければ続行不能なので終了
  player.alive = false;
  clearOnFinish(player);

  if (wolves === 0) {
    player.escaped = true;
    if (!game.winners.includes(player.id)) {
      game.winners.push(player.id);
    }
    logPush(game, `P${player.id + 1} 勝利`);
  } else {
    player.escaped = false;
    logPush(game, `P${player.id + 1} 敗北`);
  }

  game.over = true;
  game.phase = PHASES.END;
  logPush(
    game,
    `ゲーム終了 / 勝者: ${
      game.winners.length ? game.winners.map(id => `P${id + 1}`).join(", ") : "なし"
    }`
  );

  return true;
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

  // 村人モードで最後の1人なら、吊り直後に勝敗確認
  if (judgeSoloVillagerAfterLynch(game, actorId)) {
    return;
  }

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

export function applyGuard(game, actorId, targetId, slotIndex) {
  if (game.over) return;

  const actor = game.players[actorId];
  const target = game.players[targetId];
  const slot = target?.slots?.[slotIndex];
  if (!target || !slot || slot.dead) return;

  target.guardIncomingSlot = slotIndex;
  actor.lastGuardTargetId = targetId;
  actor.lastGuardSlot = slotIndex;

  logPush(game, `P${actorId + 1} 守り設定 → P${targetId + 1} S${slotIndex + 1}`);
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
    const forbidden = actor.lastGuardTargetId === guardTargetId ? actor.lastGuardSlot : null;
    const cands = target.slots
      .map((slot, index) => ({ slot, index }))
      .filter(x => !x.slot.dead && x.index !== forbidden);
    return cands.length === 0;
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
    logPush(game, `P${actorId + 1} 守り設定 → 対象なしでスキップ`);
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

  if (game.phase === PHASES.BITE) {
    if (biteTargetId == null) {
      logPush(game, `CPU P${actorId + 1} 噛み → 対象なし`);
      advancePhase(game);
      return;
    }

    const pick = pickCpuBiteTarget(game.players[biteTargetId], game);
    if (pick == null) {
      logPush(game, `CPU P${actorId + 1} 噛み → 対象なし`);
      advancePhase(game);
      return;
    }
    applyBite(game, actorId, biteTargetId, pick);
    return;
  }

  if (game.phase === PHASES.GUARD) {
    if (guardTargetId == null) {
      advancePhase(game);
      return;
    }

    const forbidden = actor.lastGuardTargetId === guardTargetId ? actor.lastGuardSlot : null;
    const target = game.players[guardTargetId];

    let pick = pickCpuGuardTarget(target, game);

    if (pick != null && pick === forbidden) {
      const candidates = target.slots
        .map((slot, index) => ({ slot, index }))
        .filter(x => !x.slot.dead && x.index !== forbidden);

      pick = candidates.length
        ? candidates[Math.floor(Math.random() * candidates.length)].index
        : null;
    }

    if (pick == null) {
      logPush(game, `CPU P${actorId + 1} 守り設定 → 対象なし`);
      advancePhase(game);
      return;
    }

    applyGuard(game, actorId, guardTargetId, pick);
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

  if (game.phase === PHASES.BITE) {
    if (biteTargetId == null || playerId !== biteTargetId) return;
    applyBite(game, actorId, playerId, slotIndex);
    return;
  }

  if (game.phase === PHASES.GUARD) {
    if (guardTargetId == null || playerId !== guardTargetId) return;
    applyGuard(game, actorId, playerId, slotIndex);
  }
}

export function phaseLabel(phase) {
  if (phase === PHASES.LYNCH) return "吊り";
  if (phase === PHASES.RESERVE_A) return "占A予約";
  if (phase === PHASES.RESERVE_B) return "占B予約";
  if (phase === PHASES.BITE) return "噛み";
  if (phase === PHASES.GUARD) return "守り設定";
  if (phase === PHASES.END) return "終了";
  return "";
}
