export const ROLES = {
  WOLF: "WOLF",
  MAD: "MAD",
  SEER: "SEER",
  GUARD: "GUARD",
  MEDIUM: "MEDIUM",
  VILLAGER: "VILLAGER",
};

export const MARK = {
  GRAY: "GRAY",
  WHITE: "WHITE",
  BLACK: "BLACK",
};

export const PHASES = {
  ROUND0_MAD: "ROUND0_MAD",
  ROUND0_GUARD: "ROUND0_GUARD",

  SEER: "SEER",
  LYNCH: "LYNCH",
  MAD: "MAD",
  GUARD: "GUARD",
  BITE: "BITE",

  END: "END",
};

export const CONFIG = {
  humanPlayerId: 0,
  autoPlayers: true,
  autoSafetySteps: 100,

  // 追加
  cpuOnlineLike: true,      // true: 演出あり / false: 即時
  cpuThinkMsMin: 450,
  cpuThinkMsMax: 900,
};
