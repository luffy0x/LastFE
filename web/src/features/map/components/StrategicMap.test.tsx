import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REGIONS } from "../regions";
import { StrategicMap } from "./StrategicMap";

const stats = { totalPublished: 18, recentPublished: 4 };

describe("StrategicMap", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("exposes every enabled territory through the map and a link list", () => {
    render(
      <StrategicMap regions={REGIONS} stats={stats} onSelectRegion={vi.fn()} />,
    );

    expect(
      screen.getByRole("application", { name: "战略地图画布" }),
    ).toBeVisible();
    expect(screen.getAllByRole("button", { name: /^进入.+区$/ })).toHaveLength(5);
    expect(screen.getByRole("navigation", { name: "领地列表" })).toBeVisible();
    expect(screen.getAllByRole("link", { name: /区$/ })).toHaveLength(5);
  });

  it("selects a territory with the keyboard and reports its status", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <StrategicMap regions={REGIONS} stats={stats} onSelectRegion={onSelect} />,
    );
    const interview = screen.getByRole("button", { name: "进入面经区" });

    expect(interview).toHaveAttribute("tabindex", "0");
    interview.focus();
    await user.keyboard("{Enter}");

    expect(onSelect).toHaveBeenCalledWith("interview");
    expect(screen.getByText("目标锁定：面经区")).toBeVisible();
  });

  it("shows publishing telemetry and the explorer position", () => {
    render(
      <StrategicMap regions={REGIONS} stats={stats} onSelectRegion={vi.fn()} />,
    );

    expect(screen.getByText("18", { selector: "output" })).toBeVisible();
    expect(screen.getByText("4", { selector: "output" })).toBeVisible();
    expect(
      screen.getByRole("img", { name: "探索者当前位置：八股区" }),
    ).toBeVisible();
  });

  it("shows the project logo in the map brand", () => {
    render(
      <StrategicMap regions={REGIONS} stats={stats} onSelectRegion={vi.fn()} />,
    );

    expect(screen.getByRole("img", { name: "LastFE 项目 Logo" })).toHaveAttribute(
      "src",
      "/lastfe-logo.svg",
    );
  });

  it("searches published content from the HUD", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(() =>
        Promise.resolve(
          Response.json({
            ok: true,
            page: {
              items: [
                {
                  id: "resource-react-typescript",
                  title: "React TypeScript 学习路线",
                  regionSlug: "resources",
                },
              ],
              page: 1,
              pageSize: 20,
              total: 1,
            },
          }),
        ),
      ),
    );
    render(
      <StrategicMap regions={REGIONS} stats={stats} onSelectRegion={vi.fn()} />,
    );

    await user.type(screen.getByLabelText("全局搜索关键词"), "React");
    await user.click(screen.getByRole("button", { name: "搜索情报" }));

    expect(
      await screen.findByRole("link", { name: "React TypeScript 学习路线" }),
    ).toBeVisible();
  });

  it("restores the camera, explorer, and selected territory from session", async () => {
    sessionStorage.setItem(
      "knowledge-frontier:map:v1",
      JSON.stringify({
        camera: { x: -120, y: 48, scale: 1.4 },
        explorerPoint: { x: 759, y: 372 },
        selectedSlug: "algorithms",
      }),
    );

    render(
      <StrategicMap regions={REGIONS} stats={stats} onSelectRegion={vi.fn()} />,
    );

    expect(
      await screen.findByRole("img", { name: "探索者当前位置：算法区" }),
    ).toHaveAttribute("transform", "translate(759 344)");
    expect(screen.getByTestId("camera-layer")).toHaveAttribute(
      "transform",
      "translate(-120 48) scale(1.4)",
    );
    expect(screen.getByRole("button", { name: "进入算法区" })).toHaveAttribute(
      "data-selected",
      "true",
    );
  });

  it("lets an explicit region query override a stored session", async () => {
    sessionStorage.setItem(
      "knowledge-frontier:map:v1",
      JSON.stringify({
        camera: { x: -120, y: 48, scale: 1.4 },
        explorerPoint: { x: 759, y: 372 },
        selectedSlug: "algorithms",
      }),
    );

    render(
      <StrategicMap
        regions={REGIONS}
        stats={stats}
        onSelectRegion={vi.fn()}
        initialRegionSlug="projects"
      />,
    );

    expect(
      await screen.findByRole("img", { name: "探索者当前位置：项目区" }),
    ).toHaveAttribute("transform", "translate(232 357)");
    expect(screen.getByRole("button", { name: "进入项目区" })).toHaveAttribute(
      "data-selected",
      "true",
    );
    expect(screen.getByRole("button", { name: "进入项目区" })).toHaveFocus();
  });
});
