'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Image from 'next/image'

export default function MoviePage() {
  const params = useParams()
  const [movie, setMovie] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [showQualityModal, setShowQualityModal] = useState(false)

  useEffect(() => {
    fetchMovie()
  }, [params.id])

  async function fetchMovie() {
    try {
      const response = await fetch(`/api/movies/${params.id}`)
      const data = await response.json()
      setMovie(data)
    } catch (error) {
      console.error('Error fetching movie:', error)
    } finally {
      setLoading(false)
    }
  }

  function handleRequestClick() {
    setShowQualityModal(true)
  }

  function sendToWhatsApp(quality: string) {
    const token = Math.random().toString(36).substring(2, 10)
    const message = `FilmFeed Request: ${movie.title} | Quality: ${quality} | Token: ${token}`
    const whatsappUrl = `https://wa.me/94760372547?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank')
    setShowQualityModal(false)
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-pulse space-y-6">
          <div className="bg-gray-800 h-96 rounded-2xl"></div>
          <div className="bg-gray-800 h-10 rounded w-2/3"></div>
          <div className="bg-gray-800 h-6 rounded w-1/3"></div>
        </div>
      </div>
    )
  }

  if (!movie) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
        <h2 className="text-3xl font-bold text-red-500">Movie Not Found</h2>
        <p className="text-gray-400 mt-2">The requested movie or series could not be loaded.</p>
        <a href="/" className="inline-block mt-6 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold">
          Back to Home
        </a>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Top Ad Container */}
      <div className="mb-8 bg-gray-900 border border-gray-800 p-4 rounded-xl text-center overflow-hidden">
        <div id="container-2b2b0152bf2e6dc65de7161495e8eb8e"></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        {/* Poster */}
        <div className="lg:col-span-1">
          <div className="relative h-[480px] rounded-2xl overflow-hidden bg-gray-800 shadow-2xl border border-gray-800 sticky top-24">
            {movie.poster ? (
              <Image
                src={movie.poster}
                alt={movie.title}
                fill
                className="object-cover"
                priority
                unoptimized
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500 font-semibold">
                No Poster Available
              </div>
            )}
            <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
              {movie.category || 'FilmFeed'}
            </div>
          </div>
        </div>

        {/* Details & Action */}
        <div className="lg:col-span-2 flex flex-col justify-between">
          <div>
            <h1 className="text-3xl md:text-5xl font-extrabold text-white leading-tight mb-4">
              {movie.title}
            </h1>

            <div className="flex flex-wrap items-center gap-3 mb-6">
              <span className="px-3.5 py-1.5 bg-red-600/20 text-red-400 border border-red-500/30 rounded-lg text-sm font-semibold">
                🎥 {movie.quality || '1080p / 720p'}
              </span>
              <span className="px-3.5 py-1.5 bg-gray-800 text-gray-300 rounded-lg text-sm font-medium">
                📅 {movie.year || '2024'}
              </span>
              <span className="px-3.5 py-1.5 bg-green-900/30 text-green-400 border border-green-500/30 rounded-lg text-sm font-medium">
                ⚡ Direct WhatsApp Download
              </span>
            </div>

            {/* Middle Ad Container */}
            <div className="my-6 bg-gray-900/80 border border-gray-800 p-3 rounded-xl text-center">
              <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Sponsored</p>
              <div id="container-2b2b0152bf2e6dc65de7161495e8eb8e"></div>
            </div>

            <div className="bg-gray-800/60 border border-gray-800 rounded-2xl p-6 mb-8 backdrop-blur">
              <h2 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                <span>📖</span> Synopsis / Storyline
              </h2>
              <p className="text-gray-300 leading-relaxed text-base">
                {movie.description || 'No description available for this title.'}
              </p>
            </div>
          </div>

          {/* Request Button Action */}
          <div className="bg-gradient-to-r from-red-900/40 to-black p-6 rounded-2xl border border-red-800/50">
            <h3 className="text-lg font-semibold text-white mb-2">Want to watch on WhatsApp?</h3>
            <p className="text-sm text-gray-400 mb-6">
              Click below to select your preferred video quality. The FilmFeed bot will download and upload it as a file directly into your WhatsApp group!
            </p>

            <button
              onClick={handleRequestClick}
              className="w-full py-5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-extrabold text-xl rounded-xl shadow-xl transition-all transform hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-3"
            >
              <svg className="w-7 h-7 text-green-400" fill="currentColor" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
              </svg>
              REQUEST MOVIE TO WHATSAPP
            </button>
          </div>

          {/* Bottom Ad Container */}
          <div className="mt-8 bg-gray-900 border border-gray-800 p-4 rounded-xl text-center">
            <div id="container-2b2b0152bf2e6dc65de7161495e8eb8e"></div>
          </div>
        </div>
      </div>

      {/* Quality Selection Modal */}
      {showQualityModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-gray-900 rounded-2xl max-w-md w-full p-6 border border-gray-800 shadow-2xl">
            <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <span>🎥</span> Select Video Quality
              </h3>
              <button
                onClick={() => setShowQualityModal(false)}
                className="text-gray-400 hover:text-white text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-gray-400 mb-4">
              Select video quality to open WhatsApp and request bot processing for <strong className="text-white">{movie.title}</strong>:
            </p>

            <div className="space-y-3">
              {[
                { name: '1080p Full HD', val: '1080p', desc: 'Best Quality (Recommended)' },
                { name: '720p HD', val: '720p', desc: 'Balanced Quality & Size' },
                { name: '480p SD', val: '480p', desc: 'Smaller File Size' },
                { name: '360p Mobile', val: '360p', desc: 'Fast Download' },
              ].map((q) => (
                <button
                  key={q.val}
                  onClick={() => sendToWhatsApp(q.val)}
                  className="w-full p-4 bg-gray-800 hover:bg-red-600 rounded-xl font-semibold transition text-left flex justify-between items-center group"
                >
                  <div>
                    <div className="text-white font-bold group-hover:text-white">{q.name}</div>
                    <div className="text-xs text-gray-400 group-hover:text-red-100">{q.desc}</div>
                  </div>
                  <span className="text-sm bg-gray-700 group-hover:bg-red-700 text-white px-3 py-1 rounded-lg">
                    Select
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowQualityModal(false)}
              className="w-full mt-6 py-3 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl font-medium transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
