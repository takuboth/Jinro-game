import { CONFIG, ROLES, PHASES } from "./config.js";
import { hasRoleAlive, wolfCount, villageRolesTotal, leftPlayerIndex, rightPlayerIndex } from "./game.js";
import { getMark, isPublicSeerSlot } from "./utils.js";

export function roleChar(role){
  switch(role){
    case ROLES.WOLF: return "狼";
    case ROLES.MAD: return "狂";
    case ROLES.SEER: return "占";
    case ROLES.MEDIUM: return "霊";
    case ROLES.GUARD: return "狩";
    case ROLES.VILLAGER: return "村";
    default: return "?";
  }
}

function phaseLabel(phase){
  return phase;
}

export function deriveViewModel(game, viewAsId){
  const viewAs = game.players[viewAsId];

  // 霊媒（View as 依存）
  const mediumAliveForView = hasRoleAlive(viewAs, ROLES.MEDIUM);
  const mediumArrForView = mediumAliveForView
    ? game.players.map(p => wolfCount(p))
    : (viewAs.mediumWolfSnapshot ? viewAs.mediumWolfSnapshot : null);

  const actorId = game.turn;
  const actor = game.players[actorId];

  // 対象プレイヤー（フェーズ依存）
  const targetLeft = leftPlayerIndex(game, actorId);
  const targetRight = rightPlayerIndex(game, actorId);

  const humanCanAct = (!game.over && actorId === CONFIG.humanPlayerId);

  // クリック可能判定（slotごと）
  const clickable = Array.from({length:4}, ()=>Array(9).fill(false));
  const selected  = Array.from({length:4}, ()=>Array(9).fill(false));

  if (humanCanAct) {
    if (game.phase === PHASES.ROUND0_MAD || game.phase === PHASES.MAD) {
      const pl = actor;
      if (hasRoleAlive(pl, ROLES.MAD) && !pl.madUsed) {
        for (let i=0;i<9;i++){
          if (!pl.slots[i].dead) clickable[actorId][i]=true;
        }
      }
    }

    if (game.phase === PHASES.ROUND0_GUARD || game.phase === PHASES.GUARD) {
      const pl = actor;
      if (hasRoleAlive(pl, ROLES.GUARD)) {
        for (let i=0;i<9;i++){
          const s = pl.slots[i];
          if (s.dead) continue;
          if (s.role === ROLES.GUARD) continue;
          if (s.role === ROLES.WOLF) continue;
          clickable[actorId][i]=true;
        }
      }
    }

    if (game.phase === PHASES.SEER && hasRoleAlive(actor, ROLES.SEER) && targetLeft !== null) {
      const tgt = game.players[targetLeft];
      for (let i=0;i<9;i++) if (!tgt.slots[i].dead) clickable[targetLeft][i]=true;
    }

    if (game.phase === PHASES.LYNCH && targetLeft !== null) {
      const tgt = game.players[targetLeft];
      for (let i=0;i<9;i++) if (!tgt.slots[i].dead) clickable[targetLeft][i]=true;
    }

    if (game.phase === PHASES.BITE && targetRight !== null) {
      const tgt = game.players[targetRight];
      for (let i=0;i<9;i++) if (!tgt.slots[i].dead) clickable[targetRight][i]=true;
    }
  }

  // 選択マーカー（守り/反転は“同一スロット”に出す）
  // ※反転は未発動のときのみ紫を表示（発動済みは非表示）
  // ※守りはguardIndexがある限り表示
  for (const pl of game.players) {
    if (typeof pl.guardIndex === "number") selected[pl.id][pl.guardIndex] = true; // 使い道はrenderer側（青オーブ）
    if (!pl.madUsed && typeof pl.invertIndex === "number") selected[pl.id][pl.invertIndex] = true;
  }

  const players = game.players.map(pl => {
    const mediumVal = mediumArrForView ? mediumArrForView[pl.id] : null;
    const mediumClass = mediumArrForView
      ? (mediumAliveForView ? "mediumOn" : "mediumOff")
      : "mediumNone";

    const villageTotal = villageRolesTotal(pl);

    return {
      id: pl.id,
      alive: pl.alive,
      name: `P${pl.id+1}`,
      mediumVal,
      mediumClass,
      villageTotal,

      // 反転/守りの現在設定
      invertIndex: pl.invertIndex,
      madUsed: pl.madUsed,
      guardIndex: pl.guardIndex,

      // スロット表示用
      slots: pl.slots.map((s, idx) => ({
        idx,
        dead: s.dead,
        role: s.role,
        // seer mark (public)
        mark: getMark(s), // GRAY/WHITE/BLACK
        // seer公開（リング金）
        isPublicSeer: isPublicSeerSlot(game, pl.id, idx),
      })),
    };
  });

  const status = game.over
    ? `終了：勝者 ${game.winners.map(id=>`P${id+1}`).join(", ")}`
    : `ターンP${actorId+1} / フェーズ：${phaseLabel(game.phase)}`;

  const acting = game.over ? "-" : (humanCanAct ? "あなたの番" : `P${actorId+1}が行動中…`);

  return {
    game,
    viewAsId,
    status,
    acting,
    players,
    clickable,
    humanCanAct,
    phase: game.phase,
    turn: game.turn,
    selected,
  };
}
