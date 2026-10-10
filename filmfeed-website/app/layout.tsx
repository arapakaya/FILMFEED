import type { Metadata } from 'next'
import './globals.css'
import Header from './components/Header'

export const metadata: Metadata = {
  title: 'FilmFeed - Free Movies, TV Series & Sinhala Dubbed Downloads',
  description: 'Download latest Movies, TV Series, Anime and Sinhala Dubbed Cartoons directly to WhatsApp.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        {/* AdsTerra Scripts */}
        <script async data-cfasync="false" src="https://pl31721005.profitableratecpmnetwork.com/2b2b0152bf2e6dc65de7161495e8eb8e/invoke.js"></script>
        <script src="https://pl31721006.profitableratecpmnetwork.com/85/1c/a4/851ca45e64bf48597a884931231569f0.js"></script>
        <script src="https://pl31721007.profitableratecpmnetwork.com/b9/ba/9a/b9ba9ade6d03e3abc2cdcb8be5f127f7.js"></script>
      </head>
      <body className="bg-black text-gray-100 min-h-screen flex flex-col antialiased">
        {/* Global Top Ad Banner */}
        <div id="container-2b2b0152bf2e6dc65de7161495e8eb8e"></div>

        {/* Navigation Bar with Hamburger Menu */}
        <Header />

        <main className="flex-1">
          {children}
        </main>

        <footer className="bg-gray-950 border-t border-gray-800 mt-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div>
                <h3 className="text-xl font-bold text-red-500">FILMFEED</h3>
                <p className="text-xs text-gray-400 mt-1">Direct WhatsApp Movie & TV Series Downloader</p>
              </div>
              <div className="text-center md:text-right text-gray-400 text-xs">
                <p>© 2026 FilmFeed. All rights reserved.</p>
                <p className="mt-1 font-semibold text-green-400">WhatsApp Bot Number: 076 037 2547</p>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
