import { formatCompactCurrency } from "@/lib/format";
import type { CashFlowPoint } from "@/lib/types";

const INCOME_COLOR = "#22c55e";
const SPENDING_COLOR = "#f59e0b";

interface CashFlowChartProps {
  data: CashFlowPoint[];
  currency: string;
}

export default function CashFlowChart({ data, currency }: CashFlowChartProps) {
  const width = 640;
  const height = 240;
  const pad = { top: 16, right: 12, bottom: 28, left: 52 };
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;

  const maxValue = Math.max(1, ...data.flatMap((d) => [d.income, d.spending]));
  const x = (i: number) =>
    pad.left + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const y = (v: number) => pad.top + innerH - (v / maxValue) * innerH;

  const linePath = (key: "income" | "spending") =>
    data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d[key])}`).join(" ");
  const areaPath = (key: "income" | "spending") =>
    `${linePath(key)} L ${x(data.length - 1)} ${pad.top + innerH} L ${x(0)} ${pad.top + innerH} Z`;

  const tickCount = 4;
  const gridLines = Array.from({ length: tickCount + 1 }, (_, i) => (maxValue / tickCount) * i);

  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: INCOME_COLOR }} />
          Income
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: SPENDING_COLOR }} />
          Spending
        </span>
      </div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        role="img"
        aria-label="Cash flow chart"
      >
        {gridLines.map((value, i) => (
          <g key={i}>
            <line
              x1={pad.left}
              x2={width - pad.right}
              y1={y(value)}
              y2={y(value)}
              stroke="currentColor"
              strokeOpacity="0.1"
              strokeDasharray="3 3"
            />
            <text
              x={pad.left - 8}
              y={y(value) + 3}
              textAnchor="end"
              fontSize="11"
              className="fill-muted-foreground"
            >
              {formatCompactCurrency(value, currency)}
            </text>
          </g>
        ))}

        <path d={areaPath("income")} fill={INCOME_COLOR} fillOpacity="0.12" />
        <path
          d={linePath("income")}
          fill="none"
          stroke={INCOME_COLOR}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path d={areaPath("spending")} fill={SPENDING_COLOR} fillOpacity="0.12" />
        <path
          d={linePath("spending")}
          fill="none"
          stroke={SPENDING_COLOR}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {data.map((d, i) => (
          <text
            key={i}
            x={x(i)}
            y={height - 8}
            textAnchor="middle"
            fontSize="11"
            className="fill-muted-foreground"
          >
            {d.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
