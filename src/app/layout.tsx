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
  title: "Noxias Coach · Entraînez vos commerciaux face aux vrais prospects",
  description:
    "Coach IA pour commerciaux. Simulez des appels de prospection avec un prospect non sollicité, mesurez votre performance, progressez.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" className={`${anton.variable} ${ubuntu.variable}`}>
      <body>{children}</body>
    </html>
  );
}
