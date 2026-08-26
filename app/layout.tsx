import type { Metadata } from "next";
import { Geist, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin", "latin-ext"], variable: "--font-geist" });
const inter = Inter({ subsets: ["latin", "vietnamese"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin", "vietnamese"], variable: "--font-jetbrains" });

export const metadata: Metadata = { title: "AI Stock Research", description: "AI-assisted Vietnamese stock market research." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><head><link href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined" rel="stylesheet" /></head><body className={`${geist.variable} ${inter.variable} ${jetbrains.variable}`}>{children}</body></html>;
}
