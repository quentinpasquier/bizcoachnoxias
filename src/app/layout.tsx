import type { Metadata } from "next";
import { Anton, Ubuntu } from "next/font/google";
import "./globals.css";

const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});

const ubuntu = Ubuntu({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-ubuntu",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CALLAB · Ton coach commercial signé Noxias",
  description:
    "Le coach commercial de Quentin Pasquier, fondateur de Noxias. 10 000+ calls analysés, branché sur la production de l'agence. Entraîne-toi face à de vrais prospects, mesure ta progression, décroche plus de RDV.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  applicationName: "CALLAB",
  appleWebApp: {
    capable: true,
    title: "CALLAB",
    statusBarStyle: "default",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${anton.variable} ${ubuntu.variable}`}>
      <body>{children}</body>
    </html>
  );
}
