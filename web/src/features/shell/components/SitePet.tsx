"use client";

import { PixelLive2D } from "./pixel-live2d";
import { useSitePetDrag } from "./useSitePetDrag";

const PET_WIDTH = 200;
const PET_HEIGHT = 300;

/** 固定在右下角的站宠，可全屏拖拽，渲染产物与 SSR 一致，交互逻辑均在 effect 中运行。 */
export function SitePet() {
  const { rootRef, position, dragging, onPointerDown } = useSitePetDrag(
    PET_WIDTH,
    PET_HEIGHT,
  );

  return (
    <div
      ref={rootRef}
      className={position ? "site-pet site-pet--placed" : "site-pet"}
      data-dragging={dragging || undefined}
      style={
        position
          ? { left: position.left, top: position.top }
          : undefined
      }
      onPointerDown={onPointerDown}
    >
      <PixelLive2D width={PET_WIDTH} height={PET_HEIGHT} showHint={false} />
    </div>
  );
}
