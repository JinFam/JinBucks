// model.js — 스키마 정규화, 참조 무결성, 파생 계산 (DOM 비의존 순수 모듈)

export const SIZES = ['TALL', 'GRANDE', 'VENTI'];

export const SIZE_FOR_CONSTRAINT = {
  ONLY_TALL: 'TALL',
  ONLY_GRANDE: 'GRANDE',
};

export function isMarker(step) {
  return step && (step.type === 'marker' || step.phase === 'blend');
}

// step 정규화: type 미지정 시 ingredient로 간주, phase 기본 pre-blend
export function normalizeStep(step) {
  if (isMarker(step)) {
    return { type: 'marker', phase: 'blend', note: step.note || '블렌더 1번' };
  }
  return {
    type: 'ingredient',
    ingredientId: step.ingredientId,
    phase: step.phase || 'pre-blend',
    fill: step.fill == null ? null : step.fill,
    qty: step.qty == null ? null : step.qty,
    note: step.note || null,
  };
}

export function normalizeRecipe(recipe) {
  return {
    ...recipe,
    sizeConstraint: recipe.sizeConstraint || null,
    straw: recipe.straw || null,
    needsReview: !!recipe.needsReview,
    steps: (recipe.steps || []).map(normalizeStep),
  };
}

// 전체 데이터 정규화 + 참조 무결성 검증
export function normalizeData(ingredientsDoc, recipesDoc) {
  const ingredients = (ingredientsDoc.items || []).map((i) => ({
    ...i,
    defaultUnit: i.defaultUnit || 'count',
    needsReview: !!i.needsReview,
  }));
  const byId = new Map(ingredients.map((i) => [i.id, i]));
  const recipes = (recipesDoc.items || []).map(normalizeRecipe);

  const warnings = [];
  for (const r of recipes) {
    for (const s of r.steps) {
      if (s.type === 'marker') continue;
      if (!s.ingredientId) {
        warnings.push(`레시피 '${r.id}'에 ingredientId 없는 재료 step이 있습니다.`);
      } else if (!byId.has(s.ingredientId)) {
        warnings.push(`레시피 '${r.id}'가 존재하지 않는 재료 '${s.ingredientId}'를 참조합니다 (dangling).`);
      }
    }
  }

  return {
    ingredients,
    recipes,
    ingredientsById: byId,
    recipesById: new Map(recipes.map((r) => [r.id, r])),
    revision: { ingredients: ingredientsDoc.revision ?? 0, recipes: recipesDoc.revision ?? 0 },
    warnings,
  };
}

// 재료 step만(마커 제외) 순서대로
export function ingredientSteps(recipe) {
  return recipe.steps.filter((s) => s.type !== 'marker');
}

export function hasBlend(recipe) {
  return recipe.steps.some((s) => s.type === 'marker');
}

// 파생: 블렌딩 전/후 그룹핑 (physical_state 표현용)
export function phaseGroupOf(step) {
  if (step.phase === 'finish') return 'finish';
  if (step.phase === 'post-blend') return 'post';
  return 'pre';
}

export function qtyEqual(a, b) {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return a.value === b.value && a.unit === b.unit;
}

export function qtyToText(q, ingredient) {
  if (q == null) return '';
  const unitMap = { shot: '샷', pump: '펌프', count: '개', line: '', 'scoop-tall': 'Tall 스쿱' };
  const u = unitMap[q.unit] != null ? unitMap[q.unit] : q.unit;
  return `${q.value}${u}`.trim();
}

export const FILL_LABEL = {
  bottom: '하단선',
  middle: '중간선',
  top: '상단선',
  signature: '시그니처(굴곡선)',
  'milk-box': 'Milk 마킹 박스',
};
