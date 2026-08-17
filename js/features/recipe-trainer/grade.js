// grade.js — 채점 엔진 (순수 함수, DOM 비의존, 테스트 대상)
// 오류 유형을 독립적으로 카운트: size / ingredient / order / fill / qty / process / finish
// 순서는 집합 diff + LCS 정렬로 연쇄 오류를 방지한다.

import { isMarker, phaseGroupOf, qtyEqual, SIZE_FOR_CONSTRAINT } from './model.js';

export const COMPONENT_TYPES = ['size', 'ingredient', 'order', 'fill', 'qty', 'process', 'finish'];

function ingredientOnly(steps) {
  return steps.filter((s) => !isMarker(s));
}

// 멀티셋 차집합: 정답 대비 누락/추가 (다중도 고려)
function multisetDiff(correctIds, userIds) {
  const countOf = (arr) => arr.reduce((m, id) => m.set(id, (m.get(id) || 0) + 1), new Map());
  const c = countOf(correctIds);
  const u = countOf(userIds);
  const missing = [];
  const extra = [];
  const ids = new Set([...c.keys(), ...u.keys()]);
  for (const id of ids) {
    const diff = (c.get(id) || 0) - (u.get(id) || 0);
    if (diff > 0) for (let i = 0; i < diff; i++) missing.push(id);
    else if (diff < 0) for (let i = 0; i < -diff; i++) extra.push(id);
  }
  return { missing, extra };
}

function multisetIntersectionSize(a, b) {
  const countOf = (arr) => arr.reduce((m, id) => m.set(id, (m.get(id) || 0) + 1), new Map());
  const ca = countOf(a);
  const cb = countOf(b);
  let n = 0;
  for (const [id, k] of ca) n += Math.min(k, cb.get(id) || 0);
  return n;
}

// 두 시퀀스의 LCS 길이 (동일 id 비교)
function lcsLength(a, b) {
  const n = a.length;
  const m = b.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[n][m];
}

// id별 등장 순서대로 정답/사용자 occurrence를 페어링 (fill/qty/phase 비교용)
function pairOccurrences(correctSteps, userSteps) {
  const grp = (steps) => {
    const map = new Map();
    for (const s of steps) {
      if (!map.has(s.ingredientId)) map.set(s.ingredientId, []);
      map.get(s.ingredientId).push(s);
    }
    return map;
  };
  const cmap = grp(correctSteps);
  const umap = grp(userSteps);
  const pairs = [];
  for (const [id, clist] of cmap) {
    const ulist = umap.get(id) || [];
    const k = Math.min(clist.length, ulist.length);
    for (let i = 0; i < k; i++) pairs.push({ id, c: clist[i], u: ulist[i] });
  }
  return pairs;
}

function fillEqual(a, b) {
  return (a == null ? null : a) === (b == null ? null : b);
}

/**
 * @param {object} recipe  정규화된 정답 레시피
 * @param {object} attempt { size, steps:[{ingredientId,phase,fill,qty}|{type:'marker'}] }
 * @returns {object} { isCorrect, score, errors, messages }
 */
export function gradeAttempt(recipe, attempt) {
  const errors = { size: 0, ingredient: 0, order: 0, fill: 0, qty: 0, process: 0, finish: 0 };
  const messages = [];

  // 1) 사이즈
  if (recipe.sizeConstraint) {
    const needed = SIZE_FOR_CONSTRAINT[recipe.sizeConstraint];
    if (attempt.size && needed && attempt.size !== needed) {
      errors.size = 1;
      messages.push({ type: 'size', text: `이 메뉴는 ${needed} 전용입니다 (${recipe.sizeConstraint}).` });
    }
  }

  const correctSteps = ingredientOnly(recipe.steps);
  const userSteps = ingredientOnly(attempt.steps || []);
  const correctIds = correctSteps.map((s) => s.ingredientId);
  const userIds = userSteps.map((s) => s.ingredientId);

  // 2) 재료(집합) 오류 — 순서와 독립
  const { missing, extra } = multisetDiff(correctIds, userIds);
  errors.ingredient = missing.length + extra.length;
  if (missing.length) messages.push({ type: 'ingredient', text: `누락된 재료: ${missing.join(', ')}` });
  if (extra.length) messages.push({ type: 'ingredient', text: `잘못 넣은 재료: ${extra.join(', ')}` });

  // 3) 순서 오류 — 공통 재료의 LCS로 계산 (누락/삽입이 연쇄 오류를 일으키지 않음)
  const inter = multisetIntersectionSize(correctIds, userIds);
  const lcs = lcsLength(correctIds, userIds);
  errors.order = Math.max(0, inter - lcs);
  if (errors.order > 0) messages.push({ type: 'order', text: `투입 순서가 어긋난 재료가 있습니다 (${errors.order}건).` });

  // 4~7) 페어링 기반: fill / qty / process(pre vs post) / finish
  const pairs = pairOccurrences(correctSteps, userSteps);
  for (const { id, c, u } of pairs) {
    if (!fillEqual(c.fill, u.fill)) {
      errors.fill++;
      messages.push({ type: 'fill', text: `${id}의 기준선이 다릅니다 (정답: ${c.fill || '없음'}).` });
    }
    if (!qtyEqual(c.qty, u.qty)) {
      errors.qty++;
      messages.push({ type: 'qty', text: `${id}의 수량이 다릅니다.` });
    }
    const cg = phaseGroupOf(c);
    const ug = phaseGroupOf(u);
    if (cg !== ug) {
      if (cg === 'finish' || ug === 'finish') {
        errors.finish++;
        messages.push({ type: 'finish', text: `${id}의 마무리 위치가 다릅니다 (정답 단계: ${c.phase}).` });
      } else {
        errors.process++;
        messages.push({ type: 'process', text: `${id}의 처리 단계가 다릅니다 (정답: ${c.phase}).` });
      }
    }
  }

  // 블렌더 마커 존재 여부
  const correctHasBlend = recipe.steps.some(isMarker);
  const userHasBlend = (attempt.steps || []).some(isMarker);
  if (correctHasBlend !== userHasBlend) {
    errors.process++;
    messages.push({ type: 'process', text: correctHasBlend ? '블렌딩 단계가 빠졌습니다.' : '이 메뉴는 블렌딩하지 않습니다.' });
  }

  const totalErrors = COMPONENT_TYPES.reduce((n, k) => n + errors[k], 0);
  const isCorrect = totalErrors === 0;

  // 점수: 검사 대상 필드 수 기준 감점 (하한 0)
  const denom = Math.max(
    1,
    (recipe.sizeConstraint ? 1 : 0) + correctIds.length + inter + pairs.length + (correctHasBlend ? 1 : 0)
  );
  const score = Math.max(0, Math.round(100 * (1 - totalErrors / denom)));

  return { isCorrect, score, errors, messages, failedTypes: COMPONENT_TYPES.filter((t) => errors[t] > 0) };
}
