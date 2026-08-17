// srs.js — 컴포넌트 단위 Leitner SRS (localStorage 지속)
const KEY = 'srs.v1';
const INTERVALS_DAYS = [1, 2, 4, 7, 15]; // box 1..5
const DAY = 24 * 60 * 60 * 1000;

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{"items":[]}'); }
  catch { return { items: [] }; }
}
function save(state) {
  localStorage.setItem(KEY, JSON.stringify(state));
}

function itemKey(recipeId, componentType) {
  return `${recipeId}::${componentType}`;
}

// 퀴즈 결과 반영: 틀린 컴포넌트는 큐잉/강등, 맞은 컴포넌트는 승급
// failedTypes: string[], allTypesTested: string[]
export function recordResult(recipeId, failedTypes, allTypesTested, nowMs) {
  const now = nowMs ?? Date.now();
  const state = load();
  const map = new Map(state.items.map((it) => [itemKey(it.recipeId, it.componentType), it]));

  for (const type of allTypesTested) {
    const key = itemKey(recipeId, type);
    const failed = failedTypes.includes(type);
    let it = map.get(key);
    if (failed) {
      if (!it) {
        it = { recipeId, componentType: type, box: 1, dueAt: now, lapses: 0 };
        map.set(key, it);
      } else {
        it.box = 1;
        it.lapses = (it.lapses || 0) + 1;
        it.dueAt = now + INTERVALS_DAYS[0] * DAY;
      }
    } else if (it) {
      it.box = Math.min(5, (it.box || 1) + 1);
      it.dueAt = now + INTERVALS_DAYS[it.box - 1] * DAY;
      if (it.box >= 5) map.delete(key); // 졸업
    }
  }
  state.items = [...map.values()];
  save(state);
  return state;
}

// due 항목(now>=dueAt) 반환 + orphan(존재하지 않는 recipeId) 정리
export function getDueItems(validRecipeIds, nowMs) {
  const now = nowMs ?? Date.now();
  const state = load();
  const valid = new Set(validRecipeIds);
  const before = state.items.length;
  state.items = state.items.filter((it) => valid.has(it.recipeId));
  if (state.items.length !== before) save(state); // orphan 정리 반영
  return state.items.filter((it) => it.dueAt <= now);
}

export function getAllItems() {
  return load().items;
}

export function resetSrs() {
  save({ items: [] });
}
