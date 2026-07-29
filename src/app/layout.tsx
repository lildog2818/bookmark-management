import type { Metadata } from "next";
import type { Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import { ThemeProvider } from "@/lib/theme";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ParticlesBackground } from "@/components/particles-background";
import { ThemeInitScript } from "@/components/theme-init-script";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export const metadata: Metadata = {
  title: "书签管理",
  description: "优雅地管理您的浏览器书签",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("theme-id")||"default";var d={dark:true,sunset:true,slate:true};document.documentElement.setAttribute("data-theme",t);if(d[t])document.documentElement.classList.add("dark")}catch(e){}})()`,
          }}
        />
      </head>
      <body
        className={cn(
          geistSans.variable,
          geistMono.variable,
          "min-h-full antialiased bg-background text-foreground"
        )}
      >
        <TooltipProvider><ThemeProvider><ThemeInitScript /><ParticlesBackground />{children}</ThemeProvider></TooltipProvider>
      </body>
    </html>
  );
}