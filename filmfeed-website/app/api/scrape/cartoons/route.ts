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
    const scraperPath = path.join(process.cwd(), '..', '..', 'enhanced_cartoons_scraper.py')
    
    // Run Python scraper
    const { stdout, stderr } = await execAsync(
      `python "${scraperPath}" --search "${query}" --limit ${limit}`,
      { timeout: 60000 }
    )

    if (stderr) {
      console.error('Scraper stderr:', stderr)
    }

    // Parse JSON output from scraper
    let movies = []
    try {
      movies = JSON.parse(stdout)
    } catch (e) {
      console.error('Failed to parse scraper output:', e)
      movies = []
    }

    return NextResponse.json({
      success: true,
      source: 'cartoons.lk',
      count: movies.length,
      movies: movies
    })
  } catch (error: any) {
    console.error('Cartoons.lk scraper error:', error)
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

    const scraperPath = path.join(process.cwd(), '..', '..', 'enhanced_cartoons_scraper.py')
    
    const { stdout } = await execAsync(
      `python "${scraperPath}" --url "${url}"`,
      { timeout: 90000 }
    )

    const movieData = JSON.parse(stdout)

    return NextResponse.json({
      success: true,
      movie: movieData
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
