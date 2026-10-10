import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(request: Request) {
  try {
    const dataDir = path.join(process.cwd(), 'data')
    let movies: any[] = []

    // 1. Read CineSubz Movies
    const cinesubzPath = path.join(dataDir, 'cinesubz_result.json')
    if (fs.existsSync(cinesubzPath)) {
      try {
        const raw = fs.readFileSync(cinesubzPath, 'utf-8')
        const parsed = JSON.parse(raw)
        const items = Array.isArray(parsed) ? parsed : (parsed.movies || parsed.cards || [])
        items.forEach((item: any) => {
          const id = item.post_id || item.id || encodeURIComponent(item.title || item.url)
          movies.push({
            id: String(id),
            title: item.title,
            poster: item.poster || item.banner,
            description: item.description || `Watch ${item.title} with Sinhala Subtitles`,
            category: 'Movie',
            quality: item.quality || 'HD',
            year: item.year || '2024',
            url: item.url,
            details: item.details || {}
          })
        })
      } catch (e) {
        console.error('Error reading cinesubz_result.json:', e)
      }
    }

    // 2. Read Cartoons.lk (Sinhala Dubbed Movies & Cartoons)
    const cartoonsPath = path.join(dataDir, 'cartoons_lk_enhanced.json')
    if (fs.existsSync(cartoonsPath)) {
      try {
        const raw = fs.readFileSync(cartoonsPath, 'utf-8')
        const items = JSON.parse(raw)
        if (Array.isArray(items)) {
          items.forEach((item: any, idx: number) => {
            const id = `cartoons_${idx}_${encodeURIComponent(item.title)}`
            const validPoster = (item.banner && item.banner.startsWith('http')) ? item.banner : (item.poster && item.poster.startsWith('http') ? item.poster : null)
            movies.push({
              id,
              title: item.title,
              poster: validPoster || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500',
              description: item.description || 'Sinhala Dubbed Movie / Cartoon',
              category: 'Sinhala Dubbed',
              quality: 'Sinhala Dub',
              year: '2024',
              url: item.url,
              details: { language: 'Sinhala Dubbed' }
            })
          })
        }
      } catch (e) {
        console.error('Error reading cartoons_lk_enhanced.json:', e)
      }
    }

    // Fallback data if empty
    if (movies.length === 0) {
      movies = [
        {
          id: 'avatar-way-of-water',
          title: 'Avatar: The Way of Water (2022) Sinhala Subtitles',
          poster: 'https://cinesubz.lk/wp-content/uploads/2026/03/t6HIqrRAclMCA60NsSmeqe9RmNV.jpg',
          description: 'Set more than a decade after the events of the first film...',
          category: 'Movie',
          quality: '720p / 1080p',
          year: '2022',
          url: 'https://cinesubz.co/movies/avatar-the-way-of-water-2022-sinhala-subtitles/'
        }
      ]
    }

    return NextResponse.json({ movies, count: movies.length })
  } catch (error: any) {
    console.error('API Movies Error:', error)
    return NextResponse.json({ movies: [], error: error.message })
  }
}
