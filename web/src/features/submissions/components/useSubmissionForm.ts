"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { AltchaWidgetElement } from "altcha";
import type { Challenge as AltchaChallenge } from "altcha-lib/v1/types";
import { ZodError } from "zod";

import type { RegionDefinition } from "@/features/map/types";
import { parseSubmission } from "@/features/submissions/schemas";
import type {
  SubmissionFieldDefinition,
  SubmissionResponse,
} from "@/features/submissions/types";
import { request, RequestError } from "@/utils/request";

const RESPONSE_MESSAGES: Readonly<Record<string, string>> = {
  INVALID: "提交内容未通过校验，请检查标记字段后重试。",
  CHALLENGE: "验证已失效，请重新完成验证后再提交。",
  RATE_LIMIT: "提交过于频繁，内容已保留，请稍后重试。",
  DUPLICATE: "相同内容近期已提交，内容已保留；请等待审核或修改后重试。",
  UPSTREAM: "提交服务暂时不可用，内容已保留，请稍后重试。",
};

async function loadChallenge(): Promise<AltchaChallenge> {
  await import("altcha");
  await import("altcha/i18n/zh-cn");
  return request<AltchaChallenge>("/api/challenge", { cache: "no-store" });
}

function fieldValue(
  formData: FormData,
  definition: SubmissionFieldDefinition,
): string | string[] | undefined {
  const value = String(formData.get(definition.name) ?? "");
  if (definition.kind === "tags") {
    return value
      .split(/[,，]/)
      .map((tag) => tag.trim())
      .filter(Boolean);
  }
  if (!definition.required && value.trim() === "") return undefined;
  return value;
}

function invalidFieldMessage(
  formData: FormData,
  definition: SubmissionFieldDefinition,
): string {
  const value = fieldValue(formData, definition);
  if (
    definition.required &&
    (value === undefined || value === "" || (Array.isArray(value) && value.length === 0))
  ) {
    return `请填写${definition.label}。`;
  }
  return `请检查${definition.label}的格式或长度。`;
}

export function useSubmissionForm(region: RegionDefinition) {
  const router = useRouter();
  const widgetRef = useRef<AltchaWidgetElement>(null);
  const [challenge, setChallenge] = useState<AltchaChallenge | null>(null);
  const [challengeError, setChallengeError] = useState<string | null>(null);
  const [altchaPayload, setAltchaPayload] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refreshChallenge = useCallback(async () => {
    setChallenge(null);
    setAltchaPayload(null);
    setChallengeError(null);
    try {
      setChallenge(await loadChallenge());
    } catch {
      setChallengeError("验证加载失败，请检查网络后重试。");
    }
  }, []);

  useEffect(() => {
    let active = true;
    void loadChallenge()
      .then((nextChallenge) => {
        if (active) setChallenge(nextChallenge);
      })
      .catch(() => {
        if (active) {
          setChallengeError("验证加载失败，请检查网络后重试。");
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const widget = widgetRef.current;
    if (!widget || !challenge) return;

    const handleVerified = (event: Event) => {
      const detail = (event as CustomEvent<{ payload?: string }>).detail;
      setAltchaPayload(typeof detail?.payload === "string" ? detail.payload : null);
      setFormMessage(null);
    };
    const handleExpired = () => setAltchaPayload(null);
    widget.addEventListener("verified", handleVerified);
    widget.addEventListener("expired", handleExpired);
    return () => {
      widget.removeEventListener("verified", handleVerified);
      widget.removeEventListener("expired", handleExpired);
    };
  }, [challenge]);

  const focusField = useCallback((name: string) => {
    document.getElementById(`submission-${name}`)?.focus();
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isSubmitting) return;

      const formData = new FormData(event.currentTarget);
      const values: Record<string, unknown> = { regionSlug: region.slug };
      for (const definition of region.submissionFields) {
        const value = fieldValue(formData, definition);
        if (value !== undefined) values[definition.name] = value;
      }

      try {
        parseSubmission(region.slug, values);
      } catch (error) {
        const issues = error instanceof ZodError ? error.issues : [];
        const errors: Record<string, string> = {};
        for (const issue of issues) {
          const name = String(issue.path[0] ?? "");
          const definition = region.submissionFields.find(
            (candidate) => candidate.name === name,
          );
          if (definition && !errors[name]) {
            errors[name] = invalidFieldMessage(formData, definition);
          }
        }
        const firstInvalid = region.submissionFields.find(
          ({ name }) => errors[name],
        );
        setFieldErrors(errors);
        setFormMessage("请修正标记字段后再提交。");
        if (firstInvalid) focusField(firstInvalid.name);
        return;
      }

      setFieldErrors({});
      if (!altchaPayload) {
        setFormMessage("请先完成人机验证，再提交审核。");
        widgetRef.current?.focus();
        return;
      }

      setFormMessage(null);
      setIsSubmitting(true);
      try {
        const response = await request<SubmissionResponse>("/api/submissions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            ...values,
            altcha: altchaPayload,
            website: String(formData.get("website") ?? ""),
          }),
        });
        if (response.ok) router.replace("/submitted");
      } catch (error) {
        const code = error instanceof RequestError ? error.code : "UPSTREAM";
        setFormMessage(RESPONSE_MESSAGES[code] ?? RESPONSE_MESSAGES.UPSTREAM);
        if (code === "INVALID") {
          const first = region.submissionFields[0];
          if (first) {
            setFieldErrors({
              [first.name]: "服务器未接受此字段，请核对后重试。",
            });
            focusField(first.name);
          }
        }
        if (code === "CHALLENGE") await refreshChallenge();
      } finally {
        setIsSubmitting(false);
      }
    },
    [altchaPayload, focusField, isSubmitting, refreshChallenge, region, router],
  );

  return {
    challenge,
    challengeError,
    fieldErrors,
    formMessage,
    handleSubmit,
    isSubmitting,
    verificationComplete: altchaPayload !== null,
    refreshChallenge,
    widgetRef,
  };
}
