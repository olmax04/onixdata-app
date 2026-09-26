import type { Metadata } from "next"
import { Inter_Tight } from "next/font/google"

import { Toaster } from "@/components/ui/sonner"
import { AuthProvider } from "@/components/auth/auth-provider"

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
    "OnixData собирает публичные сообщения из Telegram, WhatsApp и Discord, очищает их и превращает в структурированные датасеты.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-icon.png",
  },
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
          <Toaster position="top-right" richColors closeButton />
        </AuthProvider>
      </body>
    </html>
  )
}
