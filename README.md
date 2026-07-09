# 🤖 toss-trader

> 토스증권 Open API + oh-my-opencode 기반 투자 어시스턴트
> **paper trading 우선, 실계좌 주문은 명시적 사용자 확인 후에만 실행**

[kstost/stock](https://github.com/kstost/stock)에서 영감을 받아 **우리 스택으로 재설계**한 버전입니다.

## 🎬 라이브 데모

CLI 기반 (Telegram inline button 알림). 별도 데모 URL 없음.

```
$ python3 -m tosstrader analyze 005930
# → 분석 결과 + Telegram inline [BUY] [SELL] [HOLD] 버튼
```

## 🤖 생성 정보

- **기반**: [kstost/stock](https://github.com/kstost/stock) (MIT, kstost) — Next.js + Codex CLI + 토스 Open API
- **재설계 사유**: Codex `--yolo` + 서버 메모리 평문 보관 → oh-my-opencode + `~/.hermes/secrets/` 패턴으로 이관
- **분석 엔진**: `oh-my-opencode` (OpenCode 플러그인). bunx 호출, 도구 화이트리스트
- **대상**: sigco3111의 `~/.hermes/secrets/tossinvest.env` 보유 사용자

## ✨ 주요 특징

- 🔒 **시크릿 격리** — 토스 API Key/Secret은 `~/.hermes/secrets/tossinvest.env` (chmod 600) 외 노출 0
- 📝 **Paper trading 기본값** — 실계좌 주문은 `DRY_RUN=false` 명시 후에만 활성
- 🤖 **oh-my-opencode 분석** — OpenCode 플러그인, 도구 호출 화이트리스트, yolo 미사용
- 💬 **Telegram confirm** — BUY/SELL은 Telegram inline button 사용자 명시 확인 후
- 🗂️ **Notion 이력** — 모든 분석/주문은 Notion DB + 로컬 JSON 이중 기록
- 🛡️ **안전 규칙** — 주문 endpoint 호출은 prompt 단계에서 차단, 사용자 행동지침이 비어있으면 HOLD 우선

## 🚀 실행 방법

```bash
# 1) 의존성
pip install -e .

# 2) 시크릿 로드 (chmod 600 필수)
export TOSSINVEST_API_KEY=***  # 토스 Open API 콘솔에서 발급
export TOSSINVEST_SECRET_KEY=***

# 3) 분석 (paper)
python3 -m tosstrader analyze 005930

# 4) 실계좌 (명시적 opt-in, 기본값 차단)
DRY_RUN=false python3 -m tosstrader order buy 005930 --qty 2 --price 81000
```

## 🎮 조작법

| 명령 | 동작 |
|---|---|
| `python3 -m tosstrader analyze <종목코드>` | 1회 분석 + Telegram 알림 |
| `python3 -m tosstrader watch <종목코드>` | 30초 간격 연속 분석 |
| `python3 -m tosstrader order buy <코드> --qty N --price P` | 지정가 매수 (paper 기본) |
| `python3 -m tosstrader order sell <코드> --qty N --price P` | 지정가 매도 (paper 기본) |
| `python3 -m tosstrader history` | Notion 이력 조회 |

## 🛠️ 기술 스택

- **언어**: Python 3.11+ (PEP 604 union, 3.8 미지원)
- **분석 엔진**: `oh-my-opencode` (`bunx oh-my-opencode` v4.16.0+, OpenCode 플러그인)
- **HTTP**: `httpx` (async) + `tornado` 없음
- **시크릿**: 환경변수 + `~/.hermes/secrets/tossinvest.env`
- **이력**: Notion DB (`toss-trader` database) + 로컬 `history/*.json`
- **알림**: Telegram Bot API (inline keyboard)
- **테스트**: `pytest` + `vcrpy` (HTTP 녹화)

## 📂 프로젝트 구조

```
toss-trader/
├── README.md
├── LICENSE                       # MIT, 원본 kstost/stock 명기
├── AGENTS.md                     # 다른 PC 에이전트용 작업 가이드
├── .gitignore                    # 시크릿 + history + Python 표준
├── pyproject.toml
├── src/tosstrader/
│   ├── __init__.py
│   ├── cli.py                    # argparse 엔트리
│   ├── broker/
│   │   ├── __init__.py
│   │   ├── toss.py               # 토스 Open API 클라이언트
│   │   └── paper.py              # paper trading 시뮬
│   ├── agent/
│   │   ├── __init__.py
│   │   ├── opencode.py           # oh-my-opencode 호출 래퍼 (bunx)
│   │   ├── schema.py             # 출력 Zod 스키마
│   │   └── prompt.py             # 안전 규칙 포함 시스템 프롬프트
│   ├── notify/
│   │   ├── __init__.py
│   │   └── telegram.py           # inline button 알림
│   ├── history/
│   │   ├── __init__.py
│   │   ├── notion.py             # Notion DB 기록
│   │   └── local.py              # JSON 백업
│   └── safety.py                 # dry-run 가드 + 화이트리스트
├── schemas/
│   └── recommendation.schema.json
├── history/                      # gitignore 대상
├── tests/
│   ├── test_safety.py
│   ├── test_broker_paper.py
│   └── cassettes/                # vcrpy 녹화
└── docs/
    ├── ARCHITECTURE.md
    ├── SAFETY.md
    └── NOTION_SETUP.md
```

## 🎨 디자인 결정

### 원본 (kstost/stock) 대비 변경점

| 차원 | 원본 | 우리 |
|---|---|---|
| 분석 엔진 | `codex exec --yolo --ephemeral` | `oh-my-opencode` 화이트리스트 |
| 시크릿 보관 | Next.js 서버 메모리 | `~/.hermes/secrets/` chmod 600 |
| 주문 실행 | 화면 버튼 즉시 | Telegram inline button + 사용자 확인 |
| 데이터 | 로컬 JSON only | Notion DB + 로컬 JSON 이중 |
| 주문 안전장치 | prompt 차원 | `safety.py` dry-run 가드 + 환경변수 opt-in |
| Paper trading | ❌ 없음 | ✅ 기본값 |

### paper trading 우선 철학

실계좌 주문은 **비가역 (irreversible)** 입니다. 한 번 체결된 주문은 시장가로만 청산 가능하며, 잘못된 행동지침 한 줄이 수백만 원 손실로 이어질 수 있습니다. 따라서:

- 모든 분석은 **paper** 모드에서 검증
- 실계좌 모드 진입은 환경변수 `DRY_RUN=false` 명시
- Telegram inline button이 사용자 마지막 확인 (Telegram 평문 노출 절대 금지)

## 🧠 동작 원리

```
사용자 명령 (CLI)
    ↓
[1] safety.py: DRY_RUN 체크 + 화이트리스트
    ↓
[2] broker/toss.py: 시세/잔고/계좌 조회 (GET only, 주문 endpoint 차단)
    ↓
[3] agent/opencode.py: oh-my-opencode 호출
    ├─ system prompt: 안전 규칙 (주문 endpoint 호출 금지, HOLD 우선, ...)
    ├─ tool whitelist: 조회 API만 허용
    └─ output schema: Zod 검증
    ↓
[4] decision: BUY/SELL/HOLD + confidence + 권장 주문
    ↓
[5] notify/telegram.py: inline button [BUY] [SELL] [HOLD]
    ↓
[6] 사용자 confirm → paper.paper 또는 toss.toss 호출
    ↓
[7] history: Notion DB + 로컬 JSON 기록
```

## 🔬 검증

- [ ] `pytest -q` 0 실패
- [ ] `safety.py` dry-run 가드 — `DRY_RUN=true`에서 주문 endpoint 호출 0회
- [ ] `toss.py` 주문 endpoint 격리 — `safety.OrderEndpointForbidden` 단위 테스트
- [ ] Zod schema 검증 — 잘못된 응답 즉시 reject
- [ ] 시크릿 격리 — `~/.hermes/secrets/` 외 평문 노출 0
- [ ] Telegram inline button — 사용자 confirm 없이 실행 0회

## 📝 프롬프트 이력

- **v0.0 (2026-07-09)**: kstost/stock 영감 + 우리 스택으로 재설계. 1차 = 4파일 스캐폴드 (README, .gitignore, LICENSE, AGENTS.md)
- 구현은 다음 세션부터 단계적으로

## 🤝 원본 크레딧

- 원본: [kstost/stock](https://github.com/kstost/stock) (MIT License, 2026)
- 재설계 사유 + diff는 위 "디자인 결정" 섹션 참조

## 📜 License

MIT — 원본 kstost/stock과 동일
