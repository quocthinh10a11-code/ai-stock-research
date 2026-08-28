import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "vietnamese"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin", "vietnamese"], variable: "--font-jetbrains" });

export const metadata: Metadata = { title: "AI Stock Research", description: "Nghiên cứu cổ phiếu Việt Nam với dữ liệu và phân tích AI có dẫn nguồn." };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="vi"><body className={`${inter.variable} ${jetbrains.variable}`}>{children}</body></html>;
}
