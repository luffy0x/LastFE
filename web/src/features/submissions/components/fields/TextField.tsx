import type { SubmissionFieldDefinition } from "../../types";

type TextDefinition = Extract<SubmissionFieldDefinition, { kind: "text" }>;

export function TextField({
  definition,
  error,
}: {
  definition: TextDefinition;
  error?: string;
}) {
  const id = `submission-${definition.name}`;
  const helperId = `${id}-helper`;
  const errorId = `${id}-error`;
  const describedBy = [definition.maxLength ? helperId : null, error ? errorId : null]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div className="submission-field">
      <label htmlFor={id}>
        {definition.label}
        {definition.required ? <span aria-hidden="true"> *</span> : null}
      </label>
      {definition.maxLength ? (
        <p id={helperId} className="submission-field__helper">
          最多 {definition.maxLength} 个字符
        </p>
      ) : null}
      <input
        id={id}
        name={definition.name}
        type="text"
        required={definition.required}
        maxLength={definition.maxLength}
        aria-describedby={describedBy}
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
