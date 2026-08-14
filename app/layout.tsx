import type { Metadata, Viewport } from "next"
import { Plus_Jakarta_Sans } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/context/ThemeContext"
import { PwaRuntime } from "@/components/pwa-runtime"

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
})

export const metadata: Metadata = {
  title: "SapoConnect",
  description: "Alternativa otimizada ao EduConnect",
  icons: {
    icon: "/brand/sapoconnect-icon-192.png",
    apple: "/brand/sapoconnect-icon-192.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "SapoConnect",
  },
}

export const viewport: Viewport = {
  themeColor: "#0c111d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${plusJakartaSans.className} antialiased`}>
        <ThemeProvider>
          <PwaRuntime />
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
