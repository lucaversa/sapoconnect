import type { Metadata, Viewport } from "next"
import { Plus_Jakarta_Sans } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { ThemeProvider } from "@/context/ThemeContext"
import { Own3dScreen } from "@/components/own3d/Own3dScreen"
import { PwaRuntime } from "@/components/pwa-runtime"
import { isOwn3dSession } from "@/lib/server/own3d-session"

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
  const showOwn3dScreen = await isOwn3dSession()

  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${plusJakartaSans.className} antialiased`}>
        {showOwn3dScreen ? (
          <Own3dScreen />
        ) : (
          <>
            <ThemeProvider>
              <PwaRuntime />
              {children}
            </ThemeProvider>
            <Analytics />
          </>
        )}
      </body>
    </html>
  )
}
