import { CoachAvatar } from "@/components/CoachAvatar";

interface AvatarProps {
  src?: string | null;
  name?: string | null;
  size?: number;
  ring?: boolean;
}

function initialsFrom(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.charAt(0).toUpperCase();
  return (parts[0]!.charAt(0) + parts[parts.length - 1]!.charAt(0)).toUpperCase();
}

export function Avatar({ src, name, size = 36, ring = false }: AvatarProps) {
  const initials = initialsFrom(name);
  const fontSize = Math.max(11, Math.round(size * 0.36));
  const ringStyle = ring
    ? { boxShadow: "0 0 0 2px var(--color-green), 0 0 0 4px rgba(60, 200, 121, 0.18)" }
    : undefined;

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name ?? "Avatar"}
        width={size}
        height={size}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size, ...ringStyle }}
      />
    );
  }

  if (!name) {
    return <CoachAvatar state="idle" size={size} />;
  }

  return (
    <div
      className="rounded-full flex items-center justify-center font-semibold shrink-0"
      style={{
        width: size,
        height: size,
        background:
          "linear-gradient(135deg, var(--color-purple) 0%, var(--color-purple-dark, #5a3a8a) 100%)",
        color: "#FFFFFF",
        fontSize,
        letterSpacing: "0.02em",
        ...ringStyle,
      }}
      aria-label={name}
    >
      {initials}
    </div>
  );
}
