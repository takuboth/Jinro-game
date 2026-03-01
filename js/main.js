import { CONFIG } from "./config.js";
import { makeNewGame, runAutoUntilHumanTurn, applyHumanPick, canAbsentOk, doAbsentOk } from "./game.js";
import { deriveViewModel } from "./viewModel.js";
import { buildRenderer } from "./renderer.js";

let game = null;
let viewAsId = 0;

const btnNew = document.getElementById("btnNew");
const selViewAs = document.getElementById("selViewAs");
const root = document.getElementById("app");

const renderer = buildRenderer(document, (playerId, slotIndex) => {
  // クリック可能判定はviewModel側で計算済み。ここでは「無効クリックは無視」だけ。
  const vm = deriveViewModel(game, viewAsId);
  if (!vm.clickable[playerId][slotIndex]) return;

  applyHumanPick(game, viewAsId, playerId, slotIndex);

  // 人間操作後、CPUを一気に回す
  runAutoUntilHumanTurn(game);

  render();
});

function render(){
  console.log("viewAsId", viewAsId);
  const vm = deriveViewModel(game, viewAsId);
  renderer.update(vm);

  // 不在→OK
  const ok = canAbsentOk(game);
  document.getElementById("btnAbsentOk").disabled = !ok;
}

function newGame(){
  game = makeNewGame(null);
  viewAsId = 0;
  selViewAs.value = "0";

  // 初期のCPU進行（P1以外を回す）
  runAutoUntilHumanTurn(game);
  render();
}

// UI events
btnNew.addEventListener("click", ()=>{
  newGame();
});
selViewAs.addEventListener("change", ()=>{
  viewAsId = Number(selViewAs.value);
  render();
});
document.getElementById("btnAbsentOk").addEventListener("click", ()=>{
  doAbsentOk(game);
  runAutoUntilHumanTurn(game);
  render();
});
const btnLog = document.getElementById("btnLog");
const logBox = document.getElementById("logBox");

btnLog.addEventListener("click", ()=>{
  logBox.open = !logBox.open;
});
// start
newGame();
