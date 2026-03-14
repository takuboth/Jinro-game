let root = document.getElementById("app");

function showFatal(err, where = "") {
  const msg = (err && err.stack) ? err.stack : String(err);
  const s = root?.querySelector?.("#txtStatus");
  const a = root?.querySelector?.("#txtActing");

  if (s) s.textContent = "JSエラーで停止";
  if (a) a.textContent = (where ? `[${where}] ` : "") + msg.slice(0, 240);

  console.error("FATAL", where, err);
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function boot() {
  try {
    const gameMod = await import("./game.js").catch(e => { throw ["./game.js", e]; });
    const vmMod   = await import("./viewModel.js").catch(e => { throw ["./viewModel.js", e]; });
    const renMod  = await import("./renderer.js").catch(e => { throw ["./renderer.js", e]; });
    const cfgMod  = await import("./config.js").catch(e => { throw ["./config.js", e]; });

    const {
      makeNewGame,
      runAutoUntilHumanTurn,
      applyHumanPick,
      canAbsentOk,
      doAbsentOk,
      isHumanTurn,
      cpuDoOneImmediate,
      phaseLabel,
    } = gameMod;

    const { deriveViewModel } = vmMod;
    const { buildRenderer } = renMod;
    const { CONFIG } = cfgMod;

    let game = null;
    let viewAsId = 0;
    let busy = false;

    const btnNew = root.querySelector("#btnNew");
    const selViewAs = root.querySelector("#selViewAs");
    const btnAbsentOk = root.querySelector("#btnAbsentOk");
    const btnCpuMode = root.querySelector("#btnCpuMode");

    const renderer = buildRenderer(root, async (playerId, slotIndex) => {
      if (busy || !game) return;

      const vm = deriveViewModel(game, viewAsId);
      if (!vm.humanCanAct) return;

      busy = true;
      try {
        applyHumanPick(game, viewAsId, playerId, slotIndex);
        render();
        await runCpuTurnsWithMode();
        render();
      } finally {
        busy = false;
      }
    });

    function render(customStatus = null) {
      const vm = deriveViewModel(game, viewAsId);
      if (customStatus) vm.status = customStatus;
      renderer.update(vm);
      btnAbsentOk.disabled = !game || !canAbsentOk(game);
    }

    function renderThinkingStatus() {
      if (!game) return;
      const actorId = game.turn;
      const txt = `P${actorId + 1} が${phaseLabel(game.phase)}を考え中...`;
      render(txt);
    }

    async function runCpuTurnsWithMode() {
      if (!game) return;
      if (!CONFIG.autoPlayers) return;

      if (!CONFIG.cpuOnlineLike) {
        runAutoUntilHumanTurn(game);
        render();
        return;
      }

      let steps = 0;
      while (!game.over && !isHumanTurn(game)) {
        steps += 1;
        if (steps > CONFIG.autoSafetySteps) break;

        renderThinkingStatus();
        await sleep(randInt(CONFIG.cpuThinkMsMin, CONFIG.cpuThinkMsMax));

        cpuDoOneImmediate(game);
        render();

        await sleep(180);
      }
    }

    function refreshCpuModeButton() {
      if (!btnCpuMode) return;
      btnCpuMode.textContent = CONFIG.cpuOnlineLike ? "ON" : "OFF";
    }

    async function newGame() {
      if (busy) return;
      busy = true;
      try {
        game = makeNewGame();
        viewAsId = 0;
        selViewAs.value = "0";
        render();
        await runCpuTurnsWithMode();
        render();
      } finally {
        busy = false;
      }
    }

    btnNew.addEventListener("click", async () => {
      await newGame();
    });

    selViewAs.addEventListener("change", () => {
      if (!game) return;
      viewAsId = Number(selViewAs.value);
      render();
    });

    btnAbsentOk.addEventListener("click", async () => {
      if (busy || !game) return;
      busy = true;
      try {
        doAbsentOk(game);
        render();
        await runCpuTurnsWithMode();
        render();
      } finally {
        busy = false;
      }
    });

    if (btnCpuMode) {
      btnCpuMode.addEventListener("click", () => {
        if (busy) return;
        CONFIG.cpuOnlineLike = !CONFIG.cpuOnlineLike;
        refreshCpuModeButton();
      });
      refreshCpuModeButton();
    }

    await newGame();

  } catch (thrown) {
    if (Array.isArray(thrown) && thrown.length === 2) {
      showFatal(thrown[1], thrown[0]);
    } else {
      showFatal(thrown);
    }
  }
}

boot();
