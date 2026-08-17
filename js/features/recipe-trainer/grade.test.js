// grade.test.js — known-answer 픽스처 (node 러너와 test.html이 공유)
import { normalizeRecipe, normalizeData } from './model.js';
import { gradeAttempt } from './grade.js';

// 정답 레시피에서 사용자 attempt steps 복제
function attemptFrom(recipe) {
  return recipe.steps.map((s) =>
    s.type === 'marker'
      ? { type: 'marker', phase: 'blend' }
      : { ingredientId: s.ingredientId, phase: s.phase, fill: s.fill, qty: s.qty }
  );
}

const javachip = normalizeRecipe({
  id: 'javachip-frappuccino', name: '자바칩 프라푸치노', family: 'coffee-frappuccino',
  steps: [
    { ingredientId: 'fr', phase: 'pre-blend' },
    { ingredientId: 'milk', phase: 'pre-blend', fill: 'bottom' },
    { ingredientId: 'bar-mocha', phase: 'pre-blend' },
    { ingredientId: 'java-chip', phase: 'pre-blend' },
    { ingredientId: 'ice', phase: 'pre-blend' },
    { ingredientId: 'coffee-base', phase: 'pre-blend' },
    { type: 'marker', phase: 'blend' },
    { ingredientId: 'whip', phase: 'finish' },
    { ingredientId: 'choco-drizzle', phase: 'finish' },
  ],
});

const strawberryCream = normalizeRecipe({
  id: 'strawberry-cream-frappuccino', name: '딸기 크림', family: 'cream-frappuccino',
  steps: [
    { ingredientId: 'milk', phase: 'pre-blend', fill: 'bottom' },
    { ingredientId: 'ice', phase: 'pre-blend' },
    { ingredientId: 'cream-base', phase: 'pre-blend' },
    { type: 'marker', phase: 'blend' },
    { ingredientId: 'strawberry-syrup', phase: 'post-blend' },
    { ingredientId: 'whip', phase: 'finish' },
  ],
});

const mangoBanana = normalizeRecipe({
  id: 'mango-banana-blended', name: '망고 바나나', family: 'blended', sizeConstraint: 'ONLY_GRANDE',
  steps: [
    { ingredientId: 'mango-base', phase: 'pre-blend', fill: 'bottom' },
    { ingredientId: 'milk', phase: 'pre-blend', fill: 'milk-box' },
    { ingredientId: 'banana', phase: 'pre-blend', qty: { value: 1, unit: 'count' } },
    { ingredientId: 'ice', phase: 'pre-blend', qty: { value: 1, unit: 'scoop-tall' } },
    { type: 'marker', phase: 'blend' },
  ],
});

const greenteaBanana = normalizeRecipe({
  id: 'greentea-banana-blended', name: '그린티 바나나', family: 'blended', sizeConstraint: 'ONLY_GRANDE',
  steps: [
    { ingredientId: 'cream-base', phase: 'pre-blend', fill: 'signature' },
    { ingredientId: 'vanilla-syrup', phase: 'pre-blend', qty: { value: 2, unit: 'pump' } },
    { ingredientId: 'banana', phase: 'pre-blend', qty: { value: 1, unit: 'count' } },
    { ingredientId: 'greentea-powder', phase: 'pre-blend', qty: { value: 2, unit: 'count' } },
    { ingredientId: 'ice', phase: 'pre-blend', qty: { value: 1, unit: 'scoop-tall' } },
    { type: 'marker', phase: 'blend' },
  ],
});

// 중복 재료 시나리오(동일 id 2회)
const dupRecipe = normalizeRecipe({
  id: 'dup-test', name: 'dup', family: 'test',
  steps: [
    { ingredientId: 'espresso', phase: 'pre-blend' },
    { ingredientId: 'milk', phase: 'pre-blend', fill: 'bottom' },
    { ingredientId: 'espresso', phase: 'pre-blend' },
    { type: 'marker', phase: 'blend' },
  ],
});

function only(errors, type) {
  // 지정 type만 >0, 나머지 0인지
  return Object.entries(errors).every(([k, v]) => (k === type ? v > 0 : v === 0));
}

export function runTests() {
  const tests = [];
  const t = (name, fn) => {
    try { const r = fn(); tests.push({ name, pass: r.pass, detail: r.detail }); }
    catch (e) { tests.push({ name, pass: false, detail: String(e && e.stack || e) }); }
  };

  t('정답 입력 → 무오류/100점', () => {
    const g = gradeAttempt(javachip, { steps: attemptFrom(javachip) });
    return { pass: g.isCorrect && g.score === 100, detail: `score=${g.score} errors=${JSON.stringify(g.errors)}` };
  });

  t('재료 오류만 검출 (coffee-base→cream-base 치환)', () => {
    const steps = attemptFrom(javachip);
    steps[5].ingredientId = 'cream-base';
    const g = gradeAttempt(javachip, { steps });
    return { pass: only(g.errors, 'ingredient') && g.errors.ingredient === 2, detail: JSON.stringify(g.errors) };
  });

  t('순서 오류만 검출 (bar-mocha↔java-chip swap, 연쇄 아님)', () => {
    const steps = attemptFrom(javachip);
    [steps[2], steps[3]] = [steps[3], steps[2]];
    const g = gradeAttempt(javachip, { steps });
    return { pass: only(g.errors, 'order') && g.errors.order <= 2, detail: JSON.stringify(g.errors) };
  });

  t('누락 1건이 순서 연쇄오류를 일으키지 않음', () => {
    const steps = attemptFrom(javachip);
    steps.splice(2, 1); // bar-mocha 제거
    const g = gradeAttempt(javachip, { steps });
    return { pass: g.errors.ingredient === 1 && g.errors.order === 0, detail: JSON.stringify(g.errors) };
  });

  t('기준선(fill) 오류만 검출 (milk bottom→top)', () => {
    const steps = attemptFrom(javachip);
    steps[1].fill = 'top';
    const g = gradeAttempt(javachip, { steps });
    return { pass: only(g.errors, 'fill') && g.errors.fill === 1, detail: JSON.stringify(g.errors) };
  });

  t('수량(qty) 오류만 검출 (그린티바나나 바닐라 2→3펌프)', () => {
    const steps = attemptFrom(greenteaBanana);
    steps[1].qty = { value: 3, unit: 'pump' };
    const g = gradeAttempt(greenteaBanana, { size: 'GRANDE', steps });
    return { pass: only(g.errors, 'qty') && g.errors.qty === 1, detail: JSON.stringify(g.errors) };
  });

  t('처리단계(process) 오류: 딸기시럽을 블렌딩 전에 투입', () => {
    const steps = attemptFrom(strawberryCream);
    steps[4].phase = 'pre-blend'; // post-blend → pre-blend
    const g = gradeAttempt(strawberryCream, { steps });
    return { pass: only(g.errors, 'process') && g.errors.process === 1, detail: JSON.stringify(g.errors) };
  });

  t('마무리(finish) 오류: 휘핑을 블렌딩 전에 투입', () => {
    const steps = attemptFrom(javachip);
    steps[7].phase = 'pre-blend'; // whip finish → pre-blend
    const g = gradeAttempt(javachip, { steps });
    return { pass: only(g.errors, 'finish') && g.errors.finish === 1, detail: JSON.stringify(g.errors) };
  });

  t('사이즈(size) 오류만 검출 (ONLY_GRANDE에 TALL)', () => {
    const g = gradeAttempt(mangoBanana, { size: 'TALL', steps: attemptFrom(mangoBanana) });
    return { pass: only(g.errors, 'size') && g.errors.size === 1, detail: JSON.stringify(g.errors) };
  });

  t('사이즈 정답 (ONLY_GRANDE에 GRANDE) → 무오류', () => {
    const g = gradeAttempt(mangoBanana, { size: 'GRANDE', steps: attemptFrom(mangoBanana) });
    return { pass: g.isCorrect, detail: JSON.stringify(g.errors) };
  });

  t('중복 재료: espresso 하나 누락 → ingredient=1, 순서 폭발 없음', () => {
    const steps = attemptFrom(dupRecipe);
    steps.splice(2, 1); // 두 번째 espresso 제거
    const g = gradeAttempt(dupRecipe, { steps });
    return { pass: g.errors.ingredient === 1 && g.errors.order === 0, detail: JSON.stringify(g.errors) };
  });

  t('중복 재료 정답 → 무오류', () => {
    const g = gradeAttempt(dupRecipe, { steps: attemptFrom(dupRecipe) });
    return { pass: g.isCorrect, detail: JSON.stringify(g.errors) };
  });

  t('참조 무결성: dangling 재료 참조 시 경고 수집', () => {
    const ing = { revision: 1, items: [{ id: 'milk', name: '우유', role: 'dairy' }] };
    const rec = { revision: 1, items: [{ id: 'x', name: 'X', steps: [{ ingredientId: 'ghost', phase: 'pre-blend' }] }] };
    const { warnings } = normalizeData(ing, rec);
    return { pass: warnings.length === 1 && /ghost/.test(warnings[0]), detail: JSON.stringify(warnings) };
  });

  const passed = tests.filter((x) => x.pass).length;
  return { tests, passed, total: tests.length, allPass: passed === tests.length };
}
