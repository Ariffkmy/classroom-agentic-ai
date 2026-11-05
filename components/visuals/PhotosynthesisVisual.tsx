"use client";
const T = "all 900ms cubic-bezier(.2,.8,.2,1)";

export default function PhotosynthesisVisual({ step }: { step: number }) {
  const show = (k: number) => ({ opacity: step >= k ? 1 : 0, transition: T });
  const dark = step >= 3;
  return (
    <svg viewBox="0 0 640 470" className="h-full w-full" role="img" aria-label="Leaf photosynthesis diagram">
      <rect width="640" height="470" fill={dark ? "#020617" : "transparent"} style={{ transition: T }} />
      <g style={{ transform: dark ? "scale(.6) translate(200px,150px)" : "none", transition: T, filter: dark ? "saturate(.2) sepia(.6)" : "none" }}>
        <path d="M320 400 C 160 380 120 220 210 130 C 290 50 450 60 500 120 C 560 200 470 360 320 400 Z" fill="#16a34a" stroke="#4ade80" strokeWidth="4" />
        <path d="M320 400 C 330 300 380 200 480 130" stroke="#bbf7d0" strokeWidth="5" fill="none" />
        <path d="M350 300 L 260 250 M380 240 L 300 180 M410 190 L 470 220 M370 270 L 450 300" stroke="#86efac" strokeWidth="3" />
        <text x="300" y="275" fontSize="56" style={show(0)}>🏭</text>
      </g>
      {!dark && (
        <>
          <g style={show(1)}>
            <text x="20" y="80" fontSize="64" className="animate-[spin_12s_linear_infinite]" style={{ transformOrigin: "52px 58px", transformBox: "fill-box" }}>☀️</text>
            <path d="M95 95 L 220 160" stroke="#fde047" strokeWidth="6" strokeDasharray="12 10" className="dash" />
            <text x="110" y="150" fontSize="20" fill="#fef08a" fontWeight="700">light</text>
            <text x="20" y="300" fontSize="40" fill="#e2e8f0" fontWeight="700">CO₂</text>
            <path d="M100 290 L 200 270" stroke="#e2e8f0" strokeWidth="5" strokeDasharray="10 8" className="dash" markerEnd="" />
            <text x="250" y="460" fontSize="40">💧</text>
            <path d="M285 430 L 305 395" stroke="#38bdf8" strokeWidth="5" strokeDasharray="10 8" className="dash" />
            <text x="320" y="455" fontSize="20" fill="#7dd3fc" fontWeight="700">water</text>
          </g>
          <g style={show(2)}>
            <path d="M510 160 L 590 120" stroke="#f0abfc" strokeWidth="5" strokeDasharray="10 8" className="dash" />
            <text x="540" y="110" fontSize="38" fill="#f5d0fe" fontWeight="700">O₂</text>
            <path d="M480 300 L 560 340" stroke="#fcd34d" strokeWidth="5" strokeDasharray="10 8" className="dash" />
            <text x="545" y="390" fontSize="44">🍬</text>
            <text x="520" y="430" fontSize="20" fill="#fde68a" fontWeight="700">glucose</text>
          </g>
        </>
      )}
      {dark && <text x="420" y="200" fontSize="80" style={show(3)}>❓</text>}
    </svg>
  );
}
