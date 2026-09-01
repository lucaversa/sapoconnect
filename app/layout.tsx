import type { Metadata, Viewport } from "next"
import { Plus_Jakarta_Sans } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { ThemeProvider } from "@/context/ThemeContext"
import { LiteLockedScreen } from "@/components/lite"
import { PwaRuntime } from "@/components/pwa-runtime"
import { getCurrentLiteAccessSnapshot } from "@/lib/server/lite-usage"

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const liteAccess = await getCurrentLiteAccessSnapshot()
  const isLiteSession = liteAccess.tier === "lite"

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${plusJakartaSans.className} antialiased`}>
        <ThemeProvider>
          <PwaRuntime />
          {liteAccess.state === "locked" ? (
            <LiteLockedScreen snapshot={liteAccess} />
          ) : isLiteSession ? (
            <div className="contents" data-sapoconnect-lite={liteAccess.state}>
              {children}
            </div>
          ) : (
            children
          )}
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
