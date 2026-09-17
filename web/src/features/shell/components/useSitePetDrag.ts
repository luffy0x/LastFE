"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DRAG_THRESHOLD_PX = 6;

type DragState = {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
};

/**
 * 站宠全屏拖拽：返回当前位置（相对视口左上角）、拖拽状态和事件处理器。
 * 按下后移动超过阈值才进入拖拽，未超过阈值视为点击，交给子元素的点击逻辑。
 */
export function useSitePetDrag(width: number, height: number) {
  const rootRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(
    null,
  );
  const [dragging, setDragging] = useState(false);

  const clamp = useCallback(
    (left: number, top: number) => ({
      left: Math.min(Math.max(left, 0), window.innerWidth - width),
      top: Math.min(Math.max(top, 0), window.innerHeight - height),
    }),
    [height, width],
  );

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
      const next = clamp(drag.originX + dx, drag.originY + dy);
      setPosition(next);
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
  }, [clamp]);

  return { rootRef, position, dragging, onPointerDown };
}
