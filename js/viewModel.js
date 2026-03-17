import { CONFIG, MODES, ROLES, PHASES, DEATH, PUBLIC_KIND } from "./config.js";
import {
  roleChar,
  publicLabel,
  fullRevealPublicLabel,
  countAliveWolves,
  countAliveNonWolves,
} from "./utils.js";
import {
  getLynchTargetId,
  getReserveTargetId,
  getGuardTargetId,
  getBiteTargetId,
  phaseLabel
} from "./game.js";

function fixedLeftId(viewAsId) {
  return (viewAsId - 1 + CONFIG.playerCount) % CONFIG.playerCount;
}

function fixedRightId(viewAsId) {
  return (viewAsId + 1) % CONFIG.playerCount;
}

function fixedDisplayOrder(viewAsId) {
  return [fixedLeftId(viewAsId), viewAsId, fixedRightId(viewAsId)];
}

function relativeLabel(viewAsId, playerId) {
  if (playerId === viewAsId) return "自分";
  if (playerId === fixedLeftId(viewAsId)) return "左";
  if (playerId === fixedRightId(viewAsId)) return "右";
  return "";
}

function slotRoleText(slot, playerId, viewAsId, revealAll, mode) {
  if (revealAll) {
    if (slot.isPublic) return fullRevealPublicLabel(slot);
    return roleChar(slot.role);
  }

  if (slot.isPublic) {
    return publicLabel(slot.publicKind);
  }

  if (slot.role === ROLES.WOLF) {
    if (mode === MODES.WOLF && playerId === viewAsId) {
      return "狼";
    }
    if (mode === MODES.VILLAGER && playerId !== viewAsId) {
      return "狼";
    }
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
    if (game.phase === PHASES.LYNCH) {
      if (lynchTargetId != null) focusPlayers.push(lynchTargetId);
    } else if (game.phase === PHASES.RESERVE_A || game.phase === PHASES.RESERVE_B) {
      if (reserveTargetId != null) focusPlayers.push(reserveTargetId);
    } else if (game.phase === PHASES.BITE) {
      if (biteTargetId != null) focusPlayers.push(biteTargetId);
    } else if (game.phase === PHASES.GUARD) {
      if (guardTargetId != null) focusPlayers.push(guardTargetId);
    }
  }

  if (humanCanAct) {
    if (game.phase === PHASES.LYNCH && lynchTargetId != null) {
      const target = game.players[lynchTargetId];
      for (let i = 0; i < CONFIG.slotCount; i++) {
        clickable[lynchTargetId][i] = !target.slots[i].dead;
      }
    }

    if (game.phase === PHASES.RESERVE_A && reserveTargetId != null) {
      const target = game.players[reserveTargetId];
      const aAlive = target.slots.some(
        s => s.isPublic && s.publicKind === PUBLIC_KIND.A && !s.dead
      );
      if (aAlive) {
        for (let i = 0; i < CONFIG.slotCount; i++) {
          const s = target.slots[i];
          clickable[reserveTargetId][i] = !s.dead && !s.isPublic && !actor.seenA[i];
        }
      }
    }

    if (game.phase === PHASES.RESERVE_B && reserveTargetId != null) {
      const target = game.players[reserveTargetId];
      const bAlive = target.slots.some(
        s => s.isPublic && s.publicKind === PUBLIC_KIND.B && !s.dead
      );
      if (bAlive) {
        for (let i = 0; i < CONFIG.slotCount; i++) {
          const s = target.slots[i];
          clickable[reserveTargetId][i] = !s.dead && !s.isPublic && !actor.seenB[i];
        }
      }
    }

    if (game.phase === PHASES.BITE && biteTargetId != null) {
      const target = game.players[biteTargetId];
      for (let i = 0; i < CONFIG.slotCount; i++) {
        const s = target.slots[i];
        clickable[biteTargetId][i] = !s.dead && s.role !== ROLES.WOLF;
      }
    }

    if (game.phase === PHASES.GUARD && guardTargetId != null) {
      const target = game.players[guardTargetId];
      const forbidden = actor.lastGuardTargetId === guardTargetId ? actor.lastGuardSlot : null;
      for (let i = 0; i < CONFIG.slotCount; i++) {
        const s = target.slots[i];
        clickable[guardTargetId][i] = !s.dead && i !== forbidden;
      }
    }
  }

  const modeText = game.mode === MODES.WOLF ? "人狼" : "村人";
  const status = game.over
    ? `${modeText}モード / 終了（勝者: ${game.winners.length ? game.winners.map(id => `P${id + 1}`).join(", ") : "なし"}）`
    : `${modeText}モード / ${phaseLabel(game.phase)}`;

  const acting = game.over
    ? ""
    : `手番: P${actorId + 1}`;

  const players = game.players.map((p) => {
    const revealAll = !p.alive || game.over;
    const wolves = countAliveWolves(p);
    const nonWolves = countAliveNonWolves(p);

    return {
      id: p.id,
      name: `P${p.id + 1}`,
      relation: relativeLabel(viewAsId, p.id),
      alive: p.alive,
      escaped: p.escaped,
      revealAll,

      resultText: !p.alive ? (p.escaped ? "WIN" : "LOSE") : "",
      wolfCount: (p.id === viewAsId) ? wolves : null,
      nonWolfCount: (p.id === viewAsId) ? nonWolves : null,

      guardIncomingSlot: p.guardIncomingSlot,

      slots: p.slots.map((slot, idx) => ({
        idx,
        roleText: slotRoleText(slot, p.id, viewAsId, revealAll, game.mode),
        dead: slot.dead,
        isPublic: slot.isPublic,
        seerA: slot.seerA,
        seerB: slot.seerB,
        medium: slot.medium,
        death: deathMark(slot),
        clickable: clickable[p.id][idx],
      })),
    };
  });

  const displayOrder = fixedDisplayOrder(viewAsId);

  return {
    game,
    viewAsId,
    humanCanAct,
    focusPlayers,
    status,
    acting,
    players,
    displayOrder,
  };
}
