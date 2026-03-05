let root = document.getElementById("app");

function showFatal(err, where = "") {
  const msg = (err && err.stack) ? err.stack : String(err);
  const s = root?.querySelector?.("#txtStatus");
  const a = root?.querySelector?.("#txtActing");

  if (s) s.textContent = "JSエラーで停止";
  if (a) a.textContent = (where ? `[${where}] ` : "") + msg.slice(0, 200);

  // コンソールにも出す（見れる環境なら）
  console.error("FATAL", where, err);
}

async function boot() {
  try {
    // ここで「どの import が死んだか」確実に分かる
    const gameMod = await import("./game.js").catch(e => { throw ["./game.js", e]; });
    const vmMod   = await import("./viewModel.js").catch(e => { throw ["./viewModel.js", e]; });
    const renMod  = await import("./renderer.js").catch(e => { throw ["./renderer.js", e]; });
    const cfgMod  = await import("./config.js").catch(e => { throw ["./config.js", e]; });

    const { makeNewGame, runAutoUntilHumanTurn, applyHumanPick, canAbsentOk, doAbsentOk } = gameMod;
    const { deriveViewModel } = vmMod;
    const { buildRenderer } = renMod;

    let game = null;
    let viewAsId = 0;

    const btnNew = root.querySelector("#btnNew");
    const selViewAs = root.querySelector("#selViewAs");
    const btnAbsentOk = root.querySelector("#btnAbsentOk");

    const renderer = buildRenderer(root, (playerId, slotIndex) => {
      const vm = deriveViewModel(game, viewAsId);
      if (!vm.humanCanAct) return;

      applyHumanPick(game, viewAsId, playerId, slotIndex);
      runAutoUntilHumanTurn(game);
      render();
    });

    function render() {
      const vm = deriveViewModel(game, viewAsId);
      renderer.update(vm);
      btnAbsentOk.disabled = !canAbsentOk(game);
    }

    function newGame() {
      game = makeNewGame(null);
      viewAsId = 0;
      selViewAs.value = "0";
      runAutoUntilHumanTurn(game);
      render();
    }

    btnNew.addEventListener("click", () => newGame());

    selViewAs.addEventListener("change", () => {
      viewAsId = Number(selViewAs.value);
      render();
    });

    btnAbsentOk.addEventListener("click", () => {
      doAbsentOk(game);
      runAutoUntilHumanTurn(game);
      render();
    });

    newGame();

  } catch (thrown) {
    // thrown が ["./xxx.js", Error] の形で来る
    if (Array.isArray(thrown) && thrown.length === 2) {
      showFatal(thrown[1], thrown[0]);
    } else {
      showFatal(thrown);
    }
  }
}

boot();
