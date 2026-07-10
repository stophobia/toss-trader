"use client";

/**
 * components/CandleChart.tsx — 순수 SVG 캔들 차트 (v1.4)
 *
 * 의존성 0 (recharts/chart.js X). 자체 SVG.
 * - 양봉(close > open): 빨간색 (한국 색상 관습 — 토스 Open API 기준)
 * - 음봉(close < open): 파란색
 * - 도지(close == open): 회색
 * - x축: 날짜 (MM/DD)
 * - y축: 가격 (천단위 콤마)
 * - 호버: 캔들 정보 (날짜 + OHLC + 거래량)
 *
 * v0.3 단순화: LLM 호출 0. 클라이언트 사이드 안전 가드 동일 패턴.
 */

import { useState } from "react";
import type { Candle, CandleStats } from "@/lib/candles";
import { formatKRW } from "@/lib/format";

interface CandleChartProps {
  candles: ReadonlyArray<Candle>;
  stats: CandleStats | null;
  width?: number;
  height?: number;
}

const PADDING = { top: 20, right: 50, bottom: 30, left: 10 };
const CANDLE_BODY_WIDTH_RATIO = 0.6; // 캔들 몸통 너비 (간격 대비)

export function CandleChart({
  candles,
  stats,
  width = 600,
  height = 300,
}: CandleChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  if (candles.length === 0 || !stats) {
    return (
      <div
        className="flex items-center justify-center text-zinc-500 text-sm"
        style={{ width, height }}
      >
        차트 데이터 없음
      </div>
    );
  }

  const innerWidth = width - PADDING.left - PADDING.right;
  const innerHeight = height - PADDING.top - PADDING.bottom;
  const yMin = stats.min;
  const yMax = stats.max;
  const yRange = yMax - yMin || 1; // division by zero 방지
  const yScale = (v: number): number => PADDING.top + innerHeight - ((v - yMin) / yRange) * innerHeight;

  const slotWidth = innerWidth / candles.length;
  const bodyWidth = slotWidth * CANDLE_BODY_WIDTH_RATIO;

  // y축 5단계 눈금
  const yTicks: number[] = [];
  for (let i = 0; i <= 4; i++) {
    yTicks.push(yMin + (yRange * i) / 4);
  }

  return (
    <div className="relative" style={{ width, height }}>
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        className="block"
        role="img"
        aria-label="캔들 차트"
      >
        {/* Y축 눈금선 + 가격 라벨 */}
        {yTicks.map((y, i) => (
          <g key={`y-tick-${i}`}>
            <line
              x1={PADDING.left}
              x2={width - PADDING.right}
              y1={yScale(y)}
              y2={yScale(y)}
              stroke="#e5e7eb"
              strokeWidth={0.5}
              strokeDasharray="2 2"
              className="dark:stroke-zinc-700"
            />
            <text
              x={width - PADDING.right + 5}
              y={yScale(y) + 3}
              fontSize={10}
              fill="#6b7280"
              className="dark:fill-zinc-400"
            >
              {Math.round(y).toLocaleString("ko-KR")}
            </text>
          </g>
        ))}

        {/* 캔들 */}
        {candles.map((c, i) => {
          const x = PADDING.left + i * slotWidth + slotWidth / 2;
          const yOpen = yScale(c.open);
          const yClose = yScale(c.close);
          const yHigh = yScale(c.high);
          const yLow = yScale(c.low);
          const isUp = c.close > c.open;
          const isDown = c.close < c.open;
          const color = isUp ? "#ef4444" : isDown ? "#3b82f6" : "#9ca3af";
          const bodyTop = Math.min(yOpen, yClose);
          const bodyHeight = Math.max(Math.abs(yClose - yOpen), 1);

          return (
            <g
              key={`candle-${i}`}
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              style={{ cursor: "pointer" }}
            >
              {/* 심지 (high-low) */}
              <line
                x1={x}
                x2={x}
                y1={yHigh}
                y2={yLow}
                stroke={color}
                strokeWidth={1}
              />
              {/* 몸통 (open-close) */}
              <rect
                x={x - bodyWidth / 2}
                y={bodyTop}
                width={bodyWidth}
                height={bodyHeight}
                fill={isDown ? color : "transparent"}
                stroke={color}
                strokeWidth={1}
              />
              {/* 호버 강조 */}
              {hoverIndex === i && (
                <rect
                  x={PADDING.left + i * slotWidth}
                  y={PADDING.top}
                  width={slotWidth}
                  height={innerHeight}
                  fill="rgba(59, 130, 246, 0.05)"
                />
              )}
            </g>
          );
        })}

        {/* X축 날짜 라벨 (5단계) */}
        {candles.map((c, i) => {
          // 균등 분포 5단계
          const step = Math.max(1, Math.floor(candles.length / 5));
          if (i % step !== 0 && i !== candles.length - 1) return null;
          const x = PADDING.left + i * slotWidth + slotWidth / 2;
          const date = new Date(c.timestamp);
          const label = `${date.getMonth() + 1}/${date.getDate()}`;
          return (
            <text
              key={`x-label-${i}`}
              x={x}
              y={height - PADDING.bottom + 15}
              fontSize={10}
              textAnchor="middle"
              fill="#6b7280"
              className="dark:fill-zinc-400"
            >
              {label}
            </text>
          );
        })}
      </svg>

      {/* 호버 툴팁 */}
      {hoverIndex !== null && candles[hoverIndex] && (
        <div
          className="absolute top-2 left-2 bg-zinc-900/90 dark:bg-zinc-50/95 text-white dark:text-zinc-900 px-2 py-1 rounded text-xs pointer-events-none"
        >
          <div>
            {new Date(candles[hoverIndex]!.timestamp).toLocaleDateString("ko-KR")}
          </div>
          <div>O: {formatKRW(candles[hoverIndex]!.open)}</div>
          <div>H: {formatKRW(candles[hoverIndex]!.high)}</div>
          <div>L: {formatKRW(candles[hoverIndex]!.low)}</div>
          <div>C: {formatKRW(candles[hoverIndex]!.close)}</div>
          <div>V: {candles[hoverIndex]!.volume.toLocaleString("ko-KR")}</div>
        </div>
      )}
    </div>
  );
}
