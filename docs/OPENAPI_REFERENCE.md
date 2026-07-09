# 📚 토스증권 Open API 참고 자료

> 본 문서는 sigco3111/toss-trader가 사용하는 토스증권 Open API v1.1.5의 공식 레퍼런스를 정리한 문서입니다.
> 출처 = [https://openapi.tossinvest.com/openapi-docs/overview.md](https://openapi.tossinvest.com/openapi-docs/overview.md) (2026-07-09 실측)

## 🌐 공식 URL

| 용도 | URL | 비고 |
|---|---|---|
| **키 발급 WTS** | [https://www.tossinvest.com](https://www.tossinvest.com) | 로그인 후 **설정 > Open API** 메뉴 |
| **공식 개발자 문서** | [https://developers.tossinvest.com/docs](https://developers.tossinvest.com/docs) | SPA, Next.js 기반 |
| **LLM 친화 인덱스** | [https://developers.tossinvest.com/llms.txt](https://developers.tossinvest.com/llms.txt) | 마크다운 인덱스 |
| **Source of Truth 개요** | [https://openapi.tossinvest.com/openapi-docs/overview.md](https://openapi.tossinvest.com/openapi-docs/overview.md) | 본 문서의 기준 |
| **OpenAPI JSON (canonical)** | [https://openapi.tossinvest.com/openapi-docs/latest/openapi.json](https://openapi.tossinvest.com/openapi-docs/latest/openapi.json) | 스키마 정식 |
| **OAuth 토큰 발급** | `POST https://openapi.tossinvest.com/oauth2/token` | Client Credentials |
| **API base** | `https://openapi.tossinvest.com` | 모든 `/api/v1/...` endpoint prefix |

## 🔑 키 발급 절차

1. [https://www.tossinvest.com](https://www.tossinvest.com) 로그인
2. 앱 좌하단 **설정(⚙️)** → **Open API** 메뉴 진입
3. 화면에 표시되는 `client_id` 와 `client_secret` **즉시 안전한 곳에 저장** (재확인 불가)
4. `~/.hermes/secrets/tossinvest.env` 에 저장 (chmod 600)

```bash
cat > ~/.hermes/secrets/tossinvest.env <<'EOF'
TOSSINVEST_API_KEY=***
TOSSINVEST_SECRET_KEY=***
DRY_RUN=true
EOF
chmod 600 ~/.hermes/secrets/tossinvest.env
```

> ⚠️ **사전 신청자 대상 단계적 롤아웃 중** — 메뉴가 보이지 않으면 토스 고객센터 사전 신청 필요.
> **사업자등록증 불필요** — 일반 개인 종합매매 계좌 보유자도 발급 가능.

## 🔐 인증

- **OAuth 2.0 Client Credentials Grant**
- **scope 구분 없음** (`scopes: {}`) — 키 1회 발급으로 시세·잔고·주문·체결 모두 가능
- **access token = 1 client당 1개**, refresh token 없음 (만료 시 동일 endpoint로 재발급)
- 계좌·자산·주문 endpoint = `Authorization: Bearer ***` + `X-Tossinvest-Account: {accountSeq}` 헤더 모두 필요

```bash
# 토큰 발급
curl -s -X POST 'https://openapi.tossinvest.com/oauth2/token' \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  -d 'grant_type=client_credentials' \
  -d "client_id=$TOSSINVEST_API_KEY" \
  -d "client_secret=$TOSSINVEST_SECRET_KEY"

# 시세 조회 (토큰만)
curl -s 'https://openapi.tossinvest.com/api/v1/stocks?symbols=005930' \
  -H "Authorization: Bearer $TOKEN"

# 잔고 조회 (토큰 + 계좌 헤더)
curl -s 'https://openapi.tossinvest.com/api/v1/holdings' \
  -H "Authorization: Bearer $TOKEN" \
  -H "X-Tossinvest-Account: 1"
```

## 📂 Endpoint 카테고리 (5종)

- **인증 (Auth)** — OAuth 2.0 토큰 발급
- **시세·종목 정보** — 시세, 종목 마스터, 환율, 장 운영 시간, 랭킹, 지수
- **계좌·자산** — 계좌 목록 및 보유 주식 조회
- **주문** — 주문 생성·정정·취소, 주문 조회, 거래 가능 정보
- **조건주문** — 감시 조건 등록 시 자동 매매 (단일 · OCO · OTO)

### 주요 endpoint

| 카테고리 | Method | Path | 필요 헤더 |
|---|---|---|---|
| Auth | `POST` | `/oauth2/token` | (없음) |
| Market Data | `GET` | `/api/v1/orderbook` | Bearer |
| Market Data | `GET` | `/api/v1/prices` | Bearer |
| Market Data | `GET` | `/api/v1/trades` | Bearer |
| Market Data | `GET` | `/api/v1/price-limits` | Bearer |
| Market Data | `GET` | `/api/v1/candles` | Bearer |
| Stock Info | `GET` | `/api/v1/stocks` | Bearer |
| Stock Info | `GET` | `/api/v1/stocks/{symbol}/warnings` | Bearer |
| Market Info | `GET` | `/api/v1/exchange-rate` | Bearer |
| Market Info | `GET` | `/api/v1/market-calendar/{KR,US}` | Bearer |
| Ranking | `GET` | `/api/v1/rankings` | Bearer |
| Market Indicators | `GET` | `/api/v1/market-indicators/prices` | Bearer |
| Market Indicators | `GET` | `/api/v1/market-indicators/{symbol}/candles` | Bearer |
| Market Indicators | `GET` | `/api/v1/market-indicators/{symbol}/investor-trading` | Bearer |
| Account | `GET` | `/api/v1/accounts` | Bearer |
| Asset | `GET` | `/api/v1/holdings` | Bearer + Account |
| Order | `POST` | `/api/v1/orders` | Bearer + Account |
| Order | `POST` | `/api/v1/orders/{orderId}/modify` | Bearer + Account |
| Order | `POST` | `/api/v1/orders/{orderId}/cancel` | Bearer + Account |
| Order History | `GET` | `/api/v1/orders` | Bearer + Account |
| Order History | `GET` | `/api/v1/orders/{orderId}` | Bearer + Account |
| Order Info | `GET` | `/api/v1/buying-power` | Bearer + Account |
| Order Info | `GET` | `/api/v1/sellable-quantity` | Bearer + Account |
| Order Info | `GET` | `/api/v1/commissions` | Bearer + Account |
| Conditional Order | `POST` | `/api/v1/conditional-orders` | Bearer + Account |
| Conditional Order | `POST` | `/api/v1/conditional-orders/{id}/modify` | Bearer + Account |
| Conditional Order | `DELETE` | `/api/v1/conditional-orders/{id}` | Bearer + Account |
| Conditional Order History | `GET` | `/api/v1/conditional-orders` | Bearer + Account |
| Conditional Order History | `GET` | `/api/v1/conditional-orders/{id}` | Bearer + Account |

## ⏱️ Rate Limits (클라이언트 × 그룹 단위)

| Group | 평시 | 비고 |
|---|---|---|
| `AUTH` | 5 TPS | |
| `ACCOUNT` | 1 TPS | ⬅ 가장 빡빡 |
| `ASSET` | 5 TPS | |
| `STOCK` | 5 TPS | |
| `MARKET_INFO` | 3 TPS | |
| `MARKET_DATA` | 10 TPS | |
| `MARKET_DATA_CHART` | 5 TPS | |
| `RANKING` | 5 TPS | |
| `MARKET_INDICATOR_PRICE` | 10 TPS | |
| `MARKET_INDICATOR` | 10 TPS | |
| `MARKET_INDICATOR_CHART` | 5 TPS | |
| `ORDER` | 6 TPS | **09:00~09:10 KST 3 TPS** |
| `ORDER_HISTORY` | 5 TPS | |
| `ORDER_INFO` | 6 TPS | **09:00~09:10 KST 3 TPS** |
| `CONDITIONAL_ORDER` | 5 TPS | |
| `CONDITIONAL_ORDER_HISTORY` | 10 TPS | |

### 응답 헤더

- `X-RateLimit-Limit` — 현재 허용 TPS
- `X-RateLimit-Remaining` — 버킷 잔여 토큰
- `X-RateLimit-Reset` — 1 토큰 재충전 예상 초
- `Retry-After` — 429 응답 시 권장 대기 초

### 429 대응

1. `Retry-After` 헤더만큼 대기 후 재시도
2. 지수 백오프 (1s → 2s → 4s ...) + jitter
3. `X-RateLimit-Remaining` 낮을 때 선제적 속도 완화

## 🛡️ 안전 가드 — toss-trader의 `safety.py` 가 반영해야 할 422 코드

> 422 `Unprocessable Entity` = 요청 형식은 OK이나 비즈니스 룰 위반. toss-trader의 safety layer는 다음 코드를 자동 인식 + 사용자 친화 메시지 변환 필수.

| 코드 | 의미 | toss-trader 가드 |
|---|---|---|
| `account-restricted` | RIA/연금/종합매매 계좌 — 주문 차단 (조회는 OK) | `safety.py`가 호출 전 계좌 종류 추정 어려움 → 422 수신 시 `paper` 모드 fallback 권장 |
| `prerequisite-required` | 약관 동의 / 위험 고지 미완료 | 첫 주문 시도 시 사용자 안내 메시지 + 토스 고객센터 링크 |
| `confirm-high-value-required` | 1억+ 주문은 `confirmHighValueOrder: true` 필수 | 자동 설정 + Telegram inline 2차 confirm 권장 |
| `insufficient-buying-power` | 매수 가능 금액 부족 | 사용자 입력으로 사전 검증 |
| `order-hours-closed` | 장 마감 | 사전 시장 캘린더 체크 |
| `stock-restricted` | 거래 제한 종목 | `quote warnings` 사전 조회로 회피 |
| `price-out-of-range` | 상/하한가 초과 | `price-limits` 사전 조회 |
| `insufficient-sellable-quantity` | 매도 가능 수량 부족 | `sellable-quantity` 사전 조회 |
| `order-limit-exceeded` | 주문 설정 한도 초과 | 사용자 입력 검증 |
| `idempotency-key-conflict` | 동일 `clientOrderId` 다른 내용 재요청 | `clientOrderId` 자동 생성 + 멱등성 보장 |

### 그 외 주요 에러 코드

- 400 `invalid-request` — 필수 파라미터 누락, 호가 유형/주문 방향/수량/금액 오류
- 400 `account-header-required` — `X-Tossinvest-Account` 헤더 누락
- 401 `invalid-token` / `expired-token` / `login-user-not-found` — 토큰 재발급
- 403 `forbidden` — 권한 부족
- 404 `stock-not-found` / `order-not-found` / `account-not-found` — 존재하지 않는 리소스
- 409 `request-in-progress` / `already-filled` / `already-canceled` — 주문 상태 충돌
- 415 `unsupported-content-type` — 요청은 `application/json`
- 429 `edge-rate-limit-exceeded` / `rate-limit-exceeded` — 위 Rate Limits 표 참조
- 500 `internal-error` / `maintenance` — 서버 장애

## 🔍 error envelope

```json
{
  "error": {
    "requestId": "01HXYZABCDEFG123456789",
    "code": "invalid-request",
    "message": "주문 방향이 올바르지 않습니다.",
    "data": {
      "field": "side",
      "allowedValues": ["BUY", "SELL"]
    }
  }
}
```

- `requestId` = `X-Request-Id` 헤더와 동일 (CS 문의 시 첨부)
- 누락 시 응답 헤더 `x-amz-cf-id` 첨부
- `data` = 에러 해결 힌트, 코드별 구조 다름

## 🤝 toss-trader에서의 활용

| 본 문서 섹션 | toss-trader 모듈 |
|---|---|
| 인증 | `broker/toss.py` `issueAccessToken()` |
| Endpoint 카테고리 | `broker/toss.py` (시세/잔고/주문 메서드) |
| Rate Limits | `agent/opencode.py` (429 자동 backoff) |
| 안전 가드 422 | `safety.py` (코드별 가드 + 사용자 안내) |
| error envelope | `broker/toss.py` `_parse_error()` |

## 📝 출처 / 인용

- 2026-07-09 실측 fetch 결과 (curl + base64-decode된 GitHub `kstost/stock/tossinvest_apidocs.json` v1.1.5)
- [https://openapi.tossinvest.com/openapi-docs/overview.md](https://openapi.tossinvest.com/openapi-docs/overview.md) — source of truth
- [https://developers.tossinvest.com/llms.txt](https://developers.tossinvest.com/llms.txt) — LLM 친화 인덱스
- [https://github.com/JungHoonGhae/tossinvest-cli](https://github.com/JungHoonGhae/tossinvest-cli) — 440⭐ Go 기반 토스 CLI (참고: "사전 신청자 대상 단계적 롤아웃")
- [https://github.com/BEOKS/tossinvest-skill](https://github.com/BEOKS/tossinvest-skill) — 40⭐ dry-run 거래 CLI (안전 패턴 차용)
- [https://github.com/kstost/stock](https://github.com/kstost/stock) — 원본 Next.js 구현 + `tossinvest_apidocs.json`
