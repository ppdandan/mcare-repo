import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/**
 * Inter font — clean, modern, great for dashboards.
 * We load the latin subset to keep the bundle small.
 */
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

/**
 * Page metadata for the M-Care admin dashboard.
 */
export const metadata: Metadata = {
  title: "M-Care Admin Dashboard",
  description: "OB-GYN Clinic Management System — Staff Dashboard",
};

/**
 * Root layout wraps the entire application.
 * Applies the Inter font and global styles to all pages.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`${inter.className} min-h-screen`}>{children}</body>
    </html>
  );
}
