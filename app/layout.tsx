import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const incoming = await headers();
  const host = incoming.get("x-forwarded-host") || incoming.get("host") || "localhost:3000";
  const protocol = incoming.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const origin = protocol + "://" + host;
  const title = "GPEC Recherche | Université Paris-Saclay";
  const description = "Pilotage prospectif des emplois et compétences de recherche.";
  return {
    metadataBase: new URL(origin),
    title,
    description,
    icons: {
      icon: "/logo-upsaclay.png",
      shortcut: "/logo-upsaclay.png",
    },
    openGraph: {
      title,
      description,
      type: "website",
      images: [{ url: origin + "/og.png", width: 1736, height: 907, alt: "GPEC Recherche" }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [origin + "/og.png"],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
