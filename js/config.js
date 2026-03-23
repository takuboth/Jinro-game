import { buildHiddenDeck } from "./roles.js";

export const MODES = {
  WOLF: "WOLF",
  VILLAGER: "VILLAGER",
};

export const ROLES = {
  WOLF: "WOLF",
  SEER: "SEER",
  MAD: "MAD",
  MEDIUM: "MEDIUM",
  GUARD: "GUARD",
  VILLAGER: "VILLAGER",
};

export const MARK = {
  NONE: "NONE",
  WHITE: "WHITE",
  BLACK: "BLACK",
};

export const DEATH = {
  NONE: "NONE",
  LYNCH: "LYNCH",
  BITE: "BITE",
};

export const PUBLIC_KIND = {
  A: "A",
  B: "B",
  MEDIUM: "MEDIUM",
};

export const PHASES = {
  LYNCH: "LYNCH",
  RESERVE_A: "RESERVE_A",
  RESERVE_B: "RESERVE_B",
  GUARD: "GUARD",
  BITE: "BITE",
  END: "END",
};

export const CONFIG = {
  playerCount: 2,
  slotCount: 18,

  humanPlayerId: 0,
  autoPlayers: true,
  autoSafetySteps: 100,

  cpuOnlineLike: true,
  cpuThinkMsMin: 450,
  cpuThinkMsMax: 900,

  defaultMode: MODES.WOLF,

  hiddenRoleCounts: {
    [ROLES.WOLF]: 3,
    [ROLES.GUARD]: 1,
    [ROLES.VILLAGER]: 11,
  },

  // 将来、モード別にフローを変えたくなった時の入口
  flowByMode: {
    [MODES.WOLF]: [
      PHASES.LYNCH,
      PHASES.RESERVE_A,
      PHASES.RESERVE_B,
      PHASES.GUARD,
      PHASES.BITE,
    ],
    [MODES.VILLAGER]: [
      PHASES.LYNCH,
      PHASES.RESERVE_A,
      PHASES.RESERVE_B,
      PHASES.GUARD,
      PHASES.BITE,
    ],
  },

  get hiddenDeck() {
    return buildHiddenDeck(this.hiddenRoleCounts);
  },
};
