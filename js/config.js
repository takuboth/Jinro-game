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
  playerCount: 3,
  slotCount: 10,

  humanPlayerId: 0,
  autoPlayers: true,
  autoSafetySteps: 100,

  cpuOnlineLike: true,
  cpuThinkMsMin: 450,
  cpuThinkMsMax: 900,

  // 非公開7枚
  hiddenDeck: [
    ROLES.WOLF,
    ROLES.WOLF,
    ROLES.GUARD,
    ROLES.VILLAGER,
    ROLES.VILLAGER,
    ROLES.VILLAGER,
    ROLES.VILLAGER,
  ],
};
