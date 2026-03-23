import { PHASES } from "../config.js";

export const DUEL_TURN_FLOW = [
  PHASES.LYNCH,
  PHASES.RESERVE_A,
  PHASES.RESERVE_B,
  PHASES.GUARD,
  PHASES.BITE,
];

export function getNextPhase(currentPhase) {
  const idx = DUEL_TURN_FLOW.indexOf(currentPhase);
  if (idx < 0) return null;
  if (idx === DUEL_TURN_FLOW.length - 1) return null;
  return DUEL_TURN_FLOW[idx + 1];
}

export function isLastPhase(currentPhase) {
  return DUEL_TURN_FLOW[DUEL_TURN_FLOW.length - 1] === currentPhase;
}
