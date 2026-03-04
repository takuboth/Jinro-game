export function buildRenderer(rootEl, onSlotClick){
  const playersWrap = rootEl.querySelector("#players");
  if (!playersWrap) {
    throw new Error("#players not found (index.htmlに <div id='players'></div> が必要)");
  }

  const txtStatus = rootEl.querySelector("#txtStatus");
  const txtActing = rootEl.querySelector("#txtActing");

  // 役職表示（viewModelに依存しない）
  function roleToChar(r){
    const map = {
      WOLF: "狼",
      MAD: "狂",
      SEER: "占",
      GUARD: "狩",
      MEDIUM: "霊",
      VILLAGER: "村",
    };
    return map[r] ?? "";
  }

  const playerEls = [];
  const headerNameEls = [];
  const badgeWolfEls = [];
  const badgeVillageEls = [];

  const slotEls = Array.from({length:4}, ()=>Array(9).fill(null));
  const roleEls = Array.from({length:4}, ()=>Array(9).fill(null));
  const orbEls  = Array.from({length:4}, ()=>Array.from({length:9}, ()=>({tl:null,tr:null,br:null,bl:null})));

  playersWrap.innerHTML = "";

  for (let pid=0; pid<4; pid++){
    const card = document.createElement("section");
    card.className = "player";
    card.dataset.pid = String(pid);

    const head = document.createElement("div");
    head.className = "playerHeader";

    const left = document.createElement("div");
    const pname = document.createElement("div");
    pname.className = "pname";
    pname.textContent = `P${pid+1}`;
    left.appendChild(pname);

    const right = document.createElement("div");
    right.className = "badges";

    const bWolf = document.createElement("span");
    bWolf.className = "badge mediumNone";
    bWolf.textContent = "人狼:-";

    const bVillage = document.createElement("span");
    bVillage.className = "badge";
    bVillage.textContent = "村役:-";

    right.appendChild(bWolf);
    right.appendChild(bVillage);

    head.appendChild(left);
    head.appendChild(right);

    const grid = document.createElement("div");
    grid.className = "grid";

    for (let i=0;i<9;i++){
      const slot = document.createElement("div");
      slot.className = "slot";
      slot.dataset.pid = String(pid);
      slot.dataset.sid = String(i);

      function makeOrb(pos){
        const o = document.createElement("div");
        o.className = `orb ${pos}`;

        const ring = document.createElement("div");
        ring.className = "ring";

        const core = document.createElement("div");
        core.className = "core gray";

        o.appendChild(ring);
        o.appendChild(core);

        return {wrap:o, ring, core};
      }

      const tl = makeOrb("tl");
      const tr = makeOrb("tr");
      const br = makeOrb("br");
      const bl = makeOrb("bl");

      slot.appendChild(tl.wrap);
      slot.appendChild(tr.wrap);
      slot.appendChild(br.wrap);
      slot.appendChild(bl.wrap);

      const role = document.createElement("div");
      role.className = "role";
      role.textContent = "";
      slot.appendChild(role);

      // slot.svg（光沢入り）
      const frame = document.createElement("img");
      frame.className = "slotFrame";
      frame.src = "./img/slot.svg";
      frame.alt = "";
      slot.appendChild(frame);

      slot.addEventListener("click", ()=>{
        onSlotClick(Number(slot.dataset.pid), Number(slot.dataset.sid));
      });

      grid.appendChild(slot);

      slotEls[pid][i] = slot;
      roleEls[pid][i] = role;
      orbEls[pid][i] = { tl, tr, br, bl };
    }

    card.appendChild(head);
    card.appendChild(grid);
    playersWrap.appendChild(card);

    playerEls[pid] = card;
    headerNameEls[pid] = pname;
    badgeWolfEls[pid] = bWolf;
    badgeVillageEls[pid] = bVillage;
  }

  function setCore(orbObj, cls){
    orbObj.core.className = "core " + cls;
  }
  function setPublic(orbObj, isPublic){
    orbObj.wrap.classList.toggle("public", !!isPublic);
  }

  function update(vm){
    if (txtStatus) txtStatus.textContent = vm.status ?? "---";
    if (txtActing) txtActing.textContent = vm.acting ?? "---";

    for (const p of (vm.players ?? [])){
      playerEls[p.id]?.classList.toggle("dim", !!p.dim);

      if (headerNameEls[p.id]) headerNameEls[p.id].textContent = p.name ?? `P${p.id+1}`;

      if (badgeWolfEls[p.id]) {
        badgeWolfEls[p.id].className = `badge ${p.mediumClass ?? "mediumNone"}` + (p.alive ? "" : " retired");
        badgeWolfEls[p.id].textContent = `人狼:${(p.mediumVal==null?"-":p.mediumVal)}`;
      }
      if (badgeVillageEls[p.id]) {
        badgeVillageEls[p.id].className = "badge" + (p.alive ? "" : " retired");
        badgeVillageEls[p.id].textContent = `村役:${(p.villageTotal==null?"-":p.villageTotal)}`;
      }

      for (const s of (p.slots ?? [])){
        const el = slotEls[p.id][s.idx];
        const roleEl = roleEls[p.id][s.idx];
        if (!el || !roleEl) continue;

        el.classList.toggle("dead", !!s.dead);
        el.classList.toggle("disabled", !p.alive);
        el.classList.toggle("clickable", !!(vm.clickable?.[p.id]?.[s.idx]));

        const showRole = !!s.showRole;
        roleEl.textContent = showRole ? roleToChar(s.role) : "";

        const orbs = orbEls[p.id][s.idx];

        setCore(orbs.tl, s.guard ? "guard" : "gray");
        setCore(orbs.tr, s.invert ? "invert" : "gray");

        if (s.mark === "WHITE") setCore(orbs.br, "white");
        else if (s.mark === "BLACK") setCore(orbs.br, "black");
        else setCore(orbs.br, "gray");

        setPublic(orbs.br, !!s.isPublicSeer);

        setCore(orbs.bl, "gray");
      }
    }
  }

  return { update };
}
