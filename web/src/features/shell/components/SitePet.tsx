"use client";

import { PixelLive2D } from "./pixel-live2d";

/** 固定在右下角的站宠，渲染产物与 SSR 一致，交互逻辑均在 effect 中运行。 */
export function SitePet() {
  return (
    <div className="site-pet">
      <PixelLive2D width={200} height={300} showHint={false} />
    </div>
  );
}
