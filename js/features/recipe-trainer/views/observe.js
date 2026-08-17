// observe.js — 관찰 모드: 레시피 선택 후 단계별 사용자 제어 시각화(자동재생 없음)
import { h, render } from '../../../ui.js';
import { renderCup, renderSizeComparison } from '../cup-svg.js';
import { isMarker, FILL_LABEL, qtyToText } from '../model.js';

export function mount(container, ctx) {
  const { data } = ctx;
  let selectedId = ctx.params?.recipeId || data.recipes[0]?.id;
  let stepIdx = 0;

  function defaultSize(recipe) {
    if (recipe.sizeConstraint === 'ONLY_TALL') return 'TALL';
    if (recipe.sizeConstraint === 'ONLY_GRANDE') return 'GRANDE';
    return 'GRANDE';
  }

  function draw() {
    const recipe = data.recipesById.get(selectedId);
    const size = defaultSize(recipe);
    const maxIdx = recipe.steps.length - 1;
    stepIdx = Math.max(0, Math.min(stepIdx, maxIdx));
    const curStep = recipe.steps[stepIdx];

    const list = h('div', { class: 'recipe-list' },
      data.recipes.map((r) =>
        h('button', {
          class: 'recipe-chip' + (r.id === selectedId ? ' active' : ''),
          onClick: () => { selectedId = r.id; stepIdx = 0; draw(); },
        }, r.name + (r.needsReview ? ' ⚠' : ''))
      )
    );

    const stepText = isMarker(curStep)
      ? '블렌더 1번 (혼합)'
      : `${(data.ingredientsById.get(curStep.ingredientId) || {}).name || curStep.ingredientId}` +
        (curStep.fill ? ` — ${FILL_LABEL[curStep.fill]}` : '') +
        (curStep.qty ? ` — ${qtyToText(curStep.qty, {})}` : '') +
        ` [${curStep.phase}]`;

    const cup = renderCup({
      recipe, ingredientsById: data.ingredientsById, size,
      uptoIndex: stepIdx, showLabels: true, highlightIndex: stepIdx,
    });

    const controls = h('div', { class: 'step-controls' }, [
      h('button', { class: 'btn', onClick: () => { stepIdx--; draw(); }, disabled: stepIdx === 0 }, '‹ 이전'),
      h('span', { class: 'step-counter' }, `${stepIdx + 1} / ${recipe.steps.length}`),
      h('button', { class: 'btn primary', onClick: () => { stepIdx++; draw(); }, disabled: stepIdx === maxIdx }, '다음 ›'),
    ]);

    const procedure = h('ol', { class: 'procedure' },
      recipe.steps.map((s, i) =>
        h('li', { class: (i === stepIdx ? 'cur' : '') + (i > stepIdx ? ' pending' : '') },
          isMarker(s) ? '🌀 블렌더 1번'
            : (data.ingredientsById.get(s.ingredientId) || {}).name || s.ingredientId)
      )
    );

    const view = h('div', { class: 'observe' }, [
      list,
      h('div', { class: 'observe-main' }, [
        h('div', { class: 'observe-stage' }, [
          h('h2', {}, recipe.name + (recipe.needsReview ? ' ⚠ 검증필요' : '')),
          h('div', { class: 'family-tag' }, recipe.family),
          cup,
          h('div', { class: 'current-step' }, [h('strong', {}, '현재 단계: '), stepText]),
          controls,
        ]),
        h('div', { class: 'observe-side' }, [
          h('h3', {}, '제조 절차'),
          procedure,
          h('h3', {}, '사이즈'),
          renderSizeComparison(size),
        ]),
      ]),
    ]);
    render(container, view);
  }
  draw();
}
