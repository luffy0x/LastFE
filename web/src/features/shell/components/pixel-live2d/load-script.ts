const pending = new Map<string, Promise<void>>();

export function loadScriptOnce(src: string) {
  if (typeof window === "undefined") return Promise.resolve();
  if (pending.has(src)) return pending.get(src)!;

  const existing = document.querySelector<HTMLScriptElement>(
    `script[data-live2d-core="${src}"]`,
  );
  if (existing?.dataset.loaded === "true") return Promise.resolve();

  const task = new Promise<void>((resolve, reject) => {
    const script = existing ?? document.createElement("script");
    script.src = src;
    script.async = true;
    script.dataset.live2dCore = src;
    script.addEventListener("load", () => {
      script.dataset.loaded = "true";
      resolve();
    }, { once: true });
    script.addEventListener("error", () => {
      pending.delete(src);
      reject(new Error(`Cubism Core 加载失败：${src}`));
    }, { once: true });
    if (!existing) document.head.appendChild(script);
  });

  pending.set(src, task);
  return task;
}
