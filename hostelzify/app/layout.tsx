import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "../contexts/AuthContext";
import { AlertSocketProvider } from "../contexts/AlertSocketContext";
import ToastContainer from "../components/Toast";
import ConfirmModal from "../components/ConfirmModal";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Hostel Management System",
  description: "Hostel Management System - Manage your hostel efficiently",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          <AlertSocketProvider>
            {children}
            <ToastContainer />
            <ConfirmModal />
          </AlertSocketProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
