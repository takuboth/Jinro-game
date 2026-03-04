import { roleChar } from "./viewModel.js";

export function buildRenderer(rootEl, onSlotClick){
  const playersWrap = rootEl.querySelector("#players");
  const txtStatus = rootEl.querySelector("#txtStatus");
  const txtActing = rootEl.querySelector("#txtActing");

  if (!playersWrap) {
    throw new Error("#players not found. rootEl must be #app or inside it.");
  }

  // 参照保持
  const playerEls = [];
  const headerNameEls = [];
  const badgeMediumEls = [];
  const badgeVillageEls = [];
  const slotEls = Array.from({length:4}, ()=>Array(9).fill(null));
  const roleEls = Array.from({length:4}, ()=>Array(9).fill(null));
  const orbEls = Array.from({length:4}, ()=>Array.from({length:9}, ()=>({tl:null,tr:null,br:null,bl:null})));

  // DOM固定生成
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

    const bMedium = document.createElement("span");
    bMedium.className = "badge";
    bMedium.textContent = "人狼:-";

    const bVillage = document.createElement("span");
    bVillage.className = "badge";
    bVillage.textContent = "村役:-";

    right.appendChild(bMedium);
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

      // orbs 4 corners
      function makeOrb(pos){
        const o = document.createElement("div");
        o.className = `orb ${pos}`;

        const ring = document.createElement("div");
        ring.className = "ring";

        const core = document.createElement("div");
        core.className = "core gray";

        // 光/縁取り（上に重ねる画像）
        const fx = document.createElement("img");
        fx.className = "fx";
        fx.alt = "";
        fx.src = "./img/orb_fx.png";

        o.appendChild(ring);
        o.appendChild(core);
        o.appendChild(fx);

        return {wrap:o, ring, core, fx};
      }

      const tl = makeOrb("tl");
      const tr = makeOrb("tr");
      const br = makeOrb("br");
      const bl = makeOrb("bl");

      slot.appendChild(tl.wrap);
      slot.appendChild(tr.wrap);
      slot.appendChild(br.wrap);
      slot.appendChild(bl.wrap);

      // center role (仮：文字)
      const role = document.createElement("div");
      role.className = "role";
      role.textContent = "";
      slot.appendChild(role);

      // click
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
    badgeMediumEls[pid] = bMedium;
    badgeVillageEls[pid] = bVillage;
  }

  function setCore(orbObj, cls, active){
    const {wrap, core} = orbObj;
    wrap.classList.toggle("active", !!active);
    core.className = "core " + cls;
  }

  function setRingPublic(orbObj, isPublic){
    orbObj.wrap.classList.toggle("public", !!isPublic);
  }

  function update(vm){
    if (txtStatus) txtStatus.textContent = vm.status;
    if (txtActing) txtActing.textContent = vm.acting;

    for (const p of vm.players){
      const focus = Array.isArray(vm.focusPlayers) ? vm.focusPlayers : [];
      const isFocus = (!vm.humanCanAct) || focus.includes(p.id);
      playerEls[p.id].classList.toggle("dim", vm.humanCanAct && !isFocus && !vm.game.over);

      headerNameEls[p.id].textContent = p.name;

      // badges
      badgeMediumEls[p.id].className = "badge" + (p.alive ? "" : " retired");
      badgeMediumEls[p.id].textContent = `人狼:${(p.mediumVal===null?"-":p.mediumVal)}`;

      badgeVillageEls[p.id].className = "badge" + (p.alive ? "" : " retired");
      badgeVillageEls[p.id].textContent = `村役:${p.villageTotal}`;

      for (const s of p.slots){
        const el = slotEls[p.id][s.idx];
        const roleEl = roleEls[p.id][s.idx];

        el.classList.toggle("dead", !!s.dead);
        el.classList.toggle("disabled", !p.alive);
        el.classList.toggle("clickable", !!vm.clickable[p.id][s.idx]);

        // role 表示：通常はView as本人だけ / 勝敗確定後は全員オープン
        const revealAll = (vm.game && vm.game.over === true);
        const showRole = revealAll || (p.id === vm.viewAsId);
        roleEl.textContent = showRole ? roleChar(s.role) : "";

        const orbs = orbEls[p.id][s.idx];
        const isSelfView = (p.id === vm.viewAsId);

        // 左上：守り（青）※本人だけ見える
        const guardActive = isSelfView && (typeof p.guardIndex === "number" && p.guardIndex === s.idx);
        setCore(orbs.tl, guardActive ? "guard" : "gray", guardActive);

        // 右上：反転（紫）※未発動かつ本人だけ見える
        const invertActive = isSelfView && (!p.madUsed && typeof p.invertIndex === "number" && p.invertIndex === s.idx);
        setCore(orbs.tr, invertActive ? "invert" : "gray", invertActive);

        // 右下：占い結果（グレー/白/黒）※これは全体公開
        const mark = s.mark;
        if (mark === "WHITE") setCore(orbs.br, "white", true);
        else if (mark === "BLACK") setCore(orbs.br, "black", true);
        else setCore(orbs.br, "gray", false);

        // 公開占い：リング金（固定）
        setRingPublic(orbs.br, !!s.isPublicSeer);

        // 左下：未使用だが同等に表示（薄グレー固定）
        setCore(orbs.bl, "gray", false);
      }
    }
  }

  return { update };
}
