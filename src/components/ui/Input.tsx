import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, id, className = "", ...rest }, ref) => {
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label
            htmlFor={id}
            className="text-small font-medium"
            style={{ color: "var(--color-purple)" }}
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={id}
          className={`input ${error ? "border-[var(--color-error)]" : ""} ${className}`}
          {...rest}
        />
        {hint && !error && (
          <span className="text-meta" style={{ color: "var(--color-gray)" }}>
            {hint}
          </span>
        )}
        {error && (
          <span className="text-meta" style={{ color: "var(--color-error)" }}>
            {error}
          </span>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ label, hint, error, id, className = "", rows = 4, ...rest }, ref) => {
    return (
      <div className="flex flex-col gap-2">
        {label && (
          <label
            htmlFor={id}
            className="text-small font-medium"
            style={{ color: "var(--color-purple)" }}
          >
            {label}
          </label>
        )}
        <textarea
          ref={ref}
          id={id}
          rows={rows}
          className={`input resize-none ${
            error ? "border-[var(--color-error)]" : ""
          } ${className}`}
          {...rest}
        />
        {hint && !error && (
          <span className="text-meta" style={{ color: "var(--color-gray)" }}>
            {hint}
          </span>
        )}
        {error && (
          <span className="text-meta" style={{ color: "var(--color-error)" }}>
            {error}
          </span>
        )}
      </div>
    );
  },
);
Textarea.displayName = "Textarea";
