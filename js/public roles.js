import { ROLES, PUBLIC_KIND } from "./config.js";

export const PUBLIC_SLOT_DEF = [
  {
    slotKey: "seerLikeA",
    publicKind: PUBLIC_KIND.A,
    rolePool: [ROLES.SEER, ROLES.MAD],
  },
  {
    slotKey: "seerLikeB",
    publicKind: PUBLIC_KIND.B,
    rolePool: [ROLES.SEER, ROLES.MAD],
  },
  {
    slotKey: "medium",
    publicKind: PUBLIC_KIND.MEDIUM,
    fixedRole: ROLES.MEDIUM,
  },
];

export function buildPublicRoles() {
  // A/Bだけは SEER/MAD をシャッフルして割り当てる
  const seerMad = [ROLES.SEER, ROLES.MAD].sort(() => Math.random() - 0.5);

  return PUBLIC_SLOT_DEF.map(def => {
    if (def.publicKind === PUBLIC_KIND.A) {
      return {
        ...def,
        role: seerMad[0],
      };
    }
    if (def.publicKind === PUBLIC_KIND.B) {
      return {
        ...def,
        role: seerMad[1],
      };
    }
    return {
      ...def,
      role: def.fixedRole,
    };
  });
}
