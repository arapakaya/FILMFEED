import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(request: Request) {
  try {
    const dataDir = path.join(process.cwd(), 'data')
    let movies: any[] = []
    const seen = new Set()

    const files = [
      { name: 'cinesubz_result.json', category: 'Movie' },
      { name: 'sinhalasub_result.json', category: 'SinhalaSub Movie' },
      { name: 'cartoons_lk_enhanced.json', category: 'Sinhala Dubbed' }
    ]

    for (const file of files) {
      const filePath = path.join(dataDir, file.name)
      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, 'utf-8')
          const items = JSON.parse(raw)
          if (Array.isArray(items)) {
            items.forEach((item: any) => {
              if (item.category === 'TV Series') return // Skip TV series on movies route
              const id = item.id || encodeURIComponent(item.title)
              if (!seen.has(id) && item.title) {
                seen.add(id)
                movies.push({
                  id: String(id),
                  title: item.title,
                  poster: item.poster || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500',
                  description: item.description || `Watch ${item.title} with Sinhala Subtitles / Sinhala Dubbed`,
                  category: item.category || file.category,
                  quality: item.quality || 'HD',
                  year: item.year || '2024',
                  url: item.url
                })
              }
            })
          }
        } catch (e) {
          console.error(`Error reading ${file.name}:`, e)
        }
      }
    }

    return NextResponse.json({ movies, count: movies.length })
  } catch (error: any) {
    console.error('API Movies Error:', error)
    return NextResponse.json({ movies: [], error: error.message })
  }
}
