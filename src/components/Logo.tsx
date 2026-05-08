interface LogoProps {
  variant?: "dark" | "light" | "mono";
  size?: number;
  withWordmark?: boolean;
}

const LOGO_URL = "https://onboarding-noxias.vercel.app/brand/logo.svg";

// Le SVG officiel Noxias contient déjà logotype + losange. Sur fond foncé
// (variante dark) on l'utilise tel quel. Sur fond clair, on inverse les
// couleurs via filter (c'est le SVG qui est sombre par défaut donc on
// l'éclaircit pour le fond clair via `filter: invert()` n'est pas
// approprié ici car ça change la teinte. On utilise plutôt la même image,
// c'est la lecture qui change selon le fond).
//
// Tant que les variantes "logo blanc" et "logo violet" ne sont pas
// disponibles à des URLs séparées, on assume que le SVG fourni est conçu
// pour fond clair (logotype violet + accent vert) et on bascule en blanc
// via mix-blend-mode si besoin.
export function Logo({ variant = "dark", size = 32 }: LogoProps) {
  const height = Math.round(size * 1.6);

  // Sur fond foncé (dark), on bascule la teinte du logo en blanc en
  // utilisant un filtre. Sur fond clair (light), on garde l'original.
  // mono : tout en blanc.
  const filter =
    variant === "dark"
      ? "brightness(0) invert(1)"
      : variant === "mono"
        ? "brightness(0) invert(1)"
        : "none";

  return (
    <img
      src={LOGO_URL}
      alt="Noxias"
      style={{
        height: `${height}px`,
        width: "auto",
        display: "block",
        filter,
      }}
    />
  );
}
