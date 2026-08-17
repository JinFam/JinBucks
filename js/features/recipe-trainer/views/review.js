// review.js — SRS 복습: due(now>=dueAt) 항목을 componentType 단위로 부분 재출제(플래시카드 + 자기평가)
import { h, render } from '../../../ui.js';
import { getDueItems, getAllItems, recordResult, resetSrs } from '../srs.js';
import { ingredientSteps, isMarker, FILL_LABEL, qtyToText, hasBlend } from '../model.js';

const LABEL = { size: '사이즈', ingredient: '재료 집합', order: '투입 순서', fill: '기준선', qty: '수량', process: '처리 단계', finish: '마무리' };

export function mount(container, ctx) {
  const { data } = ctx;
  const validIds = data.recipes.map((r) => r.id);
  let due = getDueItems(validIds);
  let cursor = 0;
  let revealed = false;

  function answerFor(recipe, type) {
    const steps = ingredientSteps(recipe);
    const nm = (id) => (data.ingredientsById.get(id) || {}).name || id;
    switch (type) {
      case 'size': return recipe.sizeConstraint ? recipe.sizeConstraint.replace('_', ' ') : '제약 없음';
      case 'ingredient': return steps.map((s) => nm(s.ingredientId)).join(', ');
      case 'order': return recipe.steps.map((s) => isMarker(s) ? '🌀블렌더' : nm(s.ingredientId)).join(' → ');
      case 'fill': return steps.filter((s) => s.fill).map((s) => `${nm(s.ingredientId)}: ${FILL_LABEL[s.fill]}`).join(' / ') || '기준선 없음';
      case 'qty': return steps.filter((s) => s.qty).map((s) => `${nm(s.ingredientId)}: ${qtyToText(s.qty, {})}`).join(' / ') || '지정 수량 없음';
      case 'process': return steps.filter((s) => s.phase === 'post-blend').map((s) => `${nm(s.ingredientId)}(블렌딩 후)`).join(', ') || (hasBlend(recipe) ? '블렌딩 있음' : '블렌딩 없음');
      case 'finish': return steps.filter((s) => s.phase === 'finish').map((s) => nm(s.ingredientId)).join(', ') || '마무리 없음';
      default: return '';
    }
  }

  function assess(pass) {
    const item = due[cursor];
    recordResult(item.recipeId, pass ? [] : [item.componentType], [item.componentType]);
    // due 재계산
    due = getDueItems(validIds);
    cursor = 0; revealed = false;
    draw();
  }

  function draw() {
    const allCount = getAllItems().length;
    if (!due.length) {
      render(container, h('div', { class: 'review' }, [
        h('h2', {}, '복습 (SRS)'),
        h('p', { class: 'muted' }, allCount ? `지금 due인 복습 항목이 없습니다. 추적 중인 항목 ${allCount}개.` : '아직 복습 항목이 없습니다. 퀴즈에서 틀린 구성요소가 여기에 쌓입니다.'),
        allCount ? h('button', { class: 'btn', onClick: () => { resetSrs(); due = []; draw(); } }, 'SRS 초기화') : null,
      ]));
      return;
    }
    cursor = Math.min(cursor, due.length - 1);
    const item = due[cursor];
    const recipe = data.recipesById.get(item.recipeId);

    render(container, h('div', { class: 'review' }, [
      h('h2', {}, '복습 (SRS)'),
      h('div', { class: 'review-progress' }, `due ${due.length}개 · 현재 ${cursor + 1}/${due.length}`),
      h('div', { class: 'flashcard' }, [
        h('div', { class: 'fc-recipe' }, recipe.name),
        h('div', { class: 'fc-q' }, `틀렸던 구성요소: ${LABEL[item.componentType] || item.componentType} (box ${item.box})`),
        h('div', { class: 'fc-prompt' }, `"${recipe.name}"의 ${LABEL[item.componentType] || item.componentType}을(를) 떠올려 보세요.`),
        revealed
          ? h('div', { class: 'fc-answer' }, [h('strong', {}, '정답: '), answerFor(recipe, item.componentType)])
          : h('button', { class: 'btn primary', onClick: () => { revealed = true; draw(); } }, '정답 보기'),
        revealed ? h('div', { class: 'assess-row' }, [
          h('button', { class: 'btn ok', onClick: () => assess(true) }, '맞았어요 (승급)'),
          h('button', { class: 'btn bad', onClick: () => assess(false) }, '틀렸어요 (재복습)'),
        ]) : null,
      ]),
    ]));
  }
  draw();
}
