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

    // Check across all datasets
    const files = ['cinesubz_result.json', 'cartoons_lk_enhanced.json', 'animekaizen_enhanced.json']

    for (const fileName of files) {
      const filePath = path.join(dataDir, fileName)
      if (fs.existsSync(filePath)) {
        try {
          const raw = fs.readFileSync(filePath, 'utf-8')
          const parsed = JSON.parse(raw)
          const items = Array.isArray(parsed) ? parsed : (parsed.movies || parsed.cards || [])

          for (let idx = 0; idx < items.length; idx++) {
            const item = items[idx]
            const id = item.post_id || item.id || `cartoons_${idx}_${encodeURIComponent(item.title)}` || `anime_${idx}_${encodeURIComponent(item.title)}`

            if (String(id) === requestedId || item.title === requestedId || encodeURIComponent(item.title) === requestedId) {
              const validPoster = (item.poster && item.poster.startsWith('http'))
                ? item.poster
                : (item.banner && item.banner.startsWith('http') ? item.banner : null)

              return NextResponse.json({
                id: String(id),
                title: item.title,
                poster: validPoster || 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500',
                description: item.description || `Watch ${item.title} on FilmFeed`,
                category: item.category || 'Movie / Series',
                quality: item.quality || 'HD',
                year: item.year || '2024',
                url: item.url,
                details: item.details || {}
              })
            }
          }
        } catch (e) {
          console.error(`Error reading ${fileName}:`, e)
        }
      }
    }

    // Default return if not explicitly found in json
    return NextResponse.json({
      id: requestedId,
      title: requestedId.replace(/_/g, ' '),
      poster: 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500',
      description: `Watch ${requestedId.replace(/_/g, ' ')} on FilmFeed`,
      category: 'Movie / Series',
      quality: '720p / 1080p',
      year: '2024',
      details: { Source: 'FilmFeed Library' }
    })
  } catch (error: any) {
    console.error('API Movie ID Error:', error)
    return NextResponse.json({ error: 'Failed to fetch movie details' }, { status: 500 })
  }
}
