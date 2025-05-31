
import type {Metadata, Viewport} from 'next';
import {Geist, Geist_Mono} from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/authContext';
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'BizFlow - Employee Management System',
  description: 'Comprehensive Employee Attendance, Payroll, Leave, and Task Management.',
  manifest: '/manifest.json', // Link to the manifest file
};

// Add viewport configuration for PWA theme color, etc.
export const viewport: Viewport = {
  themeColor: '#6D28D9', // Same as manifest.json theme_color
  // You can add more viewport settings here if needed
  // initialScale: 1,
  // width: 'device-width',
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          {children}
          <Toaster />
        </AuthProvider>
      </body>
    </html>
  );
}
