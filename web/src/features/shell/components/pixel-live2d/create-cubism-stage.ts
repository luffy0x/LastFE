import type { CharacterState, Live2DController } from "./types";

type StageHandle = Live2DController & { destroy: () => void };

export async function createCubismStage(
  host: HTMLDivElement,
  canvas: HTMLCanvasElement,
  modelUrl: string,
): Promise<StageHandle> {
  const PIXI = await import("pixi.js");
  // 必须在浏览器端、且在 Cubism Core 就绪后导入。
  const { Live2DModel } = await import("pixi-live2d-display/cubism4");

  const app = new PIXI.Application({
    view: canvas,
    autoStart: true,
    transparent: true,
    antialias: false,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    autoDensity: true,
    resizeTo: host,
  });

  const model = await Live2DModel.from(modelUrl, { autoInteract: false });
  model.anchor.set(0.5, 0.5);
  app.stage.addChild(model);

  const fit = () => {
    const bounds = model.getLocalBounds();
    if (!bounds.width || !bounds.height) return;
    const scale = Math.min(
      (host.clientWidth * 0.92) / bounds.width,
      (host.clientHeight * 0.96) / bounds.height,
    );
    model.scale.set(scale);
    model.position.set(host.clientWidth / 2, host.clientHeight / 2);
  };

  fit();
  const resizeObserver = new ResizeObserver(fit);
  resizeObserver.observe(host);

  const setState = (state: CharacterState) => {
    if (state === "idle") {
      void model.expression();
      return;
    }

    const expression = state === "shock" ? "shock" : "wry";
    const motionGroup = state === "shock" ? "TapHead" : "TapBody";
    void model.expression(expression);
    void model.motion(motionGroup, 0, 3);
  };

  return {
    setState,
    destroy: () => {
      resizeObserver.disconnect();
      app.stage.removeChildren();
      model.destroy({ children: true, texture: true, baseTexture: true });
      app.destroy(true, { children: true, texture: true, baseTexture: true });
    },
  };
}
