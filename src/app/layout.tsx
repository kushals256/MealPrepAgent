import type { Metadata, Viewport } from "next";
import { Fraunces, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const display = Fraunces({ variable: "--font-display-face", subsets: ["latin"], weight: ["500", "600", "700"] });
const body = Plus_Jakarta_Sans({ variable: "--font-body", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Rasoi — talk to Meera, your kitchen planner",
  description: "A voice agent that plans an Indian household's week of meals, builds the grocery list and walks the cook through it every day.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#fbf6ec" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable} antialiased`}>{children}</body>
    </html>
  );
}
