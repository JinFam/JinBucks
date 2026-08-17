// js/sync-config.example.js — 동기화 설정 템플릿.
// 사용법: 이 파일을 js/sync-config.js 로 복사하고 owner/repo를 채운다.
// ⚠️ 토큰(PAT)은 절대 여기 넣지 않는다. 토큰은 앱 UI에서 1회 입력 → localStorage에만 저장.
//    이 파일에는 비밀이 없으므로 공개 레포에 커밋해도 안전하다.
export const syncConfig = {
  owner: 'YOUR_ORG',        // 조직/사용자 (fine-grained PAT의 Resource owner와 동일)
  repo: 'YOUR_SYNC_REPO',   // 비공개 데이터 레포 이름
  branch: 'main',
  dir: 'state',             // 섹션 JSON이 들어갈 폴더 (state/ingredients.json ...)
  pollMs: 5000,             // 폴링 주기(ms)
  label: '',                // 이 기기 사용자 라벨(updatedBy 기본값)
};
