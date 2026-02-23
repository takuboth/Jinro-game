const CONFIG = {
  humanPlayerId: 0,
  autoPlayers: true,
  autoSafetySteps: 800,
  effectsEnabled: true,
};

const ROLES = {
  WOLF: "人狼",
  MAD: "狂人",
  SEER: "占い",
  GUARD: "狩人",
  MEDIUM: "霊媒",
  VILLAGER: "村人",
};

const PHASES = {
  ROUND0_MAD: "Round0:狂人（反転対象選択）",
  ROUND0_GUARD: "Round0:狩人守り設定",
  SEER: "占い",
  LYNCH: "吊り",
  MAD: "狂人設定",
  GUARD: "狩人守り設定",
  BITE: "噛み",
  END: "終了",
};

const MARK = {
  GRAY: "GRAY",
  WHITE: "WHITE",
  BLACK: "BLACK",
};
