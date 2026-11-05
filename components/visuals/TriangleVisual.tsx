"use client";
// Rotating right-angled triangle used for "spot the hypotenuse" follow-ups.

export default function TriangleVisual({ rotation, labels, highlight = "none" }: { rotation: number; labels: [string, string, string]; highlight?: "hyp" | "right" | "none" }) {
  const P = { x: -110, y: -110 }, Q = { x: -110, y: 90 }, R = { x: 150, y: 90 };
  const pts = [P, Q, R];
  const cx = (P.x + Q.x + R.x) / 3, cy = (P.y + Q.y + R.y) / 3;
  const T = "transform 1.4s cubic-bezier(.2,.8,.2,1)";
  return (
    <svg viewBox="-320 -240 640 480" className="h-full w-full" role="img" aria-label="Right-angled triangle">
      <g style={{ transform: `rotate(${rotation}deg)`, transition: T }}>
        <polygon points={pts.map((p) => `${p.x},${p.y}`).join(" ")} fill="#0ea5e9" fillOpacity="0.12" stroke="#7dd3fc" strokeWidth="5" strokeLinejoin="round" />
        {highlight === "hyp" && (
          <>
            <line x1={P.x} y1={P.y} x2={R.x} y2={R.y} stroke="#fbbf24" strokeWidth="12" strokeLinecap="round" className="animate-pulse" />
            <g style={{ transform: `translate(${(P.x + R.x) / 2 + 40}px, ${(P.y + R.y) / 2 - 30}px) rotate(${-rotation}deg)`, transition: T }}>
              <text textAnchor="middle" fontSize="28" fontWeight="800" fill="#fde68a">hypotenuse</text>
            </g>
          </>
        )}
        <rect x={Q.x} y={Q.y - 30} width="30" height="30" fill={highlight === "right" ? "#f472b6" : "none"} fillOpacity="0.35" stroke="#f472b6" strokeWidth="5" className={highlight === "right" ? "animate-pulse" : ""} />
        {pts.map((p, i) => {
          const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy);
          return (
            <g key={i} style={{ transform: `translate(${p.x + (dx / d) * 40}px, ${p.y + (dy / d) * 40}px) rotate(${-rotation}deg)`, transition: T }}>
              <text textAnchor="middle" dominantBaseline="central" fontSize="40" fontWeight="800" fill="#f8fafc">{labels[i]}</text>
            </g>
          );
        })}
      </g>
    </svg>
  );
}
