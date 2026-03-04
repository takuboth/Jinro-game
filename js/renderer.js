import { roleChar } from "./viewModel.js";

export function buildRenderer(rootEl, onSlotClick){
  const playersWrap = rootEl.querySelector("#players");
  if (!playersWrap) throw new Error("#players not found");

  const txtStatus = rootEl.querySelector("#txtStatus");
  const txtActing = rootEl.querySelector("#txtActing");

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

      // slot frame svg（slot側に光沢が入ってる想定）
      const frame = document.createElement("img");
      frame.className = "slotFrame";
      frame.src = "./img/slot.svg";
      frame.alt = "";
      slot.appendChild(frame);

      slot.addEventListener("click", ()=>{
        const p = Number(slot.dataset.pid);
        const s = Number(slot.dataset.sid);
        onSlotClick(p, s);
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
    txtStatus.textContent = vm.status;
    txtActing.textContent = vm.acting;

    for (const p of vm.players){
      const focus = Array.isArray(vm.focusPlayers) ? vm.focusPlayers : [];
      const isFocus = (!vm.humanCanAct) || focus.includes(p.id);

      playerEls[p.id].classList.toggle("dim", vm.humanCanAct && !isFocus && !vm.game.over);

      headerNameEls[p.id].textContent = p.name;

      badgeWolfEls[p.id].className = `badge ${p.mediumClass}` + (p.alive ? "" : " retired");
      badgeWolfEls[p.id].textContent = `人狼:${(p.mediumVal===null?"-":p.mediumVal)}`;

      badgeVillageEls[p.id].className = "badge" + (p.alive ? "" : " retired");
      badgeVillageEls[p.id].textContent = `村役:${p.villageTotal}`;

      for (const s of p.slots){
        const el = slotEls[p.id][s.idx];
        const roleEl = roleEls[p.id][s.idx];

        el.classList.toggle("dead", !!s.dead);
        el.classList.toggle("disabled", !p.alive);
        el.classList.toggle("clickable", !!vm.clickable[p.id][s.idx]);

        const revealAll = (vm.game && vm.game.over === true);
        const showRole = revealAll || (p.id === vm.viewAsId);
        roleEl.textContent = showRole ? roleChar(s.role) : "";

        const orbs = orbEls[p.id][s.idx];
        const isSelfView = (p.id === vm.viewAsId);

        // TL: guard（本人だけ）
        const guardActive = isSelfView && (typeof p.guardIndex === "number" && p.guardIndex === s.idx);
        setCore(orbs.tl, guardActive ? "guard" : "gray");

        // TR: invert（未発動＆本人だけ）
        const invertActive = isSelfView && (!p.madUsed && typeof p.invertIndex === "number" && p.invertIndex === s.idx);
        setCore(orbs.tr, invertActive ? "invert" : "gray");

        // BR: seer mark（公開）
        if (s.mark === "WHITE") setCore(orbs.br, "white");
        else if (s.mark === "BLACK") setCore(orbs.br, "black");
        else setCore(orbs.br, "gray");

        // 公開占い：リング金
        setPublic(orbs.br, !!s.isPublicSeer);

        // BL: 未使用
        setCore(orbs.bl, "gray");
      }
    }
  }

  return { update };
}
