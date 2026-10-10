import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const dataDir = path.join(process.cwd(), 'data')
    const requestedId = decodeURIComponent(params.id)

    const files = [
      'cinesubz_result.json',
      'sinhalasub_result.json',
      'cartoons_lk_enhanced.json',
      'animekaizen_enhanced.json'
    ]

    for (const fileName of files) {
      const filePath = path.join(dataDir, fileName)
      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, 'utf-8')
          const items = JSON.parse(raw)
          if (Array.isArray(items)) {
            for (const item of items) {
              if (String(item.id) === requestedId || item.title === requestedId || encodeURIComponent(item.title) === requestedId) {
                return NextResponse.json({
                  id: String(item.id),
                  title: item.title,
                  poster: item.poster || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500',
                  description: item.description || `Watch ${item.title} on FilmFeed`,
                  category: item.category || 'Movie / Series',
                  quality: item.quality || 'HD',
                  year: item.year || '2024',
                  url: item.url,
                  details: item.details || {}
                })
              }
            }
          }
        } catch (e) {
          console.error(`Error reading ${fileName}:`, e)
        }
      }
    }

    // Default fallback
    return NextResponse.json({
      id: requestedId,
      title: requestedId.replace(/_/g, ' '),
      poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500',
      description: `Watch ${requestedId.replace(/_/g, ' ')} on FilmFeed`,
      category: 'Movie / Series',
      quality: '1080p / 720p',
      year: '2024'
    })
  } catch (error: any) {
    console.error('API Movie ID Error:', error)
    return NextResponse.json({ error: 'Failed to fetch movie details' }, { status: 500 })
  }
}
