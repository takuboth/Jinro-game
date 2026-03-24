import { CONFIG, DEATH, PHASES, ROLES, PUBLIC_KIND } from "../config.js";
import { buildPublicRoles } from "../publicRoles.js";
import { makeEmptyMarks } from "../markUtils.js";
import {
  shuffle,
  pickRandom,
  makeEmptySeenMap,
  getTrueLineKind,
  getFakeLineKind,
} from "../utils.js";

function makePublicSlots() {
  return buildPublicRoles().map(def => ({
    role: def.role,
    isPublic: true,
    publicKind: def.publicKind,
    dead: false,
    foxPairKey: null,
    ...makeEmptyMarks(),
    marks: makeEmptyMarks(),
    deathReason: DEATH.NONE,
  }));
}

function makeHiddenSlots(playerId) {
  const deck = shuffle(CONFIG.hiddenDeck);

  let foxAssigned = false;

  return deck.map(role => {
    const slot = {
      role,
      isPublic: false,
      publicKind: null,
      dead: false,
      foxPairKey: null,
      ...makeEmptyMarks(),
      marks: makeEmptyMarks(),
      deathReason: DEATH.NONE,
    };

    if (role === ROLES.FOX && !foxAssigned) {
      slot.foxPairKey = "FOX_PAIR_1";
      foxAssigned = true;
    }

    return slot;
  });
}

export function makePlayer(id) {
  return {
    id,
    alive: true,
    escaped: false,
    resultText: "",

    slots: [...makePublicSlots(), ...makeHiddenSlots(id)],

    seenA: makeEmptySeenMap(),
    seenB: makeEmptySeenMap(),

    pendingA: null,
    pendingB: null,
    pendingMedium: null,

    guardIncomingSlot: null,
  };
}

export function makeNewGameBase(mode) {
  const players = [];
  for (let i = 0; i < CONFIG.playerCount; i++) {
    players.push(makePlayer(i));
  }

  return {
    mode,
    players,
    turn: 0,
    phase: PHASES.LYNCH,
    over: false,
    winners: [],
    log: [],
    lastLynchedSlot: null,

    pendingGuards: [],
    roundGuardActors: [],
    pendingBites: [],
    roundBiteActors: [],

    duelPendingResult: null,
  };
}

function getReserveTargetId(game, actorId) {
  return game.mode === "VILLAGER" ? actorId : (actorId === 0 ? 1 : 0);
}

export function applyInitialReservationsSeed(game) {
  for (let actorId = 0; actorId < game.players.length; actorId++) {
    setInitialReservationsForActor(game, actorId);
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
    x.slot.role !== ROLES.WOLF &&
    x.slot.role !== ROLES.FOX
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
