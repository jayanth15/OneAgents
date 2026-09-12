import { Geist, Geist_Mono, Inter } from "next/font/google"
import "./globals.css"
import "@copilotkit/react-ui/styles.css"
import { ThemeProvider } from "@/components/theme-provider"
import { CopilotProvider } from "@/components/CopilotProvider"
import { AppNavigation } from "@/components/AppNavigation"
import { cn } from "@/lib/utils"

const inter = Inter({subsets:['latin'],variable:'--font-sans'})
const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={cn("antialiased", fontMono.variable, "font-sans", inter.variable)}
    >
      <body className="flex h-screen w-screen overflow-hidden bg-background text-foreground font-sans">
        <ThemeProvider>
          <CopilotProvider>
            <div className="flex h-screen w-screen overflow-hidden">
              <AppNavigation />
              <main className="flex-1 flex h-screen overflow-hidden">{children}</main>
            </div>
          </CopilotProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
