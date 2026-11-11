import type { Metadata } from "next";
import "./globals.css";

/**
 * Page metadata for the M-Care admin dashboard.
 */
export const metadata: Metadata = {
  title: "M-Care Admin Dashboard",
  description: "OB-GYN Clinic Management System — Staff Dashboard",
};

/**
 * Root layout wraps the entire application.
 * Uses clean system font stack for instant zero-dependency loading.
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="mcare">
      <body className="min-h-screen font-sans antialiased text-gray-900 bg-gray-50">{children}</body>
    </html>
  );
}
