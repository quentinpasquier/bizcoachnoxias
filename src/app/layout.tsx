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
  title: "Noxias Coach · Ton coach commercial",
  description:
    "Ton coach commercial. Entraîne-toi face à de vrais prospects, mesure ta progression, décroche plus de RDV.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  applicationName: "Noxias Coach",
  appleWebApp: {
    capable: true,
    title: "Noxias Coach",
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
