// app.js — 앱 셸 + 2단계 해시 라우터 (#/<tab>/<subview>?k=v) + 동기화 배선
import { h, render, clear } from './ui.js';
import { createTabRegistry, renderTabNav } from './tabs.js';
import recipeTab from './features/recipe-trainer/index.js';
import scheduleTab from './features/schedule/index.js';
import * as sync from './sync.js';
import { mountSyncBar } from './sync-ui.js';
import * as store from './features/recipe-trainer/store.js';

const registry = createTabRegistry([recipeTab, scheduleTab]);

const shellNav = document.getElementById('tabnav');
const content = document.getElementById('content');
const syncBar = document.getElementById('syncbar');

let currentModule = null;

// ---- 동기화 배선 ----------------------------------------------------------
let _statusCb = () => {};
let _routePending = false;
function scheduleRoute() { if (_routePending) return; _routePending = true; setTimeout(() => { _routePending = false; route(); }, 60); }

sync.configure({
  getLocalDoc: (s) => store.getSectionDoc(s),
  applyRemote: (s, doc) => { if (store.isLoaded()) { store.replaceSectionDoc(s, doc); scheduleRoute(); } },
  onStatus: (kind, detail) => _statusCb(kind, detail),
});
store.onChange((section) => { if (sync.isConnected()) sync.pushSection(section, store.getSectionDoc(section)); });

async function connectFlow(token, label) {
  await store.loadData(); // 원격 반영 전에 로컬(더미/기존) 문서 로드 보장
  const r = await sync.connect(token, label);
  if (r.ok) { sync.startPolling(); route(); }
  else _statusCb('error', r.status ? `HTTP ${r.status}` : (r.reason || '연결 실패'));
  return r;
}

if (syncBar) {
  mountSyncBar(syncBar, {
    isConfigured: () => sync.isConfigured(),
    isConnected: () => sync.isConnected(),
    getToken: () => sync.getToken(),
    getLabel: () => sync.getLabel(),
    registerStatus: (cb) => { _statusCb = cb; },
    onConnect: (token, label) => connectFlow(token, label),
    onDisconnect: () => sync.disconnect(),
  });
  // 저장된 토큰이 있으면 자동 연결(원격 실데이터 자동 로드)
  if (sync.isConnected()) connectFlow(null, null);
}

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [pathPart, queryPart] = raw.split('?');
  const [tab, subview] = pathPart.split('/');
  const params = {};
  if (queryPart) for (const kv of queryPart.split('&')) { const [k, v] = kv.split('='); if (k) params[k] = decodeURIComponent(v || ''); }
  return { tab: tab || null, subview: subview || null, params };
}

function navigate(tab, subview, params) {
  let hash = `#/${tab}`;
  if (subview) hash += `/${subview}`;
  if (params && Object.keys(params).length) {
    hash += '?' + Object.entries(params).map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  }
  if (location.hash === hash) route(); else location.hash = hash;
}

async function route() {
  let { tab, subview, params } = parseHash();
  let mod = tab ? registry.get(tab) : null;
  if (!mod) { mod = registry.firstEnabled(); tab = mod.id; }

  render(shellNav, renderTabNav(registry, tab, (t) => navigate(t)));

  if (currentModule && currentModule.unmount) currentModule.unmount();
  currentModule = mod;
  clear(content);
  await mod.mount(content, { subview, params, navigate });
}

window.addEventListener('hashchange', route);

function start() {
  if (!location.hash) navigate(registry.firstEnabled().id);
  else route();
}
// 모듈 스크립트는 defer이므로 로드 시 이미 파싱이 끝난 경우가 많다.
// 이중 초기화를 막기 위해 한 경로로만 시작한다.
if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', start);
else start();
