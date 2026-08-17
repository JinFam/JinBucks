// manage.js — 재료/레시피 CRUD(in-memory 작업본) + JSON export/import
import { h, render } from '../../../ui.js';
import * as store from '../store.js';

export function mount(container, ctx) {
  let editingRecipeId = null;
  let jsonDraft = '';
  let message = null;

  // store가 편집 시 정규화 캐시를 제자리 갱신하므로 draw()만 다시 그리면 된다
  function refresh() { draw(); }

  function draw() {
    const data = store.getData();

    // ---- 재료 ----
    const ingForm = (() => {
      const f = { id: '', name: '', role: 'base', color: '#cccccc' };
      const inp = (key, ph, type = 'text') => h('input', { class: 'm-inp', type, placeholder: ph, onInput: (e) => { f[key] = e.target.value; } });
      const idI = inp('id', 'id'), nameI = inp('name', '이름'), roleI = inp('role', 'role(base/syrup...)'), colorI = h('input', { class: 'm-inp', type: 'color', value: '#cccccc', onInput: (e) => { f.color = e.target.value; } });
      return h('div', { class: 'm-form' }, [
        idI, nameI, roleI, colorI,
        h('button', { class: 'btn primary', onClick: () => { if (!f.id || !f.name) { message = 'id와 이름은 필수'; draw(); return; } store.upsertIngredient({ id: f.id, name: f.name, role: f.role || 'base', color: f.color, pattern: 'liquid', icon: 'bottle', defaultUnit: 'count' }); message = `재료 '${f.name}' 저장`; refresh(); } }, '재료 추가/수정'),
      ]);
    })();

    const ingList = h('table', { class: 'm-table' }, [
      h('thead', {}, h('tr', {}, [h('th', {}, '이름'), h('th', {}, 'id'), h('th', {}, 'role'), h('th', {}, '색'), h('th', {}, '')])),
      h('tbody', {}, data.ingredients.map((i) => h('tr', {}, [
        h('td', {}, i.name), h('td', { class: 'mono' }, i.id), h('td', {}, i.role),
        h('td', {}, h('span', { class: 'swatch', style: { background: i.color } })),
        h('td', {}, h('button', { class: 'x', onClick: () => { store.deleteIngredient(i.id); message = `재료 '${i.name}' 삭제`; refresh(); } }, '삭제')),
      ]))),
    ]);

    // ---- 레시피 ----
    const recList = h('table', { class: 'm-table' }, [
      h('thead', {}, h('tr', {}, [h('th', {}, '이름'), h('th', {}, 'id'), h('th', {}, '계열'), h('th', {}, '')])),
      h('tbody', {}, data.recipes.map((r) => h('tr', {}, [
        h('td', {}, r.name + (r.needsReview ? ' ⚠' : '')), h('td', { class: 'mono' }, r.id), h('td', {}, r.family),
        h('td', {}, [
          h('button', { class: 'btn small', onClick: () => { editingRecipeId = r.id; jsonDraft = JSON.stringify(store.getWorkingDocs().recipes.items.find((x) => x.id === r.id), null, 2); draw(); } }, '편집'),
          h('button', { class: 'x', onClick: () => { store.deleteRecipe(r.id); message = `레시피 '${r.name}' 삭제`; refresh(); } }, '삭제'),
        ]),
      ]))),
    ]);

    const editor = editingRecipeId != null ? h('div', { class: 'm-editor' }, [
      h('h4', {}, `레시피 편집(JSON): ${editingRecipeId}`),
      h('textarea', { class: 'm-json', rows: '16', onInput: (e) => { jsonDraft = e.target.value; }, }, jsonDraft),
      h('div', {}, [
        h('button', { class: 'btn primary', onClick: () => {
          try { const parsed = JSON.parse(jsonDraft); store.upsertRecipe(parsed); message = `레시피 '${parsed.id}' 저장`; editingRecipeId = null; refresh(); }
          catch (err) { message = 'JSON 파싱 오류: ' + err.message; draw(); }
        } }, '저장'),
        h('button', { class: 'btn', onClick: () => { editingRecipeId = null; draw(); } }, '취소'),
      ]),
    ]) : null;

    const newRecipeBtn = h('button', { class: 'btn', onClick: () => {
      const tmpl = { id: 'new-recipe-' + Date.now(), name: '새 레시피', family: 'custom', sizeConstraint: null, straw: null, steps: [{ ingredientId: 'milk', phase: 'pre-blend', fill: 'bottom', qty: null }] };
      store.upsertRecipe(tmpl); editingRecipeId = tmpl.id; jsonDraft = JSON.stringify(tmpl, null, 2); refresh();
    } }, '+ 새 레시피');

    // ---- export / import ----
    const ioRow = h('div', { class: 'm-io' }, [
      h('button', { class: 'btn', onClick: () => store.exportDoc('ingredients') }, 'ingredients.json 내보내기'),
      h('button', { class: 'btn', onClick: () => store.exportDoc('recipes') }, 'recipes.json 내보내기'),
      h('label', { class: 'btn file' }, ['JSON 가져오기',
        h('input', { type: 'file', accept: '.json', style: { display: 'none' }, onChange: (e) => {
          const file = e.target.files[0]; if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            try {
              const parsed = JSON.parse(reader.result);
              const which = Array.isArray(parsed.items) && parsed.items.some((x) => x.steps) ? 'recipes' : 'ingredients';
              const res = store.importDoc(which, parsed);
              message = `${which} 가져오기 완료.` + (res.warning ? ' ⚠ ' + res.warning : '');
              refresh();
            } catch (err) { message = '가져오기 실패: ' + err.message; draw(); }
          };
          reader.readAsText(file);
        } }),
      ]),
    ]);

    render(container, h('div', { class: 'manage' }, [
      h('h2', {}, '데이터 관리'),
      message ? h('div', { class: 'm-msg' }, message) : null,
      ioRow,
      data.warnings.length ? h('div', { class: 'm-warn' }, '참조 무결성 경고: ' + data.warnings.join(' | ')) : null,
      h('h3', {}, '재료'), ingForm, ingList,
      h('h3', {}, '레시피'), newRecipeBtn, recList, editor,
    ]));
  }
  draw();
}
