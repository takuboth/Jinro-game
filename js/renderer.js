// /js/renderer.js（役職は文字のみ、DOM固定生成で描画は差分更新＝見た目も動作も安定）
export function buildRenderer(root, onPick){
  const playersEl = root.querySelector("#players");
  const txtStatus = root.querySelector("#txtStatus");
  const txtActing = root.querySelector("#txtActing");

  const playerCards = [];
  const slotEls = []; // [playerId][slotIndex]

  // クリックは委譲（slot.clickableだけ）
  playersEl.addEventListener("click", (ev) => {
    const slot = ev.target.closest?.(".slot.clickable");
    if (!slot) return;
    const p = Number(slot.dataset.playerId);
    const s = Number(slot.dataset.slotIndex);
    onPick(p, s);
  });

  // 初期DOM（4人×9）
  for (let p = 0; p < 4; p++){
    const card = document.createElement("section");
    card.className = "player";
    card.dataset.playerId = String(p);

    const header = document.createElement("div");
    header.className = "playerHeader";

    const name = document.createElement("div");
    name.className = "pname";
    name.textContent = `P${p+1}`;

    const badges = document.createElement("div");
    badges.className = "badges";

    header.appendChild(name);
    header.appendChild(badges);

    const grid = document.createElement("div");
    grid.className = "grid";

    slotEls[p] = [];

    for (let i = 0; i < 9; i++){
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.dataset.playerId = String(p);
      slot.dataset.slotIndex = String(i);

      // orbs
      slot.appendChild(makeOrb("tl"));
      slot.appendChild(makeOrb("tr"));
      slot.appendChild(makeOrb("br"));
      slot.appendChild(makeOrb("bl"));

      // role text
      const roleText = document.createElement("div");
      roleText.className = "role";
      roleText.textContent = "";
      slot.appendChild(roleText);

      grid.appendChild(slot);
      slotEls[p][i] = slot;
    }

    card.appendChild(header);
    card.appendChild(grid);
    playersEl.appendChild(card);

    playerCards.push({ card, nameEl: name, badgesEl: badges });
  }

  function update(vm){
    if (txtStatus) txtStatus.textContent = pick(vm, ["statusText","status","phaseText"], "---");
    if (txtActing) txtActing.textContent = pick(vm, ["actingText","acting","turnText"], "---");

    const vPlayers = pick(vm, ["players"], []);
    for (let p = 0; p < playerCards.length; p++){
      const vPl = vPlayers[p] || {};
      const pc = playerCards[p];

      pc.card.classList.toggle("dim", !!pick(vPl, ["dim","isDim","retired"], false));
      pc.nameEl.textContent = pick(vPl, ["name","title","label"], `P${p+1}`);

      pc.badgesEl.replaceChildren();
      const b = pick(vPl, ["badges"], []);
      const badgeArr = Array.isArray(b) ? b : (b ? [String(b)] : []);
      for (const t of badgeArr){
        const bd = document.createElement("span");
        bd.className = "badge";
        bd.textContent = t;
        pc.badgesEl.appendChild(bd);
      }

      const vSlots = pick(vPl, ["slots"], []);
      for (let i = 0; i < 9; i++){
        const vS = vSlots[i] || {};
        const el = slotEls[p][i];

        const dead = !!pick(vS, ["dead","isDead"], false);
        const disabled = !!pick(vS, ["disabled","isDisabled"], false);
        const clickable = !!pick(vS, ["clickable","canPick","pickable"], false);
        const selected = !!pick(vS, ["selected","isSelected"], false);

        el.classList.toggle("dead", dead);
        el.classList.toggle("disabled", disabled);
        el.classList.toggle("clickable", clickable && !dead && !disabled);
        el.classList.toggle("selected", selected && !dead && !disabled);

        // 役職文字
        const roleText = el.querySelector(":scope > .role");
        if (roleText){
          roleText.textContent = pick(vS, ["roleText","text","label","roleChar"], "");
        }

        // オーブ（vmにorbsがなければ薄い灰で出す）
        const orbs = pick(vS, ["orbs"], null);
        applyOrb(el, "tl", orbs ? orbs.tl : pick(vS, ["tl"], null));
        applyOrb(el, "tr", orbs ? orbs.tr : pick(vS, ["tr"], null));
        applyOrb(el, "br", orbs ? orbs.br : pick(vS, ["br"], null));
        applyOrb(el, "bl", orbs ? orbs.bl : pick(vS, ["bl"], null));
      }
    }
  }

  return { update };

  function makeOrb(pos){
    const orb = document.createElement("div");
    orb.className = `orb ${pos}`;

    const ring = document.createElement("div");
    ring.className = "ring";

    const core = document.createElement("div");
    core.className = "core gray";

    orb.appendChild(ring);
    orb.appendChild(core);
    return orb;
  }

  function applyOrb(slotEl, pos, data){
    const orb = slotEl.querySelector(`:scope > .orb.${pos}`);
    if (!orb) return;

    const active = !!(data && pick(data, ["active","on","enabled"], false));
    const isPublic = !!(data && pick(data, ["public","isPublic"], false));
    const coreKind = data ? pick(data, ["core","kind","type","color"], "gray") : "gray";

    orb.classList.toggle("active", active);
    orb.classList.toggle("public", isPublic);

    const core = orb.querySelector(":scope > .core");
    if (core){
      core.className = `core ${coreKind || "gray"}`;
    }
  }

  function pick(obj, keys, fallback=null){
    for (const k of keys){
      if (obj && Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined) return obj[k];
    }
    return fallback;
  }
}
