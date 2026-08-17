// tabs.js — 최상위 탭 네비게이션 + 모듈 등록/전환
import { h } from './ui.js';

export function createTabRegistry(modules) {
  const map = new Map(modules.map((m) => [m.id, m]));
  return {
    list: modules,
    get: (id) => map.get(id),
    firstEnabled: () => modules.find((m) => m.enabled) || modules[0],
  };
}

export function renderTabNav(registry, activeTabId, navigate) {
  return h('nav', { class: 'tabnav', role: 'tablist' },
    registry.list.map((m) =>
      h('button', {
        class: 'tab' + (m.id === activeTabId ? ' active' : '') + (m.enabled ? '' : ' disabled'),
        role: 'tab',
        'aria-selected': m.id === activeTabId ? 'true' : 'false',
        onClick: () => navigate(m.id),
      }, [m.label, m.enabled ? null : h('span', { class: 'soon' }, '준비 중')])
    )
  );
}
