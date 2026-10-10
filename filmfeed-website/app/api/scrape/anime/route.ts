import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'

const execAsync = promisify(exec)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const query = searchParams.get('q') || ''
  const limit = searchParams.get('limit') || '10'

  try {
    const scraperPath = path.join(process.cwd(), '..', '..', 'enhanced_animekaizen_scraper.py')
    
    // Run Python scraper
    const { stdout, stderr } = await execAsync(
      `python "${scraperPath}" --search "${query}" --limit ${limit}`,
      { timeout: 60000 }
    )

    if (stderr) {
      console.error('Scraper stderr:', stderr)
    }

    // Parse JSON output
    let anime = []
    try {
      anime = JSON.parse(stdout)
    } catch (e) {
      console.error('Failed to parse scraper output:', e)
      anime = []
    }

    return NextResponse.json({
      success: true,
      source: 'animekaizen.org',
      count: anime.length,
      anime: anime
    })
  } catch (error: any) {
    console.error('AnimeKaizen scraper error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { url } = body

    if (!url) {
      return NextResponse.json({
        success: false,
        error: 'URL required'
      }, { status: 400 })
    }

    const scraperPath = path.join(process.cwd(), '..', '..', 'enhanced_animekaizen_scraper.py')
    
    const { stdout } = await execAsync(
      `python "${scraperPath}" --url "${url}"`,
      { timeout: 90000 }
    )

    const animeData = JSON.parse(stdout)

    return NextResponse.json({
      success: true,
      anime: animeData
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
