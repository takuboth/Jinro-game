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

const btnNew = root.querySelector("#btnNew");
const selViewAs = root.querySelector("#selViewAs");
const btnAbsentOk = root.querySelector("#btnAbsentOk");
const btnLog = root.querySelector("#btnLog");
const logBox = root.querySelector("#logBox");

// renderer は #app の中だけを見る（重要）
const renderer = buildRenderer(root, (playerId, slotIndex) => {
  const vm = deriveViewModel(game, viewAsId);

  // 人間の番じゃないなら無視
  if (!vm.humanCanAct) return;

  // clickable じゃなくても game 側で判定＆スキップ吸収する
  applyHumanPick(game, viewAsId, playerId, slotIndex);

  // 人間操作後にCPUを回す
  runAutoUntilHumanTurn(game);
  render();
});

function render() {
  const vm = deriveViewModel(game, viewAsId);
  renderer.update(vm);

  // 不在→OK
  btnAbsentOk.disabled = !canAbsentOk(game);
}

function newGame() {
  game = makeNewGame(null);
  viewAsId = 0;
  selViewAs.value = "0";

  runAutoUntilHumanTurn(game);
  render();
}

// ---- UI events ----
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

if (btnLog && logBox) {
  btnLog.addEventListener("click", () => {
    logBox.open = !logBox.open;
  });
}

// start
newGame();
