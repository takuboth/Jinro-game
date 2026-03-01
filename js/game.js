import { CONFIG, ROLES, PHASES, MARK } from "./config.js";
import {
  shuffle, nowStamp,
  getAliveSlotIndices, getGuardableSlotIndices,
  getMark, isRecentBiteFail, isPublicSeerSlot,
  pickRandom, pickByMarkPriority, pickByMarkPriorityWithTieBonus,
  cpuPickMadInvertIndexByWolfStock, cpuPickGuardIndex,
} from "./utils.js";

export function makeNewGame(fixedDeal = null) {
  const deck = [
    ROLES.WOLF, ROLES.WOLF,
    ROLES.MAD,
    ROLES.SEER,
    ROLES.GUARD,
    ROLES.MEDIUM,
    ROLES.VILLAGER, ROLES.VILLAGER, ROLES.VILLAGER
  ];

  const players = [];
  for (let p = 0; p < 4; p++) {
    const roles = fixedDeal ? fixedDeal[p].slice() : shuffle(deck);
    const slots = roles.map(r => ({
      role: r,
      dead: false,

      // 全体公開：最新占い結果（白/黒）
      publicSeer: { last: null, changedLast: false, byActorId: null },

      // 噛み不発タグ（非公開）
      biteFailCount: 0,
      biteFailTurn: null,
    }));

    players.push({
      id: p,
      alive: true,
      slots,

      invertIndex: null,
      madUsed: false,

      guardIndex: null,

      mediumWolfSnapshot: null,
    });
  }

  return {
    players,
    phase: PHASES.ROUND0_MAD,
    turn: 0,
    winners: [],
    over: false,
    log: [],

    // ★占：黒を出した占いの位置（playerId -> slotIndex or null）
    publicSeerReveal: [null, null, null, null],

    // 噛み回数（非公開）
    biteNo: 0,
  };
}

/* ============
   ログ
============ */
export function logPush(game, text) {
  game.log.push(`[${nowStamp()}] ${text}`);
}

/* ============
   便利（ゲーム依存）
============ */
export function countRoleRemaining(pl, role) {
  return pl.slots.reduce((acc, s) => acc + ((!s.dead && s.role === role) ? 1 : 0), 0);
}
export function hasRoleAlive(pl, role) { return countRoleRemaining(pl, role) > 0; }
export function wolfCount(pl) { return countRoleRemaining(pl, ROLES.WOLF); }
export function villageRolesTotal(pl) {
  return countRoleRemaining(pl, ROLES.SEER) + countRoleRemaining(pl, ROLES.GUARD) + countRoleRemaining(pl, ROLES.MEDIUM);
}
export function findRoleIndex(pl, role) {
  for (let i = 0; i < pl.slots.length; i++) if (pl.slots[i].role === role) return i;
  return null;
}
function nextAliveIndex(game, from, dir) {
  const n = game.players.length;
  for (let step = 1; step <= n; step++) {
    const idx = (from + dir * step + n) % n;
    if (game.players[idx].alive) return idx;
  }
  return null;
}
export function leftPlayerIndex(game, actorId) { return nextAliveIndex(game, actorId, -1); }
export function rightPlayerIndex(game, actorId) { return nextAliveIndex(game, actorId, +1); }

/* ============
   ルール処理
============ */
export function killSlot(game, playerId, slotIndex) {
  const pl = game.players[playerId];
  if (!pl.alive) return;
  const slot = pl.slots[slotIndex];
  if (slot.dead) return;

  slot.dead = true;

  if (pl.invertIndex === slotIndex) {
    pl.invertIndex = null;
    logPush(game, `P${playerId + 1} 反転対象がDEAD → 反転解除`);
  }

  if (slot.role === ROLES.MAD) {
    pl.invertIndex = null;
    logPush(game, `P${playerId + 1} 狂人カードがDEAD → 能力消滅`);
  }

  if (slot.role === ROLES.MEDIUM) {
    if (pl.mediumWolfSnapshot === null) {
      pl.mediumWolfSnapshot = game.players.map(x => wolfCount(x));
      logPush(game, `P${playerId + 1} 霊媒カードがDEAD → 霊媒表示は固定化`);
    }
  }

  if (slot.role === ROLES.GUARD) {
    pl.guardIndex = null;
    logPush(game, `P${playerId + 1} 狩人カードがDEAD → 守り無効`);
  }
}

function retireIfWolfZero(game) {
  for (const pl of game.players) {
    if (pl.alive && wolfCount(pl) === 0) {
      pl.alive = false;

      for (const s of pl.slots) s.dead = true;

      pl.invertIndex = null;
      pl.guardIndex = null;

      logPush(game, `P${pl.id + 1} 人狼0 → 即リタイヤ（全スロットDEAD表示）`);

      if (pl.mediumWolfSnapshot === null && findRoleIndex(pl, ROLES.MEDIUM) !== null) {
        pl.mediumWolfSnapshot = game.players.map(x => wolfCount(x));
      }
    }
  }
}

function checkWinnersAndEndIfAny(game) {
  const alive = game.players.filter(p => p.alive);
  if (alive.length === 0) return;

  const winners = [];
  for (const pl of alive) {
    const othersAllRetired = game.players.every(x => x.id === pl.id ? true : !x.alive);
    if (othersAllRetired && wolfCount(pl) >= 1) winners.push(pl.id);
  }

  if (winners.length) {
    game.winners = winners;
    game.over = true;
    game.phase = PHASES.END;
    logPush(game, `勝利確定 → 勝者: ${winners.map(id => `P${id + 1}`).join(", ")}`);
  }
}

function updateAfterKill(game) {
  retireIfWolfZero(game);
  checkWinnersAndEndIfAny(game);
}

export function advanceRound0(game) {
  if (game.over) return;

  if (game.phase === PHASES.ROUND0_MAD) {
    game.phase = PHASES.ROUND0_GUARD;
    return;
  }

  if (game.phase === PHASES.ROUND0_GUARD) {
    if (game.turn < 3) {
      game.turn += 1;
      game.phase = PHASES.ROUND0_MAD;
    } else {
      game.turn = 0;
      game.phase = PHASES.SEER;
      logPush(game, "Round0終了 → 通常ターン開始");
    }
  }
}

export function advancePhase(game) {
  if (game.over) return;
  if (game.phase === PHASES.ROUND0_MAD || game.phase === PHASES.ROUND0_GUARD) return;

  const order = [PHASES.SEER, PHASES.LYNCH, PHASES.MAD, PHASES.GUARD, PHASES.BITE];
  const idx = order.indexOf(game.phase);
  if (idx === -1) return;

  if (idx < order.length - 1) {
    game.phase = order[idx + 1];
  } else {
    const next = nextAliveIndex(game, game.turn, +1);
    game.turn = (next === null) ? game.turn : next;
    game.phase = PHASES.SEER;
  }
}

/* ============
   各フェーズ解決
============ */
export function resolveSeer(game, actorId, targetId, slotIndex) {
  const actor = game.players[actorId];

  if (targetId === null) {
    logPush(game, `P${actorId + 1} 占い → 対象なし（生存者1人）なのでスキップ`);
    advancePhase(game);
    return;
  }
  const target = game.players[targetId];

  if (!hasRoleAlive(actor, ROLES.SEER)) {
    logPush(game, `P${actorId + 1} 占い不在 → OK（スキップ）`);
    advancePhase(game);
    return;
  }

  const slot = target.slots[slotIndex];
  if (slot.dead) {
    logPush(game, `P${actorId + 1} 占い: 対象がDEADで無効`);
    return;
  }

  let isBlack = (slot.role === ROLES.WOLF);
  let wasInverted = false;

  if (!target.madUsed && hasRoleAlive(target, ROLES.MAD) && target.invertIndex === slotIndex) {
    isBlack = !isBlack;
    wasInverted = true;
    target.madUsed = true;
    logPush(game, `P${targetId + 1} 狂人反転が発動（1回きり）→ 以後は選択不可`);
  }

  const res = isBlack ? "黒" : "白";
  const prev = slot.publicSeer.last;
  const changedLast = (prev !== null && prev !== res);

  slot.publicSeer = { last: res, changedLast, byActorId: actorId };

  // ★占公開：黒が出たら占いの位置を公開（反転黒でも同様）
  if (res === "黒") {
    game.publicSeerReveal[actorId] = findRoleIndex(actor, ROLES.SEER);
  }

  logPush(game, `P${actorId + 1} 占い → P${targetId + 1} S${slotIndex + 1} = ${res}${changedLast ? "（変化）" : ""}${wasInverted ? "（反転結果）" : ""}`);

  advancePhase(game);
}

export function resolveLynch(game, actorId, targetId, slotIndex) {
  if (targetId === null) {
    logPush(game, `P${actorId + 1} 吊り → 対象なし（生存者1人）なのでスキップ`);
    advancePhase(game);
    return;
  }
  const target = game.players[targetId];
  if (target.slots[slotIndex].dead) return;

  killSlot(game, targetId, slotIndex);
  logPush(game, `P${actorId + 1} 吊り → P${targetId + 1} S${slotIndex + 1}（カード種別は非公開／対象スロットはDEAD）`);

  updateAfterKill(game);
  if (!game.over) advancePhase(game);
}

export function resolveMadPick(game, actorId, slotIndex) {
  const pl = game.players[actorId];

  if (!hasRoleAlive(pl, ROLES.MAD)) {
    pl.invertIndex = null;
    const label = (game.phase === PHASES.ROUND0_MAD) ? "Round0 狂人" : "狂人";
    logPush(game, `P${actorId + 1} ${label}不在 → OK（スキップ）`);
    if (game.phase === PHASES.ROUND0_MAD) advanceRound0(game); else advancePhase(game);
    return;
  }

  if (pl.madUsed) {
    const label = (game.phase === PHASES.ROUND0_MAD) ? "Round0 狂人" : "狂人設定";
    logPush(game, `P${actorId + 1} ${label} → 発動済み（1回きり）のためスキップのみ`);
    if (game.phase === PHASES.ROUND0_MAD) advanceRound0(game); else advancePhase(game);
    return;
  }

  if (pl.slots[slotIndex].dead) {
    logPush(game, `P${actorId + 1} 狂人 → DEADは選べない`);
    return;
  }

  pl.invertIndex = slotIndex;
  const label = (game.phase === PHASES.ROUND0_MAD) ? "Round0 狂人" : "狂人設定";
  logPush(game, `P${actorId + 1} ${label} → 反転対象設定（非公開）`);

  if (game.phase === PHASES.ROUND0_MAD) advanceRound0(game); else advancePhase(game);
}

export function resolveGuard(game, actorId, slotIndex) {
  const pl = game.players[actorId];

  if (!hasRoleAlive(pl, ROLES.GUARD)) {
    pl.guardIndex = null;
    const label = (game.phase === PHASES.ROUND0_GUARD) ? "Round0 狩人" : "狩人";
    logPush(game, `P${actorId + 1} ${label}不在 → OK（スキップ）`);
    if (game.phase === PHASES.ROUND0_GUARD) advanceRound0(game); else advancePhase(game);
    return;
  }

  const slot = pl.slots[slotIndex];
  if (slot.dead) {
    logPush(game, `P${actorId + 1} 狩人設定 → DEADは選べない`);
    return;
  }
  if (slot.role === ROLES.GUARD || slot.role === ROLES.WOLF) {
    logPush(game, `P${actorId + 1} 狩人設定 → 守れないカード（狩人/人狼）`);
    return;
  }

  pl.guardIndex = slotIndex;

  if (game.phase === PHASES.ROUND0_GUARD) {
    logPush(game, `P${actorId + 1} Round0 狩人守り → 設定完了（非公開）`);
    advanceRound0(game);
    return;
  }

  logPush(game, `P${actorId + 1} 狩人守り設定 → 設定完了（非公開）`);
  advancePhase(game);
}

export function resolveBite(game, actorId, targetId, slotIndex) {
  if (targetId === null) {
    logPush(game, `P${actorId + 1} 噛み → 対象なし（生存者1人）なのでスキップ`);
    advancePhase(game);
    return;
  }

  const target = game.players[targetId];
  const slot = target.slots[slotIndex];
  if (slot.dead) return;

  const isWolf = (slot.role === ROLES.WOLF);
  const isGuarded = (target.guardIndex === slotIndex);

  game.biteNo += 1;

  if (isWolf || isGuarded) {
    slot.biteFailCount += 1;
    slot.biteFailTurn = game.biteNo;
    logPush(game, `P${actorId + 1} 噛み → P${targetId + 1} S${slotIndex + 1}（不発：理由は非公開）`);
  } else {
    killSlot(game, targetId, slotIndex);
    logPush(game, `P${actorId + 1} 噛み → P${targetId + 1} S${slotIndex + 1}（DEAD：理由は非公開）`);
    updateAfterKill(game);
  }

  if (!game.over) advancePhase(game);
}

/* ============
   不在→OK（役職が“いない”時だけ）
============ */
export function canAbsentOk(game) {
  if (game.over) return false;
  if (game.turn !== CONFIG.humanPlayerId) return false;

  const actor = game.players[game.turn];

  if (game.phase === PHASES.SEER) return !hasRoleAlive(actor, ROLES.SEER);
  if (game.phase === PHASES.MAD) return !hasRoleAlive(actor, ROLES.MAD);
  if (game.phase === PHASES.GUARD) return !hasRoleAlive(actor, ROLES.GUARD);

  if (game.phase === PHASES.ROUND0_MAD) return !hasRoleAlive(actor, ROLES.MAD);
  if (game.phase === PHASES.ROUND0_GUARD) return !hasRoleAlive(actor, ROLES.GUARD);

  return false;
}
export function doAbsentOk(game) {
  if (!canAbsentOk(game)) return;

  const actorId = game.turn;

  if (game.phase === PHASES.SEER) { logPush(game, `P${actorId + 1} 占い不在 → OK（スキップ）`); advancePhase(game); return; }
  if (game.phase === PHASES.MAD)  { logPush(game, `P${actorId + 1} 狂人不在 → OK（スキップ）`); advancePhase(game); return; }
  if (game.phase === PHASES.GUARD){ logPush(game, `P${actorId + 1} 狩人不在 → OK（スキップ）`); advancePhase(game); return; }

  if (game.phase === PHASES.ROUND0_MAD)   { logPush(game, `P${actorId + 1} Round0 狂人不在 → OK（スキップ）`); advanceRound0(game); return; }
  if (game.phase === PHASES.ROUND0_GUARD) { logPush(game, `P${actorId + 1} Round0 狩人不在 → OK（スキップ）`); advanceRound0(game); return; }
}

/* ============
   CPU 1手（即時）
============ */
export function cpuDoOneImmediate(game) {
  if (game.over) return;

  const actorId = game.turn;
  const actor = game.players[actorId];

  // Round0 狂人
  if (game.phase === PHASES.ROUND0_MAD) {
    if (!hasRoleAlive(actor, ROLES.MAD)) {
      logPush(game, `CPU: P${actorId + 1} Round0 狂人不在 → OK（スキップ）`);
      advanceRound0(game);
      return;
    }
    if (actor.madUsed) {
      logPush(game, `CPU: P${actorId + 1} Round0 狂人 → 発動済み（1回きり）のためスキップ`);
      advanceRound0(game);
      return;
    }
    const idx = cpuPickMadInvertIndexByWolfStock(actor);
    if (idx === null) {
      logPush(game, `CPU: P${actorId + 1} Round0 狂人 → 対象なし（進行のみ）`);
      advanceRound0(game);
      return;
    }
    logPush(game, `CPU: P${actorId + 1} Round0 狂人 → 反転対象を選択（非公開）`);
    resolveMadPick(game, actorId, idx);
    return;
  }

  // Round0 狩人
  if (game.phase === PHASES.ROUND0_GUARD) {
    if (!hasRoleAlive(actor, ROLES.GUARD)) {
      logPush(game, `CPU: P${actorId + 1} Round0 狩人不在 → OK（スキップ）`);
      advanceRound0(game);
      return;
    }
    const pick = cpuPickGuardIndex(game, actor);
    if (pick === null) {
      const cand = getGuardableSlotIndices(actor);
      const pick2 = cand.length ? pickRandom(cand) : null;
      if (pick2 === null) {
        logPush(game, `CPU: P${actorId + 1} Round0 狩人守り → 守れるスロットなし（進行のみ）`);
        advanceRound0(game);
        return;
      }
      logPush(game, `CPU: P${actorId + 1} Round0 狩人守り → フォールバック選択`);
      resolveGuard(game, actorId, pick2);
      return;
    }
    logPush(game, `CPU: P${actorId + 1} Round0 狩人守り → 優先順位で選択`);
    resolveGuard(game, actorId, pick);
    return;
  }

  // 占い（左対象 / GRAY>WHITE>BLACK）
  if (game.phase === PHASES.SEER) {
    if (!hasRoleAlive(actor, ROLES.SEER)) {
      logPush(game, `CPU: P${actorId + 1} 占い不在 → OK（スキップ）`);
      advancePhase(game);
      return;
    }
    const left = leftPlayerIndex(game, actorId);
    if (left === null) {
      logPush(game, `CPU: P${actorId + 1} 占い → 対象なし（生存者1人）なのでスキップ`);
      advancePhase(game);
      return;
    }
    const tgt = game.players[left];
    const cand = getAliveSlotIndices(tgt).map(i => ({ slotIndex: i, slot: tgt.slots[i] }));
    const pick = pickByMarkPriority(cand, [MARK.GRAY, MARK.WHITE, MARK.BLACK]);
    logPush(game, `CPU: P${actorId + 1} 占い → 左の優先順位で選択（全体公開）`);
    resolveSeer(game, actorId, left, pick.slotIndex);
    return;
  }

  // 吊り（左）：黒 > グレー > 白 > 公開占い（★占は最後）
  if (game.phase === PHASES.LYNCH) {
    const left = leftPlayerIndex(game, actorId);
    if (left === null) {
      logPush(game, `CPU: P${actorId + 1} 吊り → 対象なし（生存者1人）なのでスキップ`);
      advancePhase(game);
      return;
    }
    const tgt = game.players[left];

    const candAll = getAliveSlotIndices(tgt).map(i => ({ slotIndex: i, slot: tgt.slots[i] }));
    const candNonPublic = candAll.filter(x => !isPublicSeerSlot(game, left, x.slotIndex));
    const candPublic    = candAll.filter(x =>  isPublicSeerSlot(game, left, x.slotIndex));

    let pick = null;

    if (candNonPublic.length) {
      pick = pickByMarkPriorityWithTieBonus(
        candNonPublic,
        [MARK.BLACK, MARK.GRAY, MARK.WHITE],
        (x) => ((x.slot.biteFailCount || 0) > 0 ? 0.5 : 0)
      );
    } else if (candPublic.length) {
      pick = pickRandom(candPublic);
    } else {
      pick = pickRandom(candAll);
    }

    logPush(game, `CPU: P${actorId + 1} 吊り → 左の優先順位で選択`);
    resolveLynch(game, actorId, left, pick.slotIndex);
    return;
  }

  // 狂人（毎ターン選択、ただし発動済みならスキップのみ）
  if (game.phase === PHASES.MAD) {
    if (!hasRoleAlive(actor, ROLES.MAD)) {
      logPush(game, `CPU: P${actorId + 1} 狂人不在 → OK（スキップ）`);
      advancePhase(game);
      return;
    }
    if (actor.madUsed) {
      logPush(game, `CPU: P${actorId + 1} 狂人設定 → 発動済み（1回きり）のためスキップ`);
      advancePhase(game);
      return;
    }
    const idx = cpuPickMadInvertIndexByWolfStock(actor);
    if (idx === null) {
      logPush(game, `CPU: P${actorId + 1} 狂人設定 → 対象なし（進行のみ）`);
      advancePhase(game);
      return;
    }
    logPush(game, `CPU: P${actorId + 1} 狂人設定 → 反転対象を選択（非公開）`);
    resolveMadPick(game, actorId, idx);
    return;
  }

  // 狩人（毎ターン選択）
  if (game.phase === PHASES.GUARD) {
    if (!hasRoleAlive(actor, ROLES.GUARD)) {
      logPush(game, `CPU: P${actorId + 1} 狩人不在 → OK（スキップ）`);
      advancePhase(game);
      return;
    }
    const pick = cpuPickGuardIndex(game, actor);
    if (pick === null) {
      const cand = getGuardableSlotIndices(actor);
      const pick2 = cand.length ? pickRandom(cand) : null;
      if (pick2 === null) {
        logPush(game, `CPU: P${actorId + 1} 狩人守り → 守れるスロットなし（進行のみ）`);
        advancePhase(game);
        return;
      }
      logPush(game, `CPU: P${actorId + 1} 狩人守り → フォールバック選択`);
      resolveGuard(game, actorId, pick2);
      return;
    }

    logPush(game, `CPU: P${actorId + 1} 狩人守り → 優先順位で選択`);
    resolveGuard(game, actorId, pick);
    return;
  }

  // 噛み（右）
  if (game.phase === PHASES.BITE) {
    const right = rightPlayerIndex(game, actorId);
    if (right === null) {
      logPush(game, `CPU: P${actorId + 1} 噛み → 対象なし（生存者1人）なのでスキップ`);
      advancePhase(game);
      return;
    }

    const tgt = game.players[right];

    const candAll = getAliveSlotIndices(tgt).map(i => ({
      slotIndex: i,
      slot: tgt.slots[i],
      mark: getMark(tgt.slots[i]),
      biteFail: isRecentBiteFail(tgt.slots[i], game.biteNo + 1, 2)
    }));

    const candPublic = candAll.filter(x => isPublicSeerSlot(game, right, x.slotIndex));

    const actorVillageRoles = villageRolesTotal(actor);
    const actorOnlySeer =
      (actorVillageRoles === 1) &&
      hasRoleAlive(actor, ROLES.SEER) &&
      !hasRoleAlive(actor, ROLES.GUARD) &&
      !hasRoleAlive(actor, ROLES.MEDIUM);

    const anyPublicSeerExists = game.publicSeerReveal.some(v => typeof v === "number");

    // ★ 特例：公開占いが存在 && 占いしか残っていない → 公開占い最優先
    if (anyPublicSeerExists && actorOnlySeer && candPublic.length) {
      const pick = pickRandom(candPublic);
      logPush(game, `CPU: P${actorId + 1} 噛み → 特例：公開占いを最優先`);
      resolveBite(game, actorId, right, pick.slotIndex);
      return;
    }

    // 通常優先順位（最新版）
    // 白 > グレー = 噛めなかった白 > 黒
    function biteScore(c) {
      if (c.mark === MARK.WHITE && !c.biteFail) return 100;
      if (c.mark === MARK.GRAY) return 80;
      if (c.mark === MARK.WHITE && c.biteFail) return 80;
      if (c.mark === MARK.BLACK) return 50;
      return 0;
    }

    let best = candAll[0];
    let bestScore = -1;

    for (const c of candAll) {
      const score = biteScore(c) + Math.random() * 0.01;
      if (score > bestScore) { bestScore = score; best = c; }
    }

    logPush(game, `CPU: P${actorId + 1} 噛み → 通常優先で選択`);
    resolveBite(game, actorId, right, best.slotIndex);
    return;
  }
}

/* ============
   自動進行（同期）
============ */
export function isHumanTurn(game) {
  if (!CONFIG.autoPlayers) return true;
  if (game.over || game.phase === PHASES.END) return true;

  // 人間がリタイヤしたら人間ターン扱いにしない
  const human = game.players[CONFIG.humanPlayerId];
  if (!human.alive) return false;

  return game.turn === CONFIG.humanPlayerId;
}

export function runAutoUntilHumanTurn(game) {
  if (!CONFIG.autoPlayers) return;

  let steps = 0;
  while (!game.over && game.phase !== PHASES.END && !isHumanTurn(game)) {
    steps += 1;
    if (steps > CONFIG.autoSafetySteps) {
      logPush(game, `自動停止: safetySteps超過（無限ループ防止）`);
      break;
    }
    cpuDoOneImmediate(game);
  }
}

/* ============
   人間の入力（現在フェーズに応じて呼ぶ）
============ */
export function applyHumanPick(game, viewAsId, playerId, slotIndex) {
  if (game.over) return;
  if (game.turn !== CONFIG.humanPlayerId) return;

  const actorId = game.turn;
  const actor = game.players[actorId];

  // 人間がリタイヤ済みなら操作させない（CPUとして流す）
  if (!actor.alive) return;

  // フェーズごとの「正しい対象プレイヤー」を強制
  const left = leftPlayerIndex(game, actorId);
  const right = rightPlayerIndex(game, actorId);

  // --- クリックで進めたい“スキップ”条件を先に吸収 ---
  if (game.phase === PHASES.SEER) {
    if (!hasRoleAlive(actor, ROLES.SEER) || left === null) {
      resolveSeer(game, actorId, null, 0); // 対象なしでスキップ
      return;
    }
  }

  if (game.phase === PHASES.LYNCH) {
    if (left === null) {
      logPush(game, `P${actorId + 1} 吊り → 対象なし（生存者1人）なのでスキップ`);
      advancePhase(game);
      return;
    }
  }

  if (game.phase === PHASES.BITE) {
    if (right === null) {
      logPush(game, `P${actorId + 1} 噛み → 対象なし（生存者1人）なのでスキップ`);
      advancePhase(game);
      return;
    }
  }

  if (game.phase === PHASES.ROUND0_MAD || game.phase === PHASES.MAD) {
    // 狂人不在 or 発動済みならクリックでスキップ
    if (!hasRoleAlive(actor, ROLES.MAD) || actor.madUsed) {
      resolveMadPick(game, actorId, 0); // 内部でスキップ進行
      return;
    }
  }

  if (game.phase === PHASES.ROUND0_GUARD || game.phase === PHASES.GUARD) {
    // 狩人不在ならクリックでスキップ
    if (!hasRoleAlive(actor, ROLES.GUARD)) {
      resolveGuard(game, actorId, 0); // 内部でスキップ進行
      return;
    }
  }

  // --- 通常の“正規入力”は対象プレイヤーを強制して受け付ける ---
  if (game.phase === PHASES.ROUND0_MAD) {
    if (playerId !== actorId) return;
    resolveMadPick(game, actorId, slotIndex);
    return;
  }
  if (game.phase === PHASES.ROUND0_GUARD) {
    if (playerId !== actorId) return;
    resolveGuard(game, actorId, slotIndex);
    return;
  }

  if (game.phase === PHASES.SEER) {
    if (playerId !== left) return;
    resolveSeer(game, actorId, playerId, slotIndex);
    return;
  }
  if (game.phase === PHASES.LYNCH) {
    if (playerId !== left) return;
    resolveLynch(game, actorId, playerId, slotIndex);
    return;
  }
  if (game.phase === PHASES.MAD) {
    if (playerId !== actorId) return;
    resolveMadPick(game, actorId, slotIndex);
    return;
  }
  if (game.phase === PHASES.GUARD) {
    if (playerId !== actorId) return;
    resolveGuard(game, actorId, slotIndex);
    return;
  }
  if (game.phase === PHASES.BITE) {
    if (playerId !== right) return;
    resolveBite(game, actorId, playerId, slotIndex);
    return;
  }
}

  // 通常の入力
  if (game.phase === PHASES.ROUND0_MAD) { resolveMadPick(game, actorId, slotIndex); return; }
  if (game.phase === PHASES.ROUND0_GUARD) { resolveGuard(game, actorId, slotIndex); return; }

  if (game.phase === PHASES.SEER) { resolveSeer(game, actorId, playerId, slotIndex); return; }
  if (game.phase === PHASES.LYNCH) { resolveLynch(game, actorId, playerId, slotIndex); return; }
  if (game.phase === PHASES.MAD) { resolveMadPick(game, actorId, slotIndex); return; }
  if (game.phase === PHASES.GUARD) { resolveGuard(game, actorId, slotIndex); return; }
  if (game.phase === PHASES.BITE) { resolveBite(game, actorId, playerId, slotIndex); return; }
}
