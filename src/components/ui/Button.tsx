import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
}

const sizeClasses: Record<Size, string> = {
  sm: "text-small px-4 py-2",
  md: "text-body px-6 py-3",
  lg: "text-body-l px-7 py-4",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading,
      fullWidth,
      className = "",
      disabled,
      children,
      ...rest
    },
    ref,
  ) => {
    const variantClass = `btn-${variant}`;
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`btn ${variantClass} ${sizeClasses[size]} ${
          fullWidth ? "w-full" : ""
        } ${className}`}
        {...rest}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <span className="typing-dot" />
            <span className="typing-dot" />
            <span className="typing-dot" />
          </span>
        ) : (
          children
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
