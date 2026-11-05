"use client";
import type { SceneVisual as SV } from "@/lib/types";
import LadderVisual from "./LadderVisual";
import TriangleVisual from "./TriangleVisual";
import PhotosynthesisVisual from "./PhotosynthesisVisual";

export default function SceneVisual({ visual, sceneKey }: { visual: SV; sceneKey: string }) {
  switch (visual.kind) {
    case "ladder":
      return <LadderVisual step={visual.step} a={visual.a} b={visual.b} />;
    case "triangle":
      return <TriangleVisual rotation={visual.rotation} labels={visual.labels} highlight={visual.highlight} />;
    case "photosynthesis":
      return <PhotosynthesisVisual step={visual.step} />;
    case "emoji":
      return (
        <div key={sceneKey} className="flex h-full w-full items-center justify-center gap-6">
          {visual.emoji.map((e, i) => (
            <span key={i} className="pop text-[9rem] leading-none drop-shadow-2xl" style={{ animationDelay: `${i * 180}ms` }}>
              {e}
            </span>
          ))}
        </div>
      );
  }
}
