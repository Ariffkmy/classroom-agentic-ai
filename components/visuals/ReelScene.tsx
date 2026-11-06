"use client";
// Plays one reel scene. The timeline is seeked from the shared scene clock instead of running
// on its own, so the teacher's preview and the classroom display stay on the same frame, and a
// display window that was hidden or opened late catches up.

import { useEffect, useLayoutEffect, useRef } from "react";
import type gsap from "gsap";
import type { ReelStyleId, Scene } from "@/lib/types";
import { buildReelScene } from "@/lib/reel/kit";

export default function ReelScene({ scene, style, showCaptions, motif, discuss, playing, startedAt }: {
  scene: Scene;
  style: ReelStyleId;
  showCaptions: boolean;
  motif?: string;
  discuss: string;
  playing: boolean;
  startedAt: number;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const tlRef = useRef<gsap.core.Timeline | null>(null);
  const startedRef = useRef(startedAt);
  startedRef.current = startedAt;

  // `scene` is compared by content: the display receives a fresh copy with every state broadcast.
  const sceneKey = JSON.stringify(scene);

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const tl = buildReelScene(root, { scene: JSON.parse(sceneKey) as Scene, style, showCaptions, motif, discuss });
    tlRef.current = tl;
    tl.seek(Math.max(0, (Date.now() - startedRef.current) / 1000), false);
    return () => {
      tl.kill();
      tlRef.current = null;
      root.replaceChildren();
    };
  }, [sceneKey, style, showCaptions, motif, discuss]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    const tick = () => {
      tlRef.current?.seek(Math.max(0, (Date.now() - startedRef.current) / 1000), false);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing]);

  return (
    <div className="absolute left-0 top-0 origin-top-left" style={{ width: 1920, height: 1080, transform: "scale(0.66667)" }}>
      <div ref={rootRef} className="rs-root" />
    </div>
  );
}
