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
  BITE: "BITE",
  GUARD: "GUARD",
  END: "END",
};

export const CONFIG = {
  // タイマン
  playerCount: 2,

  // 6×3 = 18枚
  slotCount: 18,

  humanPlayerId: 0,
  autoPlayers: true,
  autoSafetySteps: 100,

  cpuOnlineLike: true,
  cpuThinkMsMin: 450,
  cpuThinkMsMax: 900,

  defaultMode: MODES.WOLF,

  // 公開3 + 非公開15 = 合計18
  hiddenDeck: [
    ROLES.WOLF,
    ROLES.WOLF,
    ROLES.WOLF,
    ROLES.GUARD,

    ROLES.VILLAGER,
    ROLES.VILLAGER,
    ROLES.VILLAGER,
    ROLES.VILLAGER,
    ROLES.VILLAGER,
    ROLES.VILLAGER,
    ROLES.VILLAGER,
    ROLES.VILLAGER,
    ROLES.VILLAGER,
    ROLES.VILLAGER,
    ROLES.VILLAGER,
  ],
};
