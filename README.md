# JinBucks ☕ — 바리스타 레시피 학습 앱

스타벅스 음료 레시피(재료·투입순서·기준선/수량·사이즈 예외·마무리)를 **구조화 → 차이 구분 →
직접 회상 → 간격 반복**으로 익히는 빌드리스 정적 웹앱.

## 구성
- **최상위 탭 셸**: `레시피 학습`(활성) · `근무 스케줄`(준비 중, 향후 확장)
- **레시피 학습 탭 4개 뷰**
  - 관찰: 단계별(다음/이전) 컵 레이어 시각화, 블렌딩 전/후 상태 분리
  - 회상 퀴즈: 사이즈 선택 + 후보에서 순서 구성 → 순서까지 엄격 채점 + 오류 유형별 피드백
  - 복습(SRS): 틀린 구성요소만 Leitner 간격(1·2·4·7·15일)으로 재출제
  - 데이터 관리: 재료/레시피 CRUD + JSON export/import

## 데이터 모델
- `data/recipe-trainer/ingredients.json`, `recipes.json` (revision 스탬프)
- `phase` 통일 스키마: `pre-blend | blend | post-blend | finish`
- 채점 엔진 `js/features/recipe-trainer/grade.js`: 집합 diff + LCS 정렬로 오류 유형 독립 채점

## 로컬 실행
정적 서버 필요(`file://`는 `fetch` CORS로 차단됨):
```bash
npm run serve          # 또는: python -m http.server 8080
# → http://localhost:8080
```

## 테스트
```bash
npm test               # 채점 엔진 known-answer 테스트 (node)
# 브라우저: http://localhost:8080/test.html
```

## 배포 (GitHub Pages)
루트를 소스로 하는 정적 사이트. `.nojekyll` 포함(Jekyll 비활성).

> ⚠️ `needsReview: true` 레시피(초콜릿 바나나·그린티 바나나 등)는 사용자 필기 기반 해석으로,
> 실제 매장 레시피로 검증이 필요합니다.
