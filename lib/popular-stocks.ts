/**
 * lib/popular-stocks.ts — 새로고침 시 토스 API로 일괄 fetch할 인기 종목 200개
 *
 * 토스 Open API는 "전체 종목" endpoint가 없으므로, 사용자가 "새로고침" 버튼을
 * 누르면 이 리스트를 한 번에 batch fetch (/api/v1/stocks?symbols=...) 해서
 * stocks-cache.json에 추가한다.
 *
 * KRX 2,872 종목 시드(lib/stocks-seed.json)에 이미 다 들어있어서 "정확도"는
 * 보장되지만, 캐시된 englishName/currency 같은 추가 메타는 토스 API 응답이
 * 더 정확하다. 새로 상장된 종목이 시드에 없으면 사용자가 직접 분석해서
 * 캐시에 추가하는 흐름.
 *
 * 목록 선정 기준 (2026-07-10):
 *   KR: KOSPI 시총 상위 + 외국인 거래 상위 + 테마주 (2차전지/AI/바이오)
 *   US: S&P 500 대형주 + NASDAQ 인기
 */

import type { Market } from "@/lib/stocks";

export type PopularStock = {
  symbol: string;
  name: string;
  market: Market;
};

// KOSPI + KOSDAQ 인기 100개 (시총 상위 + 테마주)
const POPULAR_KR: PopularStock[] = [
  // 시총 상위
  { symbol: "005930", name: "삼성전자", market: "KR" },
  { symbol: "000660", name: "SK하이닉스", market: "KR" },
  { symbol: "035420", name: "NAVER", market: "KR" },
  { symbol: "005490", name: "POSCO홀딩스", market: "KR" },
  { symbol: "051910", name: "LG화학", market: "KR" },
  { symbol: "006400", name: "삼성SDI", market: "KR" },
  { symbol: "028260", name: "삼성물산", market: "KR" },
  { symbol: "012330", name: "현대모비스", market: "KR" },
  { symbol: "005380", name: "현대차", market: "KR" },
  { symbol: "066570", name: "LG전자", market: "KR" },
  { symbol: "003550", name: "LG", market: "KR" },
  { symbol: "034730", name: "SK", market: "KR" },
  { symbol: "015760", name: "한국전력", market: "KR" },
  { symbol: "017670", name: "SK텔레콤", market: "KR" },
  { symbol: "030200", name: "KT", market: "KR" },
  { symbol: "032830", name: "삼성생명", market: "KR" },
  { symbol: "086790", name: "하나금융지주", market: "KR" },
  { symbol: "105560", name: "KB금융", market: "KR" },
  { symbol: "055550", name: "신한지주", market: "KR" },
  { symbol: "316140", name: "우리금융지주", market: "KR" },
  { symbol: "024110", name: "기업은행", market: "KR" },
  { symbol: "000810", name: "삼성화재", market: "KR" },
  { symbol: "002790", name: "아모레퍼시픽", market: "KR" },
  { symbol: "090430", name: "아모레G", market: "KR" },
  { symbol: "051900", name: "LG생활건강", market: "KR" },
  { symbol: "033780", name: "KT&G", market: "KR" },
  { symbol: "010130", name: "고려아연", market: "KR" },
  { symbol: "011170", name: "롯데케미칼", market: "KR" },
  { symbol: "009150", name: "삼성전기", market: "KR" },
  { symbol: "035720", name: "카카오", market: "KR" },
  { symbol: "000270", name: "기아", market: "KR" },
  { symbol: "207940", name: "삼성바이오로직스", market: "KR" },
  { symbol: "068270", name: "셀트리온", market: "KR" },
  { symbol: "096770", name: "SK이노베이션", market: "KR" },
  { symbol: "010950", name: "S-Oil", market: "KR" },
  { symbol: "034020", name: "두산에너빌리티", market: "KR" },
  { symbol: "402340", name: "SK스퀘어", market: "KR" },
  { symbol: "003490", name: "대한항공", market: "KR" },
  { symbol: "011200", name: "HMM", market: "KR" },
  { symbol: "005935", name: "삼성전자우", market: "KR" },
  { symbol: "000100", name: "유한양행", market: "KR" },
  { symbol: "128940", name: "한미약품", market: "KR" },
  { symbol: "326030", name: "SK바이오팜", market: "KR" },
  { symbol: "091990", name: "셀트리온헬스케어", market: "KR" },
  { symbol: "196170", name: "알테오젠", market: "KR" },
  { symbol: "145020", name: "휴젤", market: "KR" },
  { symbol: "058470", name: "리노공업", market: "KR" },
  // 2차전지
  { symbol: "373220", name: "LG에너지솔루션", market: "KR" },
  { symbol: "247540", name: "에코프로비엠", market: "KR" },
  { symbol: "086520", name: "에코프로", market: "KR" },
  { symbol: "003670", name: "포스코퓨처엠", market: "KR" },
  { symbol: "006260", name: "LS", market: "KR" },
  { symbol: "005387", name: "현대차2우B", market: "KR" },
  { symbol: "005385", name: "현대차우", market: "KR" },
  // 바이오/헬스
  { symbol: "207940", name: "삼성바이오로직스", market: "KR" },
  { symbol: "068270", name: "셀트리온", market: "KR" },
  { symbol: "302440", name: "삼성바이오에피스", market: "KR" },
  { symbol: "000720", name: "현대건설", market: "KR" },
  { symbol: "012450", name: "한화에어로스페이스", market: "KR" },
  { symbol: "079550", name: "LIG넥스원", market: "KR" },
  { symbol: "042700", name: "한미반도체", market: "KR" },
  { symbol: "058610", name: "에스피지", market: "KR" },
  // 엔터/미디어
  { symbol: "035900", name: "JYP Ent.", market: "KR" },
  { symbol: "352820", name: "하이브", market: "KR" },
  { symbol: "041510", name: "SM", market: "KR" },
  { symbol: "035760", name: "CJ ENM", market: "KR" },
  { symbol: "139480", name: "아이엔24", market: "KR" },
  // 게임
  { symbol: "036570", name: "엔씨소프트", market: "KR" },
  { symbol: "251270", name: "넷마블", market: "KR" },
  { symbol: "259960", name: "크래프톤", market: "KR" },
  { symbol: "293490", name: "카카오게임즈", market: "KR" },
  { symbol: "112040", name: "위메이드", market: "KR" },
  { symbol: "263750", name: "펄어비스", market: "KR" },
  // 통신/IT
  { symbol: "017800", name: "현대엘리베이터", market: "KR" },
  { symbol: "034220", name: "LG디스플레이", market: "KR" },
  { symbol: "011070", name: "LG이노텍", market: "KR" },
  { symbol: "000990", name: "DB하이텍", market: "KR" },
  { symbol: "036490", name: "SK머티리얼즈", market: "KR" },
  // 금융
  { symbol: "071050", name: "한국금융지주", market: "KR" },
  { symbol: "175330", name: "JB금융지주", market: "KR" },
  { symbol: "006800", name: "미래에셋증권", market: "KR" },
  { symbol: "039490", name: "키움증권", market: "KR" },
  // 건설/조선
  { symbol: "009540", name: "한국조선해양", market: "KR" },
  { symbol: "010140", name: "삼성중공업", market: "KR" },
  { symbol: "329180", name: "HD현대중공업", market: "KR" },
  { symbol: "267270", name: "HD현대", market: "KR" },
  { symbol: "042660", name: "한화오션", market: "KR" },
  { symbol: "010620", name: "HD현대미포", market: "KR" },
  // 유통/소비
  { symbol: "139130", name: "DGB대구은행", market: "KR" },
  { symbol: "023530", name: "롯데쇼핑", market: "KR" },
  { symbol: "097950", name: "CJ제일제당", market: "KR" },
  { symbol: "002380", name: "KCC", market: "KR" },
  { symbol: "271560", name: "오뚜기", market: "KR" },
  { symbol: "004370", name: "농심", market: "KR" },
  { symbol: "005300", name: "롯데칠성", market: "KR" },
];

// US 인기 100개
const POPULAR_US: PopularStock[] = [
  // Big Tech
  { symbol: "AAPL", name: "Apple", market: "US" },
  { symbol: "MSFT", name: "Microsoft", market: "US" },
  { symbol: "NVDA", name: "NVIDIA", market: "US" },
  { symbol: "GOOGL", name: "Alphabet Class A", market: "US" },
  { symbol: "GOOG", name: "Alphabet Class C", market: "US" },
  { symbol: "AMZN", name: "Amazon", market: "US" },
  { symbol: "META", name: "Meta Platforms", market: "US" },
  { symbol: "TSLA", name: "Tesla", market: "US" },
  { symbol: "ORCL", name: "Oracle", market: "US" },
  { symbol: "CRM", name: "Salesforce", market: "US" },
  { symbol: "ADBE", name: "Adobe", market: "US" },
  { symbol: "AVGO", name: "Broadcom", market: "US" },
  { symbol: "INTC", name: "Intel", market: "US" },
  { symbol: "AMD", name: "Advanced Micro Devices", market: "US" },
  { symbol: "QCOM", name: "Qualcomm", market: "US" },
  { symbol: "TXN", name: "Texas Instruments", market: "US" },
  { symbol: "MU", name: "Micron Technology", market: "US" },
  { symbol: "NOW", name: "ServiceNow", market: "US" },
  { symbol: "INTU", name: "Intuit", market: "US" },
  { symbol: "IBM", name: "IBM", market: "US" },
  { symbol: "CSCO", name: "Cisco", market: "US" },
  { symbol: "ACN", name: "Accenture", market: "US" },
  { symbol: "ORAN", name: "Orange", market: "US" },
  // Finance
  { symbol: "JPM", name: "JPMorgan Chase", market: "US" },
  { symbol: "V", name: "Visa", market: "US" },
  { symbol: "MA", name: "Mastercard", market: "US" },
  { symbol: "BAC", name: "Bank of America", market: "US" },
  { symbol: "WFC", name: "Wells Fargo", market: "US" },
  { symbol: "MS", name: "Morgan Stanley", market: "US" },
  { symbol: "GS", name: "Goldman Sachs", market: "US" },
  { symbol: "AXP", name: "American Express", market: "US" },
  { symbol: "BLK", name: "BlackRock", market: "US" },
  { symbol: "C", name: "Citigroup", market: "US" },
  { symbol: "BRK.B", name: "Berkshire Hathaway", market: "US" },
  { symbol: "SCHW", name: "Charles Schwab", market: "US" },
  // Healthcare
  { symbol: "JNJ", name: "Johnson & Johnson", market: "US" },
  { symbol: "UNH", name: "UnitedHealth", market: "US" },
  { symbol: "LLY", name: "Eli Lilly", market: "US" },
  { symbol: "PFE", name: "Pfizer", market: "US" },
  { symbol: "ABBV", name: "AbbVie", market: "US" },
  { symbol: "MRK", name: "Merck", market: "US" },
  { symbol: "TMO", name: "Thermo Fisher Scientific", market: "US" },
  { symbol: "ABT", name: "Abbott Laboratories", market: "US" },
  { symbol: "DHR", name: "Danaher", market: "US" },
  { symbol: "BMY", name: "Bristol-Myers Squibb", market: "US" },
  { symbol: "AMGN", name: "Amgen", market: "US" },
  { symbol: "GILD", name: "Gilead Sciences", market: "US" },
  { symbol: "CVS", name: "CVS Health", market: "US" },
  { symbol: "CI", name: "Cigna", market: "US" },
  { symbol: "ELV", name: "Elevance Health", market: "US" },
  // Consumer
  { symbol: "WMT", name: "Walmart", market: "US" },
  { symbol: "COST", name: "Costco", market: "US" },
  { symbol: "PG", name: "Procter & Gamble", market: "US" },
  { symbol: "KO", name: "Coca-Cola", market: "US" },
  { symbol: "PEP", name: "PepsiCo", market: "US" },
  { symbol: "MCD", name: "McDonald's", market: "US" },
  { symbol: "NKE", name: "Nike", market: "US" },
  { symbol: "SBUX", name: "Starbucks", market: "US" },
  { symbol: "HD", name: "Home Depot", market: "US" },
  { symbol: "LOW", name: "Lowe's", market: "US" },
  { symbol: "TGT", name: "Target", market: "US" },
  { symbol: "DIS", name: "Walt Disney", market: "US" },
  { symbol: "NFLX", name: "Netflix", market: "US" },
  { symbol: "CMG", name: "Chipotle Mexican Grill", market: "US" },
  { symbol: "YUM", name: "Yum! Brands", market: "US" },
  // Energy
  { symbol: "XOM", name: "ExxonMobil", market: "US" },
  { symbol: "CVX", name: "Chevron", market: "US" },
  { symbol: "COP", name: "ConocoPhillips", market: "US" },
  { symbol: "SLB", name: "Schlumberger", market: "US" },
  { symbol: "EOG", name: "EOG Resources", market: "US" },
  // Industrial
  { symbol: "BA", name: "Boeing", market: "US" },
  { symbol: "CAT", name: "Caterpillar", market: "US" },
  { symbol: "GE", name: "GE Aerospace", market: "US" },
  { symbol: "HON", name: "Honeywell", market: "US" },
  { symbol: "UPS", name: "United Parcel Service", market: "US" },
  { symbol: "RTX", name: "RTX Corp", market: "US" },
  { symbol: "LMT", name: "Lockheed Martin", market: "US" },
  { symbol: "DE", name: "Deere", market: "US" },
  { symbol: "MMM", name: "3M", market: "US" },
  // Auto
  { symbol: "F", name: "Ford", market: "US" },
  { symbol: "GM", name: "General Motors", market: "US" },
  { symbol: "RIVN", name: "Rivian", market: "US" },
  { symbol: "STLA", name: "Stellantis", market: "US" },
  { symbol: "TM", name: "Toyota", market: "US" },
  // Telecom / Media
  { symbol: "T", name: "AT&T", market: "US" },
  { symbol: "VZ", name: "Verizon", market: "US" },
  { symbol: "TMUS", name: "T-Mobile", market: "US" },
  { symbol: "CMCSA", name: "Comcast", market: "US" },
  // Real Estate / Finance
  { symbol: "O", name: "Realty Income", market: "US" },
  { symbol: "SPG", name: "Simon Property Group", market: "US" },
  // Tech 추가
  { symbol: "PYPL", name: "PayPal", market: "US" },
  { symbol: "SHOP", name: "Shopify", market: "US" },
  { symbol: "SQ", name: "Block", market: "US" },
  { symbol: "UBER", name: "Uber", market: "US" },
  { symbol: "ABNB", name: "Airbnb", market: "US" },
  { symbol: "LYFT", name: "Lyft", market: "US" },
  { symbol: "PLTR", name: "Palantir", market: "US" },
  { symbol: "COIN", name: "Coinbase", market: "US" },
  { symbol: "SNAP", name: "Snap", market: "US" },
  { symbol: "PINS", name: "Pinterest", market: "US" },
  { symbol: "ROKU", name: "Roku", market: "US" },
  // 해외 대형 (중국/유럽)
  { symbol: "BABA", name: "Alibaba", market: "US" },
  { symbol: "PDD", name: "PDD Holdings", market: "US" },
  { symbol: "NVO", name: "Novo Nordisk", market: "US" },
  { symbol: "ASML", name: "ASML Holding", market: "US" },
  { symbol: "TSM", name: "Taiwan Semiconductor", market: "US" },
  { symbol: "SAP", name: "SAP", market: "US" },
];

export const POPULAR_STOCKS: PopularStock[] = [...POPULAR_KR, ...POPULAR_US];

/** Just the symbols, deduped, for batched /api/v1/stocks fetch. */
export function getPopularSymbols(): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of POPULAR_STOCKS) {
    if (!seen.has(s.symbol)) {
      seen.add(s.symbol);
      out.push(s.symbol);
    }
  }
  return out;
}
