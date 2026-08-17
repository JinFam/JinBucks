// js/sync-ui.js — 우하단 동기화 바(토큰/라벨 입력, 연결/해제, 상태 표시). ESM.
import { h, render } from './ui.js';

const STATUS_TEXT = {
  idle: '미연결', connecting: '연결 중…', synced: '동기화됨', syncing: '동기화 중…',
  conflict: '충돌 병합됨', error: '오류', disconnected: '해제됨',
};

// mountSyncBar(container, { isConfigured, isConnected, getToken, getLabel, onConnect, onDisconnect })
export function mountSyncBar(container, api) {
  let status = api.isConnected() ? 'synced' : 'idle';
  let detail = '';
  let open = !api.isConnected();
  let busy = false;

  function setStatus(kind, d) { status = kind; detail = d || ''; draw(); }
  api.registerStatus(setStatus);

  async function doConnect(token, label) {
    busy = true; draw();
    try { await api.onConnect(token, label); } finally { busy = false; open = false; draw(); }
  }

  function draw() {
    if (!api.isConfigured()) { render(container, h('div', { class: 'sync-bar disabled' }, '동기화 미설정')); return; }
    const connected = api.isConnected();
    const dot = h('span', { class: 'sync-dot ' + status });
    const label = h('span', { class: 'sync-status' }, STATUS_TEXT[status] + (detail ? ` · ${detail}` : ''));
    const toggle = h('button', { class: 'sync-toggle', onClick: () => { open = !open; draw(); } }, open ? '▾' : '▸');

    let panel = null;
    if (open) {
      const tokenInp = h('input', { class: 'sync-inp', type: 'password', placeholder: 'GitHub 토큰(PAT)', value: '' });
      const labelInp = h('input', { class: 'sync-inp', type: 'text', placeholder: '이름(예: 지니)', value: api.getLabel() });
      panel = h('div', { class: 'sync-panel' }, [
        h('div', { class: 'sync-help' }, '비공개 데이터 레포 접근용 PAT를 입력하세요. 토큰은 이 브라우저에만 저장됩니다.'),
        tokenInp, labelInp,
        h('div', { class: 'sync-actions' }, [
          connected
            ? h('button', { class: 'btn small', onClick: () => { api.onDisconnect(); status = 'disconnected'; open = true; draw(); } }, '연결 해제')
            : null,
          h('button', {
            class: 'btn small primary', disabled: busy,
            onClick: () => doConnect(tokenInp.value.trim() || api.getToken(), labelInp.value.trim()),
          }, busy ? '연결 중…' : (connected ? '재연결' : '연결')),
        ]),
      ]);
    }

    render(container, h('div', { class: 'sync-bar' }, [
      h('div', { class: 'sync-head' }, [dot, label, toggle]),
      panel,
    ]));
  }
  draw();
}
