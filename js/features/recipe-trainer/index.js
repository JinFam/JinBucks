// features/recipe-trainer/index.js — "레시피 학습" 탭 모듈 (자기완결)
// 탭 모듈 계약: { id, label, enabled, mount(container, ctx), unmount() }
import { h, render } from '../../ui.js';
import * as store from './store.js';
import { mount as observeMount } from './views/observe.js';
import { mount as quizMount } from './views/quiz.js';
import { mount as reviewMount } from './views/review.js';
import { mount as manageMount } from './views/manage.js';

const SUBVIEWS = [
  { id: 'observe', label: '관찰', mount: observeMount },
  { id: 'quiz', label: '회상 퀴즈', mount: quizMount },
  { id: 'review', label: '복습(SRS)', mount: reviewMount },
  { id: 'manage', label: '데이터 관리', mount: manageMount },
];

let loaded = false;
let loadError = null;

async function ensureData() {
  if (loaded) return;
  try { await store.loadData(); loaded = true; }
  catch (e) { loadError = e; }
}

export default {
  id: 'recipe',
  label: '레시피 학습',
  enabled: true,

  async mount(container, ctx) {
    await ensureData();
    if (loadError) {
      render(container, h('div', { class: 'load-error' }, [
        h('h2', {}, '데이터 로드 실패'),
        h('p', {}, String(loadError.message || loadError)),
        h('p', { class: 'muted' }, '로컬에서 열었다면 정적 서버로 실행하세요: npm run serve (또는 python -m http.server) 후 http://localhost:8080'),
      ]));
      return;
    }

    const sub = SUBVIEWS.find((s) => s.id === ctx.subview) || SUBVIEWS[0];

    const subnav = h('nav', { class: 'subnav' },
      SUBVIEWS.map((s) => h('button', {
        class: 'subnav-btn' + (s.id === sub.id ? ' active' : ''),
        onClick: () => ctx.navigate('recipe', s.id),
      }, s.label)));

    const body = h('div', { class: 'subview' });
    render(container, h('div', { class: 'feature recipe-trainer' }, [subnav, body]));

    sub.mount(body, {
      data: store.getData(),
      params: ctx.params || {},
      navigate: ctx.navigate,
    });
  },

  unmount() {},
};
