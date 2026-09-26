import type { Metadata } from "next"
import { Inter_Tight } from "next/font/google"

import { Toaster } from "@/components/ui/sonner"

import { AuthProvider } from "@/lib/supabase/auth-context"

import "./globals.css"

const interTight = Inter_Tight({
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter-tight",
  display: "swap",
})

export const metadata: Metadata = {
  title: {
    default: "OnixData — парсинг данных из мессенджеров",
    template: "%s · OnixData",
  },
  description:
    "OnixData собирает публичные сообщения из Viber и других мессенджеров, очищает их и превращает в структурированные данные.",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ru" className="dark" suppressHydrationWarning>
      <body className={`${interTight.variable} font-sans antialiased`}>
        <AuthProvider>
          {children}
        </AuthProvider>
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  )
}
