// quiz.js — 회상 퀴즈: 사이즈 선택 + 후보(전체사전+distractor)에서 순서대로 구성 → 엄격 채점
import { h, render } from '../../../ui.js';
import { gradeAttempt, COMPONENT_TYPES } from '../grade.js';
import { recordResult } from '../srs.js';
import { isMarker, ingredientSteps, hasBlend, FILL_LABEL, SIZES } from '../model.js';

const FILL_OPTS = ['', 'bottom', 'middle', 'top', 'signature', 'milk-box'];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 정답 재료 + 같은 role distractor 혼합 후보
function buildCandidates(recipe, data) {
  const correctIds = new Set(ingredientSteps(recipe).map((s) => s.ingredientId));
  const correctRoles = new Set([...correctIds].map((id) => (data.ingredientsById.get(id) || {}).role));
  const distractors = data.ingredients
    .filter((i) => !correctIds.has(i.id) && correctRoles.has(i.role))
    .slice(0, 5);
  const pool = [...[...correctIds].map((id) => data.ingredientsById.get(id)), ...distractors].filter(Boolean);
  return shuffle(pool);
}

function testedTypes(recipe) {
  const steps = ingredientSteps(recipe);
  const types = ['ingredient', 'order'];
  if (recipe.sizeConstraint) types.push('size');
  if (steps.some((s) => s.fill)) types.push('fill');
  if (steps.some((s) => s.qty)) types.push('qty');
  if (hasBlend(recipe) || steps.some((s) => s.phase === 'post-blend')) types.push('process');
  if (steps.some((s) => s.phase === 'finish')) types.push('finish');
  return types.filter((t) => COMPONENT_TYPES.includes(t));
}

export function mount(container, ctx) {
  const { data } = ctx;
  let recipe = ctx.params?.recipeId ? data.recipesById.get(ctx.params.recipeId) : pickRandom(data.recipes);
  let size = 'GRANDE';
  let attempt = []; // [{ingredientId, phase, fill, qty}| {type:'marker'}]
  let candidates = buildCandidates(recipe, data);
  let result = null;

  function guessPhase(ing) {
    // 토핑/드리즐만 기본 finish. 파우더는 pre/post로 쓰이는 경우가 많아(예: 그린티 파우더=pre-blend)
    // 블렌더 마커 이후면 post-blend, 아니면 pre-blend로 추정한다. 사용자가 드롭다운으로 수정 가능.
    if (['topping', 'drizzle'].includes(ing.role)) return 'finish';
    return attempt.some(isMarker) ? 'post-blend' : 'pre-blend';
  }

  function addIngredient(ing) {
    attempt.push({ ingredientId: ing.id, phase: guessPhase(ing), fill: null, qty: null });
    result = null; draw();
  }
  function addBlend() {
    attempt.push({ type: 'marker', phase: 'blend' });
    result = null; draw();
  }
  function removeAt(i) { attempt.splice(i, 1); result = null; draw(); }

  function newQuiz() {
    recipe = pickRandom(data.recipes);
    size = 'GRANDE'; attempt = []; result = null;
    candidates = buildCandidates(recipe, data);
    draw();
  }

  function submit() {
    result = gradeAttempt(recipe, { size, steps: attempt });
    // 테스트 대상 유형에 더해, 실제 발생한 오류 유형(예: 비블렌딩 메뉴에 마커 추가 → process)도 누락 없이 SRS에 반영
    const tested = Array.from(new Set([...testedTypes(recipe), ...result.failedTypes]));
    recordResult(recipe.id, result.failedTypes, tested);
    draw();
  }

  function draw() {
    const sizeRow = h('div', { class: 'size-row' },
      SIZES.map((s) => h('button', { class: 'size-btn' + (s === size ? ' active' : ''), onClick: () => { size = s; result = null; draw(); } }, s)));

    const pool = h('div', { class: 'candidate-pool' }, [
      ...candidates.map((ing) => h('button', { class: 'cand', onClick: () => addIngredient(ing), style: { borderLeftColor: ing.color } }, ing.name)),
      h('button', { class: 'cand blend', onClick: addBlend }, '🌀 블렌더 1번'),
    ]);

    const seq = h('ol', { class: 'attempt-seq' },
      attempt.map((s, i) => {
        if (isMarker(s)) {
          return h('li', { class: 'seq-item marker' }, [
            h('span', {}, '🌀 블렌더 1번'),
            h('button', { class: 'x', onClick: () => removeAt(i) }, '×'),
          ]);
        }
        const ing = data.ingredientsById.get(s.ingredientId) || {};
        const phaseSel = h('select', { class: 'phase-sel', onChange: (e) => { s.phase = e.target.value; result = null; draw(); } },
          ['pre-blend', 'post-blend', 'finish'].map((p) => h('option', { value: p, ...(p === s.phase ? { selected: true } : {}) }, p)));
        const fillSel = h('select', { class: 'fill-sel', onChange: (e) => { s.fill = e.target.value || null; result = null; draw(); } },
          FILL_OPTS.map((f) => h('option', { value: f, ...(f === (s.fill || '') ? { selected: true } : {}) }, f ? FILL_LABEL[f] : '기준선 없음')));
        const qtyInp = h('input', {
          class: 'qty-inp', type: 'number', min: '0', placeholder: '수량', value: s.qty ? s.qty.value : '',
          onInput: (e) => { const v = e.target.value; s.qty = v === '' ? null : { value: Number(v), unit: ing.defaultUnit || 'count' }; result = null; },
        });
        return h('li', { class: 'seq-item', style: { borderLeftColor: ing.color } }, [
          h('span', { class: 'seq-name' }, `${i + 1}. ${ing.name}`),
          phaseSel, fillSel, qtyInp,
          h('button', { class: 'x', onClick: () => removeAt(i) }, '×'),
        ]);
      }));

    const feedback = result ? h('div', { class: 'feedback ' + (result.isCorrect ? 'ok' : 'bad') }, [
      h('div', { class: 'fb-head' }, result.isCorrect ? `✅ 정답! (${result.score}점)` : `❌ 오답 (${result.score}점)`),
      ...(result.isCorrect ? [] : result.messages.map((m) => h('div', { class: 'fb-line ' + m.type }, `[${labelOf(m.type)}] ${m.text}`))),
      ...(result.isCorrect ? [] : [h('div', { class: 'fb-types' }, '틀린 유형: ' + result.failedTypes.map(labelOf).join(', '))]),
    ]) : null;

    const view = h('div', { class: 'quiz' }, [
      h('div', { class: 'quiz-head' }, [
        h('h2', {}, `Q. "${recipe.name}"를 제조하세요`),
        h('button', { class: 'btn', onClick: newQuiz }, '다른 문제 ↻'),
      ]),
      h('div', { class: 'quiz-sub' }, '컵 사이즈를 고르고, 재료를 순서대로 배치한 뒤 각 단계(phase)·기준선·수량을 지정하세요.'),
      h('h3', {}, '1) 컵 사이즈'), sizeRow,
      h('h3', {}, '2) 재료 후보 (탭하여 추가)'), pool,
      h('h3', {}, '3) 내 구성 (위=먼저)'), seq,
      h('div', { class: 'quiz-actions' }, [
        h('button', { class: 'btn primary', onClick: submit, disabled: attempt.length === 0 }, '채점하기'),
        h('button', { class: 'btn', onClick: () => { attempt = []; result = null; draw(); } }, '비우기'),
      ]),
      feedback,
    ]);
    render(container, view);
  }
  draw();
}

function pickRandom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

function labelOf(type) {
  return { size: '사이즈', ingredient: '재료', order: '순서', fill: '기준선', qty: '수량', process: '처리단계', finish: '마무리' }[type] || type;
}
