import { CONFIG, ROLES, MARK, PUBLIC_KIND } from "./config.js";

export function nowStamp() {
  const d = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pickRandom(arr) {
  if (!arr || !arr.length) return null;
  return arr[Math.floor(Math.random() * arr.length)];
}

export function roleChar(role) {
  if (role === ROLES.WOLF) return "狼";
  if (role === ROLES.SEER) return "占";
  if (role === ROLES.MAD) return "狂";
  if (role === ROLES.MEDIUM) return "霊";
  if (role === ROLES.GUARD) return "狩";
  return "村";
}

export function publicLabel(kind) {
  if (kind === PUBLIC_KIND.A) return "占A";
  if (kind === PUBLIC_KIND.B) return "占B";
  if (kind === PUBLIC_KIND.MEDIUM) return "霊";
  return "";
}

export function fullRevealPublicLabel(slot) {
  if (slot.publicKind === PUBLIC_KIND.A || slot.publicKind === PUBLIC_KIND.B) {
    return roleChar(slot.role);
  }
  if (slot.publicKind === PUBLIC_KIND.MEDIUM) return "霊";
  return "";
}

export function isWolf(role) {
  return role === ROLES.WOLF;
}

export function colorFromRole(role) {
  return isWolf(role) ? MARK.BLACK : MARK.WHITE;
}

export function isPublicSlot(slot) {
  return !!slot.isPublic;
}

export function isHiddenSlot(slot) {
  return !slot.isPublic;
}

export function getPublicSlotIndexByKind(player, kind) {
  const idx = player.slots.findIndex(s => s.isPublic && s.publicKind === kind);
  return idx >= 0 ? idx : null;
}

export function getAliveSlots(player) {
  return player.slots
    .map((slot, index) => ({ slot, index }))
    .filter(x => !x.slot.dead);
}

export function getAliveHiddenSlots(player) {
  return player.slots
    .map((slot, index) => ({ slot, index }))
    .filter(x => !x.slot.dead && !x.slot.isPublic);
}

export function getAliveBiteTargets(player) {
  return player.slots
    .map((slot, index) => ({ slot, index }))
    .filter(x => !x.slot.dead && x.slot.role !== ROLES.WOLF);
}

export function getAliveGuardTargets(player){
  return player.slots
    .map((slot, index) => ({ slot, index }))
    .filter(x => !x.slot.dead);
}

export function hasAliveRole(player, role) {
  return player.slots.some(s => !s.dead && s.role === role);
}

export function countAliveRole(player, role) {
  return player.slots.filter(s => !s.dead && s.role === role).length;
}

export function countAliveWolves(player) {
  return countAliveRole(player, ROLES.WOLF);
}

export function countAliveNonWolves(player) {
  return player.slots.filter(s => !s.dead && s.role !== ROLES.WOLF).length;
}

export function countAliveOpenAndHidden(player) {
  return player.slots.filter(s => !s.dead).length;
}

export function isLineAlive(player, kind) {
  const idx = getPublicSlotIndexByKind(player, kind);
  if (idx == null) return false;
  return !player.slots[idx].dead;
}

export function getLineRole(player, kind) {
  const idx = getPublicSlotIndexByKind(player, kind);
  if (idx == null) return null;
  return player.slots[idx].role;
}

export function getTrueLineKind(player) {
  const roleA = getLineRole(player, PUBLIC_KIND.A);
  if (roleA === ROLES.SEER) return PUBLIC_KIND.A;
  return PUBLIC_KIND.B;
}

export function getFakeLineKind(player) {
  return getTrueLineKind(player) === PUBLIC_KIND.A ? PUBLIC_KIND.B : PUBLIC_KIND.A;
}

export function sameTarget(a, b) {
  if (!a || !b) return false;
  return a.targetId === b.targetId && a.slotIndex === b.slotIndex;
}

export function makeEmptySeenMap() {
  return Array(CONFIG.slotCount).fill(false);
}

export function hiddenReserveCandidates(player, seenMap) {
  return player.slots
    .map((slot, index) => ({ slot, index }))
    .filter(x => !x.slot.dead && !x.slot.isPublic && !seenMap[x.index]);
}

export function markScore(slot) {
  const a = slot.seerA;
  const b = slot.seerB;
  const m = slot.medium;

  const vals = [a, b, m];
  if (vals.includes(MARK.BLACK)) return 3;
  if (vals.includes(MARK.WHITE)) return 1;
  return 2;
}

export function judgeLineTrust(player) {
  let trustA = 0;
  let trustB = 0;

  let fixedTrue = null;   // "A" | "B" | null
  let fixedFalse = null;  // "A" | "B" | null

  for (const slot of player.slots) {
    const a = slot.seerA;
    const b = slot.seerB;
    const m = slot.medium;

    const aBlack = a === MARK.BLACK;
    const aWhite = a === MARK.WHITE;
    const bBlack = b === MARK.BLACK;
    const bWhite = b === MARK.WHITE;
    const mBlack = m === MARK.BLACK;
    const mWhite = m === MARK.WHITE;

    // 1) 同一スロットで白黒割れ + 霊結果あり
    //    → 霊結果と一致した方を真確定、逆を偽確定
    if (m !== MARK.NONE) {
      const split =
        (aBlack && bWhite) ||
        (aWhite && bBlack);

      if (split) {
        if (mBlack) {
          if (aBlack && bWhite) {
            fixedTrue = "A";
            fixedFalse = "B";
          } else if (bBlack && aWhite) {
            fixedTrue = "B";
            fixedFalse = "A";
          }
        } else if (mWhite) {
          if (aWhite && bBlack) {
            fixedTrue = "A";
            fixedFalse = "B";
          } else if (bWhite && aBlack) {
            fixedTrue = "B";
            fixedFalse = "A";
          }
        }
      }
    }

    // 2) 片黒 + 霊白
    //    → その黒出し占いを偽確定
    if (mWhite) {
      const oneBlack =
        (aBlack ? 1 : 0) + (bBlack ? 1 : 0) === 1;

      if (oneBlack) {
        if (aBlack) {
          fixedTrue = "B";
          fixedFalse = "A";
        } else if (bBlack) {
          fixedTrue = "A";
          fixedFalse = "B";
        }
      }
    }

    // 3) 片黒 + 霊黒
    //    → その占いに信頼度 +80
    if (mBlack) {
      const oneBlack =
        (aBlack ? 1 : 0) + (bBlack ? 1 : 0) === 1;

      if (oneBlack) {
        if (aBlack) trustA += 80;
        if (bBlack) trustB += 80;
      }
    }

    // 4) 片白 + 霊白
    // 5) 両白 + 霊白
    //    → 変化なし
  }

  // 確定情報が出た場合は最優先
  if (fixedTrue === "A") {
    trustA = 1000;
    trustB = -1000;
  } else if (fixedTrue === "B") {
    trustA = -1000;
    trustB = 1000;
  }

  let trueLike = null;
  if (trustA > trustB) trueLike = "A";
  else if (trustB > trustA) trueLike = "B";

  return {
    trustA,
    trustB,
    trueLike,
    fixedTrue,
    fixedFalse,
  };
}

export function classifySlotForLynch(slot, trust, mediumAlive = false) {
  const a = slot.seerA;
  const b = slot.seerB;

  const aBlack = a === MARK.BLACK;
  const aWhite = a === MARK.WHITE;
  const bBlack = b === MARK.BLACK;
  const bWhite = b === MARK.WHITE;

  const trueLike = trust.trueLike;

  // 1. 確定黒（A）
  if (aBlack && bBlack) return "CERT_BLACK";

  // 白黒割れ
  const isSplit =
    (aBlack && bWhite) ||
    (aWhite && bBlack);

  if (isSplit) {
    // 2. 白黒（霊媒生存）
    if (mediumAlive) return "SPLIT_MEDIUM_ON";
    // 6. 白黒（霊媒死亡）
    return "SPLIT_MEDIUM_OFF";
  }

  const blackCount = (aBlack ? 1 : 0) + (bBlack ? 1 : 0);
  const whiteCount = (aWhite ? 1 : 0) + (bWhite ? 1 : 0);

  // 片黒
  if (blackCount === 1) {
    if (trueLike === "A" && aBlack) return "HALF_BLACK_HIGH";
    if (trueLike === "B" && bBlack) return "HALF_BLACK_HIGH";

    if (trueLike === "A" && bBlack) return "HALF_BLACK_LOW";
    if (trueLike === "B" && aBlack) return "HALF_BLACK_LOW";

    return "HALF_BLACK_FLAT";
  }

  // グレー
  if (blackCount === 0 && whiteCount === 0) return "GRAY";

  // 片白
  if (blackCount === 0 && whiteCount === 1) {
    if (trueLike === "A" && aWhite) return "HALF_WHITE_HIGH";
    if (trueLike === "B" && bWhite) return "HALF_WHITE_HIGH";

    if (trueLike === "A" && bWhite) return "HALF_WHITE_LOW";
    if (trueLike === "B" && aWhite) return "HALF_WHITE_LOW";

    return "HALF_WHITE_FLAT";
  }

  // 確定白
  if (blackCount === 0 && whiteCount >= 2) return "CERT_WHITE";

  return "GRAY";
}

export function scoreLynchSlot(slot, trust, mediumAlive = false) {
  const cls = classifySlotForLynch(slot, trust, mediumAlive);

  if (cls === "CERT_BLACK") return 110;
  if (cls === "SPLIT_MEDIUM_ON") return 100;
  if (cls === "HALF_BLACK_HIGH") return 90;
  if (cls === "HALF_BLACK_FLAT") return 80;
  if (cls === "HALF_BLACK_LOW") return 70;
  if (cls === "SPLIT_MEDIUM_OFF") return 60;
  if (cls === "GRAY") return 45;
  if (cls === "HALF_WHITE_LOW") return 35;
  if (cls === "HALF_WHITE_FLAT") return 30;
  if (cls === "HALF_WHITE_HIGH") return 20;
  if (cls === "CERT_WHITE") return 10;
  return 0;
}

export function weightedPickIndex(cands, scoreFn) {
  if (!cands || !cands.length) return null;

  const scored = cands.map(x => ({
    ...x,
    score: Math.max(0, scoreFn(x.slot, x) || 0),
  }));

  const total = scored.reduce((sum, x) => sum + x.score, 0);

  if (total <= 0) {
    return pickRandom(scored)?.index ?? null;
  }

  let r = Math.random() * total;
  for (const x of scored) {
    r -= x.score;
    if (r <= 0) return x.index;
  }

  return scored[scored.length - 1].index;
}

export function pickCpuLynchTarget(player) {
  const alive = getAliveSlots(player);
  if (!alive.length) return null;

  const trust = judgeLineTrust(player);
  const mediumAlive = isLineAlive(player, PUBLIC_KIND.MEDIUM);

  return weightedPickIndex(alive, (slot) => {
    let score = scoreLynchSlot(slot, trust, mediumAlive);

    // 公開役職は吊れるが少し不利にする
    if (slot.isPublic) score -= 8;

    return score;
  });
}

export function pickCpuReserveTarget(player, seenMap, otherReservedIndex = null) {
  const unseen = hiddenReserveCandidates(player, seenMap);
  if (!unseen.length) return null;

  const primary = unseen.filter(x => x.index !== otherReservedIndex);
  const pool = primary.length ? primary : unseen;

  if (!pool.length) return null;

  return weightedPickIndex(pool, (slot, x) => {
    const a = slot.seerA;
    const b = slot.seerB;

    const blackCount = (a === MARK.BLACK ? 1 : 0) + (b === MARK.BLACK ? 1 : 0);
    const whiteCount = (a === MARK.WHITE ? 1 : 0) + (b === MARK.WHITE ? 1 : 0);

    let score = 0;

    // 1. 片黒最優先
    if (blackCount === 1) {
      score = 100;
    }
    // 2. 未占い
    else if (blackCount === 0 && whiteCount === 0) {
      score = 75;
    }
    // 3. 片白
    else if (blackCount === 0 && whiteCount === 1) {
      score = 45;
    }
    // 4. 両白（ほぼ選ばない）
    else if (blackCount === 0 && whiteCount >= 2) {
      score = 5;
    }
    else {
      score = 20;
    }

    // もう片方の占いと被らない方を優先
    if (otherReservedIndex != null && x.index === otherReservedIndex) {
      score -= 30;
    }

    return score;
  });
}

// ============================
// 噛み・狩人 共通分類
// ============================

function classifyProtectTarget(slot, trust) {
  const a = slot.seerA;
  const b = slot.seerB;

  const aBlack = a === MARK.BLACK;
  const aWhite = a === MARK.WHITE;
  const bBlack = b === MARK.BLACK;
  const bWhite = b === MARK.WHITE;

  const trueLike = trust.trueLike;

  // 占い
  if (slot.isPublic && (slot.publicKind === PUBLIC_KIND.A || slot.publicKind === PUBLIC_KIND.B)) {
    if (trueLike === "A" && slot.publicKind === PUBLIC_KIND.A) return "SEER_HIGH";
    if (trueLike === "B" && slot.publicKind === PUBLIC_KIND.B) return "SEER_HIGH";

    if (trueLike === "A" && slot.publicKind === PUBLIC_KIND.B) return "SEER_LOW";
    if (trueLike === "B" && slot.publicKind === PUBLIC_KIND.A) return "SEER_LOW";

    return "SEER_FLAT";
  }

  // 霊媒
  if (slot.isPublic && slot.publicKind === PUBLIC_KIND.MEDIUM) {
    return "MEDIUM";
  }

  // 確定白
  if (aWhite && bWhite) return "CERT_WHITE";

  const blackCount = (aBlack ? 1 : 0) + (bBlack ? 1 : 0);
  const whiteCount = (aWhite ? 1 : 0) + (bWhite ? 1 : 0);

  // グレー
  if (blackCount === 0 && whiteCount === 0) return "GRAY";

  // 片白
  if (blackCount === 0 && whiteCount === 1) {
    return "HALF_WHITE";
  }

  // 片黒
  if (blackCount === 1) {
    return "HALF_BLACK";
  }

  // 両黒
  if (aBlack && bBlack) return "BLACK";

  return "GRAY";
}


// ============================
// 噛み優先スコア
// ============================

function biteScore(cls, mediumTop = false) {

  if (mediumTop) {
    if (cls === "MEDIUM") return 200;
  }

  if (cls === "SEER_HIGH") return 120;
  if (cls === "SEER_FLAT") return 110;
  if (cls === "SEER_LOW") return 100;

  if (cls === "MEDIUM") return 90;

  if (cls === "CERT_WHITE") return 80;
  if (cls === "HALF_WHITE") return 70;
  if (cls === "GRAY") return 60;
  if (cls === "HALF_BLACK") return 30;
  if (cls === "BLACK") return 10;

  return 0;
}


// ============================
// 直前吊りが白黒か
// ============================

function lastLynchWasSplit(game) {

  if (!game.lastLynchedSlot) return false;

  const slot = game.lastLynchedSlot;

  const a = slot.seerA;
  const b = slot.seerB;

  return (
    (a === MARK.WHITE && b === MARK.BLACK) ||
    (a === MARK.BLACK && b === MARK.WHITE)
  );
}


// ============================
// 両黒存在判定
// ============================

function existDoubleBlack(players) {
  for (const p of players) {
    for (const s of p.slots) {

      if (s.dead) continue;

      if (s.seerA === MARK.BLACK && s.seerB === MARK.BLACK) {
        return true;
      }
    }
  }

  return false;
}


// ============================
// CPU 噛み
// ============================

export function pickCpuBiteTarget(selfPlayer, game) {

  const cands = getAliveBiteTargets(selfPlayer);
  if (!cands.length) return null;

  const trust = judgeLineTrust(selfPlayer);

  let mediumTop = false;

  if (lastLynchWasSplit(game)) {
    mediumTop = true;
  }

  else if (existDoubleBlack(game.players)) {
    mediumTop = true;
  }

  return weightedPickIndex(cands, (slot) => {

    const cls = classifyProtectTarget(slot, trust);

    return biteScore(cls, mediumTop);

  });

}


// ============================
// CPU 狩人
// ============================

export function pickCpuGuardTarget(selfPlayer, game) {

  const cands = getAliveGuardTargets(selfPlayer);
  if (!cands.length) return null;

  const trust = judgeLineTrust(selfPlayer);

  let mediumTop = false;

  if (lastLynchWasSplit(game)) {
    mediumTop = true;
  }

  else if (existDoubleBlack(game.players)) {
    mediumTop = true;
  }

  return weightedPickIndex(cands, (slot) => {

    const cls = classifyProtectTarget(slot, trust);

    return biteScore(cls, mediumTop);

  });

}
