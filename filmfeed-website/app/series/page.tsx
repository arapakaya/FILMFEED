'use client'

import { useState, useEffect } from 'react'
import MovieCard from '../components/MovieCard'
import SearchBar from '../components/SearchBar'

export default function SeriesPage() {
  const [series, setSeries] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchSeries()
  }, [])

  async function fetchSeries() {
    try {
      const response = await fetch('/api/series')
      const data = await response.json()
      setSeries(data.series || [])
    } catch (error) {
      console.error('Error fetching series:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredSeries = series.filter((item: any) =>
    item.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Top Banner AdsTerra Container */}
      <div className="mb-8 bg-gray-900 border border-gray-800 p-4 rounded-xl text-center overflow-hidden">
        <div id="container-2b2b0152bf2e6dc65de7161495e8eb8e"></div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
        <div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white">TV Series & Anime Section</h2>
          <p className="text-gray-400 text-sm mt-1">Discover popular TV Shows, Korean Dramas & Anime Series</p>
        </div>
        <div className="flex gap-2">
          <a href="/" className="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg font-bold text-sm">Movies</a>
          <a href="/series" className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold text-sm">TV Series & Anime</a>
        </div>
      </div>

      <SearchBar value={searchQuery} onChange={setSearchQuery} />

      {/* Mid AdsTerra Container */}
      <div className="my-8 bg-gray-900 border border-gray-800 p-3 rounded-xl text-center">
        <p className="text-xs text-gray-500 uppercase tracking-widest mb-1">Sponsored</p>
        <div id="container-2b2b0152bf2e6dc65de7161495e8eb8e"></div>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-gray-800 h-72 rounded-2xl"></div>
              <div className="bg-gray-800 h-4 mt-3 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
          {filteredSeries.map((item: any) => (
            <MovieCard key={item.id || item.url} movie={item} />
          ))}
        </div>
      )}

      {/* Bottom AdsTerra Container */}
      <div className="mt-12 bg-gray-900 border border-gray-800 p-4 rounded-xl text-center">
        <div id="container-2b2b0152bf2e6dc65de7161495e8eb8e"></div>
      </div>
    </div>
  )
}
