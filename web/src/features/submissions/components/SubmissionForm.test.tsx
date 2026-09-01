import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { REGIONS } from "@/features/map/regions";
import { RequestError } from "@/utils/request";
import { SubmissionForm } from "./SubmissionForm";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  request: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
}));

vi.mock("@/utils/request", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/request")>();
  return { ...actual, request: mocks.request };
});

vi.mock("altcha", () => ({}));
vi.mock("altcha/i18n/zh-cn", () => ({}));

const challenge = {
  algorithm: "SHA-256" as const,
  challenge: "challenge",
  maxnumber: 100,
  salt: "salt",
  signature: "signature",
};

const interview = REGIONS.find(({ slug }) => slug === "interview")!;
const algorithms = REGIONS.find(({ slug }) => slug === "algorithms")!;

function solveChallenge() {
  const widget = screen.getByTestId("altcha-widget");
  fireEvent(
    widget,
    new CustomEvent("verified", {
      detail: { payload: "signed-altcha-payload" },
    }),
  );
}

async function fillInterviewForm() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText(/公司 \/ 部门/), "字节跳动/基础架构");
  await user.type(screen.getByLabelText(/^岗位/), "后端开发");
  await user.type(screen.getByLabelText(/^标签/), "一面, Go");
  await user.type(screen.getByLabelText(/^面经内容/), "面试记录");
  solveChallenge();
  return user;
}

beforeEach(() => {
  mocks.replace.mockReset();
  mocks.request.mockReset();
  mocks.request.mockImplementation(async (input: string) => {
    if (input === "/api/challenge") return challenge;
    return { ok: true, issueNumber: 101 };
  });
});

describe("SubmissionForm", () => {
  it("renders every configured field kind with persistent accessible labels", async () => {
    render(<SubmissionForm region={algorithms} />);

    expect(screen.getByLabelText(/^标题/)).toBeRequired();
    expect(screen.getByLabelText(/^来源/)).toBeRequired();
    expect(screen.getByLabelText(/^难度/)).toBeRequired();
    expect(screen.getByLabelText(/^题目 URL/)).not.toBeRequired();
    expect(screen.getByLabelText(/^标签/)).toBeRequired();
    expect(screen.getByLabelText(/^题解/)).toBeRequired();
    await waitFor(() =>
      expect(screen.getByTestId("altcha-widget")).toHaveAttribute(
        "challenge",
        JSON.stringify(challenge),
      ),
    );
  });

  it("focuses the first invalid field and renders an associated inline error", async () => {
    render(<SubmissionForm region={interview} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: "提交审核" }));

    const first = screen.getByLabelText(/公司 \/ 部门/);
    expect(first).toHaveFocus();
    expect(first).toHaveAttribute("aria-invalid", "true");
    expect(first).toHaveAccessibleDescription(/请填写/);
    expect(mocks.request).toHaveBeenCalledTimes(1);
  });

  it("submits normalized values and replaces history only after success", async () => {
    render(<SubmissionForm region={interview} />);
    const user = await fillInterviewForm();

    await user.click(screen.getByRole("button", { name: "提交审核" }));

    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/submitted"));
    expect(mocks.request).toHaveBeenLastCalledWith(
      "/api/submissions",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          regionSlug: "interview",
          companyDepartment: "字节跳动/基础架构",
          position: "后端开发",
          tags: ["一面", "Go"],
          markdown: "面试记录",
          altcha: "signed-altcha-payload",
          website: "",
        }),
      }),
    );
  });

  it("preserves values and refreshes ALTCHA after a challenge rejection", async () => {
    mocks.request.mockImplementation(async (input: string) => {
      if (input === "/api/challenge") return challenge;
      throw new RequestError(
        "server detail must not replace recovery copy",
        422,
        "CHALLENGE",
      );
    });
    render(<SubmissionForm region={interview} />);
    const user = await fillInterviewForm();

    await user.click(screen.getByRole("button", { name: "提交审核" }));

    expect(
      await screen.findByText("验证已失效，请重新完成验证后再提交。"),
    ).toBeVisible();
    expect(screen.getByLabelText(/公司 \/ 部门/)).toHaveValue(
      "字节跳动/基础架构",
    );
    expect(mocks.request).toHaveBeenCalledTimes(3);
    expect(mocks.replace).not.toHaveBeenCalled();
  });

  it("disables only during the active submission request and recovers with guidance", async () => {
    let rejectSubmission: ((error: unknown) => void) | undefined;
    mocks.request.mockImplementation((input: string) => {
      if (input === "/api/challenge") return Promise.resolve(challenge);
      return new Promise((_resolve, reject) => {
        rejectSubmission = reject;
      });
    });
    render(<SubmissionForm region={interview} />);
    const user = await fillInterviewForm();
    const button = screen.getByRole("button", { name: "提交审核" });

    await user.click(button);

    expect(screen.getByRole("button", { name: "正在提交…" })).toBeDisabled();
    rejectSubmission?.(new RequestError("hidden", 503, "UPSTREAM"));
    expect(
      await screen.findByText("提交服务暂时不可用，内容已保留，请稍后重试。"),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "提交审核" })).toBeEnabled();
  });

  it("keeps the honeypot outside keyboard and accessibility navigation", () => {
    render(<SubmissionForm region={interview} />);

    const honeypot = document.querySelector<HTMLInputElement>(
      'input[name="website"]',
    );
    expect(honeypot).toHaveValue("");
    expect(honeypot).toHaveAttribute("tabindex", "-1");
    expect(honeypot?.closest("[aria-hidden='true']")).not.toBeNull();
  });
});
