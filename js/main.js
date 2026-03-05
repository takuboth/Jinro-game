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
  // ★ここが表示されないなら main.js 自体が動いてない
  const s0 = root.querySelector("#txtStatus");
  if (s0) s0.textContent = "main.js loaded";

  const btnNew = root.querySelector("#btnNew");
  const selViewAs = root.querySelector("#selViewAs");
  const btnAbsentOk = root.querySelector("#btnAbsentOk");

  if (!btnNew || !selViewAs || !btnAbsentOk) {
    throw new Error("UI要素が見つからない（btnNew/selViewAs/btnAbsentOk）");
  }

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
