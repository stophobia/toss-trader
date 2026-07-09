# AGENTS.md — 다른 PC 에이전트용 작업 가이드

## 프로젝트 한 줄 요약

토스증권 Open API + **다중 LLM (NIM/미니맥스/OpenAI)** 기반 투자 어시스턴트.
**Next.js + Vercel + BYOK localStorage + paper trading 기본값**. 원본 [kstost/stock](https://github.com/kstost/stock) 패턴을 우리 스택으로 재설계.

자세한 아키텍처 = [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## 디렉토리 구조 (v0.2)

```
toss-trader/
├── app/                         # Next.js 15 App Router
│   ├── page.tsx
│   ├── settings/page.tsx        # BYOK 폼
│   └── api/
│       ├── llm/route.ts         # LLM provider 라우터
│       ├── llm/nim/route.ts     # NIM (미니맥스/GLM-5/...)
│       ├── llm/openai/route.ts
│       ├── toss/route.ts        # 토스 Open API relay
│       ├── notion/route.ts
│       └── telegram/route.ts
├── components/                  # React UI
│   ├── ChatPanel.tsx
│   ├── Portfolio.tsx
│   ├── OrderButton.tsx
│   └── SettingsForm.tsx         # BYOK localStorage
├── lib/                         # 서버 측 비즈니스 로직
│   ├── llm/
│   │   ├── router.ts            # provider 분기
│   │   ├── nim.ts
│   │   ├── openai.ts
│   │   └── anthropic.ts         # (선택)
│   ├── toss.ts
│   ├── notion.ts
│   ├── telegram.ts
│   └── safety.ts                # 5대 가드
├── schemas/                     # JSON Schema
├── docs/
│   ├── ARCHITECTURE.md          # v0.2 정식
│   ├── OPENAPI_REFERENCE.md     # v0.1 정식
│   ├── SAFETY.md                # (예정)
│   └── NOTION_SETUP.md          # (예정)
├── AGENTS.md                    # 이 파일
├── README.md
├── LICENSE
└── .gitignore
```

## 절대 어기지 말 것

> ⚠️ v0.2에서 Red Lines #5 (서버 0 / Vercel 이관 금지) **해제됨** — 사용자 승인 받음. 단, **시크릿 격리 정책은 강화됨**.

1. **시크릿 평문 노출 금지** — 토스/NIM/OpenAI 토큰을 Vercel env에 박지 마. **유일한 정착처 = 브라우저 localStorage (BYOK)**
2. **메신저 평문 전송 절대 금지** — Telegram 메시지에 토큰/API key 직접 노출 ❌. 토큰 회전 요청 시 토큰값 메시지 노출 금지, terminal 명령만 제시
3. **주문 endpoint 호출은 opt-in** — 기본값 = paper (`DRY_RUN=true`). `DRY_RUN=false` 명시 + Telegram 사용자 confirm 후에만 토스 Open API `POST /api/v1/orders` 등 호출
4. **사용자 행동지침 없으면 HOLD** — prompt의 안전 규칙으로 강제
5. **Vercel serverless 제약 인지** — `child_process.spawn` 등 외부 CLI 호출 ❌. HTTP 호출만 가능. LLM은 모두 Edge Function 경유 HTTP
6. **422 가드 자동 처리** — `account-restricted`, `prerequisite-required`, `confirm-high-value-required` (1억+) 자동 인식 + 사용자 안내

## 핵심 기술 결정 (v0.2)

- **프레임워크**: Next.js 15 (App Router) + TypeScript + Tailwind
- **LLM provider 라우터**: OpenAI 호환 SDK (`openai` npm)
  - NIM: `https://integrate.api.nvidia.com/v1` (미니맥스 M2.7, GLM-5, GPT-OSS 120B, DeepSeek V4 Pro, Mistral, Nemotron)
  - OpenAI: `https://api.openai.com/v1` (gpt-5.x)
  - Anthropic: `https://api.anthropic.com/v1` (선택)
- **시크릿**: `localStorage` (BYOK) — Toss API Key/Secret + NIM/OpenAI Key
- **Vercel env**: Notion API Key, Telegram Bot Token (서버 측 도구만)
- **이력**: Notion DB 1차
- **알림**: Telegram Bot API (inline button)
- **검증**: `vitest` + MSW (HTTP mock)

## 의존성 (예정)

```json
{
  "dependencies": {
    "next": "^15",
    "react": "^19",
    "react-dom": "^19",
    "openai": "^4",
    "@notionhq/client": "^2",
    "node-telegram-bot-api": "^0.66",
    "tailwindcss": "^4"
  },
  "devDependencies": {
    "@types/node": "^22",
    "@types/react": "^19",
    "typescript": "^5",
    "vitest": "^2",
    "msw": "^2"
  }
}
```

## 작업 시작 체크리스트

다른 PC에서 이 repo를 받아 작업할 때:

```bash
# 1) 클론
git clone https://github.com/sigco3111/toss-trader.git
cd toss-trader

# 2) Codex + LazyCodex 설치 (개발자 측 도구)
brew install --cask codex
npx lazycodex-ai install

# 3) Codex auth (택 1)
codex login                       # ChatGPT 플랜
export OPENAI_API_KEY=sk-...      # API key
# 또는 NIM plugin 추가 후 NVIDIA_API_KEY

# 4) Node 의존성
npm install

# 5) Vercel env (서버 측 도구만)
#    NOTION_API_KEY, TELEGRAM_BOT_TOKEN
vercel link
vercel env add NOTION_API_KEY
vercel env add TELEGRAM_BOT_TOKEN

# 6) (구현 후) 테스트
npm run test

# 7) 로컬 dev
npm run dev  # http://localhost:3000
```

## 🛠️ 개발 도구 — Codex + LazyCodex

toss-trader는 **두 가지 도구 환경**으로 개발합니다.

### 1) Codex (OpenAI 공식) — 사용자 분석 환경

```bash
brew install --cask codex        # v0.143.0
codex login                       # ChatGPT 로그인
codex exec "..."                  # 비대화형
codex review                      # PR 리뷰
codex doctor                      # 환경 진단
```

- **기본 모델**: `gpt-5.5` (OmO 기본, 400k context)
- **plugin**: `omo@sisyphuslabs` v4.16.0 (자동 설치됨)

### 2) LazyCodex (oh-my-openagent Codex 통합) — 자동화/에이전트

```bash
npx lazycodex-ai install          # OmO + Codex 통합 (전역 설치 X)
```

- **26개 스킬**: ultrawork, ulw-loop, start-work, review-work, refactor, debugging, frontend, lsp, ast-grep, comment-checker 등
- **8개 에이전트**: explorer, librarian, metis, momus, plan, lazycodex-executor, lazycodex-code-reviewer, lazycodex-qa-executor
- **MCP servers**: context7 (문서), codegraph (코드 그래프), grep_app (GitHub), lsp (언어 서버)

### 3) toss-trader에서 Codex의 역할

| 차원 | Vercel (사용자 분석) | Codex (개발자 코딩) |
|---|---|---|
| 호출 위치 | Edge Function HTTP | 개발자 PC TUI/exec |
| 모델 | NIM/MiniMax/OpenAI (BYOK) | gpt-5.5 또는 NIM plugin |
| 목적 | 매수/매도 시그널 | Next.js 컴포넌트 자동 생성 |
| 시크릿 | localStorage | `~/.codex/auth.json` / env |

### 4) NIM plugin 추가 (optional)

```bash
# NVIDIA marketplace + plugin 추가
codex plugin marketplace add sisyphuslabs
codex plugin add nvidia
# config.toml에 model_providers 등록
```

> v0.2에서는 Vercel Edge Function이 직접 NIM API 호출. Codex NIM plugin은 optional.

사용자 측:

```text
1) 토스증권 WTS 로그인 → 설정 > Open API → client_id/secret 발급
2) NIM/OpenAI/Anthropic 콘솔에서 API 키 발급
3) 브라우저로 Vercel URL 접속 → /settings → 4개 키 입력 (localStorage)
4) 메인 대시보드에서 시세 조회 / LLM 분석 / BUY-SELL 시뮬레이션
```

## LLM provider 매트릭스

| Provider | base URL | 기본 모델 | 비고 |
|---|---|---|---|
| **NIM** (NVIDIA) | `https://integrate.api.nvidia.com/v1` | `openai/gpt-oss-120b` | 무료, OpenAI 호환, 미니맥스 등 6종 카탈로그 |
| **OpenAI** | `https://api.openai.com/v1` | `gpt-5.x` | 유료, 표준 |
| **Anthropic** | `https://api.anthropic.com/v1` | `claude-sonnet-4.6` | (선택), 다른 SDK |

미니맥스 = NIM 카탈로그 `MiniMax/MiniMax-M2.7` (NVIDIA Codex 플러그인 공식 카탈로그).

## 막혔을 때

- 토스 Open API 스펙: [docs/OPENAPI_REFERENCE.md](docs/OPENAPI_REFERENCE.md) + [https://openapi.tossinvest.com/openapi-docs/overview.md](https://openapi.tossinvest.com/openapi-docs/overview.md)
- Next.js 15 App Router: [https://nextjs.org/docs/app](https://nextjs.org/docs/app)
- LLM provider 라우터 패턴: [https://developers.openai.com/codex/config-reference](https://developers.openai.com/codex/config-reference) (`model_providers.<id>` 참조)
- NIM 카탈로그: [https://build.nvidia.com](https://build.nvidia.com)
- 미니맥스 공식 Codex 카탈로그: [github.com/openai/plugins/nvidia](https://github.com/openai/plugins/tree/main/plugins/nvidia)
- 원본 Next.js 구현 참고: [kstost/stock](https://github.com/kstost/stock) (lib/tossinvest.ts + schemas/investment-agent-output.schema.json)

## 작업 위임 시 권장 (v0.2 순서)

- 1단계: Next.js 15 + TypeScript + Tailwind 보일러플레이트 셋업
- 2단계: `components/SettingsForm.tsx` BYOK 폼 + localStorage
- 3단계: `app/api/toss/route.ts` 토스 relay (시세/잔고)
- 4단계: `lib/llm/router.ts` + `nim.ts` + `openai.ts` provider 라우터
- 5단계: `components/ChatPanel.tsx` + `app/api/llm/route.ts` UI 통합
- 6단계: `lib/safety.ts` 5대 가드 + 단위 테스트
- 7단계: `app/api/telegram/route.ts` + OrderButton UI 통합
- 8단계: `app/api/notion/route.ts` 이력 기록
- 9단계: `vercel.json` + Vercel 배포 + 환경변수

각 단계마다 `npm run test` 그린 유지.

## 📚 참고 자료

- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — v0.2 정식 아키텍처 (UI/LLM/시크릿/안전가드)
- **[docs/OPENAPI_REFERENCE.md](docs/OPENAPI_REFERENCE.md)** — 토스증권 Open API v1.1.5 정식 레퍼런스 (URL, 발급 절차, 422 가드, rate limit)
- [토스증권 WTS (키 발급)](https://www.tossinvest.com) — 로그인 후 설정 > Open API 메뉴
- [공식 개발자 문서](https://developers.openai.com/codex) — OpenAI Codex 공식
- [NVIDIA Codex 플러그인](https://github.com/openai/plugins/tree/main/plugins/nvidia) — 미니맥스 M2.7 공식 카탈로그
- [kstost/stock](https://github.com/kstost/stock) — 원본 Next.js 구현 + `tossinvest_apidocs.json`

각 단계마다 `npm run test` 그린 유지.
