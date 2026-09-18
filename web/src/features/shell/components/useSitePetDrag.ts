"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DRAG_THRESHOLD_PX = 6;
/** 每格滚动的缩放步长 */
const WHEEL_SCALE_STEP = 0.06;

export const PET_MIN_SCALE = 0.6;
export const PET_MAX_SCALE = 1.75;
/** 布局基准尺寸（未缩放），实际视觉尺寸 = 基准 × scale */
export const PET_BASE_WIDTH = 160;
/** 宽高比固定 2:3 */
export const PET_ASPECT = 3 / 2;
export const PET_BASE_HEIGHT = PET_BASE_WIDTH * PET_ASPECT;

const clampScale = (scale: number) =>
  Math.min(Math.max(scale, PET_MIN_SCALE), PET_MAX_SCALE);

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
};

/**
 * 站宠全屏拖拽 + 滚轮缩放。
 * 缩放用 transform scale（可中断、可合成，连续滚轮下依然丝滑），
 * width/height 过渡在连续事件下会被反复重启动画而冻结，故不采用。
 * 返回位置（相对视口左上角）、缩放、拖拽状态和事件处理器；
 * 按下后移动超过阈值才算拖拽，否则视为点击，交给子元素的点击逻辑。
 */
export function useSitePetDrag() {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [scale, setScale] = useState(1);
  const scaleRef = useRef(1);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(
    null,
  );
  const [dragging, setDragging] = useState(false);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const root = rootRef.current;
      if (!root) return;
      // 按下即捕获指针：拖出窗口仍能收到 move；合成事件下可能失败，忽略即可
      try {
        root.setPointerCapture(event.pointerId);
      } catch {
        // 指针不存在（如自动化合成事件）时无需捕获
      }
      const rect = root.getBoundingClientRect();
      dragRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: rect.left,
        originY: rect.top,
        moved: false,
      };
    },
    [],
  );

  const onWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    // 以指针悬停点为锚缩放；transform 动画可中断，连续滚动也能平滑跟进
    event.preventDefault();
    const factor = 1 + (event.deltaY < 0 ? WHEEL_SCALE_STEP : -WHEEL_SCALE_STEP);
    setScale((prev) => {
      const next = clampScale(prev * factor);
      scaleRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    const handleMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
        drag.moved = true;
        setDragging(true);
      }
      const root = rootRef.current;
      if (!root) return;
      // transform scale 从中心放大：视觉盒 = 布局盒 × scale，四周溢出 (scale-1)/2。
      // 钳制必须按视觉盒计算，否则放大后拖到边缘时溢出部分（如头部）被视口裁掉。
      const visualW = PET_BASE_WIDTH * scaleRef.current;
      const visualH = PET_BASE_HEIGHT * scaleRef.current;
      const bleedX = (visualW - PET_BASE_WIDTH) / 2;
      const bleedY = (visualH - PET_BASE_HEIGHT) / 2;
      const rect = root.getBoundingClientRect();
      const visualLeft = rect.left + dx;
      const visualTop = rect.top + dy;
      setPosition({
        left: Math.min(
          Math.max(visualLeft, bleedX),
          Math.max(bleedX, window.innerWidth - visualW + bleedX),
        ),
        top: Math.min(
          Math.max(visualTop, bleedY),
          Math.max(bleedY, window.innerHeight - visualH + bleedY),
        ),
      });
      drag.startX = event.clientX;
      drag.startY = event.clientY;
    };

    const handleUp = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      dragRef.current = null;
      setDragging(false);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleUp);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
    };
  }, []);

  return {
    rootRef,
    position,
    scale,
    dragging,
    onPointerDown,
    onWheel,
  };
}
