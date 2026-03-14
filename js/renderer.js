import { CONFIG, MARK } from "./config.js";

export function buildRenderer(root, onPick) {
  const playersEl = root.querySelector("#players");
  const txtStatus = root.querySelector("#txtStatus");
  const txtActing = root.querySelector("#txtActing");

  const playerCards = [];
  const slotEls = [];

  playersEl.addEventListener("click", (ev) => {
    const slot = ev.target.closest?.(".slot.clickable");
    if (!slot) return;
    const p = Number(slot.dataset.playerId);
    const s = Number(slot.dataset.slotIndex);
    onPick(p, s);
  });

  for (let p = 0; p < CONFIG.playerCount; p++) {
    const card = document.createElement("section");
    card.className = "player";
    card.dataset.playerId = String(p);

    const header = document.createElement("div");
    header.className = "playerHeader";

    const left = document.createElement("div");
    left.className = "playerHeadLeft";

    const name = document.createElement("div");
    name.className = "pname";
    name.textContent = `P${p + 1}`;

    const relation = document.createElement("div");
    relation.className = "prelation";
    relation.textContent = "";

    left.appendChild(name);
    left.appendChild(relation);

    const right = document.createElement("div");
    right.className = "playerHeadRight";

    const counts = document.createElement("div");
    counts.className = "counts";
    counts.textContent = "";

    const result = document.createElement("div");
    result.className = "playerResult";
    result.textContent = "";

    right.appendChild(counts);
    right.appendChild(result);

    header.appendChild(left);
    header.appendChild(right);

    const grid = document.createElement("div");
    grid.className = "grid";

    slotEls[p] = [];

    for (let i = 0; i < CONFIG.slotCount; i++) {
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

      const frame = document.createElement("img");
      frame.className = "slotFrame";
      frame.src = "./img/slot.svg";
      frame.alt = "";
      slot.appendChild(frame);

      const role = document.createElement("div");
      role.className = "role";
      role.textContent = "";
      slot.appendChild(role);

      grid.appendChild(slot);

      slotEls[p][i] = {
        root: slot,
        role,
        tl,
        tr,
        br,
        bl,
      };
    }

    card.appendChild(header);
    card.appendChild(grid);
    playersEl.appendChild(card);

    playerCards.push({
      card,
      name,
      relation,
      counts,
      result,
    });
  }

  function update(vm) {
    if (txtStatus) txtStatus.textContent = vm.status ?? "---";
    if (txtActing) txtActing.textContent = vm.acting ?? "---";

    // View as の人が中央になる順で並べ替え
    const order = Array.isArray(vm.displayOrder) ? vm.displayOrder : vm.players.map(p => p.id);
    for (const id of order) {
      if (playerCards[id]) {
        playersEl.appendChild(playerCards[id].card);
      }
    }

    for (let p = 0; p < CONFIG.playerCount; p++) {
      const vPl = vm.players[p];
      const pc = playerCards[p];

      pc.name.textContent = vPl.name;
      pc.relation.textContent = vPl.relation || "";
      pc.counts.textContent = `狼:${vPl.wolfCount} / 非狼:${vPl.nonWolfCount}`;
      pc.result.textContent = vPl.resultText || "";

      const focus = Array.isArray(vm.focusPlayers) ? vm.focusPlayers : [];
      const isFocus = (!vm.humanCanAct) || focus.includes(vPl.id);
      pc.card.classList.toggle("dim", vm.humanCanAct && !isFocus && !vm.game.over);

      for (let i = 0; i < CONFIG.slotCount; i++) {
        const vS = vPl.slots[i];
        const el = slotEls[p][i];

        el.root.classList.toggle("dead", !!vS.dead);
        el.root.classList.toggle("clickable", !!vS.clickable && !vS.dead);
        el.role.textContent = vS.roleText || "";

        setOrb(el.bl, vS.seerA);
        setOrb(el.br, vS.seerB);
        setOrb(el.tr, vS.medium);
        setDeathOrb(el.tl, vS.death);
      }
    }
  }

  return { update };
}

function makeOrb(pos) {
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

function setOrb(orbObj, mark) {
  orbObj.wrap.classList.remove("active");
  orbObj.wrap.classList.remove("deathLynch");
  orbObj.wrap.classList.remove("deathBite");

  let cls = "gray";
  if (mark === MARK.WHITE) {
    cls = "white";
    orbObj.wrap.classList.add("active");
  } else if (mark === MARK.BLACK) {
    cls = "black";
    orbObj.wrap.classList.add("active");
  }

  orbObj.core.className = "core " + cls;
}

function setDeathOrb(orbObj, death) {
  orbObj.wrap.classList.remove("active");
  orbObj.wrap.classList.remove("deathLynch");
  orbObj.wrap.classList.remove("deathBite");

  let cls = "gray";

  if (death === "LYNCH") {
    cls = "blue";
    orbObj.wrap.classList.add("active", "deathLynch");
  } else if (death === "BITE") {
    cls = "red";
    orbObj.wrap.classList.add("active", "deathBite");
  }

  orbObj.core.className = "core " + cls;
}
