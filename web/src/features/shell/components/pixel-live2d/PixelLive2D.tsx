"use client";

import {
  type CSSProperties,
  type PointerEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createCubismStage } from "./create-cubism-stage";
import { loadScriptOnce } from "./load-script";
import styles from "./pixel-live2d.module.css";
import type { CharacterState, Live2DController, PixelLive2DProps } from "./types";

const RESET_DELAY = 1700;

export function PixelLive2D({
  modelUrl,
  coreScriptUrl = "/live2d/pixel-coder/live2dcubismcore.min.js",
  className = "",
  width = 320,
  height = 480,
  showHint = true,
  fallbackBaseUrl = "/live2d/pixel-coder/preview",
  onStateChange,
}: PixelLive2DProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<Live2DController | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [state, setState] = useState<CharacterState>("idle");
  const [cubismReady, setCubismReady] = useState(false);

  const changeState = useCallback((next: CharacterState) => {
    setState(next);
    controllerRef.current?.setState(next);
    onStateChange?.(next);

    if (timerRef.current) clearTimeout(timerRef.current);
    if (next !== "idle") {
      timerRef.current = setTimeout(() => {
        setState("idle");
        controllerRef.current?.setState("idle");
        onStateChange?.("idle");
      }, RESET_DELAY);
    }
  }, [onStateChange]);

  useEffect(() => {
    if (!modelUrl || !hostRef.current || !canvasRef.current) return;
    let disposed = false;
    let destroy: (() => void) | undefined;

    void (async () => {
      try {
        await loadScriptOnce(coreScriptUrl);
        const stage = await createCubismStage(
          hostRef.current!,
          canvasRef.current!,
          modelUrl,
        );
        if (disposed) {
          stage.destroy();
          return;
        }
        controllerRef.current = stage;
        destroy = stage.destroy;
        setCubismReady(true);
      } catch (error) {
        // 模型未导出或 Core 未放入 public 时，三状态 PNG 仍可正常使用。
        console.warn("PixelLive2D: Cubism 模型加载失败，已切换到 PNG 预览。", error);
        setCubismReady(false);
      }
    })();

    return () => {
      disposed = true;
      controllerRef.current = null;
      destroy?.();
    };
  }, [coreScriptUrl, modelUrl]);

  useEffect(() => () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  }, []);

  const interact = (event: PointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const relativeY = (event.clientY - rect.top) / rect.height;
    changeState(relativeY < 0.48 ? "shock" : "wry");
  };

  const handleKeyboard = () => {
    changeState(state === "shock" ? "wry" : "shock");
  };

  const style = {
    "--pet-width": `${width}px`,
    "--pet-height": `${height}px`,
  } as CSSProperties;

  return (
    <div
      ref={hostRef}
      className={`${styles.shell} ${className}`}
      style={style}
      data-state={state}
    >
      <canvas
        ref={canvasRef}
        className={`${styles.canvas} ${cubismReady ? styles.canvasReady : ""}`}
        aria-hidden="true"
      />

      <img
        src={`${fallbackBaseUrl}/${state}.png`}
        alt=""
        draggable={false}
        className={`${styles.preview} ${styles[state]} ${cubismReady ? styles.previewHidden : ""}`}
      />

      <button
        type="button"
        className={styles.hitLayer}
        aria-label="与像素切图仔互动：点击头部或身体"
        onPointerDown={interact}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handleKeyboard();
          }
        }}
      />

      {showHint && <p className={styles.hint}>点我 / 别点头</p>}
    </div>
  );
}

export type { CharacterState, PixelLive2DProps } from "./types";
