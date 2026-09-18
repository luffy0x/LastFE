"use client";

import type { CSSProperties } from "react";

import { PixelLive2D } from "./pixel-live2d";
import {
  PET_ASPECT,
  PET_BASE_HEIGHT,
  PET_BASE_WIDTH,
  useSitePetDrag,
} from "./useSitePetDrag";

/** 固定在右下角的站宠：可全屏拖拽，悬停滚轮丝滑缩放（transform scale，可中断）。 */
export function SitePet() {
  const { rootRef, position, scale, dragging, onPointerDown, onWheel } =
    useSitePetDrag();

  const style: CSSProperties = {
    width: PET_BASE_WIDTH,
    height: PET_BASE_HEIGHT,
    transform: `scale(${scale})`,
    transformOrigin: "center",
  };
  if (position) {
    style.left = position.left;
    style.top = position.top;
  }

  return (
    <div
      ref={rootRef}
      className={position ? "site-pet site-pet--placed" : "site-pet"}
      data-dragging={dragging || undefined}
      style={style}
      onPointerDown={onPointerDown}
      onWheel={onWheel}
    >
      <PixelLive2D
        width={PET_BASE_WIDTH}
        height={Math.round(PET_BASE_HEIGHT)}
        showHint={false}
      />
    </div>
  );
}
