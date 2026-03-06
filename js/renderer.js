// /js/renderer.js
export function buildRenderer(root, onPick){
  const playersEl = root.querySelector("#players");
  const txtStatus = root.querySelector("#txtStatus");
  const txtActing = root.querySelector("#txtActing");

  const playerCards = [];
  const slotEls = [];
  const roleEls = [];
  const orbEls = [];

  function roleChar(role){
    if (role === "WOLF") return "狼";
    if (role === "MAD") return "狂";
    if (role === "SEER") return "占";
    if (role === "GUARD") return "狩";
    if (role === "MEDIUM") return "霊";
    if (role === "VILLAGER") return "村";
    return "";
  }

  playersEl.addEventListener("click", (ev) => {
    const slot = ev.target.closest?.(".slot.clickable");
    if (!slot) return;
    const p = Number(slot.dataset.playerId);
    const s = Number(slot.dataset.slotIndex);
    onPick(p, s);
  });

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

    const wolfBadge = document.createElement("span");
    wolfBadge.className = "badge mediumNone";
    wolfBadge.textContent = "人狼:-";

    const villageBadge = document.createElement("span");
    villageBadge.className = "badge";
    villageBadge.textContent = "村役:-";

    badges.appendChild(wolfBadge);
    badges.appendChild(villageBadge);

    header.appendChild(name);
    header.appendChild(badges);

    const grid = document.createElement("div");
    grid.className = "grid";

    slotEls[p] = [];
    roleEls[p] = [];
    orbEls[p] = [];

    for (let i = 0; i < 9; i++){
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.dataset.playerId = String(p);
      slot.dataset.slotIndex = String(i);

      const tl = makeOrb("tl");
      const tr = makeOrb("tr");
      const br = makeOrb("br");
      const bl = makeOrb("bl");

      slot.appendChild(tl.wrap);
      slot.appendChild(tr.wrap);
      slot.appendChild(br.wrap);
      slot.appendChild(bl.wrap);

      // オーブの上、文字の下に入るスロット画像
      const frame = document.createElement("img");
      frame.className = "slotFrame";
      frame.src = "./img/slot.svg";
      frame.alt = "";
      slot.appendChild(frame);

      const roleText = document.createElement("div");
      roleText.className = "role";
      roleText.textContent = "";
      slot.appendChild(roleText);

      grid.appendChild(slot);

      slotEls[p][i] = slot;
      roleEls[p][i] = roleText;
      orbEls[p][i] = { tl, tr, br, bl };
    }

    card.appendChild(header);
    card.appendChild(grid);
    playersEl.appendChild(card);

    playerCards.push({
      card,
      nameEl: name,
      wolfBadgeEl: wolfBadge,
      villageBadgeEl: villageBadge
    });
  }

  function update(vm){
    if (txtStatus) txtStatus.textContent = vm.status ?? "---";
    if (txtActing) txtActing.textContent = vm.acting ?? "---";

    const players = vm.players ?? [];

    for (let p = 0; p < 4; p++){
      const vPl = players[p];
      if (!vPl) continue;

      const pc = playerCards[p];

      const focus = Array.isArray(vm.focusPlayers) ? vm.focusPlayers : [];
      const isFocus = (!vm.humanCanAct) || focus.includes(vPl.id);
      pc.card.classList.toggle("dim", vm.humanCanAct && !isFocus && !vm.game.over);

      pc.nameEl.textContent = vPl.name ?? `P${p+1}`;

      pc.wolfBadgeEl.className = `badge ${vPl.mediumClass || "mediumNone"}` + (vPl.alive ? "" : " retired");
      pc.wolfBadgeEl.textContent = `人狼:${vPl.mediumVal == null ? "-" : vPl.mediumVal}`;

      pc.villageBadgeEl.className = "badge" + (vPl.alive ? "" : " retired");
      pc.villageBadgeEl.textContent = `村役:${vPl.villageTotal ?? "-"}`;

      const slots = vPl.slots ?? [];
      for (let i = 0; i < 9; i++){
        const vS = slots[i];
        if (!vS) continue;

        const el = slotEls[p][i];
        const roleEl = roleEls[p][i];
        const orbs = orbEls[p][i];

        const dead = !!vS.dead;
        const disabled = !vPl.alive;
        const clickable = !!(vm.clickable?.[p]?.[i]);

        el.classList.toggle("dead", dead);
        el.classList.toggle("disabled", disabled);
        el.classList.toggle("clickable", clickable && !dead && !disabled);
        el.classList.remove("selected");

        const revealAll = !!(vm.game && vm.game.over === true);
        const showRole = revealAll || (p === vm.viewAsId);
        roleEl.textContent = showRole ? roleChar(vS.role) : "";

        const guardActive =
          (p === vm.viewAsId) &&
          (typeof vPl.guardIndex === "number") &&
          (vPl.guardIndex === i);

        setCore(orbs.tl, guardActive ? "guard" : "gray", guardActive);

        const invertActive =
          (p === vm.viewAsId) &&
          (!vPl.madUsed) &&
          (typeof vPl.invertIndex === "number") &&
          (vPl.invertIndex === i);

        setCore(orbs.tr, invertActive ? "invert" : "gray", invertActive);

        if (vS.mark === "WHITE") setCore(orbs.br, "white", true);
        else if (vS.mark === "BLACK") setCore(orbs.br, "black", true);
        else setCore(orbs.br, "gray", false);

        setPublic(orbs.br, !!vS.isPublicSeer);

        setCore(orbs.bl, "gray", false);
      }
    }
  }

  return { update };

  function makeOrb(pos){
    const wrap = document.createElement("div");
    wrap.className = `orb ${pos}`;

    const ring = document.createElement("div");
    ring.className = "ring";

    const core = document.createElement("div");
    core.className = "core gray";

    wrap.appendChild(ring);
    wrap.appendChild(core);

    return { wrap, ring, core };
  }

  function setCore(orbObj, cls, active){
    orbObj.wrap.classList.toggle("active", !!active);
    orbObj.core.className = "core " + cls;
  }

  function setPublic(orbObj, isPublic){
    orbObj.wrap.classList.toggle("public", !!isPublic);
  }
}
