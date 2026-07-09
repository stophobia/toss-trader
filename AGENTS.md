# AGENTS.md — 다른 PC 에이전트용 작업 가이드

## 프로젝트 한 줄 요약

토스증권 Open API + `oh-my-opencode` 기반 투자 어시스턴트. paper trading 기본값, 실계좌는 명시적 opt-in.

## 디렉토리 구조 (1차 스캐폴드)

```
toss-trader/
├── README.md          # 한국어 메인 문서
├── LICENSE            # MIT (원본 kstost/stock 명기)
├── AGENTS.md          # 이 파일
└── .gitignore         # 시크릿 + history + Python 표준
```

`src/tosstrader/` 구현은 다음 세션부터 단계적으로 채움.

## 절대 어기지 말 것 (Red Lines)

1. **시크릿 평문 노출 금지** — 토스 API Key/Secret을 git에 커밋 ❌, Telegram 평문 전송 ❌, 로그 출력 ❌. 유일한 정착처 = `~/.hermes/secrets/tossinvest.env` (chmod 600)
2. **주문 endpoint 호출은 opt-in** — 기본값 = paper. `DRY_RUN=false` 명시 + Telegram 사용자 confirm 후에만 토스 Open API `POST /api/v1/orders` 등 호출
3. **사용자 행동지침 없으면 HOLD** — prompt의 안전 규칙으로 강제
4. **yolo 모드 금지** — 원본 `codex --yolo` 패턴은 oh-my-opencode 화이트리스트로 대체
5. **서버 만들지 마** — CLI + Telegram inline button 구조 유지. Vercel/Next.js 이관 ❌

## 핵심 기술 결정

- **언어**: Python 3.11+ (PEP 604 union 필수)
- **분석 엔진**: `oh-my-opencode` (`bunx oh-my-opencode` v4.16.0+, OpenCode 플러그인)
- **HTTP**: `httpx` async 클라이언트
- **시크릿**: 환경변수 (`TOSSINVEST_API_KEY`, `TOSSINVEST_SECRET_KEY`, `DRY_RUN`)
- **이력**: Notion DB 1차, 로컬 JSON 백업
- **알림**: Telegram Bot API inline keyboard
- **검증**: `pytest` + `vcrpy` (HTTP 녹화)

## 의존성 (예정)

```toml
[project]
dependencies = [
  "httpx>=0.27",
  "click>=8.1",          # CLI
  "pydantic>=2.5",       # Zod 대신 pydantic (Python 관용)
  "notion-client>=2.0",
  "python-telegram-bot>=21.0",
]

[project.optional-dependencies]
dev = ["pytest>=8.0", "vcrpy>=6.0", "ruff>=0.6"]
```

## 작업 시작 체크리스트

다른 PC에서 이 repo를 받아 작업할 때:

```bash
# 1) 클론
git clone https://github.com/sigco3111/toss-trader.git
cd toss-trader

# 2) 시크릿 로드 (chmod 600 확인)
ls -la ~/.hermes/secrets/tossinvest.env   # -rw------- 이어야 함
source ~/.hermes/secrets/tossinvest.env

# 3) oh-my-opencode 확인
bunx oh-my-opencode --version   # v4.16.0 이상이어야 함

# 4) (구현 후) 테스트
pip install -e ".[dev]"
pytest -q
```

## 막혔을 때

- 토스 Open API 스펙: https://openapi.tossinvest.com (사양 변경 시 doc 직접 확인)
- oh-my-opencode 사용법: `bunx oh-my-opencode --help` (서브커맨드: `run`, `doctor`, `install`, `cleanup`)
- 원본 Next.js 구현 참고: https://github.com/kstost/stock (lib/tossinvest.ts의 OAuth 흐름 + schemas/investment-agent-output.schema.json)

## 작업 위임 시 권장

- 1단계: `safety.py` dry-run 가드 + 단위 테스트 (TDD)
- 2단계: `broker/paper.py` paper trading 엔진
- 3단계: `broker/toss.py` GET-only 클라이언트
- 4단계: `agent/opencode.py` oh-my-opencode 래퍼
- 5단계: `notify/telegram.py` inline button
- 6단계: `history/notion.py` + `history/local.py`
- 7단계: `cli.py` 엔트리포인트 + 통합 테스트

각 단계마다 `pytest -q` 그린 유지.
