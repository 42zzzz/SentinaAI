import React, { useMemo } from "react";

function fmtSmall(n) {
  const x = Number(n);
  if (!Number.isFinite(x)) return "—";
  if (Math.abs(x) >= 1000) return x.toFixed(0);
  if (Math.abs(x) >= 100) return x.toFixed(1);
  return x.toFixed(2);
}

function fmtTime(ts) {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function Sparkline({ points = [], height = 110 }) {
  // ✅ Bigger chart width/height
  const w = 320;
  const h = height;

  // room for labels/axes (scaled up slightly)
  const padLeft = 34;
  const padRight = 10;
  const padTop = 10;
  const padBottom = 22;

  if (!points.length) {
    return <div style={{ width: w, height: h, opacity: 0.4, fontSize: 12 }}>—</div>;
  }

  const ys = points.map((p) => Number(p.value || 0));
  const yMin = Math.min(...ys);
  const yMax = Math.max(...ys);

  const xMin = 0;
  const xMax = Math.max(1, points.length - 1);

  const xScale = (x) => padLeft + ((x - xMin) / (xMax - xMin)) * (w - padLeft - padRight);
  const yScale = (y) => {
    if (yMax === yMin) return (padTop + (h - padBottom)) / 2;
    return (h - padBottom) - ((y - yMin) / (yMax - yMin)) * (h - padTop - padBottom);
  };

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(i).toFixed(2)} ${yScale(p.value).toFixed(2)}`)
    .join(" ");

  const firstTs = points[0]?.ts;
  const lastTs = points[points.length - 1]?.ts;

  const gridYs = useMemo(() => {
    const mid = (yMin + yMax) / 2;
    return [yMax, mid, yMin];
  }, [yMin, yMax]);

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ display: "block" }}>
      {/* Y grid + labels */}
      {gridYs.map((v, idx) => {
        const y = yScale(v);
        return (
          <g key={idx}>
            <line x1={padLeft} x2={w - padRight} y1={y} y2={y} stroke="#e5e7eb" strokeWidth="1" />
            <text x={padLeft - 8} y={y + 4} fontSize="10" textAnchor="end" fill="#6b7280">
              {idx === 0 ? fmtSmall(yMax) : idx === 2 ? fmtSmall(yMin) : ""}
            </text>
          </g>
        );
      })}

      {/* Axes */}
      <line x1={padLeft} x2={padLeft} y1={padTop} y2={h - padBottom} stroke="#9ca3af" strokeWidth="1" />
      <line x1={padLeft} x2={w - padRight} y1={h - padBottom} y2={h - padBottom} stroke="#9ca3af" strokeWidth="1" />

      {/* Line */}
      <path d={d} fill="none" stroke="#111827" strokeWidth="2.5" />

      {/* X labels: start/end time */}
      <text x={padLeft} y={h - 6} fontSize="10" textAnchor="start" fill="#6b7280">
        {fmtTime(firstTs)}
      </text>
      <text x={w - padRight} y={h - 6} fontSize="10" textAnchor="end" fill="#6b7280">
        {fmtTime(lastTs)}
      </text>
    </svg>
  );
}