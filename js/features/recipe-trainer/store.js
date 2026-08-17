// store.js — JSON 진실소스 로드 + in-memory 편집 작업본 + SRS localStorage
import { normalizeData } from './model.js';

const BASE = new URL('../../../data/recipe-trainer/', import.meta.url);

let cache = null; // { ingredients, recipes, ... }
let working = null; // 편집 작업본(원본 문서 형태 유지: {revision, items})

async function fetchJson(name) {
  const res = await fetch(new URL(name, BASE));
  if (!res.ok) throw new Error(`${name} 로드 실패: ${res.status}`);
  return res.json();
}

export async function loadData(force = false) {
  if (cache && !force) return cache; // 이미 로드됨(중복 fetch로 원격 적용분을 덮지 않도록)
  const [ing, rec] = await Promise.all([fetchJson('ingredients.json'), fetchJson('recipes.json')]);
  working = { ingredients: structuredClone(ing), recipes: structuredClone(rec) };
  cache = normalizeData(working.ingredients, working.recipes);
  if (cache.warnings.length) console.warn('[recipe-trainer] 참조 무결성 경고:', cache.warnings);
  return cache;
}
export function isLoaded() { return !!cache; }

export function getData() {
  if (!cache) throw new Error('loadData() 먼저 호출');
  return cache;
}

export function getWorkingDocs() {
  return working;
}

// 섹션 문서({revision, items}) 접근/교체 — 동기화 레이어용
export function getSectionDoc(section) {
  return section === 'ingredients' ? working.ingredients : working.recipes;
}
export function replaceSectionDoc(section, doc) {
  if (!doc) return cache;
  if (section === 'ingredients') working.ingredients = doc; else working.recipes = doc;
  return recompute();
}

// 변경 구독(동기화 push 트리거용). section: 'ingredients' | 'recipes'
const _listeners = [];
export function onChange(cb) { if (typeof cb === 'function') _listeners.push(cb); }
function emit(section) { for (const cb of _listeners) { try { cb(section); } catch {} } }

// 정규화 재계산(편집 후)
function recompute() {
  cache = normalizeData(working.ingredients, working.recipes);
  return cache;
}

// ---- CRUD (in-memory 작업본) ----
export function upsertIngredient(item) {
  const arr = working.ingredients.items;
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = item; else arr.push(item);
  const c = recompute(); emit('ingredients'); return c;
}
export function deleteIngredient(id) {
  working.ingredients.items = working.ingredients.items.filter((x) => x.id !== id);
  const c = recompute(); emit('ingredients'); return c;
}
export function upsertRecipe(item) {
  const arr = working.recipes.items;
  const i = arr.findIndex((x) => x.id === item.id);
  if (i >= 0) arr[i] = item; else arr.push(item);
  const c = recompute(); emit('recipes'); return c;
}
export function deleteRecipe(id) {
  working.recipes.items = working.recipes.items.filter((x) => x.id !== id);
  const c = recompute(); emit('recipes'); return c;
}

// ---- export / import ----
export function exportDoc(which) {
  const doc = which === 'ingredients' ? working.ingredients : working.recipes;
  doc.revision = (doc.revision || 0) + 1;
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${which}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// returns {ok, warning}
export function importDoc(which, parsed) {
  const current = which === 'ingredients' ? working.ingredients : working.recipes;
  let warning = null;
  if ((parsed.revision ?? 0) < (current.revision ?? 0)) {
    warning = `가져온 ${which} revision(${parsed.revision ?? 0})이 현재(${current.revision ?? 0})보다 낮습니다. 구버전을 덮어쓰려 합니다.`;
  }
  if (which === 'ingredients') working.ingredients = parsed; else working.recipes = parsed;
  recompute();
  emit(which);
  return { ok: true, warning };
}
