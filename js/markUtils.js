import { MARK } from "./config.js";

export function makeEmptyMarks() {
  return {
    seerA: MARK.NONE,
    seerB: MARK.NONE,
    medium: MARK.NONE,
  };
}

export function getSlotMark(slot, key) {
  if (slot?.marks && key in slot.marks) {
    return slot.marks[key];
  }

  // 旧構造互換
  return slot?.[key] ?? MARK.NONE;
}

export function setSlotMark(slot, key, value) {
  if (!slot.marks) {
    slot.marks = makeEmptyMarks();
  }

  slot.marks[key] = value;

  // 旧構造互換
  slot[key] = value;
}

export function clearSlotMarks(slot) {
  slot.marks = makeEmptyMarks();
  slot.seerA = MARK.NONE;
  slot.seerB = MARK.NONE;
  slot.medium = MARK.NONE;
}
