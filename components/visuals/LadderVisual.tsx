"use client";
// Procedurally rendered animation: ladder against a wall (Pythagoras' theorem).

const T = "all 900ms cubic-bezier(.2,.8,.2,1)";

export default function LadderVisual({ step, a = 3, b = 4 }: { step: number; a?: number; b?: number }) {
  const u = 150 / Math.max(a, b);
  const x0 = 250, y0 = 300;
  const A = { x: x0 + a * u, y: y0 }; // ladder foot
  const B = { x: x0, y: y0 - b * u }; // ladder top
  const n = { x: b * u, y: -a * u }; // outward normal for hypotenuse square
  const c = Math.sqrt(a * a + b * b);
  const challenge = step >= 5;
  const len = Math.hypot(A.x - B.x, A.y - B.y);
  const dir = { x: (B.x - A.x) / len, y: (B.y - A.y) / len };
  const perp = { x: -dir.y * 7, y: dir.x * 7 };
  const rungs = Array.from({ length: Math.floor(len / 22) }, (_, i) => (i + 1) * 22);
  const show = (k: number) => ({ opacity: step >= k ? 1 : 0, transition: T });

  return (
    <svg viewBox="0 0 640 470" className="h-full w-full" role="img" aria-label="Ladder leaning against a wall forming a right-angled triangle">
      <defs>
        <pattern id="brick" width="40" height="20" patternUnits="userSpaceOnUse">
          <rect width="40" height="20" fill="#7c2d12" />
          <path d="M0 0H40M0 10H40M20 0V10M0 10V20M40 10V20" stroke="#9a3412" strokeWidth="2" />
        </pattern>
        <filter id="glow"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>

      {/* sky & ground */}
      <rect x="0" y={y0} width="640" height="170" fill="#14532d" opacity="0.35" />
      <line x1="40" y1={y0} x2="620" y2={y0} stroke="#86efac" strokeWidth="4" />
      {/* wall */}
      <rect x={x0 - 34} y={y0 - 4.6 * u - 10} width="34" height={4.6 * u + 10} fill="url(#brick)" />
      <line x1={x0} y1={y0} x2={x0} y2={B.y - 20} stroke="#fdba74" strokeWidth="3" />

      {/* squares on sides */}
      <g style={show(3)}>
        <rect x={x0} y={y0} width={a * u} height={a * u} fill="#38bdf8" fillOpacity="0.28" stroke="#38bdf8" strokeWidth="2" />
        <text x={x0 + (a * u) / 2} y={y0 + (a * u) / 2 + 10} textAnchor="middle" fontSize="30" fontWeight="800" fill="#7dd3fc">{challenge ? "36" : `${a * a}`}</text>
        <rect x={x0 - b * u} y={B.y} width={b * u} height={b * u} fill="#a78bfa" fillOpacity="0.28" stroke="#a78bfa" strokeWidth="2" />
        <text x={x0 - (b * u) / 2} y={B.y + (b * u) / 2 + 10} textAnchor="middle" fontSize="30" fontWeight="800" fill="#c4b5fd">{challenge ? "h²" : `${b * b}`}</text>
        <polygon
          points={`${A.x},${A.y} ${B.x},${B.y} ${B.x + n.x},${B.y + n.y} ${A.x + n.x},${A.y + n.y}`}
          fill="#fbbf24" fillOpacity={step >= 4 ? 0.35 : 0.15} stroke="#fbbf24" strokeWidth="2" strokeDasharray={step >= 4 ? "0" : "8 6"} style={{ transition: T }}
        />
        <text x={(A.x + B.x) / 2 + n.x / 2} y={(A.y + B.y) / 2 + n.y / 2 + 10} textAnchor="middle" fontSize="32" fontWeight="800" fill="#fde68a">
          {step >= 4 ? (challenge ? "100" : `${c * c}`) : "c²"}
        </text>
      </g>

      {/* ladder */}
      <g
        style={{ transition: "all 1.4s cubic-bezier(.2,.8,.2,1)", transform: step >= 0 ? "none" : "translateX(200px)" }}
        filter={step === 2 || step === 4 ? "url(#glow)" : undefined}
      >
        {[1, -1].map((s) => (
          <line key={s} x1={A.x + perp.x * s} y1={A.y + perp.y * s} x2={B.x + perp.x * s} y2={B.y + perp.y * s}
            stroke={step >= 2 ? "#fbbf24" : "#d6d3d1"} strokeWidth="5" strokeLinecap="round" style={{ transition: T }} />
        ))}
        {rungs.map((d) => {
          const p = { x: A.x + dir.x * d, y: A.y + dir.y * d };
          return <line key={d} x1={p.x + perp.x} y1={p.y + perp.y} x2={p.x - perp.x} y2={p.y - perp.y} stroke={step >= 2 ? "#f59e0b" : "#a8a29e"} strokeWidth="3" />;
        })}
      </g>

      {/* painter */}
      <text x={A.x + 30} y={y0 - 6} fontSize="44" style={show(0)}>🧑‍🎨</text>

      {/* right angle */}
      <g style={show(1)}>
        <rect x={x0} y={y0 - 26} width="26" height="26" fill="none" stroke="#f472b6" strokeWidth="4" className={step === 1 ? "animate-pulse" : ""} />
        <text x={x0 + 6} y={y0 - 36} fontSize="22" fontWeight="700" fill="#f9a8d4">90°</text>
      </g>

      {/* labels */}
      <g style={show(0)}>
        <text x={x0 + (a * u) / 2} y={y0 + 30} textAnchor="middle" fontSize="24" fontWeight="700" fill="#e0f2fe">
          {challenge ? "6 m" : `a = ${a} m`}
        </text>
      </g>
      <g style={show(2)}>
        <text x={x0 - 46} y={y0 - (b * u) / 2} textAnchor="end" fontSize="24" fontWeight="700" fill="#ede9fe" style={{ opacity: step >= 3 ? 0 : 1, transition: T }}>
          {challenge ? "h = ?" : `b = ${b} m`}
        </text>
        <text x={(A.x + B.x) / 2 + (n.x / (c * u)) * 30} y={(A.y + B.y) / 2 + (n.y / (c * u)) * 30} textAnchor="start" fontSize="24" fontWeight="800" fill="#fde68a">
          {challenge ? "10 m" : step >= 4 ? `c = ${c} m` : "c = ?"}
        </text>
      </g>
      {challenge && (
        <text x={x0 + 10} y={B.y - 30} fontSize="26" fontWeight="800" fill="#f9a8d4">h = ?</text>
      )}
    </svg>
  );
}
