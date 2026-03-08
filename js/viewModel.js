import { CONFIG, ROLES, PHASES } from "./config.js";
import { wolfCount, villageRolesTotal, hasRoleAlive, leftPlayerIndex, rightPlayerIndex } from "./game.js";
import { getMark, isPublicSeerSlot } from "./utils.js";

export function roleChar(role){
  if (role === ROLES.WOLF) return "狼";
  if (role === ROLES.MAD) return "狂";
  if (role === ROLES.SEER) return "占";
  if (role === ROLES.GUARD) return "狩";
  if (role === ROLES.MEDIUM) return "霊";
  return "村";
}

function phaseLabel(phase){
  switch (phase){
    case PHASES.ROUND0_MAD: return "Round0: 狂人設定";
    case PHASES.ROUND0_GUARD: return "Round0: 狩人守り";
    case PHASES.SEER: return "占い";
    case PHASES.LYNCH: return "吊り";
    case PHASES.MAD: return "狂人設定";
    case PHASES.GUARD: return "狩人守り";
    case PHASES.BITE: return "噛み";
    case PHASES.END: return "終了";
    default: return String(phase);
  }
}

export function deriveViewModel(game, viewAsId){
  const humanId = CONFIG.humanPlayerId;
  const actorId = game.turn;

  const humanCanAct = (!game.over && actorId === humanId && game.players[humanId].alive);

  // クリック可能マトリクス
  const clickable = Array.from({length:4}, ()=>Array(9).fill(false));

  const left = leftPlayerIndex(game, actorId);
  const right = rightPlayerIndex(game, actorId);

  // どのプレイヤー枠を明るくするか（対象だけ）
  let focusPlayers = [];

  if (humanCanAct){
    if (game.phase === PHASES.SEER || game.phase === PHASES.LYNCH) focusPlayers = (left===null)?[]:[left];
    else if (game.phase === PHASES.BITE) focusPlayers = (right===null)?[]:[right];
    else focusPlayers = [actorId];
  }

  // clickable の付与
  if (humanCanAct){
    // 自分のターンで、対象プレイヤーのスロットだけクリック可能にする
    if (game.phase === PHASES.ROUND0_MAD || game.phase === PHASES.MAD){
      const pl = game.players[actorId];
      for (let i=0;i<9;i++){
        clickable[actorId][i] = !pl.slots[i].dead; // DEADは不可
      }
    }
    else if (game.phase === PHASES.ROUND0_GUARD || game.phase === PHASES.GUARD){
      const pl = game.players[actorId];
      for (let i=0;i<9;i++){
        const s = pl.slots[i];
        clickable[actorId][i] = (!s.dead && s.role !== ROLES.GUARD && s.role !== ROLES.WOLF);
      }
    }
    else if (game.phase === PHASES.SEER){
      if (left !== null){
        const tgt = game.players[left];
        for (let i=0;i<9;i++) clickable[left][i] = !tgt.slots[i].dead;
      }
    }
    else if (game.phase === PHASES.LYNCH){
      if (left !== null){
        const tgt = game.players[left];
        for (let i=0;i<9;i++) clickable[left][i] = !tgt.slots[i].dead;
      }
    }
    else if (game.phase === PHASES.BITE){
      if (right !== null){
        const tgt = game.players[right];
        for (let i=0;i<9;i++) clickable[right][i] = !tgt.slots[i].dead;
      }
    }
  }

  // 霊媒表示（View as 依存）
  const viewer = game.players[viewAsId];
  const viewerHasMediumAlive = hasRoleAlive(viewer, ROLES.MEDIUM);
  const viewerSnapshot = viewer.mediumWolfSnapshot;

  function mediumValFor(playerId){
    if (viewerHasMediumAlive) return wolfCount(game.players[playerId]);
    if (viewerSnapshot && typeof viewerSnapshot[playerId] === "number") return viewerSnapshot[playerId];
    return null;
  }
  function mediumClass(){
    if (viewerHasMediumAlive) return "mediumOn";
    if (viewerSnapshot) return "mediumOff";
    return "mediumNone";
  }

  const status = game.over
    ? `終了（勝者: ${game.winners.map(id=>`P${id+1}`).join(", ")}）`
    : phaseLabel(game.phase);

  const acting = game.over
    ? ""
    : `手番: P${actorId+1}`;

  // players view model
 const players = game.players.map(p => {
  const revealAll = !p.alive;

  return {
    id: p.id,
    name: `P${p.id+1}`,
    alive: p.alive,
    escaped: !!p.escaped,
    revealAll,

    mediumVal: mediumValFor(p.id),
    mediumClass: mediumClass(),

    villageTotal: villageRolesTotal(p),

    guardIndex: p.guardIndex,
    invertIndex: p.invertIndex,
    madUsed: p.madUsed,

    slots: p.slots.map((s, idx) => ({
      idx,
      role: s.role,
      dead: s.dead,
      mark: getMark(s),
      isPublicSeer: isPublicSeerSlot(game, p.id, idx),
      revealRole: revealAll,
    })),
  };
});

  return {
    game,
    viewAsId,
    humanCanAct,
    focusPlayers,
    clickable,
    status,
    acting,
    players,
  };
}
