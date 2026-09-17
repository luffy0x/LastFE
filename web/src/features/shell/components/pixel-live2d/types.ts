export type CharacterState = "idle" | "shock" | "wry";

export type PixelLive2DProps = {
  /** Cubism Editor 导出的 .model3.json。省略时自动使用三状态 PNG 预览。 */
  modelUrl?: string;
  /** Cubism SDK for Web 中的 live2dcubismcore.min.js。 */
  coreScriptUrl?: string;
  className?: string;
  width?: number;
  height?: number;
  showHint?: boolean;
  fallbackBaseUrl?: string;
  onStateChange?: (state: CharacterState) => void;
};

export type Live2DController = {
  setState: (state: CharacterState) => void;
};
