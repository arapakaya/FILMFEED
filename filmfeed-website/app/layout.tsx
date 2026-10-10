import type { Metadata } from 'next'
import './globals.css'

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

        <nav className="bg-black/90 border-b border-gray-800 sticky top-0 z-50 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <a href="/" className="flex items-center gap-2 group">
                <span className="text-2xl font-black bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent group-hover:from-red-400 group-hover:to-red-500 transition">
                  FILMFEED
                </span>
                <span className="text-[10px] uppercase font-extrabold bg-red-600 text-white px-2 py-0.5 rounded-full">
                  BOT ACTIVE
                </span>
              </a>
              <div className="flex items-center space-x-6 text-sm font-semibold">
                <a href="/" className="hover:text-red-500 transition text-gray-200">Movies</a>
                <a href="/series" className="hover:text-red-500 transition text-gray-200">TV Series & Anime</a>
                <a
                  href="https://wa.me/94760372547"
                  target="_blank"
                  rel="noreferrer"
                  className="bg-green-600 hover:bg-green-500 text-white px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition text-xs"
                >
                  <span>💬</span> Bot: 0760372547
                </a>
              </div>
            </div>
          </div>
        </nav>

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
