export const ROLE_DEF = {
  WOLF: {
    key: "WOLF",
    label: "狼",
    team: "wolf",
    hidden: true,
    publicKind: null,
  },

  VILLAGER: {
    key: "VILLAGER",
    label: "村",
    team: "village",
    hidden: true,
    publicKind: null,
  },

  GUARD: {
    key: "GUARD",
    label: "狩",
    team: "village",
    hidden: true,
    publicKind: null,
  },

  SEER: {
    key: "SEER",
    label: "占",
    team: "public",
    hidden: false,
    publicKind: "A_OR_B",
  },

  MAD: {
    key: "MAD",
    label: "狂",
    team: "public",
    hidden: false,
    publicKind: "A_OR_B",
  },

  MEDIUM: {
    key: "MEDIUM",
    label: "霊",
    team: "public",
    hidden: false,
    publicKind: "MEDIUM",
  },
};

export function getRoleDef(role) {
  return ROLE_DEF[role] ?? null;
}

export function roleLabel(role) {
  return ROLE_DEF[role]?.label ?? "";
}

export function isWolfRole(role) {
  return ROLE_DEF[role]?.team === "wolf";
}

export function isVillageRole(role) {
  return ROLE_DEF[role]?.team === "village";
}

export function isPublicRole(role) {
  return ROLE_DEF[role]?.hidden === false;
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
