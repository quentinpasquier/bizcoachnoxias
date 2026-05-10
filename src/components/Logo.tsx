interface LogoProps {
  variant?: "dark" | "light" | "mono";
  size?: number;
}

// dark = sur fond sombre (header app, login) -> logo blanc
// light = sur fond clair (carte profil, etc.)  -> logo violet
export function Logo({ variant = "dark", size = 32 }: LogoProps) {
  const src =
    variant === "light" ? "/logos/noxias-purple.svg" : "/logos/noxias-white.svg";

  // Logos exportés en 1200x675 (16:9) -> on fixe la hauteur, largeur auto.
  const height = size;
  const width = Math.round(size * (1200 / 675));

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt="Noxias"
      width={width}
      height={height}
      style={{ height, width: "auto", display: "block" }}
      draggable={false}
    />
  );
}
