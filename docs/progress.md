# 진행 기록

> 이 파일은 CLAUDE.md/SKILL.md(안 바뀌는 원칙)와 별개로, "지금까지 뭘 했고 왜 그렇게 했는지"를 남기는 로그입니다.
> 새로 합류하거나 다른 브랜치에서 작업을 이어받는 사람(또는 AI)은 이 파일을 CLAUDE.md와 함께 먼저 읽으세요.
> 작업하다가 중요한 결정을 내리면 이 파일 맨 아래에 이어서 추가해주세요.

---

## 2026-07-29 — 화면 스켈레톤 완성

### 한 것
- 6화면(잠금·홈·캘린더·봉투·편지·일기상세) `docs/prototype.html` 기준으로 React Native로 옮김
- `src/theme.ts`, `src/ThemeContext.tsx` — SKILL.md §1 색 토큰, §2 타이포그래피 그대로 반영
- `src/data/mockData.ts` — 가짜 일기 데이터 + 편지 문안 (실데이터 아님, 개발용)
- 네비게이션은 라이브러리 없이 `App.tsx`에서 화면 이름을 state로 전환하는 방식

### 의도적으로 단순화한 부분 (아직 SKILL.md 기준 100% 미충족 — 나중에 보완 필요)
- **아이콘**: SKILL.md §7은 선 아이콘(stroke 1.4px)을 요구하는데, `react-native-svg`가 아직 설치 안 돼 있어서 지금은 텍스트 라벨("캘린더", "편지함")로 대체함. 나중에 `react-native-svg` 추가하고 `prototype.html`의 SVG path를 그대로 옮기면 됨
- **봉투 플랩**: 원본은 CSS `clip-path`로 삼각형인데 RN엔 없어서 지금은 사각형. 시간 되면 SVG로 삼각형 처리
- **캘린더 "안 쓴 날 탭"**: 지금은 아무 동작 안 함. `plan.md` §7 [2]대로 "그 날짜 일기 쓰기" 화면으로 연결해야 함 (사람 1 작업)
- **편지함 화면(plan.md P0 #9)**: 스켈레톤엔 아직 없음 (사람 1 작업)

### Expo SDK 57 → 54 다운그레이드한 이유
- 최초 세팅이 SDK 57이었는데, **SDK 57용 Expo Go 앱이 아직 앱스토어/플레이스토어 심사 중**이라 폰에서 "incompatible" 에러가 남
- 확인해보니 **현재 스토어에 정식으로 풀린 버전은 SDK 54**뿐 (55, 56, 57 전부 심사 대기)
- 그래서 `expo`, `react-native` 등을 전부 54 기준으로 내림. **SDK 버전을 임의로 다시 올리지 말 것** — 스토어에 54가 아닌 게 풀렸다는 공식 확인 없이 올리면 똑같은 에러 재발함
- 만약 나중에 55/56/57이 스토어에 정식으로 올라왔다는 게 확인되면, 그때는 `npx expo install expo@^해당버전.0.0` → `npx expo install --fix`로 올리면 됨

### AGENTS.md에 대해
- 내용: "Expo가 최근 많이 바뀌었으니 코드 짜기 전에 버전별 공식 문서(`https://docs.expo.dev/versions/v57.0.0/`) 확인하라"는 메모
- **지우지 말 것.** 다만 지금은 SDK 54로 내렸으니, 이 메모를 참고할 땐 v57이 아니라 **v54 문서**를 봐야 함 (`https://docs.expo.dev/versions/v54.0.0/`)

### 코딩할 때 주의할 파일 (충돌 방지)
- `App.tsx`, `src/screens/`, `src/theme.ts`, `src/ThemeContext.tsx` — 사람 1 담당, 다른 사람이 고쳐야 하면 단톡방에 먼저 말할 것
- `src/pipeline/` — 사람 2·3이 같이 쓰는 폴더. 파일 단위로 나눠서 작업 (예: `preprocess.ts`/`tagging.ts`/`extract.ts`는 사람 2, `assemble.ts`/`verify.ts`는 사람 3)
- `src/ocr/` — 사람 3

### 팀 간 인터페이스 (미리 합의된 약속, 임의로 바꾸지 말 것)

사람 1이 만들 함수:
```ts
// src/storage.ts
function getEntriesForMonth(yearMonth: string): Promise<DiaryEntry[]>
// AsyncStorage 기반이라 비동기. 쓸 때 반드시 await 붙일 것
```

사람 2 → 사람 3으로 넘기는 데이터 형태:
```ts
interface ExtractedSignal {
  category: 'repeated' | 'faded' | 'unspoken_effort';
  quote: string;   // 원문 그대로, 한 글자도 수정 없음
  date: string;    // YYYY-MM-DD
}
```

이 두 가지는 아직 실제 구현 전이라도, 이 타입을 기준으로 각자 가짜 데이터를 만들어서 먼저 개발을 시작할 수 있음.

### 실데이터 수집 (plan.md §14)
- 아직 시작 전. 오늘(7/29)부터 셋 다 시작해야 함 — 사람 2·3의 파이프라인 테스트에 필요

---

## 2026-07-30 — 코드 합류 + 캘린더 연결 · 편지함 화면 · storage.ts

### 브랜치 상태 관련 (먼저 알아야 할 것)
- `hyelim` 브랜치엔 그동안 docs만 있었고, 실제 코드 스켈레톤(App.tsx, src/ 등)은 `origin/hoooon` 브랜치에 있었음
- `origin/hoooon`의 **코드 파일만** 체크아웃해서 `hyelim`으로 가져옴 (`git checkout origin/hoooon -- App.tsx src/ assets/ ...`). docs(plan.md, 이 파일 등)는 `hyelim`의 최신 버전을 그대로 유지 — hoooon 쪽 docs는 더 오래된 버전(예: 역할분담 4인 버전, 연말편지 항목 빠짐)이라 덮어쓰지 않음
- 이후 코딩할 때는 `hyelim`이 코드까지 포함한 브랜치가 됐다는 전제로 작업하면 됨

### 빌드가 아예 안 되던 문제 발견 및 수정
- `src/screens/LetterScreen.tsx`가 **첫 커밋(43f86b3)부터 빈 파일**이었음 — 한 번도 구현된 적 없음. `App.tsx`가 default export 없는 모듈을 import해서 `npx tsc --noEmit` 자체가 실패하는 상태였음
- 오늘 요청받은 3개 작업을 확인하려면 빌드가 되어야 해서, SKILL.md §5(시그니처 화면: 편지) 기준 + `mockData.ts`에 이미 있던 `letterParagraphs`/`letterMonthLabel`/`letterSignature`를 써서 최소 구현함
- 인용 문장 탭 → `onQuoteTap(date)` 연결까지 되어 있음. 톤·카피는 손대지 않음(이미 mockData에 완성된 7월 편지 예시 그대로 사용)

### 오늘 요청받은 작업 3가지
1. **캘린더 "안 쓴 날" 탭 연결**
   - 새 화면 `src/screens/DiaryWriteScreen.tsx` 추가 — HomeScreen과 UI는 비슷하지만 임의 날짜용(뒤로가기 있음, 캘린더로 복귀)
   - `App.tsx`의 `handleSelectDay`: mock `entries`에 없는 날짜면 `write` 화면으로 분기 (기존엔 주석만 있고 미구현이었음)
   - "놓쳤다"가 아니라 "아직 안 썼다" 원칙대로 실패 표시 없음, placeholder만 다르게("이 날은...")

2. **편지함 화면 (plan.md P0 #9) 신규 구현**
   - `src/screens/LetterboxScreen.tsx` — 받은 편지 월별 리스트. 카드 없이 `--line` 구분선만 사용(SKILL.md §7 "카드는 쓰지 않는다")
   - `mockData.ts`에 `receivedLetters` 배열 추가 (현재는 7월 1건만 — 편지 데이터 자체가 아직 월별로 분리 저장되지 않기 때문. 편지 콘텐츠가 여러 달로 늘어나면 여기 확장 필요)
   - `HomeScreen`의 "편지함" 버튼(App.tsx의 `onOpenLetterbox`)이 원래 빈 함수였는데 실제로 화면 전환하게 연결. 편지함 항목 탭 → 봉투 화면으로 이동

3. **`src/storage.ts` 신규 — `getEntriesForMonth(yearMonth)`**
   - AsyncStorage 기반으로 실제 구현 (mock 반환 아님)
   - 짝 함수로 `getEntry(date)` / `saveEntry(entry)`도 같이 추가 — 안 쓴 날 → 일기 쓰기 화면이 실제로 읽고 저장할 대상이 필요했음
   - ⚠️ **인터페이스 문서(이 파일 상단, 사람1→사람2 약속)엔 `getEntriesForMonth`가 동기 함수(`DiaryEntry[]` 리턴)로 적혀 있었는데, AsyncStorage 자체가 비동기라 `Promise<DiaryEntry[]>`로 구현함.** 사람2가 갖다 쓸 때 `await` 필요 — 단톡방에 공유 필요
   - `src/dateUtils.ts`도 새로 추가: `formatDateLabel(dateStr)` — `'YYYY-MM-DD'` → `'7월 12일 일요일'`. 캘린더에서 고른 임의 날짜에 라벨을 붙이려면 필요했음 (기존엔 오늘 날짜만 하드코딩)

### 확인한 것 / 못 한 것
- `npx tsc --noEmit` 통과 (컴파일 에러 없음)
- 실기기(Expo Go)·브라우저로 화면을 직접 눈으로 확인하는 건 이번엔 못 했음 — 다음 작업자가 QR 스캔으로 직접 확인 필요
- 웹 프리뷰(`react-dom`, `react-native-web`) 설치해서 확인해보려다가 이 프로젝트는 폰 전용(Expo Go)이 기본 검증 경로라 되돌림 — `package.json`엔 안 남아 있음

### 아직 안 끝난 것 (다음 작업자용)
- 캘린더의 "쓴 날" 점 표시는 여전히 `mockData.writtenDays` 하드코딩 기반. 오늘 새로 쓴 일기가 캘린더 점에 반영되려면 캘린더 ↔ storage 연동이 별도로 더 필요함 (역할분담 문서 "사람 1 — 캘린더 완성" 항목, 오늘 범위 아니었음)
- 편지함은 현재 7월 1건만 있어서 리스트가 사실상 의미 없음. 편지 파이프라인(사람2·3)이 월별로 편지를 만들어내기 시작하면 `receivedLetters`를 실제 데이터로 교체해야 함

<!-- 다음 작업자는 여기 아래에 이어서 기록하세요 -->

## 2026-07-30 (추가) — 문서 버전 혼선 확인 및 정리

- 어제 progress.md에 "hoooon 쪽 docs는 오래된 버전(4인 역할분담, 연말편지 항목 빠짐)"이라는 메모가 있었으나,
  확인 결과 그런 별도 버전은 실제로 존재하지 않았음 (plan.md에 "연말편지" 검색해도 안 나오고, 팀원도 확인해줌)
- docs 폴더엔 plan.md / progress.md / prototype.html / 초하루_역할분담.md 이렇게 4개뿐이고, 역할분담 문서는
  하나뿐이라 버전 통일 문제 자체가 없었음
- 앞으로 문서 관련 메모 남길 땐 "어느 파일의 어느 버전"인지 파일명을 정확히 적을 것 (헷갈림 방지)

## 2026-07-30 (추가) — 브랜치 정리 완료, main이 기준점으로 확정

### 있었던 일
- hoooon과 hyelim이 애초에 커밋 역사가 서로 다른 브랜치였음(각자 로컬에서 git init한 결과로 추정)
- 이 때문에 GitHub PR 화면이 정상 작동 안 해서, 로컬에서 강제 병합(`--allow-unrelated-histories`) 진행
- `sync-hyelim`이라는 임시 브랜치를 만들어 main 기준으로 hyelim을 합치고 → PR → main에 merge 완료
- 이후 hoooon 브랜치도 main과 다시 합쳐서(충돌 5개 파일 발생, 전부 main 내용으로 채택) 최신화 완료
- **결론: 지금부터 main이 진짜 최신 기준점.** 각자 브랜치에서 작업 시작 전엔 반드시
  `git fetch origin` → `git merge origin/main`으로 최신화할 것

### CLAUDE.md 추가된 내용
- "저장소 규칙" 섹션 추가됨: PR/이슈/커밋은 원본 레포(ApptiveDev/AI-Builder-Sprint)가 아닌
  포크한 팀 레포에만 할 것 (대회 측 공지 반영)

### 사람 3 (지문) 진행 상황
- `src/pipeline/types.ts` 작성 완료 — `ExtractedSignal` 타입 정의됨
```ts
  interface ExtractedSignal {
    category: 'repeated' | 'faded' | 'unspoken_effort';
    quote: string;   // 원문 그대로, 한 글자도 수정 없음
    date: string;    // YYYY-MM-DD
  }
```
- 다음: `assemble.ts`(조립), `verify.ts`(검증) 작업 예정

### 사람 2 (yebbinie)에게
- 작업 시작 전에 본인 브랜치에서 `git fetch origin` + `git merge origin/main` 먼저 해서 최신 상태로 맞춰줘
- `getEntriesForMonth`는 비동기(`Promise<DiaryEntry[]>`)인 거 위쪽에 이미 적혀있으니 참고
- 사람2 → 사람3으로 넘길 `ExtractedSignal` 타입은 위에서 확정됨 (`src/pipeline/types.ts`), 이 타입 그대로 맞춰서 `extract.ts` 결과를 만들어주면 됨

## 2026-07-30 (추가) — 사람3: 조립·검증 파이프라인 완성, 실기기 검증 완료

### 사용 API 변경
- 당초 Claude API로 시작했으나, 대회 지원 크레딧이 있는 **Upstage Solar API로 변경**
- 엔드포인트: `https://api.upstage.ai/v1/chat/completions` (OpenAI 호환 형식)
- 모델: `solar-pro3`
- API 키는 `.env`의 `EXPO_PUBLIC_UPSTAGE_API_KEY`로 관리 (`.gitignore`에 이미 포함, git엔 안 올라감)
- ⚠️ CLAUDE.md엔 "백엔드 서버 안 씀"이라고 되어 있는데, API 키를 클라이언트(앱)에 그대로 노출하는 구조임.
  해커톤 데모 프로토타입이라는 전제로 감수하기로 함. 실제 서비스라면 이 구조는 바꿔야 함.

### 새로 만든 파일
- `src/pipeline/types.ts` — `ExtractedSignal` 타입 정의 (사람2 ↔ 사람3 인터페이스)
  ```ts
  interface ExtractedSignal {
    category: 'repeated' | 'faded' | 'unspoken_effort';
    quote: string;
    date: string; // YYYY-MM-DD
  }
  ```
- `src/pipeline/assemble.ts` — Upstage API로 편지 조립 (④조립)
- `src/pipeline/verify.ts` — 원본 일기와 인용 대조, 불일치 시 문단째 제거 (⑤검증, 순수 코드)
- `src/pipeline/generateLetter.ts` — assemble + verify 연결, AsyncStorage 캐싱 포함
- `src/data/realEntries.ts` — 지문 실제 7월 일기 5개 (파이프라인 실데이터 테스트용)
- `src/pipeline/realSignals.ts` — 위 데이터에서 수동으로 고른 신호 3개 (전부 `unspoken_effort`)
- `LetterScreen.tsx`, `App.tsx` — 위 파이프라인 실제 연결. 실패 시 mock 편지로 자동 대체됨 (안전장치)

### 조립 단계에서 겪은 문제와 해결 (다음에 프롬프트 건드릴 사람 참고용)
1. **모델이 다음 달 조언을 씀** ("~하면 좋겠다" 등, SKILL.md §9 위반) → 프롬프트에 실제 채택 편지 예시 추가해서 해결
2. **모델이 인용 문장을 자기 말로 바꿔 씀 + 사실을 반대로 지어냄** (예: "이 말은 적지 않았어"라고 반대로 서술) →
   - 인용 자리에 `{{Q1}}` 같은 표시만 넣게 하고, 실제 텍스트는 코드에서 채워 넣는 방식으로 변경 (LLM이 원문을 직접 못 쓰게 구조적으로 차단)
   - `assemble.ts`에 인용 개수 검증 로직 추가, 안 맞으면 최대 3번 재시도
3. **모델이 `{{Q1}}` 표시 앞뒤에 원문을 중복으로 씀** → `stripDuplicatedQuoteText()` 함수로 자동 후처리 (정규식 치환)
4. **모델이 프롬프트의 예시 문장(고양이, 벤치 등)을 실제 내용인 것처럼 복붙함** → 프롬프트의 예시를 구체적 문장에서 자리표시 형태로 교체
5. **서로 다른 문단의 이어주는 텍스트가 통째로 똑같이 나옴** → `assemble.ts`에 문단 간 텍스트 중복 검사 추가, 걸리면 재시도
6. 위 5가지 다 잡은 뒤에도 미묘한 문제가 종종 남을 수 있음 (예: 인용은 정확한데 그 앞뒤 서술이 논리적으로 살짝 모순되는 경우). 이건 문자열 대조로 못 잡는 영역이라 **완전 자동화는 포기하고, 발표 전 사람이 실제 편지 몇 개를 눈으로 검수하는 과정을 반드시 넣기로 함**

### 캐싱 관련
- `generateLetter`는 AsyncStorage에 `letter-cache:{yearMonth}` 키로 결과를 캐싱함
- 최초 생성은 (재시도 포함) 40~50초까지 걸릴 수 있음. 이후엔 캐시로 즉시 로드됨
- 발표 당일 API 장애 대비도 겸함 — 미리 한 번 생성해서 캐시를 만들어두면, 그 이후엔 API가 죽어도 편지가 뜸
- **개발 중 프롬프트를 계속 고칠 때는 캐시가 옛날 결과를 계속 보여줄 수 있음.** 이 경우 AsyncStorage의 `letter-cache:2026-07` 키를 수동으로 지우거나, 테스트용으로 다른 yearMonth 키(`2026-07-real-test` 등)를 쓸 것

### 확인 완료
- `tsx`로 터미널에서 가짜 데이터 테스트 완료 (assemble, verify 각각 + 연결)
- 실기기(Expo Go)에서 지문의 진짜 7월 데이터로 편지 생성 → 인용 탭 → 원본 일기 이동까지 전체 흐름 확인 완료

### 다음 할 일 (사람3)
- 사람2의 `extract.ts` 완성되면, `realSignals.ts`의 수동 데이터를 `extract.ts` 결과로 교체
- 시간 남으면 OCR(Upstage Document Parse) 연동 — 우선순위 낮음, 8/2 밤까지도 안 되면 포기 가능
- 실데이터가 5개뿐이라 '반복된 감정'/'사라진 걱정' 카테고리는 아직 의미 있게 테스트 못 함. 팀원 실데이터(§14, 아직 아무도 수집 안 함) 더 모이면 재테스트 필요

## 2026-07-31 (추가) — 신호 5개·4개 카테고리로 확장 검증, 알려진 한계 기록

### 진행
- 새 실데이터(julyDiary.ts, 17개 일기, 8/1 넘기지 않고 확보)로 교체
- 인용 방식을 번호(`{{Q1}}`) → 날짜(`{{Q:날짜}}`) 기반으로 변경 — 신호 개수가 늘어날수록 번호 착각이 잦아져서 구조적으로 해결
- 신호 5개(unspoken_effort x2, faded x1, repeated x1, good_day x1)로 처음 테스트, 4개 카테고리 다 정상 작동 확인
- assemble.ts 검증 로직 대폭 강화: 인용 날짜 집합 일치 여부, 원문 중복, 문단 간 텍스트 중복, 조언 표현(마지막 문단 제외) 자동 검증 + 최대 5회 재시도

### 알려진 한계 (해결 안 하기로 결정, 발표 전 사람이 직접 확인 필요)
- **문단 구조가 획일화되는 경향**: 다섯 문단이 전부 "[상황]. {{Q:날짜}}이라고 적어놨더라. 그때는 ~, 지금은 ~." 패턴으로 반복됨
- 프롬프트로 2번 시도했으나 개선 안 됨 (오히려 더 획일화된 경우도 있었음) — 모델의 습성에 가까운 문제로 판단, 프롬프트만으론 한계
- **발표 직전(8/2), 실제 발표용 데이터로 편지를 뽑아서 문장 다양성 사람이 직접 검수/수정할 것.** 필요하면 그때 문단 몇 개를 손으로 다시 쓰는 것도 고려
- 시간 남으면 코드로 연결 표현을 랜덤하게 강제하는 방식도 고려 가능하나, 지금은 우선순위 낮음으로 보류

## 2026-07-31 — 사람3: 편지 파이프라인 확장 검증 + OCR 연동 완성

### 실데이터 교체
- 팀원 실제 7월 일기(17개, `src/data/julyDiary.ts`)로 테스트 데이터 교체
- 신호 5개(unspoken_effort x2, faded x1, repeated x1, good_day x1)로 확장, 4개 카테고리 전부 실제로 검증 완료
- `src/pipeline/julySignals.ts` — 수동으로 고른 신호 (extract.ts 완성되면 이 파일을 실제 자동 추출 결과로 교체 예정)

### 인용 방식 변경: 번호 → 날짜 기반
- 기존 `{{Q1}}`, `{{Q2}}`... 순서 번호 방식은 신호가 5개로 늘어나자 모델이 번호를 자주 착각함 (텍스트는 맞는데 번호가 다른 신호를 가리키는 사고 발생)
- `{{Q:2026-07-14}}`처럼 **날짜를 직접 표시**하는 방식으로 변경 — 날짜는 서로 다 달라서 착각할 확률이 구조적으로 낮아짐
- `assemble.ts` 검증 로직도 강화: 신호의 날짜 집합과 실제 사용된 인용 날짜 집합이 정확히 일치하는지 확인 (누락/중복 모두 잡아냄), 원문 중복, 문단 간 텍스트 중복, 조언 표현(마지막 문단 제외) 자동 검증. 재시도 횟수 3→5로 확대

### 알려진 한계 (해결 안 하기로 결정, 발표 전 사람이 직접 확인 필요)
- **문단 구조가 획일화되는 경향**: "[상황]. {{Q:날짜}}이라고 적어놨더라. 그때는 ~, 지금은 ~." 패턴이 반복됨
- 프롬프트로 2번 시도했으나 개선 안 됨 — 모델 습성에 가까운 문제로 판단, 프롬프트만으론 한계
- **발표 직전(8/2), 실제 발표용 데이터로 편지를 뽑아서 문장 다양성 사람이 직접 검수/수정할 것**
- 시간 남으면 코드로 연결 표현을 랜덤하게 강제하는 방식도 고려 가능하나 우선순위 낮음

### OCR 연동 (Upstage Document Digitization)
- 엔드포인트: `https://api.upstage.ai/v1/document-digitization` (`document=파일`, `model=document-parse`, `ocr=force`)
- ⚠️ 응답의 `content.text`가 빈 문자열로 오는 경우가 있음 — 이 경우 `content.html`에서 태그를 제거해서 텍스트를 뽑아내는 방식으로 우회함 (`src/ocr/upstageOcr.ts`)
- 새 파일: `src/ocr/upstageOcr.ts`(API 호출), `src/screens/OcrReviewScreen.tsx`(결과 확인·수정 화면, plan.md §7 [3]에 따라 바로 저장 안 하고 수정 화면 거치게 함)
- `HomeScreen`의 "사진" 버튼 연결 (`expo-image-picker` 사용)
- `App.tsx`에 `ocr` 화면 상태 추가, `storage.ts`의 `saveEntry` 연결까지 완료 — 저장 확인됨

### 그 과정에서 같이 고친 것들
- `App.tsx`의 `currentEntry` 조회 우선순위 정리: `storage.ts`(실제 저장된 것) → `julyDiary`(테스트 데이터) → `mockData` 순으로 확인하도록 변경 (원래는 storage.ts를 아예 안 보고 있어서, OCR로 저장해도 화면에 반영이 안 됐음)
- `LetterScreen`에 뒤로가기(`onBack`) 버튼 추가 — 원래 "봉투→편지→인용탭" 흐름만 상정하고 만들어져서, 그냥 홈으로 돌아가는 경로가 없었음
- `HomeScreen`, `OcrReviewScreen`에 키보드 dismiss 처리 추가 (`src/components/DismissKeyboardView.tsx` 신규, 화면 빈 곳 탭하면 키보드 내려감)

### .env 관련
- `.env.example` 파일은 따로 만들지 않기로 함 — 필요한 환경변수(`EXPO_PUBLIC_UPSTAGE_API_KEY`)를 팀원들에게 직접 구두/메시지로 안내함
- 새로 합류하거나 새 컴퓨터에서 시작하는 사람은 프로젝트 루트에 `.env` 파일을 직접 만들고 아래 한 줄을 넣을 것:

## 2026-07-31 (추가) — extract.ts 실제 결과로 최종 연결

- 사람2의 extract.ts 완성분(good_day, unspoken_effort 7개, yebbinie 브랜치 `src/pipeline/fixtures/july-signals.json`) 반영
- repeated/faded는 아직 미구현 (②태깅 의존) — extract.ts 파일 상단 주석에도 명시됨. 사람2가 손으로 후보 짚어놓음(잠/보고서/지갑), 내일 만나서 마저 구현 예정
- generateLetter.ts 캐시에 신호 해시 비교 로직 추가 — 신호 내용이 바뀌면 캐시 자동 무효화되도록 수정 (이전엔 신호 바꿔도 옛날 캐시가 계속 재사용되는 버그 있었음)
- tsconfig.json에 resolveJsonModule 추가 (JSON 파일 import 위해 필요)
## 2026-07-31 — 사람1: 저장소(storage.ts) CRUD 정리, 홈 화면 저장 버튼 연결

### AsyncStorage
- `@react-native-async-storage/async-storage@2.2.0` 이미 설치돼 있었음(`npx expo install --check` 통과, SDK 54와 호환). 새로 설치한 것 없음

### `src/storage.ts` 함수 이름 변경 + 신규 추가
- 기존 `getEntry(date)` / `saveEntry(entry: DiaryEntry)` → `getDiaryEntry(date)` / `saveDiaryEntry(date, content)`로 이름 변경
  - `saveDiaryEntry`는 `(date, content)` 두 인자만 받고, `dateLabel`은 내부에서 `formatDateLabel(date)`로 자동 생성함. 기존 `highlight` 필드가 있던 항목은 덮어쓰지 않고 그대로 유지(스프레드 후 `body`만 교체)
  - **호출부가 있으면 이 이름으로 맞춰서 고쳐야 함** — 오늘 `src/screens/DiaryWriteScreen.tsx`의 호출부도 같이 바꿔놨음
- `deleteDiaryEntry(date)` 신규 추가 (지금까지 없었음)
- `getEntriesForMonth(yearMonth)`는 손대지 않음 — 이미 사람2와 공유된 시그니처(`Promise<DiaryEntry[]>`)라 그대로 둠
- AsyncStorage 키 구조는 그대로: 단일 키 `chohyaru:diaryEntries`에 `{ [date]: DiaryEntry }` 통짜 오브젝트. 날짜별 개별 키로 바꾸지 않음 (한 달 최대 31건 수준이라 안 바꿔도 됨, `getEntriesForMonth` 구현이 이 구조 전제)

### 홈 화면(오늘 일기) 저장 기능 실제 연결
- `App.tsx`: 하드코딩돼 있던 `todayLabel = '7월 28일 화요일'` TODO를 실제 `new Date()` 기반 `YYYY-MM-DD` + `formatDateLabel`로 교체. `HomeScreen`에 `date` prop으로 오늘 날짜 문자열을 넘겨줌
- `src/screens/HomeScreen.tsx`:
  - 진입 시 `getDiaryEntry(오늘 날짜)`로 기존에 쓴 게 있으면 불러와서 이어쓰기 (plan.md §7 [1] "오늘 이미 쓴 게 있으면 이어쓰기" — 지금까지 빈 입력창만 있던 부분이라 이번에 같이 채움)
  - 저장 버튼 `onPress` → `saveDiaryEntry(date, text)` 연결 (기존엔 버튼에 `onPress` 자체가 없었음)
  - 저장 성공 시 버튼 옆에 `--sub` 색 텍스트로 "저장됨"이 1.5초간 떴다 사라짐. 토스트/스낵바 같은 팝업은 디자인 스킬 기준(카드·그림자 없음, 앱이 말을 많이 안 걺)에 안 맞아서 인라인 텍스트로 처리함. 화면 이동은 안 함 — 홈 자체가 "오늘 일기" 화면이라 이동할 곳이 없음

### 확인한 것 / 못 한 것
- `npx tsc --noEmit`: 이번에 건드린 파일(`App.tsx`, `HomeScreen.tsx`, `DiaryWriteScreen.tsx`, `storage.ts`) 관련 에러 없음. (참고: `frontend/` 폴더에 별개의 미사용 스캐폴드 관련 에러가 이미 있었는데, 이번 작업과 무관 — 안 건드림)
- **실기기(Expo Go) 확인은 못 함.** 폰을 직접 조작할 수 있는 도구가 없어서, 이번 세션에서 `npx expo start`로 Metro 서버(`http://localhost:8081`)만 띄워놓고 팀원에게 실기기 확인을 요청함. 확인해야 할 것: ① 오늘 일기 입력 후 저장 → "저장됨" 텍스트가 잠깐 뜨는지 ② 앱을 껐다 켜거나 캘린더 갔다 왔을 때 저장한 내용이 남아있는지(이어쓰기) ③ 캘린더에서 "안 쓴 날" 탭 → 일기 쓰기 화면 저장도 계속 정상 동작하는지(호출부 이름만 바뀌었을 뿐 동작은 동일해야 함)

### 다음 작업자 참고
- `deleteDiaryEntry`는 이번엔 UI에서 아직 아무 데서도 안 씀 (요청받은 CRUD 세트만 먼저 갖춰둔 것). 일기 삭제 버튼이 화면에 생기면 그때 연결하면 됨

## 2026-07-31 (추가) — 사람1: SVG 아이콘·봉투 플랩 다듬기 + plan.md §12 "7/31 목표" 점검

### `react-native-svg` 설치 + 아이콘/봉투 플랩 마감
- `npx expo install react-native-svg` → `15.12.1` (SDK 54 호환 버전 자동 해결)
- `src/components/icons.tsx` 신규 — `MailIcon`/`CalendarIcon`, `prototype.html`의 SVG path 그대로 옮김, stroke 1.4px (SKILL.md §7)
- `HomeScreen.tsx`의 "편지함"/"캘린더" 텍스트 라벨 → 위 아이콘으로 교체
- `EnvelopeScreen.tsx`의 사각형 플랩 View → `react-native-svg` `Polygon`으로 삼각형 처리 (`prototype.html`의 `clip-path: polygon(0 0, 100% 0, 50% 100%)`와 동일한 좌표)
- 진행 기록에 남아있던 "의도적으로 단순화한 부분" 2건(2026-07-29 항목) 모두 해소됨

### plan.md §12 "7/31 목표: 편지 화면 · 문장 탭 이동 · 편지 톤 프롬프트" 점검 결과
사람3이 7/30에 미리 끝내놓은 항목이라 오늘은 검증만 했는데, **문장 탭 → 하이라이트가 실데이터에서 동작하지 않는 버그**를 발견함.

- `LetterScreen.tsx:68` — `onQuoteTap(seg.date)`로 **날짜만** 넘기고 실제 인용 문구(`seg.content`)는 버림
- `DiaryDetailScreen.tsx:14` — 하이라이트 여부를 그 날짜 일기의 **정적 필드** `entry.highlight`로만 판단
- `src/data/realEntries.ts`(실데모 데이터 5건)엔 `highlight` 필드가 **하나도 없음** — `mockData.ts`만 하드코딩으로 갖고 있어서, 지금까지 실기기 검증(7/30 로그)에서도 이 하이라이트 자체는 눈으로 확인 안 된 채 통과된 것으로 보임
- 결과: 편지 화면에서 문장 탭 → 그날 일기로 이동은 되지만(네비게이션 OK), 인용된 문장 하이라이트는 실데이터 경로에서 항상 비어 있음. plan.md §7 [5]가 "핵심 감동 포인트"라고 명시한 기능이고, 시연 경로("문장 탭 → 그날 일기로 이동") 한가운데 걸려 있어서 **발표 전 반드시 고쳐야 함**
- 고치려면 `onQuoteTap` 시그니처에 인용 문구를 같이 넘기거나, `DiaryDetailScreen`에서 날짜만으로 하이라이트를 다시 찾는 방식이 필요 — `LetterScreen.tsx`는 사람3 파일이라 손대기 전 공유 필요
- **수정 완료** (같은 날 이어서 처리, 사람3 파일까지 포함해서 반영):
  - `LetterScreen.tsx` — `onQuoteTap(seg.date)` → `onQuoteTap(seg.date, seg.content)`로 인용 문구도 같이 넘기게 변경
  - `App.tsx` — `diaryQuote` state 추가, `handleQuoteTap(date, quote)`로 확장해 저장, `DiaryDetailScreen`에 `quote` prop으로 전달. `handleSelectDay`(캘린더에서 진입)에서는 `diaryQuote`를 `null`로 리셋해 이전 인용이 새로 연 일기에 안 새게 함
  - `DiaryDetailScreen.tsx` — `quote` prop 추가. 하이라이트 판단 우선순위: ① 넘어온 `quote`가 `entry.body`에 실제로 있으면 그걸 사용(실데이터 경로, `verify.ts`가 이미 존재를 보장) ② 없으면 기존 `entry.highlight` 폴백(목데이터 스켈레톤 경로 — `letterParagraphs`의 인용 문구와 `mockData.entries`의 `highlight` 필드가 손으로 쓰여 서로 정확히 안 맞아서 그대로 유지)
  - `npx tsc --noEmit` 통과 (frontend/ 미사용 스캐폴드 에러 제외 시 에러 없음)
  - 실기기 확인은 아직 못 함 — 다음에 폰으로 편지 화면 → 문장 탭 → 하이라이트 뜨는지 확인 필요

### 캘린더 ↔ storage 연동 (7/29 이월 항목) — 완료
- `CalendarScreen.tsx` 수정: 마운트 시 `storage.ts`의 `getEntriesForMonth('2026-07')`를 호출해 실제 저장된 날짜를 가져오고, 기존 데모 데이터(`mockData.entries`, `realEntries.ts`의 `realEntriesJuly`)의 날짜와 합쳐서 "쓴 날" 집합을 계산하도록 변경. `writtenDays`가 더 이상 하드코딩 배열이 아니라 이 결합 결과의 `useState`
- 오늘 홈 화면이나 "안 쓴 날" 쓰기 화면에서 새로 저장한 일기가 캘린더 점에 즉시 반영됨 (화면이 매번 새로 마운트되는 구조라 재진입 시 재조회됨)
### `App.tsx` 캘린더 탭 라우팅에 AsyncStorage 반영 — 완료
- `handleSelectDay`를 async로 변경: `getDiaryEntry(date)`를 먼저 조회해서, storage/mock/real 어디에든 일기가 있으면 `diary` 화면으로, 셋 다 없을 때만 `write` 화면으로 분기. 이제 AsyncStorage에만 있는 날짜를 탭해도 '일기 상세'로 정확히 감 (plan.md 화면 흐름도: 캘린더→일기 상세)
- `currentEntry`를 동기 계산에서 `useState` + `useEffect`(diaryDate 변경 시 `getDiaryEntry` 조회, 우선순위: storage → `realEntriesJuly` → mock `entries`)로 전환. 조회 중엔 `diaryLoading` 상태로 짧게 `ActivityIndicator` 표시 (LetterScreen과 같은 패턴)
- `handleQuoteTap`(편지에서 문장 탭)은 손대지 않음 — `diaryDate`만 바꾸면 위 `useEffect`가 알아서 storage 우선으로 다시 조회하므로 자동으로 같은 혜택을 받음
- `npx tsc --noEmit` 통과 (frontend/ 미사용 스캐폴드 에러 제외 시 에러 없음)
- 실기기 확인은 아직 못 함 — 다음에 폰으로 ① 오늘 홈에서 일기 저장 → 캘린더 갔다가 그 날짜 다시 탭 → 일기 상세로 바로 가는지 ② 안 쓴 날은 여전히 '일기 쓰기'로 가는지 확인 필요

## 2026-08-01 — hyelim 브랜치 병합 + 캘린더 버그 수정

### hyelim 브랜치 병합
- 날짜 하드코딩 해결 (todayDateString() 실제 계산), storage.ts 함수명 통일 (getEntry→getDiaryEntry 등)
- 편지 인용 하이라이트 버그 수정 (LetterScreen→App.tsx→DiaryDetailScreen에 quote 전달)
- react-native-svg 아이콘, 봉투 삼각 플랩 적용
- 캘린더 storage.ts 실데이터 연동
- 4개 파일 충돌(App.tsx, HomeScreen.tsx, LetterScreen.tsx, progress.md) 수동 병합 완료

### 캘린더 렌더링 버그 발견 및 수정
- 요일 헤더와 날짜 칸이 flexWrap 반올림 오차로 6개씩만 한 줄에 들어가고 나머지가 밀리는 버그 발견
- flexWrap 방식 대신, 7일씩 명시적으로 week 배열을 나눠서 렌더링하는 방식으로 변경

### 결정 사항
- 캘린더는 실제 오늘(8월) 기준 동적 전환 대신, 발표 데이터(7월)에 맞춰 2026-07 고정 유지하기로 함. 8월에 저장한 데이터는 storage.ts엔 정상 저장되지만 캘린더에서 확인은 불가 — 발표 시연엔 지장 없음

## 2026-08-01 (추가) — 지문/PIN 인증 구현

- expo-local-authentication 설치, LockScreen에서 실제 지문/Face ID 인증 호출
- 기기에 지문 미등록·미지원 또는 인증 실패/취소 시 자동으로 PIN 화면으로 전환
- PinScreen.tsx 신규: 최초 1회 4자리 PIN 설정(설정→확인 2단계) → 이후엔 검증만
- storage.ts에 getPin/setPin 추가 (AsyncStorage, 평문 저장 — 데모 앱 수준이라 보안 강화는 안 함)
- 실기기 확인 완료: 지문 인증, PIN 설정, PIN 재입력 모두 정상 동작

## 2026-08-01 (추가) — 편지 문장 다양성 개선 시도, 사람2에게 인계

### 문제
- 팀원들이 편지가 "부자연스럽다"고 지적 — 문장이 기계적으로 반복되고, 나열식 구조("N일엔 이랬고")가 느껴짐
- 손으로 쓴 예시 편지(mockData.ts)와 비교했을 때, AI 결과는 연결 표현이 단조롭고 "그때는~지금은~" 패턴이 반복됨

### 시도한 것 (assemble.ts SYSTEM_PROMPT)
1. "적어놨더라" 반복 금지 + 연결 표현 다양화 지시 → 어느 정도 개선됨
2. "날짜 순서 나열 금지" (N일에 표현 금지) → 나열식 구조 줄어듦
3. 마무리 문단을 모델이 아니라 코드에서 고정으로 붙이도록 변경 (CLOSING_LINE) → 마무리 누락 문제 해결
4. "인용 앞에서 내용 미리 설명 금지" 규칙 추가 → 아직 완전히 해결 안 됨

### 아직 남은 문제 (핵심)
- **모델이 인용 앞에 그 내용을 요약하는 문장을 쓰고, 바로 뒤에 실제 인용을 또 붙이는 패턴이 계속 발생.**
  예: "엄마가 옥수수 삶아준 저녁이 있었어. 그게 여름이지…… [실제 인용: 저녁에 엄마가 옥수수 삶아줬는데 이게 여름이지……]"
  → 같은 내용이 다른 표현으로 두 번 나와서 팀원이 다시 지적함
- 이걸 코드로 잡으려고 "인용을 4글자 단위로 쪼개서 앞 문장과 겹치는지 검사"하는 로직을 시도했으나,
  **너무 엄격해서 8번 재시도해도 거의 통과를 못 하고, 결국 catch로 빠져서 mock 편지(가짜 예시)가 대신 뜨는 상태가 됨.**
  → 이 엄격한 검사는 되돌림 (원래의 "정확히 같은 문자열만 검사"로 복원)

### 다음에 시도해볼 만한 방향 (아직 안 해본 것)
- 청크 크기를 4글자보다 크게(6~8글자) 해서 오탐 줄이기
- 프롬프트에 "인용 앞 설명" 예시를 더 강하게 반복 제시 (few-shot처럼)
- 아예 다른 접근: 모델이 인용 앞에 아무 설명도 못 쓰게 하고, 인용을 항상 문장 맨 앞에 오도록 강제 (형식 제약을 더 엄격히)
- resolved/repeated처럼 category가 명확한 신호는 템플릿 기반으로 일부 코드가 직접 문장을 만들고, 나머지만 LLM에 맡기는 하이브리드 방식도 고려 가능

### 테스트 방법

npx tsx src/pipeline/testJulyDiary.ts

결과에서 재시도 로그(`검증 실패 감지...`)가 몇 번 뜨는지, 8번 넘어가서 에러로 죽는지 확인.
에러 나면 실기기에서는 mock 편지(옥수수/날씨/면접/붙었다 예시)가 대신 뜬다 — 이게 뜨면 파이프라인이 실패했다는 신호.

### 파일 위치
- `src/pipeline/assemble.ts` — 프롬프트와 검증 로직 다 여기 있음
- `src/pipeline/fixtures/july-signals.json` — 지금 신호 데이터 (9개, good_day/unspoken_effort/repeated/resolved)
