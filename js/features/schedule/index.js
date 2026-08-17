// features/schedule/index.js — "근무 스케줄" 탭 (향후 구현 placeholder)
import { h, render } from '../../ui.js';

export default {
  id: 'schedule',
  label: '근무 스케줄',
  enabled: false, // placeholder — 아직 비활성

  mount(container) {
    render(container, h('div', { class: 'feature placeholder' }, [
      h('div', { class: 'placeholder-card' }, [
        h('div', { class: 'placeholder-emoji' }, '🗓️'),
        h('h2', {}, '근무 스케줄'),
        h('p', { class: 'muted' }, '준비 중입니다. 이 탭은 추후 스케줄 근무 기능으로 채워집니다.'),
      ]),
    ]));
  },

  unmount() {},
};
