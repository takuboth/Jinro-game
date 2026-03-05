// /js/main.js（パスは /js 配下前提：importは相対でOK）
import { CONFIG } from "./config.js";
import {
  makeNewGame,
  runAutoUntilHumanTurn,
  applyHumanPick,
  canAbsentOk,
  doAbsentOk
} from "./game.js";
import { deriveViewModel } from "./viewModel.js";
import { buildRenderer } from "./renderer.js";

let game = null;
let viewAsId = 0;

const root = document.getElementById("app");

function showFatal(err){
  const msg = (err && err.stack) ? err.stack : String(err);
  const s = root.querySelector("#txtStatus");
  const a = root.querySelector("#txtActing");
  if (s) s.textContent = "JSエラーで停止";
  if (a) a.textContent = msg.slice(0, 200);
}

try {
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

  function render(){
    const vm = deriveViewModel(game, viewAsId);
    renderer.update(vm);
    btnAbsentOk.disabled = !canAbsentOk(game);
  }

  function newGame(){
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

} catch (err) {
  showFatal(err);
  throw err;
}
