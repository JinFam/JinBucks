// js/sync.js — JB.sync: 비공개 GitHub 레포에 레시피/재료 JSON을 동기화(폴링 GET + 커밋 PUT).
// ESM. config/token 없으면 완전 no-op → 로컬 순수 동작 회귀 0.
//
// 설계(JinFin 패턴 적응):
//  - 동기화 섹션 = ingredients, recipes. 각 섹션 = 비공개 레포의 JSON 파일 1개(독립 sha).
//  - SRS(학습 진행)는 개인별 → 동기화 제외(각 기기 localStorage 유지).
//  - 충돌은 "감지 + id-union 병합"이 목표(자동 CRDT 아님). stale-sha PUT은 409 → 재조회 후 병합 재시도.
//  - 토큰(PAT)은 브라우저 localStorage에만. 이 파일/레포에는 비밀 없음.
//  - GitHub content base64는 \n 래핑 → decode 전 공백 제거. 한글은 TextEncoder.

import { syncConfig } from './sync-config.js';

const TOKEN_KEY = 'jinbucks:sync:token';
const LABEL_KEY = 'jinbucks:sync:label';
export const SECTIONS = ['ingredients', 'recipes'];

// ---- base64 UTF-8 -------------------------------------------------------
export function b64EncodeUtf8(str) {
  const bytes = new TextEncoder().encode(String(str));
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
export function b64DecodeUtf8(b64) {
  const clean = String(b64).replace(/\s/g, '');
  const bin = atob(clean);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// ---- 봉투 ----------------------------------------------------------------
export function wrapEnvelope(section, data, label) {
  return { section, updatedAt: new Date().toISOString(), updatedBy: label || '', data };
}
export function unwrapEnvelope(text) {
  const obj = JSON.parse(text);
  if (obj && typeof obj === 'object' && !Array.isArray(obj) && obj.section && 'data' in obj) return obj;
  return { section: null, updatedAt: null, updatedBy: '', data: obj };
}

// ---- items 문서 병합({revision, items:[{id}]}) --------------------------
// theirs(원격) 기준 + 내 신규 id 추가. 동일 id 상충 → theirs 유지 + 충돌 보고.
export function mergeItemsDoc(mine, theirs) {
  const mi = (mine && Array.isArray(mine.items)) ? mine.items : [];
  const ti = (theirs && Array.isArray(theirs.items)) ? theirs.items : [];
  const merged = ti.slice();
  const seen = new Map();
  ti.forEach((it, i) => { if (it && it.id != null) seen.set(it.id, i); });
  const conflicts = [];
  for (const it of mi) {
    if (!it || it.id == null) { merged.push(it); continue; }
    if (!seen.has(it.id)) merged.push(it);
    else if (JSON.stringify(ti[seen.get(it.id)]) !== JSON.stringify(it)) conflicts.push(it.id);
  }
  const revision = Math.max((mine && mine.revision) || 0, (theirs && theirs.revision) || 0);
  return { doc: { revision, generatedAt: new Date().toISOString(), items: merged }, conflicts };
}

// ---- config / token ------------------------------------------------------
export function isConfigured() { return !!(syncConfig && syncConfig.owner && syncConfig.repo); }
export function getToken() { try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } }
export function setToken(t) { try { t ? localStorage.setItem(TOKEN_KEY, t) : localStorage.removeItem(TOKEN_KEY); return true; } catch { return false; } }
export function getLabel() { try { return localStorage.getItem(LABEL_KEY) || (syncConfig && syncConfig.label) || ''; } catch { return ''; } }
export function setLabel(l) { try { localStorage.setItem(LABEL_KEY, l || ''); return true; } catch { return false; } }
export function isConnected() { return isConfigured() && !!getToken(); }

// ---- GitHub REST ---------------------------------------------------------
const apiBase = () => `https://api.github.com/repos/${syncConfig.owner}/${syncConfig.repo}`;
const branchName = () => (syncConfig && syncConfig.branch) || 'main';
const dirName = () => (syncConfig && syncConfig.dir) || 'state';
const pathFor = (section) => `${dirName()}/${section}.json`;
function ghHeaders(extra) {
  return Object.assign({
    Authorization: 'Bearer ' + getToken(),
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }, extra || {});
}

async function ghGetFile(section) {
  const url = `${apiBase()}/contents/${pathFor(section)}?ref=${encodeURIComponent(branchName())}`;
  const res = await fetch(url, { headers: ghHeaders() });
  if (res.status === 404) return { status: 404 };
  if (!res.ok) { const e = new Error(`GET ${section} HTTP ${res.status}`); e.code = res.status; throw e; }
  const body = await res.json();
  return { status: 200, sha: body.sha, text: body.content ? b64DecodeUtf8(body.content) : '' };
}
async function ghPutFile(section, text, sha) {
  const url = `${apiBase()}/contents/${pathFor(section)}`;
  const payload = { message: `sync: ${section}`, content: b64EncodeUtf8(text), branch: branchName() };
  if (sha) payload.sha = sha;
  const res = await fetch(url, { method: 'PUT', headers: ghHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(payload) });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}
async function ghGetRepo() { const res = await fetch(apiBase(), { headers: ghHeaders() }); return { status: res.status }; }

// ---- 런타임 --------------------------------------------------------------
let _sha = {};              // section -> blob sha
let _pollTimer = null;
let _hooks = {};            // { onStatus(kind,detail), onRemoteApply(section, doc) }
let _getLocalDoc = null;    // (section) => 현재 로컬 문서
let _applyRemote = null;    // (section, doc) => 로컬에 반영

export function configure({ getLocalDoc, applyRemote, onStatus, onRemoteApply }) {
  _getLocalDoc = getLocalDoc; _applyRemote = applyRemote;
  _hooks.onStatus = onStatus; _hooks.onRemoteApply = onRemoteApply;
}
function status(kind, detail) { if (_hooks.onStatus) { try { _hooks.onStatus(kind, detail); } catch {} } }

// 원격 전체 조회. 각 섹션 파일 GET(없으면 null).
async function pullAll() {
  const out = {};
  for (const s of SECTIONS) {
    const r = await ghGetFile(s);
    if (r.status === 404) { out[s] = { sha: null, doc: null }; continue; }
    _sha[s] = r.sha;
    out[s] = { sha: r.sha, doc: unwrapEnvelope(r.text).data };
  }
  return out;
}

// 섹션 PUT(409 시 재조회+병합 후 1회 재시도).
async function pushSection(section, doc) {
  if (!isConnected()) return { skipped: true };
  const text = JSON.stringify(wrapEnvelope(section, doc, getLabel()), null, 2);
  let res = await ghPutFile(section, text, _sha[section]);
  if (res.status === 409) {
    status('conflict', section);
    const remote = await ghGetFile(section);
    const remoteDoc = remote.status === 200 ? unwrapEnvelope(remote.text).data : null;
    const { doc: merged } = mergeItemsDoc(doc, remoteDoc);
    if (_applyRemote) _applyRemote(section, merged);
    const text2 = JSON.stringify(wrapEnvelope(section, merged, getLabel()), null, 2);
    res = await ghPutFile(section, text2, remote.sha);
  }
  if (res.status >= 200 && res.status < 300) {
    _sha[section] = res.body && res.body.content && res.body.content.sha;
    status('synced', section);
    return { ok: true };
  }
  status('error', `PUT ${section} HTTP ${res.status}`);
  return { ok: false, status: res.status };
}

// 연결: repo 접근 확인 → 원격 pull. 원격 비어있으면 로컬을 시드로 push.
export async function connect(token, label) {
  if (token != null) setToken(token);
  if (label != null) setLabel(label);
  if (!isConnected()) return { ok: false, reason: 'not-configured' };
  status('connecting');
  const repo = await ghGetRepo();
  if (repo.status !== 200) { status('error', `repo 접근 불가 HTTP ${repo.status}`); return { ok: false, status: repo.status }; }
  const remote = await pullAll();
  for (const s of SECTIONS) {
    if (remote[s].doc) {
      if (_applyRemote) _applyRemote(s, remote[s].doc);        // 원격 실데이터 반영
    } else if (_getLocalDoc) {
      await pushSection(s, _getLocalDoc(s));                    // 원격 비어있음 → 로컬 시드 업로드
    }
  }
  status('synced');
  return { ok: true };
}

export function disconnect() { stopPolling(); setToken(''); status('disconnected'); }

// 폴링: 각 섹션 sha 변화 감지 → 변경분 GET → 반영.
export function startPolling() {
  if (!isConnected() || _pollTimer) return;
  const ms = (syncConfig && syncConfig.pollMs) || 5000;
  const tick = async () => {
    try {
      for (const s of SECTIONS) {
        const r = await ghGetFile(s);
        if (r.status === 200 && r.sha !== _sha[s]) {
          _sha[s] = r.sha;
          const doc = unwrapEnvelope(r.text).data;
          if (_applyRemote && doc) _applyRemote(s, doc);
          status('synced', s);
        }
      }
    } catch (e) { status('error', String(e.message || e)); }
    _pollTimer = setTimeout(tick, ms);
  };
  _pollTimer = setTimeout(tick, ms);
}
export function stopPolling() { if (_pollTimer) { clearTimeout(_pollTimer); _pollTimer = null; } }

export { pullAll, pushSection };
