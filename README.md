# 토스 트레이더 (Toss Trader)

> 토스증권 Open API와 로컬 LLM CLI를 이용해 계좌·시장 상태를 주기적으로 분석하고,
> `BUY` / `SELL` / `HOLD` 판단을 화면에 표시하는 Next.js 애플리케이션입니다.

이 프로젝트는 [kstost/stock](https://github.com/kstost/stock)을 기반으로 재구축한 결과물입니다.
원작자가 설계한 분석 파이프라인(로컬 LLM exec → JSON 스키마 응답 → UI 표시)을 그대로 따르되,
LLM 백엔드를 **Codex → OpenCode**로 교체해 누구나 무료로(또는 NIM·로컬 모델로) 사용할 수 있도록 만들었습니다.

---

## 원작자 (Credit)

이 프로젝트의 아키텍처와 핵심 프롬프트 설계는
**[@kstost](https://github.com/kstost) 님의 [kstost/stock](https://github.com/kstost/stock)** 에서 출발했습니다.

- 토스증권 Open API 연동 패턴
- `lib/codex-agent.ts` 구조 (system prompt + spawn + 검증)
- `schemas/investment-agent-output.schema.json` (BUY/SELL/HOLD 판단 스키마)
- `history/*.json` 1-record-1-file 누적 방식
- `BUY` / `SELL` 버튼만 실제 주문을 발생시키는 분리 설계

그 외 모든 코드 변경(OpenCode 전환, 환경 정리, 에러 수정, UI 개선)은 본 저장소에서 이루어졌습니다.

원본 저장소 README에 있는 "투 자 전 권, 분석과 주문 실행의 분리" 같은 안전 정책은 그대로 유지합니다.

---

## 왜 Codex → OpenCode 로 바꿨는가

원작자 구현은 Codex CLI (`~/codex exec`)를 백엔드로 사용합니다. Codex는 OpenAI API 키 기반이라
사용료가 발생하고, 본 프로젝트를 가볍게 시험해 보고 싶은 사람에게는 진입 장벽이 됩니다.

OpenCode로 전환한 목적은 **구독료 없이도 동일한 분석 파이프라인을 사용할 수 있게 하는 것**입니다.

| | Codex (원본) | OpenCode (이 저장소) |
|---|---|---|
| **비용** | OpenAI API 키 필요 (유료) | 무료 모델 또는 자체 API 키 |
| **기본 사용 가능** | ❌ | ✅ ([oh-my-opencode](https://github.com/code-yeongyu/oh-my-opencode) Free) |
| **NIM(NVIDIA) 연동** | 추가 코드 필요 | OpenCode provider 추가만으로 가능 |
| **로컬 모델** | 비공식 | `ollama` / `lmstudio` `--local-provider` 지원 |
| **권한 정책** | `--dangerously-bypass-approvals-and-sandbox` (전부 통과) | `--auto` (deny 안 된 것만 통과) ← 더 안전 |
| **stdout 형식** | 자유 형식 (마크다운 펜스 섞임) | `--format json` (구조화된 JSONL) |

즉, **"구독료가 없는 사람도 OpenCode의 Free 모델이나 NIM을 이용해서 동일한 분석 파이프라인을 돌릴 수 있도록"** 하는 것이 본 저장소의 핵심 의도입니다.
원작자 분이 의도한 안전 정책(분석과 주문 실행 분리, API 키 서버 메모리 보관, history 키 마스킹 등)은 그대로 유지됩니다.

---

## 요구 사항

- Node.js 22 이상
- npm
- 로컬 **OpenCode** 실행 파일 ([opencode.ai](https://opencode.ai))
- 토스증권 Open API 문서: `./tossinvest_apidocs.json`
- 토스증권 Open API Key / Secret Key ([WTS → 설정 → Open API](https://www.tossinvest.com/)에서 발급)

## 설치

```bash
npm install
```

## OpenCode 경로 설정

기본값은 macOS Homebrew 설치 위치인 `/opt/homebrew/bin/opencode`입니다.
다른 위치에 있다면 환경변수 `OPENCODE_BIN`(또는 `AGENT_BIN`)으로 덮어쓸 수 있습니다.

```bash
export OPENCODE_BIN=/absolute/path/to/opencode
npm run dev
```

경로가 올바른지 확인:

```bash
$OPENCODE_BIN run --format json "Return exactly: {\"ok\":true}"
```

### 에이전트 선택 (선택 사항)

기본은 OpenCode입니다. 환경변수 `AGENT_KIND`로 다른 에이전트를 활성화할 수 있습니다.
현재 저장소에는 `opencode` 한 가지만 번들되어 있습니다(`codex`는 자리만 남겨두고 미구현).

```bash
AGENT_KIND=opencode npm run dev
```

## 개발 서버 실행

```bash
npm run dev
```

기본 주소: <http://localhost:3000>

## 사용 방법

1. 브라우저에서 `http://localhost:3000`을 엽니다.
2. 토스증권 `API Key`와 `Secret Key`를 입력합니다.
3. **분석 간격 (초)** 을 입력합니다. 최소값 30초, 기본값 60초.
4. 행동지침을 입력합니다.
5. `시작` 버튼을 누릅니다.
6. OpenCode가 토스증권 Open API 문서와 현재 history를 참고하여 분석합니다.
7. 결과가 화면에 표시됩니다.
8. 필요하면 수량, 지정가, 통화를 수정합니다.
9. 실제 주문을 원할 때만 `BUY` 또는 `SELL` 버튼을 누릅니다.

## 분석 결과 형식

OpenCode의 최종 응답은 JSON Schema와 동일한 구조로 검증합니다
(검증 로직은 `lib/agents/shared.ts`의 `parseRecommendation`).

스키마 파일: `schemas/investment-agent-output.schema.json`

기본 형태:

```json
{
  "symbol": "005930",
  "market": "KR",
  "decision": {
    "action": "BUY",
    "confidence": 0.87,
    "reason": "거래량 증가와 추세 돌파가 확인되었습니다."
  },
  "order": {
    "quantity": 2,
    "limitPrice": 81000,
    "currency": "KRW"
  },
  "references": [
    {
      "title": "관련 뉴스 제목",
      "url": "https://example.com",
      "reason": "판단 근거"
    }
  ]
}
```

런타임 검증 규칙:

- `HOLD` 이면 `order` 는 반드시 `null`
- `BUY` 또는 `SELL` 이면 `order` 필수
- `confidence` 는 0 이상 1 이하
- 주문 수량과 지정가는 0보다 커야 함
- 참고 링크 URL은 `http://` 또는 `https://` 로 시작해야 함

## History

모든 분석과 주문 결과는 `./history/` 폴더에 JSON 파일로 저장됩니다.
파일명은 epoch seconds 기준이며, 같은 초에 여러 기록이 생기면 `-2`, `-3` 같은 suffix가 붙습니다.

기록 종류:

- `analysis`: OpenCode 분석 결과
- `order`: 사용자가 누른 주문 요청 결과

UI 오른쪽 `History Log`에서 항목을 클릭하면 모달로 상세 내용을 볼 수 있습니다.

## 주요 파일 구조

```text
app/                                   # Next.js App Router
  page.tsx                             # 메인 화면
  layout.tsx
  api/
    session/route.ts                   # API Key/Secret 세션 생성
    agent/run/route.ts                 # OpenCode 분석 실행
    order/route.ts                     # Toss 주문 요청
    history/route.ts                   # history 목록 조회
components/                            # shadcn/ui + 커스텀 컴포넌트
lib/
  agents/
    shared.ts                          # system prompt + 검증 (agent 공용)
    opencode/runner.ts                 # opencode run 실행 래퍼
    index.ts                           # AGENT_KIND 라우터
  agent.ts                             # 호환 re-export (구 import 경로 유지)
  tossinvest.ts                        # 토스증권 Open API 클라이언트
  history.ts                           # history 파일 저장/조회
  session-store.ts                     # 서버 메모리 세션 저장
  types.ts                             # 공유 타입
  utils.ts                             # 포맷/유틸
schemas/investment-agent-output.schema.json
tossinvest_apidocs.json                # 토스증권 OpenAPI 문서
prompt.txt                             # 원작자 system prompt 원본 (참고용)
```

## OpenCode 실행 방식

분석 요청마다 새 `opencode run` 프로세스를 실행합니다.

특징:

- 인자 없이 `opencode run "prompt"`로 호출하면 자동으로 새 세션이 시작된다 (이전 세션을 resume 하지 않음).
- `--format json`으로 최종 응답을 stdout의 `text` 이벤트로 받는다.
- 토스증권 키는 child process 환경변수로만 전달한다.

환경변수 이름 (child process에 전달):

```text
TOSSINVEST_API_KEY
TOSSINVEST_SECRET_KEY
TOSSINVEST_APIDOCS_PATH
TOSSINVEST_HISTORY_DIR
TOSSINVEST_BASE_URL
```

OpenCode 프롬프트에는 다음 지침이 포함됩니다.

- 토스증권 Open API 문서 경로 확인
- 계좌 조회 후 필요한 API에는 `X-Tossinvest-Account` 사용
- 실제 주문 생성·정정·취소 endpoint 호출 금지
- API 데이터와 최신 공개 정보를 함께 참고
- 근거가 부족하면 `HOLD` 우선
- 도구 호출 4회 이내 (인증 실패 시 즉시 HOLD)

## 주문 방식

현재 서버 주문 API는 지정가 주문만 생성합니다.

요청 흐름:

1. `/oauth2/token` 으로 access token 발급
2. `/api/v1/accounts` 로 첫 번째 계좌 조회
3. `/api/v1/orders` 에 `LIMIT` 주문 생성

주문 요청 필드:

- `symbol`
- `side`: `BUY` 또는 `SELL`
- `orderType`: `LIMIT`
- `quantity`
- `price`
- `clientOrderId`

## 검증 명령

```bash
npm run lint
npm run build
npm audit --audit-level=moderate
```

OpenCode smoke test 예시:

```bash
$OPENCODE_BIN run --format json --auto \
  -C "$(pwd)" \
  'Return exactly: {"ok":true}'
```

## 서버 중지

개발 서버를 터미널에서 실행 중이라면 `Ctrl+C` 로 중지합니다.

포트 점유 확인:

```bash
lsof -nP -iTCP:3000 -sTCP:LISTEN
```

필요 시 해당 프로세스를 종료합니다.

```bash
kill <PID>
```

## 보안 메모

- Secret Key 를 저장소에 커밋하지 마세요.
- `history` 파일에는 API Key, Secret Key, access token 이 저장되지 않도록 마스킹합니다.
- 8자 미만인 키는 식별력이 낮아 마스킹을 스킵합니다 (반대로 마스킹하면 JSON 이 깨질 수 있음).
- OpenCode stdout/stderr 도 키 문자열을 마스킹한 뒤 history 에 저장합니다.
- 실제 운영 환경에서는 추가 인증, HTTPS, 서버 재시작 시 세션 초기화 정책, 주문 전 재확인 절차를 두는 것이 좋습니다.

## 주의 사항

- 이 앱은 라이브 토스증권 API 를 사용합니다.
- `BUY` 또는 `SELL` 버튼을 누르면 실제 주문 요청이 발생할 수 있습니다.
- OpenCode 가 생성한 판단은 투자 조언 자동화 실험용 결과이며, 손실 가능성이 있습니다.
- 이 앱의 사용으로 인해 생길 수 있는 모든 위험과 문제에 대한 책임은 사용자 본인이 부담합니다.
- API Key 와 Secret Key 는 서버 메모리에만 저장하며 파일에 저장하지 않습니다.
- 채팅, 로그, 화면 공유 등에 Secret Key 가 노출되면 즉시 재발급하는 것을 권장합니다.
- OpenCode 분석 프롬프트에는 실제 주문 생성·정정·취소 endpoint 호출 금지 지침이 포함되어 있습니다.

## 책임 고지

이 프로젝트는 투자 판단과 주문 실행을 자동화하는 실험용 도구입니다.
소프트웨어 오류, API 오류, 시장 변동, 지연된 정보, 잘못된 모델 판단, 사용자 설정 오류 등으로 인해
금전적 손실이 발생할 수 있습니다.

이 앱의 사용으로 인해 생길 수 있는 모든 위험과 모든 문제에 대한 책임은 사용자 본인이 부담합니다.
개발자 또는 배포자는 이 앱의 사용으로 인해 발생하는 어떠한 문제에 대해서도 책임지지 않습니다.

## 라이선스

원작자 [kstost/stock](https://github.com/kstost/stock)의 라이선스를 그대로 따릅니다.
자세한 내용은 [LICENSE](./LICENSE) 를 확인하세요.
