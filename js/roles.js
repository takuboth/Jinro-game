export const ROLE_DEF = {
  WOLF: {
    key: "WOLF",
    label: "狼",
    team: "wolf",
    hidden: true,

    countsAsWolf: true,
    canBeBitten: false,
    canGuardSelfTarget: false,
    isFox: false,

    visibleInWolfModeSelf: true,
    visibleInVillagerModeOthers: true,
  },

  VILLAGER: {
    key: "VILLAGER",
    label: "村",
    team: "village",
    hidden: true,

    countsAsWolf: false,
    canBeBitten: true,
    canGuardSelfTarget: true,
    isFox: false,

    visibleInWolfModeSelf: false,
    visibleInVillagerModeOthers: false,
  },

  GUARD: {
    key: "GUARD",
    label: "狩",
    team: "village",
    hidden: true,

    countsAsWolf: false,
    canBeBitten: true,
    canGuardSelfTarget: false,
    isFox: false,

    visibleInWolfModeSelf: false,
    visibleInVillagerModeOthers: false,
  },

  FOX: {
    key: "FOX",
    label: "狐",
    team: "fox",
    hidden: true,

    countsAsWolf: false,
    canBeBitten: false,
    canGuardSelfTarget: true,
    isFox: true,

    visibleInWolfModeSelf: false,
    visibleInVillagerModeOthers: false,
  },

  SEER: {
    key: "SEER",
    label: "占",
    team: "public",
    hidden: false,

    countsAsWolf: false,
    canBeBitten: true,
    canGuardSelfTarget: true,
    isFox: false,

    visibleInWolfModeSelf: true,
    visibleInVillagerModeOthers: true,
  },

  MAD: {
    key: "MAD",
    label: "狂",
    team: "public",
    hidden: false,

    countsAsWolf: false,
    canBeBitten: true,
    canGuardSelfTarget: true,
    isFox: false,

    visibleInWolfModeSelf: true,
    visibleInVillagerModeOthers: true,
  },

  MEDIUM: {
    key: "MEDIUM",
    label: "霊",
    team: "public",
    hidden: false,

    countsAsWolf: false,
    canBeBitten: true,
    canGuardSelfTarget: true,
    isFox: false,

    visibleInWolfModeSelf: true,
    visibleInVillagerModeOthers: true,
  },
};

export function getRoleDef(role) {
  return ROLE_DEF[role] ?? null;
}

export function roleLabel(role) {
  return ROLE_DEF[role]?.label ?? "";
}

export function isWolfRole(role) {
  return ROLE_DEF[role]?.countsAsWolf === true;
}

export function countsAsWolf(role) {
  return ROLE_DEF[role]?.countsAsWolf === true;
}

export function canBeBitten(role) {
  return ROLE_DEF[role]?.canBeBitten !== false;
}

export function canGuardSelfTarget(role) {
  return ROLE_DEF[role]?.canGuardSelfTarget === true;
}

export function isFoxRole(role) {
  return ROLE_DEF[role]?.isFox === true;
}

export function isPublicRole(role) {
  return ROLE_DEF[role]?.hidden === false;
}

export function isHiddenRole(role) {
  return ROLE_DEF[role]?.hidden === true;
}

export function isVisibleInWolfModeSelf(role) {
  return ROLE_DEF[role]?.visibleInWolfModeSelf === true;
}

export function isVisibleInVillagerModeOthers(role) {
  return ROLE_DEF[role]?.visibleInVillagerModeOthers === true;
}

export function buildHiddenDeck(roleCounts) {
  const deck = [];

  for (const [role, count] of Object.entries(roleCounts)) {
    for (let i = 0; i < count; i++) {
      deck.push(role);
    }
  }

  return deck;
}
