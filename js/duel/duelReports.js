import { MARK, PUBLIC_KIND } from "../config.js";
import {
  colorFromRole,
  getTrueLineKind,
  getFakeLineKind,
  isLineAlive,
  sameTarget,
} from "../utils.js";

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
