// utils.js

(function(){
  // 依存：ROLES はグローバル（config.jsで定義）想定

  function pickRandom(arr){
    return arr[Math.floor(Math.random()*arr.length)];
  }

  // ★人狼が2人いるときの反転優先順位：村人→狂人→霊媒→狩人→占い→人狼
  function cpuPickMadInvertIndexByWolfStock(actor){
    const buckets = {
      VILLAGER: [],
      MAD: [],
      MEDIUM: [],
      GUARD: [],
      SEER: [],
      WOLF: [],
    };

    for(let i=0;i<actor.slots.length;i++){
      const s = actor.slots[i];
      if(s.dead) continue;
      if(s.role === ROLES.VILLAGER) buckets.VILLAGER.push(i);
      else if(s.role === ROLES.MAD) buckets.MAD.push(i);
      else if(s.role === ROLES.MEDIUM) buckets.MEDIUM.push(i);
      else if(s.role === ROLES.GUARD) buckets.GUARD.push(i);
      else if(s.role === ROLES.SEER) buckets.SEER.push(i);
      else if(s.role === ROLES.WOLF) buckets.WOLF.push(i);
    }

    const wolvesAlive = buckets.WOLF.length;

    // 生存WOLFが2枚以上 → 優先順位（村人→狂人→霊媒→狩人→占い→人狼）
    if(wolvesAlive >= 2){
      const order = ["VILLAGER","MAD","MEDIUM","GUARD","SEER","WOLF"];
      for(const k of order){
        if(buckets[k].length) return pickRandom(buckets[k]);
      }
      return null;
    }

    // 生存WOLFが1枚 → 反転対象はWOLF（その1枚）
    if(wolvesAlive === 1){
      return buckets.WOLF[0];
    }

    return null;
  }

  // window に生やす（重要）
  window.cpuPickMadInvertIndexByWolfStock = cpuPickMadInvertIndexByWolfStock;

  // もし main 側で pickRandom を使ってるなら、これも公開
  window.pickRandom = window.pickRandom || pickRandom;
})();
