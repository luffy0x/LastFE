"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { RegionDefinition } from "@/features/map/types";
import { request, RequestError } from "@/utils/request";

type SubmissionFormProps = {
  region: RegionDefinition;
};

const FIELD_LABELS: Record<string, string> = {
  companyDepartment: "公司/部门",
  position: "岗位",
  category: "知识分类",
  techStack: "技术栈",
  source: "来源",
  difficulty: "难度",
};

function metadataKeysFor(region: RegionDefinition): readonly string[] {
  return region.summaryFields.filter((key) => key !== "tags");
}

function needsMarkdown(region: RegionDefinition): boolean {
  return region.schemaKey !== "resource";
}

function acceptsExternalUrl(region: RegionDefinition): boolean {
  return ["resource", "project", "algorithm"].includes(region.schemaKey);
}

export function SubmissionForm({ region }: SubmissionFormProps) {
  const router = useRouter();
  const metadataKeys = useMemo(() => metadataKeysFor(region), [region]);
  const [message, setMessage] = useState("");
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

      {metadataKeys.map((key) => (
        <label key={key}>
          {FIELD_LABELS[key] ?? key}
          <input name={key} maxLength={120} required />
        </label>
      ))}

      {acceptsExternalUrl(region) ? (
        <label>
          外部链接
          <input
            name="externalUrl"
            type="url"
            placeholder="https://example.com"
            required={region.schemaKey === "resource"}
          />
        </label>
      ) : null}

      <label className="submission-form__wide">
        简介
        <textarea name="summary" maxLength={2000} rows={4} />
      </label>

      {needsMarkdown(region) ? (
        <label className="submission-form__wide">
          Markdown 正文
          <textarea name="markdown" maxLength={50 * 1024} rows={10} required />
        </label>
      ) : null}

      <div className="submission-form__actions">
        <p role="status" aria-live="polite">
          {message}
        </p>
        <button type="submit" disabled={pending}>
          {pending ? "递交中" : "递交待审核情报"}
        </button>
      </div>
    </form>
  );
}
