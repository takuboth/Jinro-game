import {
  isVisibleInWolfModeSelf,
  isVisibleInVillagerModeOthers,
} from "./roles.js";
import { getSlotMark } from "./markUtils.js";
import { MARK_KEYS } from "./markKeys.js";
import { CONFIG, MODES, ROLES, PHASES, DEATH, PUBLIC_KIND } from "./config.js";
import {
  roleChar,
  publicLabel,
  fullRevealPublicLabel,
} from "./utils.js";
import {
  getLynchTargetId,
  getReserveTargetId,
  getGuardTargetId,
  getBiteTargetId,
  phaseLabel
} from "./game.js";

function getOpponentId(viewAsId) {
  return viewAsId === 0 ? 1 : 0;
}

function displayOrderForDuel(viewAsId) {
  return [getOpponentId(viewAsId), viewAsId];
}

function relationLabel(viewAsId, playerId) {
  return playerId === viewAsId ? "自分" : "相手";
}

function slotRoleText(slot, playerId, viewAsId, revealAll, mode) {
  // 妖狐は死亡したら即CO
  if (slot.dead && slot.role === ROLES.FOX) {
    return "狐";
  }

  if (revealAll) {
    if (slot.isPublic) return fullRevealPublicLabel(slot);
    return roleChar(slot.role);
  }

  if (slot.isPublic) {
    return publicLabel(slot.publicKind);
  }

  if (mode === MODES.WOLF && playerId === viewAsId && isVisibleInWolfModeSelf(slot.role)) {
    return roleChar(slot.role);
  }

  if (mode === MODES.VILLAGER && playerId !== viewAsId && isVisibleInVillagerModeOthers(slot.role)) {
    return roleChar(slot.role);
  }

  return "";
}

function deathMark(slot) {
  if (slot.deathReason === DEATH.LYNCH) return "LYNCH";
  if (slot.deathReason === DEATH.BITE) return "BITE";
  return "NONE";
}

export function deriveViewModel(game, viewAsId) {
  const humanId = CONFIG.humanPlayerId;
  const actorId = game.turn;
  const actor = game.players[actorId];

  const humanCanAct = !!(
    !game.over &&
    actor &&
    actor.alive &&
    actorId === humanId
  );

  const clickable = Array.from({ length: CONFIG.playerCount }, () =>
    Array(CONFIG.slotCount).fill(false)
  );

  const focusPlayers = [];

  const lynchTargetId = actor ? getLynchTargetId(game, actorId) : null;
  const reserveTargetId = actor ? getReserveTargetId(game, actorId) : null;
  const guardTargetId = actor ? getGuardTargetId(game, actorId) : null;
  const biteTargetId = actor ? getBiteTargetId(game, actorId) : null;

  if (humanCanAct) {
    if (game.phase === PHASES.LYNCH) focusPlayers.push(lynchTargetId);
    else if (game.phase === PHASES.RESERVE_A || game.phase === PHASES.RESERVE_B) focusPlayers.push(reserveTargetId);
    else if (game.phase === PHASES.GUARD) focusPlayers.push(guardTargetId);
    else if (game.phase === PHASES.BITE) focusPlayers.push(biteTargetId);
  }

  if (humanCanAct) {
    if (game.phase === PHASES.LYNCH) {
      const target = game.players[lynchTargetId];
      for (let i = 0; i < CONFIG.slotCount; i++) {
        clickable[lynchTargetId][i] = !target.slots[i].dead;
      }
    }

    if (game.phase === PHASES.RESERVE_A) {
      const target = game.players[reserveTargetId];
      const aAlive = target.slots.some(s => s.isPublic && s.publicKind === PUBLIC_KIND.A && !s.dead);
      if (aAlive) {
        for (let i = 0; i < CONFIG.slotCount; i++) {
          const s = target.slots[i];
          clickable[reserveTargetId][i] = !s.dead && !s.isPublic && !actor.seenA[i];
        }
      }
    }

    if (game.phase === PHASES.RESERVE_B) {
      const target = game.players[reserveTargetId];
      const bAlive = target.slots.some(s => s.isPublic && s.publicKind === PUBLIC_KIND.B && !s.dead);
      if (bAlive) {
        for (let i = 0; i < CONFIG.slotCount; i++) {
          const s = target.slots[i];
          clickable[reserveTargetId][i] = !s.dead && !s.isPublic && !actor.seenB[i];
        }
      }
    }

    if (game.phase === PHASES.GUARD) {
      const target = game.players[guardTargetId];
      for (let i = 0; i < CONFIG.slotCount; i++) {
        clickable[guardTargetId][i] = !target.slots[i].dead;
      }
    }

    if (game.phase === PHASES.BITE) {
      const target = game.players[biteTargetId];
      for (let i = 0; i < CONFIG.slotCount; i++) {
        const s = target.slots[i];
        clickable[biteTargetId][i] = !s.dead && s.role !== ROLES.WOLF;
      }
    }
  }

  const modeText = game.mode === MODES.WOLF ? "人狼" : "村人";
  const status = game.over
    ? `${modeText}モード / 終了（勝者: ${game.winners.length ? game.winners.map(id => `P${id + 1}`).join(", ") : "なし"}）`
    : `${modeText}モード / ${phaseLabel(game.phase)}`;

  const acting = game.over ? "" : `手番: P${actorId + 1}`;

  const players = game.players.map((p) => {
    const revealAll = !p.alive || game.over;

    let resultText = "";
    if (typeof p.resultText === "string" && p.resultText) {
      resultText = p.resultText;
    } else if (!p.alive) {
      resultText = p.escaped ? "WIN" : "LOSE";
    }

    return {
      id: p.id,
      name: `P${p.id + 1}`,
      relation: relationLabel(viewAsId, p.id),
      alive: p.alive,
      escaped: p.escaped,
      revealAll,

      resultText,
      wolfCount: null,
      nonWolfCount: null,

      guardIncomingSlot: p.guardIncomingSlot,

      slots: p.slots.map((slot, idx) => ({
        idx,
        roleText: slotRoleText(slot, p.id, viewAsId, revealAll, game.mode),
        dead: slot.dead,
        isPublic: slot.isPublic,
        seerA: getSlotMark(slot, MARK_KEYS.SEER_A),
        seerB: getSlotMark(slot, MARK_KEYS.SEER_B),
        medium: getSlotMark(slot, MARK_KEYS.MEDIUM),
        death: deathMark(slot),
        clickable: clickable[p.id][idx],
      })),
    };
  });

  return {
    game,
    viewAsId,
    humanCanAct,
    focusPlayers,
    status,
    acting,
    players,
    displayOrder: displayOrderForDuel(viewAsId),
  };
}
