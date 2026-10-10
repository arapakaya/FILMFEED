'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function Header() {
  const [menuOpen, setMenuOpen] = useState(false)

  const categories = [
    { name: '🎬 Movies', href: '/?cat=movie', desc: 'Latest English & Sinhala Subtitled Movies' },
    { name: '📺 TV Series', href: '/series?cat=tv', desc: 'Top Rated TV Shows & Web Series' },
    { name: '🎙️ Sinhala Dubbed', href: '/?cat=dubbed', desc: 'Sinhala Dubbed Movies & Cartoons' },
    { name: '🐉 Anime', href: '/series?cat=anime', desc: 'Popular Anime Movies & Ova' },
    { name: '⚔️ Anime Series', href: '/series?cat=anime-series', desc: 'Trending Anime Seasons & Episodes' },
  ]

  return (
    <nav className="bg-black/95 border-b border-gray-800 sticky top-0 z-50 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <span className="text-2xl font-black bg-gradient-to-r from-red-500 to-red-600 bg-clip-text text-transparent group-hover:from-red-400 group-hover:to-red-500 transition">
              FILMFEED
            </span>
            <span className="text-[10px] uppercase font-extrabold bg-red-600 text-white px-2 py-0.5 rounded-full shadow">
              BOT ACTIVE
            </span>
          </Link>

          {/* Desktop Nav & Hamburger Button */}
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-6 text-sm font-semibold mr-2">
              <Link href="/" className="hover:text-red-500 transition text-gray-200">Movies</Link>
              <Link href="/series" className="hover:text-red-500 transition text-gray-200">TV Series & Anime</Link>
              <a
                href="https://wa.me/94760372547"
                target="_blank"
                rel="noreferrer"
                className="bg-green-600 hover:bg-green-500 text-white px-3.5 py-1.5 rounded-xl font-bold flex items-center gap-1.5 transition text-xs shadow"
              >
                <span>💬</span> Bot: 0760372547
              </a>
            </div>

            {/* Hamburger Button (Right Corner) */}
            <button
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-2.5 bg-gray-900 hover:bg-red-600 text-white rounded-xl border border-gray-800 hover:border-red-500 transition-all flex items-center justify-center gap-2 group"
              aria-label="Toggle Menu"
            >
              <div className="space-y-1">
                <span className={`block w-5 h-0.5 bg-white transition-transform ${menuOpen ? 'rotate-45 translate-y-1.5' : ''}`}></span>
                <span className={`block w-5 h-0.5 bg-white transition-opacity ${menuOpen ? 'opacity-0' : ''}`}></span>
                <span className={`block w-5 h-0.5 bg-white transition-transform ${menuOpen ? '-rotate-45 -translate-y-1.5' : ''}`}></span>
              </div>
              <span className="text-xs font-bold uppercase tracking-wider hidden sm:inline text-gray-300 group-hover:text-white">
                Menu
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Slide-over / Modal Hamburger Menu */}
      {menuOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/80 backdrop-blur-sm transition-opacity">
          <div className="w-full max-w-sm bg-gray-950 border-l border-gray-800 h-full p-6 flex flex-col justify-between shadow-2xl overflow-y-auto">
            <div>
              <div className="flex justify-between items-center pb-6 border-b border-gray-800 mb-6">
                <div>
                  <h3 className="text-xl font-black text-red-500">FILMFEED</h3>
                  <p className="text-xs text-gray-400">Categories & Sections</p>
                </div>
                <button
                  onClick={() => setMenuOpen(false)}
                  className="p-2 bg-gray-900 hover:bg-gray-800 text-gray-300 hover:text-white rounded-xl font-bold transition"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest px-1">
                  Categories
                </p>

                {categories.map((cat) => (
                  <Link
                    key={cat.name}
                    href={cat.href}
                    onClick={() => setMenuOpen(false)}
                    className="block p-3.5 bg-gray-900/80 hover:bg-red-600/90 border border-gray-800 hover:border-red-500 rounded-xl transition group"
                  >
                    <div className="font-bold text-white group-hover:text-white text-base">
                      {cat.name}
                    </div>
                    <div className="text-xs text-gray-400 group-hover:text-red-100 mt-0.5">
                      {cat.desc}
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-gray-800 mt-6 text-center">
              <a
                href="https://wa.me/94760372547"
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition text-sm shadow"
              >
                <span>💬</span> WhatsApp Bot: 0760372547
              </a>
              <p className="text-[11px] text-gray-500 mt-3">
                © 2026 FilmFeed • Direct WhatsApp Downloader
              </p>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
