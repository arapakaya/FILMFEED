import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(request: Request) {
  try {
    const dataDir = path.join(process.cwd(), 'data')
    let series: any[] = []
    const seen = new Set()

    const files = [
      { name: 'cinesubz_result.json', filterTV: true },
      { name: 'animekaizen_enhanced.json', filterTV: false }
    ]

    for (const file of files) {
      const filePath = path.join(dataDir, file.name)
      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, 'utf-8')
          const items = JSON.parse(raw)
          if (Array.isArray(items)) {
            items.forEach((item: any) => {
              if (file.filterTV && item.category !== 'TV Series') return
              const id = item.id || encodeURIComponent(item.title)
              if (!seen.has(id) && item.title) {
                seen.add(id)
                series.push({
                  id: String(id),
                  title: item.title,
                  poster: item.poster || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500',
                  description: item.description || `Watch ${item.title} TV Series / Anime on FilmFeed`,
                  category: item.category || 'TV Series / Anime',
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

    return NextResponse.json({ series, count: series.length })
  } catch (error: any) {
    console.error('API Series Error:', error)
    return NextResponse.json({ series: [], error: error.message })
  }
}
