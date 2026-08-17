// ui.js — 모든 탭이 공유하는 경량 렌더/상태 유틸 (빌드리스, 표준 DOM)
// A안(vanilla)에서 "임시 프레임워크 재발명"을 막기 위한 최소 계약.

// hyperscript: h('div', {class:'x', onclick:fn}, [children])
export function h(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c == null || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return el;
}

// container를 vnode(들)로 교체
export function render(container, node) {
  container.replaceChildren();
  const nodes = Array.isArray(node) ? node : [node];
  for (const n of nodes) if (n) container.appendChild(n);
}

export function clear(container) {
  container.replaceChildren();
}

