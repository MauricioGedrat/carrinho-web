import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Fonte Barlow Semi Condensed (licença OFL) guardada no projeto,
// assim o site funciona mesmo sem acesso ao Google Fonts
const barlow = localFont({
  variable: "--font-barlow",
  display: "swap",
  src: [
    { path: "./fontes/barlow-semi-condensed-latin-500-normal.woff2", weight: "500" },
    { path: "./fontes/barlow-semi-condensed-latin-600-normal.woff2", weight: "600" },
    { path: "./fontes/barlow-semi-condensed-latin-700-normal.woff2", weight: "700" },
    { path: "./fontes/barlow-semi-condensed-latin-800-normal.woff2", weight: "800" },
  ],
});

export const metadata: Metadata = {
  title: "Controle do carrinho",
  description:
    "Controle o carrinho de controle remoto do ESP32 pelo navegador, via Bluetooth (Web Bluetooth).",
};

export const viewport: Viewport = {
  themeColor: "#F6C500",
  width: "device-width",
  initialScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR" className={`${barlow.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
