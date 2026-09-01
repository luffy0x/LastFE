import type { SubmissionFieldDefinition } from "../../types";

type MarkdownDefinition = Extract<
  SubmissionFieldDefinition,
  { kind: "markdown" }
>;

export function MarkdownField({
  definition,
  error,
}: {
  definition: MarkdownDefinition;
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
        支持 Markdown，UTF-8 内容不超过 50 KiB
      </p>
      <textarea
        id={id}
        name={definition.name}
        required={definition.required}
        rows={12}
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
