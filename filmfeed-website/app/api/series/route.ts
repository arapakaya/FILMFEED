import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export async function GET() {
  try {
    const dataDir = path.join(process.cwd(), 'data')
    let series: any[] = []

    // 1. Read AnimeKaizen (Anime Series)
    const animePath = path.join(dataDir, 'animekaizen_enhanced.json')
    if (fs.existsSync(animePath)) {
      try {
        const raw = fs.readFileSync(animePath, 'utf-8')
        const items = JSON.parse(raw)
        if (Array.isArray(items)) {
          items.forEach((item: any, idx: number) => {
            const id = `anime_${idx}_${encodeURIComponent(item.title)}`
            series.push({
              id,
              title: item.title,
              poster: item.poster || item.banner,
              description: item.description || `Watch ${item.title} Anime Series with English Subtitles`,
              category: 'Anime',
              quality: 'HD',
              year: '2024',
              url: item.url,
              download_links: item.download_links || [],
              details: { type: 'Anime Series' }
            })
          })
        }
      } catch (e) {
        console.error('Error reading animekaizen_enhanced.json:', e)
      }
    }

    // 2. Add sample/popular TV series if needed
    if (series.length === 0) {
      series = [
        {
          id: 'avatar-last-airbender',
          title: 'Avatar: The Last Airbender (2024) TV Series',
          poster: 'https://cinesubz.lk/wp-content/uploads/2026/06/qOzznTQVBELUNgFBhlDHqs1KKSd.webp',
          description: 'A young boy known as the Avatar must master the four elemental powers...',
          category: 'TV Series',
          quality: '1080p',
          year: '2024',
          url: 'https://cinesubz.co/tvshows/avatar-the-last-airbender-2024-tv-s01/'
        }
      ]
    }

    return NextResponse.json({ series, count: series.length })
  } catch (error: any) {
    console.error('API Series Error:', error)
    return NextResponse.json({ series: [], error: error.message })
  }
}
