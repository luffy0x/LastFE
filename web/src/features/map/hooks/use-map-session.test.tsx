import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  MAP_SESSION_KEY,
  useMapSession,
  type MapSessionSnapshot,
} from "./use-map-session";

const current: MapSessionSnapshot = {
  camera: { x: 0, y: 0, scale: 1 },
  explorerPoint: { x: 500, y: 300 },
  selectedSlug: null,
};

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  sessionStorage.clear();
});

describe("useMapSession", () => {
  it("restores a valid map snapshot", async () => {
    const stored = {
      camera: { x: -120, y: 48, scale: 1.4 },
      explorerPoint: { x: 759, y: 372 },
      selectedSlug: "algorithms",
    };
    sessionStorage.setItem(MAP_SESSION_KEY, JSON.stringify(stored));

    const { result } = renderHook(() => useMapSession(current));

    await waitFor(() => expect(result.current.restored).toEqual(stored));
  });

  it("ignores corrupt JSON", async () => {
    sessionStorage.setItem(MAP_SESSION_KEY, "{not-json");

    const { result } = renderHook(() => useMapSession(current));

    await waitFor(() => expect(result.current.restored).toBeNull());
  });

  it("rejects non-finite map coordinates", async () => {
    sessionStorage.setItem(
      MAP_SESSION_KEY,
      '{"camera":{"x":1e309,"y":0,"scale":1},"explorerPoint":{"x":500,"y":300},"selectedSlug":null}',
    );

    const { result } = renderHook(() => useMapSession(current));

    await waitFor(() => expect(result.current.restored).toBeNull());
  });

  it("rejects a selected territory missing from the registry", async () => {
    sessionStorage.setItem(
      MAP_SESSION_KEY,
      JSON.stringify({
        camera: { x: 0, y: 0, scale: 1 },
        explorerPoint: { x: 500, y: 300 },
        selectedSlug: "unknown-sector",
      }),
    );

    const { result } = renderHook(() => useMapSession(current));

    await waitFor(() => expect(result.current.restored).toBeNull());
  });

  it("persists later camera, explorer, and selection changes", async () => {
    const { rerender } = renderHook(
      (snapshot) => useMapSession(snapshot),
      { initialProps: current },
    );
    const next = {
      camera: { x: 24, y: -16, scale: 1.2 },
      explorerPoint: { x: 228, y: 166 },
      selectedSlug: "interview",
    };

    rerender(next);

    await waitFor(() =>
      expect(JSON.parse(sessionStorage.getItem(MAP_SESSION_KEY) ?? "null")).toEqual(
        next,
      ),
    );
  });
});
