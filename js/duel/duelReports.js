import { MARK, PUBLIC_KIND, DEATH } from "../config.js";
import { MARK_KEYS } from "../markKeys.js";
import { getSlotMark, setSlotMark } from "../markUtils.js";
import { isFoxRole } from "../roles.js";
import {
  colorFromRole,
  getTrueLineKind,
  getFakeLineKind,
  isLineAlive,
  sameTarget,
} from "../utils.js";

function killLinkedFoxByPair(game, foxPairKey, sourcePlayerId, sourceSlotIndex, logPush) {
  if (!foxPairKey) return;

  for (const player of game.players) {
    for (let i = 0; i < player.slots.length; i++) {
      const slot = player.slots[i];
      if (slot.dead) continue;
      if (slot.foxPairKey !== foxPairKey) continue;
      if (player.id === sourcePlayerId && i === sourceSlotIndex) continue;

      slot.dead = true;
      slot.deathReason = DEATH.FOX_LINK;
      logPush(game, `P${player.id + 1} S${i + 1} 妖狐連動死亡`);
    }
  }
}

function killFoxBySeer(game, playerId, slotIndex, logPush) {
  const player = game.players[playerId];
  const slot = player?.slots?.[slotIndex];
  if (!player || !slot || slot.dead || !isFoxRole(slot.role)) return;

  slot.dead = true;
  slot.deathReason = DEATH.SEER_KILL;
  logPush(game, `P${playerId + 1} S${slotIndex + 1} 妖狐が占いで死亡`);

  killLinkedFoxByPair(game, slot.foxPairKey, playerId, slotIndex, logPush);
}

export function revealPendingReportsForActor(game, actorId, logPush, getReserveTargetId) {
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
      if (isFoxRole(tgtSlot.role)) {
        killFoxBySeer(game, truePending.targetId, truePending.slotIndex, logPush);
      }

      trueColor = colorFromRole(tgtSlot.role);

      if (trueKind === PUBLIC_KIND.A) {
        setSlotMark(tgtSlot, MARK_KEYS.SEER_A, trueColor);
      } else {
        setSlotMark(tgtSlot, MARK_KEYS.SEER_B, trueColor);
      }

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
          (fakeKind === PUBLIC_KIND.A && getSlotMark(tgtSlot, MARK_KEYS.SEER_B) === MARK.BLACK) ||
          (fakeKind === PUBLIC_KIND.B && getSlotMark(tgtSlot, MARK_KEYS.SEER_A) === MARK.BLACK);

        if (opponentBlack) {
          fakeColor = MARK.WHITE;
        } else {
          const same = sameTarget(fakePending, truePending);
          fakeColor = same
            ? (trueColor === MARK.BLACK ? MARK.WHITE : MARK.BLACK)
            : trueColor;
        }
      }

      if (fakeKind === PUBLIC_KIND.A) {
        setSlotMark(tgtSlot, MARK_KEYS.SEER_A, fakeColor);
      } else {
        setSlotMark(tgtSlot, MARK_KEYS.SEER_B, fakeColor);
      }

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
      setSlotMark(tgtSlot, MARK_KEYS.MEDIUM, actor.pendingMedium.color);
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
