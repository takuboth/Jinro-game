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

  // 非公開役職の枚数定義
  hiddenRoleCounts: {
    [ROLES.WOLF]: 3,
    [ROLES.GUARD]: 1,
    [ROLES.VILLAGER]: 11,
  },

  get hiddenDeck() {
    return buildHiddenDeck(this.hiddenRoleCounts);
  },
};
