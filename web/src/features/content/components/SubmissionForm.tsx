"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { RegionDefinition } from "@/features/map/types";
import { request, RequestError } from "@/utils/request";

type SubmissionFormProps = {
  region: RegionDefinition;
};

function metadataKeysFor(region: RegionDefinition): readonly string[] {
  return region.summaryFields.filter((key) => key !== "tags");
}

export function SubmissionForm({ region }: SubmissionFormProps) {
  const router = useRouter();
  const metadataKeys = useMemo(() => metadataKeysFor(region), [region]);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState<"status" | "alert">("status");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const metadata = Object.fromEntries(
      metadataKeys.map((key) => [key, String(form.get(key) ?? "").trim()]),
    );
    const tags = String(form.get("tags") ?? "")
      .split(/[，,]/)
      .map((tag) => tag.trim())
      .filter(Boolean);

    setPending(true);
    setMessageKind("status");
    setMessage("正在递交审核队列…");
    try {
      await request<{ ok: true }>("/api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          regionSlug: region.slug,
          title: String(form.get("title") ?? ""),
          summary: String(form.get("summary") ?? ""),
          nickname: String(form.get("nickname") ?? ""),
          markdown: String(form.get("markdown") ?? ""),
          externalUrl: String(form.get("externalUrl") ?? "") || null,
          metadata,
          tags,
          website: String(form.get("website") ?? ""),
        }),
      });
      router.push("/submitted");
    } catch (error) {
      setMessageKind("alert");
      setMessage(
        error instanceof RequestError
          ? error.message
          : "投稿暂时没有进入审核队列，请稍后重试",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="submission-form" onSubmit={handleSubmit}>
      <input
        className="submission-form__trap"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
      />

      <label>
        标题
        <input name="title" maxLength={120} required />
      </label>

      <label>
        标签
        <input
          name="tags"
          placeholder="用逗号分隔，最多 5 个"
          maxLength={140}
          required
        />
      </label>

      <label>
        昵称
        <input name="nickname" maxLength={40} placeholder="可留空，公开显示匿名" />
      </label>

      {region.submissionFields
        .filter(({ name }) => !["title", "tags", "nickname"].includes(name))
        .map((field) => {
          if (field.kind === "select") {
            return (
              <label key={field.name}>
                {field.label}
                <select name={field.name} required={field.required}>
                  <option value="">请选择</option>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            );
          }

          if (field.kind === "markdown") {
            return (
              <label key={field.name} className="submission-form__wide">
                {field.label}
                <textarea
                  name="markdown"
                  maxLength={field.maxLength}
                  rows={10}
                  required={field.required}
                />
              </label>
            );
          }

          if (field.name === "summary") {
            return (
              <label key={field.name} className="submission-form__wide">
                {field.label}
                <textarea
                  name="summary"
                  maxLength={field.maxLength}
                  rows={4}
                  required={field.required}
                />
              </label>
            );
          }

          if (field.kind === "url") {
            return (
              <label key={field.name}>
                {field.label}
                <input
                  name={
                    field.name === "url"
                      ? "externalUrl"
                      : field.name === "demoUrl"
                        ? "externalUrl"
                        : field.name
                  }
                  type="url"
                  maxLength={field.maxLength}
                  placeholder="https://example.com"
                  required={field.required}
                />
              </label>
            );
          }

          return (
            <label key={field.name}>
              {field.label}
              <input name={field.name} maxLength={field.maxLength} required={field.required} />
            </label>
          );
        })}

      <div className="submission-form__actions">
        <p
          role={messageKind}
          aria-live={messageKind === "alert" ? "assertive" : "polite"}
        >
          {message}
        </p>
        <button type="submit" disabled={pending}>
          {pending ? "提交中" : "提交审核"}
        </button>
      </div>
    </form>
  );
}
