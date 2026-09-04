import type { SubmissionFieldDefinition } from "../../types";

type SelectDefinition = Extract<SubmissionFieldDefinition, { kind: "select" }>;

export function SelectField({
  definition,
  error,
}: {
  definition: SelectDefinition;
  error?: string;
}) {
  const id = `submission-${definition.name}`;
  const errorId = `${id}-error`;

  return (
    <div className="submission-field">
      <label htmlFor={id}>
        {definition.label}
        {definition.required ? <span aria-hidden="true"> *</span> : null}
      </label>
      <select
        id={id}
        name={definition.name}
        required={definition.required}
        defaultValue=""
        aria-describedby={error ? errorId : undefined}
        aria-invalid={error ? "true" : undefined}
      >
        <option value="" disabled>
          请选择
        </option>
        {definition.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? (
        <p id={errorId} className="submission-field__error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
