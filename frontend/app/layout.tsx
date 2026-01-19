import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Foil Lab - Wingfoil Track Analysis",
  description: "Analyze your wingfoil sessions with advanced wind and performance metrics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
          integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY="
          crossOrigin=""
        />
      </head>
      <body className={inter.className} suppressHydrationWarning>
        <Providers>
          <nav className="bg-white shadow-sm border-b">
            <div className="container mx-auto px-4">
              <div className="flex justify-between items-center h-16">
                <a href="https://wrenchat.work" className="text-xl font-bold text-gray-900 hover:text-gray-700">
                  Foil Lab
                </a>
                <span className="text-sm text-gray-500">
                  Beta
                </span>
              </div>
            </div>
          </nav>
          {children}
        </Providers>
      </body>
    </html>
  );
}
