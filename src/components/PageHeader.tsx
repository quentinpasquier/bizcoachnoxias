import type { ReactNode } from "react";

interface Props {
  eyebrow?: string;
  eyebrowGreen?: boolean;
  title: ReactNode; // Pour permettre des titres bicolores : "Hello " + <span color=green>name</span>
  subtitle?: ReactNode;
  action?: ReactNode;
  divider?: boolean;
}

export function PageHeader({
  eyebrow,
  eyebrowGreen = false,
  title,
  subtitle,
  action,
  divider = true,
}: Props) {
  return (
    <header className="flex items-end justify-between gap-6 flex-wrap">
      <div className="min-w-0 flex-1">
        {divider && !eyebrow && <span className="divider-green block mb-4" />}
        {eyebrow && (
          <div className={eyebrowGreen ? "eyebrow-green mb-2" : "eyebrow mb-2"}>
            {eyebrow}
          </div>
        )}
        <h1 className="text-h2" style={{ fontSize: "clamp(2rem, 4vw, 3rem)" }}>
          {title}
        </h1>
        {subtitle && (
          <p className="text-body-l mt-3" style={{ color: "var(--color-gray)" }}>
            {subtitle}
          </p>
        )}
      </div>
      {action && <div className="flex gap-3 shrink-0">{action}</div>}
    </header>
  );
}
