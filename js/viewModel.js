import { CONFIG, ROLES, PHASES, MARK, DEATH, PUBLIC_KIND } from "./config.js";
import {
  roleChar,
  publicLabel,
  fullRevealPublicLabel,
  countAliveWolves,
  countAliveNonWolves,
} from "./utils.js";
import { leftPlayerIndex, rightPlayerIndex, phaseLabel } from "./game.js";

function relativeLabel(viewAsId, playerId, game) {
  if (playerId === viewAsId) return "自分";
  const left = leftPlayerIndex(game, viewAsId);
  const right = rightPlayerIndex(game, viewAsId);
  if (playerId === left) return "左";
  if (playerId === right) return "右";
  return "";
}

function slotRoleText(slot, playerId, viewAsId, revealAll) {
  if (revealAll) {
    if (slot.isPublic) return fullRevealPublicLabel(slot);
    return roleChar(slot.role);
  }

  if (slot.isPublic) {
    return publicLabel(slot.publicKind);
  }

  if (playerId === viewAsId && slot.role === ROLES.WOLF) {
    return "狼";
  }

  return "";
}

function deathMark(slot) {
  if (slot.deathReason === DEATH.LYNCH) return "LYNCH";
  if (slot.deathReason === DEATH.BITE) return "BITE";
  return "NONE";
}

function uniqueOrder(arr) {
  const out = [];
  for (const v of arr) {
    if (v == null) continue;
    if (!out.includes(v)) out.push(v);
  }
  return out;
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

  const leftId = actor ? leftPlayerIndex(game, actorId) : null;
  const rightId = actor ? rightPlayerIndex(game, actorId) : null;

  if (humanCanAct) {
    if (
      game.phase === PHASES.LYNCH ||
      game.phase === PHASES.RESERVE_A ||
      game.phase === PHASES.RESERVE_B
    ) {
      if (leftId != null) focusPlayers.push(leftId);
    } else if (game.phase === PHASES.BITE) {
      focusPlayers.push(actorId);
    } else if (game.phase === PHASES.GUARD) {
      if (rightId != null) focusPlayers.push(rightId);
    }
  }

  if (humanCanAct) {
    if (game.phase === PHASES.LYNCH && leftId != null) {
      const target = game.players[leftId];
      for (let i = 0; i < CONFIG.slotCount; i++) {
        clickable[leftId][i] = !target.slots[i].dead;
      }
    }

    if (game.phase === PHASES.RESERVE_A && leftId != null) {
      const target = game.players[leftId];
      const aAlive = target.slots.some(
        s => s.isPublic && s.publicKind === PUBLIC_KIND.A && !s.dead
      );
      if (aAlive) {
        for (let i = 0; i < CONFIG.slotCount; i++) {
          const s = target.slots[i];
          clickable[leftId][i] = !s.dead && !s.isPublic && !actor.seenA[i];
        }
      }
    }

    if (game.phase === PHASES.RESERVE_B && leftId != null) {
      const target = game.players[leftId];
      const bAlive = target.slots.some(
        s => s.isPublic && s.publicKind === PUBLIC_KIND.B && !s.dead
      );
      if (bAlive) {
        for (let i = 0; i < CONFIG.slotCount; i++) {
          const s = target.slots[i];
          clickable[leftId][i] = !s.dead && !s.isPublic && !actor.seenB[i];
        }
      }
    }

    if (game.phase === PHASES.BITE) {
      const self = game.players[actorId];
      for (let i = 0; i < CONFIG.slotCount; i++) {
        const s = self.slots[i];
        clickable[actorId][i] = !s.dead && s.role !== ROLES.WOLF;
      }
    }

    if (game.phase === PHASES.GUARD && rightId != null) {
      const target = game.players[rightId];
      const forbidden = actor.lastGuardTargetId === rightId ? actor.lastGuardSlot : null;
      for (let i = 0; i < CONFIG.slotCount; i++) {
        const s = target.slots[i];
        clickable[rightId][i] = !s.dead && i !== forbidden;
      }
    }
  }

  const status = game.over
    ? `終了（勝者: ${game.winners.length ? game.winners.map(id => `P${id + 1}`).join(", ") : "なし"}）`
    : phaseLabel(game.phase);

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
      relation: relativeLabel(viewAsId, p.id, game),
      alive: p.alive,
      escaped: p.escaped,
      revealAll,

      resultText: !p.alive ? (p.escaped ? "WIN" : "LOSE") : "",
      wolfCount: (p.id === viewAsId) ? wolves : null,
      nonWolfCount: (p.id === viewAsId) ? nonWolves : null,

      guardIncomingSlot: p.guardIncomingSlot,

      slots: p.slots.map((slot, idx) => ({
        idx,
        roleText: slotRoleText(slot, p.id, viewAsId, revealAll),
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

  const viewLeft = leftPlayerIndex(game, viewAsId);
  const viewRight = rightPlayerIndex(game, viewAsId);

  const displayOrder = uniqueOrder([
    viewLeft,
    viewAsId,
    viewRight,
    ...game.players.map(p => p.id),
  ]);

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
