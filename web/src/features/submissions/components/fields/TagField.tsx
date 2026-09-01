import type { SubmissionFieldDefinition } from "../../types";

type TagDefinition = Extract<SubmissionFieldDefinition, { kind: "tags" }>;

export function TagField({
  definition,
  error,
}: {
  definition: TagDefinition;
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
        使用中英文逗号分隔，最多 5 项，每项最多 {definition.maxLength} 个字符
      </p>
      <input
        id={id}
        name={definition.name}
        type="text"
        required={definition.required}
        autoComplete="off"
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
