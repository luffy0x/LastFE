"use client";

import type {} from "altcha/types/react";

import type { RegionDefinition } from "@/features/map/types";
import type { SubmissionFieldDefinition } from "../types";
import { MarkdownField } from "./fields/MarkdownField";
import { SelectField } from "./fields/SelectField";
import { TagField } from "./fields/TagField";
import { TextField } from "./fields/TextField";
import { UrlField } from "./fields/UrlField";
import { useSubmissionForm } from "./useSubmissionForm";

function SubmissionField({
  definition,
  error,
}: {
  definition: SubmissionFieldDefinition;
  error?: string;
}) {
  switch (definition.kind) {
    case "text":
      return <TextField definition={definition} error={error} />;
    case "tags":
      return <TagField definition={definition} error={error} />;
    case "url":
      return <UrlField definition={definition} error={error} />;
    case "select":
      return <SelectField definition={definition} error={error} />;
    case "markdown":
      return <MarkdownField definition={definition} error={error} />;
    default: {
      const exhaustive: never = definition;
      return exhaustive;
    }
  }
}

export function SubmissionForm({ region }: { region: RegionDefinition }) {
  const {
    challenge,
    challengeError,
    fieldErrors,
    formMessage,
    handleSubmit,
    isSubmitting,
    refreshChallenge,
    widgetRef,
    verificationComplete,
  } = useSubmissionForm(region);

  return (
    <form className="submission-form" noValidate onSubmit={handleSubmit}>
      <div className="submission-form__fields">
        {region.submissionFields.map((definition) => (
          <SubmissionField
            key={definition.name}
            definition={definition}
            error={fieldErrors[definition.name]}
          />
        ))}
      </div>

      <div className="submission-form__trap" aria-hidden="true">
        <label htmlFor="submission-website">请勿填写此字段</label>
        <input
          id="submission-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      <section className="submission-verification" aria-labelledby="verification-title">
        <div>
          <h2 id="verification-title">人机验证</h2>
          <p>验证在本机完成，不加载第三方追踪脚本。</p>
        </div>
        {challenge ? (
          <div className="submission-verification__widget" key={challenge.signature}>
            <altcha-widget
              ref={widgetRef}
              data-testid="altcha-widget"
              challenge={JSON.stringify(challenge)}
              name="altcha"
              language="zh-cn"
              type="checkbox"
              auto="off"
              configuration={JSON.stringify({ hideFooter: true })}
            />
            <p className="submission-verification__status" role="status">
              {verificationComplete ? "验证完成" : "等待验证"}
            </p>
          </div>
        ) : challengeError ? (
          <div className="submission-verification__error" role="alert">
            <p>{challengeError}</p>
            <button type="button" onClick={() => void refreshChallenge()}>
              重新加载验证
            </button>
          </div>
        ) : (
          <p className="submission-verification__loading" role="status">
            正在加载验证…
          </p>
        )}
      </section>

      {formMessage ? (
        <p className="submission-form__message" role="alert" tabIndex={-1}>
          {formMessage}
        </p>
      ) : null}

      <div className="submission-form__actions">
        <p>提交后进入人工审核队列，请勿包含敏感或可识别个人的信息。</p>
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "正在提交…" : "提交审核"}
        </button>
      </div>
    </form>
  );
}
