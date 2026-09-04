import type { SubmissionFieldDefinition } from "../../types";

type UrlDefinition = Extract<SubmissionFieldDefinition, { kind: "url" }>;

export function UrlField({
  definition,
  error,
}: {
  definition: UrlDefinition;
  error?: string;
}) {
  const id = `submission-${definition.name}`;
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;

  return (
    <div className="submission-field">
      <label htmlFor={id}>
        {definition.label}
        {definition.required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <p id={helperId} className="submission-field__helper">
        使用完整的 http 或 https 地址
      </p>
      <input
        id={id}
        name={definition.name}
        type="url"
        inputMode="url"
        required={definition.required}
        maxLength={definition.maxLength}
        aria-describedby={`${helperId}${error ? ` ${errorId}` : ""}`}
        aria-invalid={error ? "true" : undefined}
      />
      {error ? (
        <p id={errorId} className="submission-field__error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
