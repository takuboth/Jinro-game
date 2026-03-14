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
  humanPlayerId: 0,
  autoPlayers: true,
  autoSafetySteps: 200,

  cpuOnlineLike: true,
  cpuThinkMsMin: 450,
  cpuThinkMsMax: 900,

  playerCount: 3,
  slotCount: 10,
  publicSlotCount: 3,
  hiddenSlotCount: 7,

  publicLayout: [
    { index: 0, kind: PUBLIC_KIND.A },
    { index: 1, kind: PUBLIC_KIND.B },
    { index: 2, kind: PUBLIC_KIND.MEDIUM },
  ],

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
