// cup-svg.js — 컵/기준선/레이어/블렌더 SVG 렌더 (표준 DOM, ui 비의존)
import { isMarker, FILL_LABEL, qtyToText } from './model.js';

const SVGNS = 'http://www.w3.org/2000/svg';

// 사이즈별 컵 형상(공통 바닥선, 동일 축척). 값은 뷰박스 100x160 기준 높이 비율.
const CUP_GEOM = {
  TALL: { topW: 46, botW: 34, h: 96 },
  GRANDE: { topW: 54, botW: 38, h: 118 },
  VENTI: { topW: 60, botW: 40, h: 140 },
};

// fill 기준선의 컵 내부 상대 높이(0=바닥, 1=입구)
const FILL_Y = { bottom: 0.22, middle: 0.5, top: 0.82, signature: 0.62, 'milk-box': 0.3 };

function svg(tag, attrs = {}) {
  const el = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

// 세 컵을 공통 바닥선/동일 축척으로 나란히 그려 크기 구별을 보인다
export function renderSizeComparison(activeSize) {
  const wrap = svg('svg', { viewBox: '0 0 240 160', class: 'cup-compare', role: 'img' });
  const sizes = ['TALL', 'GRANDE', 'VENTI'];
  const baseY = 150; // 공통 바닥선
  sizes.forEach((size, i) => {
    const g = CUP_GEOM[size];
    const cx = 40 + i * 80;
    const topY = baseY - g.h;
    const path = svg('path', {
      d: `M ${cx - g.topW / 2} ${topY} L ${cx + g.topW / 2} ${topY} L ${cx + g.botW / 2} ${baseY} L ${cx - g.botW / 2} ${baseY} Z`,
      class: 'cup-outline' + (size === activeSize ? ' active' : ''),
    });
    wrap.appendChild(path);
    const label = svg('text', { x: cx, y: baseY + 8, 'text-anchor': 'middle', class: 'cup-size-label' });
    label.textContent = size;
    wrap.appendChild(label);
  });
  return wrap;
}

/**
 * 제조 컵을 레이어로 렌더.
 * @param opts { recipe, ingredientsById, size, uptoIndex, blended, showLabels, highlightIndex }
 *  - uptoIndex: 이 인덱스까지의 step만 표시(관찰 모드 단계별). 미지정 시 전부.
 *  - blended: true면 pre-blend 레이어를 혼합 상태로 병합해 표시.
 */
export function renderCup(opts) {
  const { recipe, ingredientsById, size = 'GRANDE', showLabels = true } = opts;
  const uptoIndex = opts.uptoIndex == null ? recipe.steps.length - 1 : opts.uptoIndex;
  const geom = CUP_GEOM[size] || CUP_GEOM.GRANDE;
  const baseY = 150;
  const topY = baseY - geom.h;
  const cx = 70;

  const root = svg('svg', { viewBox: '0 0 140 170', class: 'cup-main', role: 'img' });

  // 컵 외곽
  const outline = svg('path', {
    d: `M ${cx - geom.topW / 2} ${topY} L ${cx + geom.topW / 2} ${topY} L ${cx + geom.botW / 2} ${baseY} L ${cx - geom.botW / 2} ${baseY} Z`,
    class: 'cup-outline active',
  });

  // 표시할 step 슬라이스
  const shown = recipe.steps.slice(0, uptoIndex + 1);
  const blendReached = shown.some(isMarker);
  const preSteps = shown.filter((s) => !isMarker(s) && s.phase === 'pre-blend');
  const postSteps = shown.filter((s) => !isMarker(s) && s.phase === 'post-blend');
  const finishSteps = shown.filter((s) => !isMarker(s) && s.phase === 'finish');

  const layerGroup = svg('g', {});

  const widthAt = (t) => geom.botW + (geom.topW - geom.botW) * t; // t: 0바닥~1입구
  const yAt = (t) => baseY - geom.h * t;

  // pre-blend 레이어(아래=먼저). blend 도달 시 하나의 혼합 레이어로.
  if (preSteps.length) {
    const fillTop = 0.72; // 컵 내용물 상단 비율
    if (blendReached) {
      // 혼합 상태: 단일 그라데이션 블럭
      const rectPath = svg('path', {
        d: `M ${cx - widthAt(0) / 2} ${yAt(0)} L ${cx + widthAt(0) / 2} ${yAt(0)} L ${cx + widthAt(fillTop) / 2} ${yAt(fillTop)} L ${cx - widthAt(fillTop) / 2} ${yAt(fillTop)} Z`,
        class: 'layer blended', fill: mixColor(preSteps, ingredientsById),
      });
      layerGroup.appendChild(rectPath);
      const t = svg('text', { x: cx, y: yAt(fillTop / 2), 'text-anchor': 'middle', class: 'layer-label mixed' });
      t.textContent = '혼합됨';
      layerGroup.appendChild(t);
    } else {
      const seg = fillTop / preSteps.length;
      preSteps.forEach((s, idx) => {
        const t0 = idx * seg;
        const t1 = (idx + 1) * seg;
        const ing = ingredientsById.get(s.ingredientId) || {};
        const isHi = highlightMatch(opts, recipe, s);
        const p = svg('path', {
          d: `M ${cx - widthAt(t0) / 2} ${yAt(t0)} L ${cx + widthAt(t0) / 2} ${yAt(t0)} L ${cx + widthAt(t1) / 2} ${yAt(t1)} L ${cx - widthAt(t1) / 2} ${yAt(t1)} Z`,
          class: 'layer' + (isHi ? ' highlight' : ''), fill: ing.color || '#ccc',
        });
        layerGroup.appendChild(applyPattern(p, ing.pattern));
        if (showLabels) {
          const lbl = svg('text', { x: cx, y: yAt((t0 + t1) / 2) + 2, 'text-anchor': 'middle', class: 'layer-label' });
          lbl.textContent = ing.name || s.ingredientId;
          layerGroup.appendChild(lbl);
        }
      });
    }
  }

  // 기준선 마커(fill) — 컵 옆 라벨
  const lineGroup = svg('g', {});
  preSteps.concat(postSteps).forEach((s) => {
    if (!s.fill || FILL_Y[s.fill] == null) return;
    const t = FILL_Y[s.fill];
    const y = yAt(t);
    const line = svg('line', { x1: cx - widthAt(t) / 2, y1: y, x2: cx + widthAt(t) / 2, y2: y, class: 'fill-line' });
    lineGroup.appendChild(line);
    const tag = svg('text', { x: cx + geom.topW / 2 + 4, y: y + 3, class: 'fill-line-label' });
    const ing = ingredientsById.get(s.ingredientId) || {};
    tag.textContent = `${FILL_LABEL[s.fill]} ← ${ing.name || s.ingredientId}`;
    lineGroup.appendChild(tag);
  });

  // 마무리(컵 위쪽): finish + post-blend 표기
  const finishGroup = svg('g', {});
  const overheads = [...postSteps.map((s) => ({ s, kind: 'post' })), ...finishSteps.map((s) => ({ s, kind: 'finish' }))];
  overheads.forEach((o, i) => {
    const ing = ingredientsById.get(o.s.ingredientId) || {};
    const y = topY - 6 - i * 11;
    const t = svg('text', { x: cx, y, 'text-anchor': 'middle', class: 'finish-label ' + o.kind });
    t.textContent = (o.kind === 'post' ? '↓ ' : '☁ ') + (ing.name || o.s.ingredientId) + (o.s.qty ? ` (${qtyToText(o.s.qty, ing)})` : '');
    finishGroup.appendChild(t);
  });

  root.appendChild(outline);
  root.appendChild(layerGroup);
  root.appendChild(lineGroup);
  root.appendChild(finishGroup);

  // 사이즈 제약 배지 / 빨대
  if (recipe.sizeConstraint || recipe.straw) {
    const badge = svg('text', { x: 6, y: 14, class: 'cup-badge' });
    const parts = [];
    if (recipe.sizeConstraint) parts.push('🔒 ' + recipe.sizeConstraint.replace('_', ' '));
    if (recipe.straw === 'thick') parts.push('굵은 빨대');
    badge.textContent = parts.join(' · ');
    root.appendChild(badge);
  }
  return root;
}

function highlightMatch(opts, recipe, step) {
  if (opts.highlightIndex == null) return false;
  return recipe.steps[opts.highlightIndex] === step;
}

function applyPattern(pathEl, pattern) {
  if (pattern === 'dots') pathEl.classList.add('pat-dots');
  else if (pattern === 'grain') pathEl.classList.add('pat-grain');
  else if (pattern === 'chunk') pathEl.classList.add('pat-chunk');
  else if (pattern === 'foam') pathEl.classList.add('pat-foam');
  return pathEl;
}

function mixColor(steps, ingredientsById) {
  // 레이어 색 평균(간이 혼합색)
  const cols = steps.map((s) => (ingredientsById.get(s.ingredientId) || {}).color).filter(Boolean);
  if (!cols.length) return '#d8c9b0';
  const rgb = cols.map(hexToRgb);
  const avg = rgb.reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0]).map((v) => Math.round(v / rgb.length));
  return `rgb(${avg[0]},${avg[1]},${avg[2]})`;
}

function hexToRgb(hex) {
  const m = hex.replace('#', '');
  const n = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  return [parseInt(n.slice(0, 2), 16), parseInt(n.slice(2, 4), 16), parseInt(n.slice(4, 6), 16)];
}
