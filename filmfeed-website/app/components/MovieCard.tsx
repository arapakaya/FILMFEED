import Link from 'next/link'
import Image from 'next/image'

export default function MovieCard({ movie }: { movie: any }) {
  const posterUrl = movie.poster && movie.poster.startsWith('http')
    ? movie.poster
    : 'https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=500'

  return (
    <Link href={`/movie/${encodeURIComponent(movie.id)}`}>
      <div className="movie-card group cursor-pointer bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-red-600 transition-all duration-300 hover:shadow-xl hover:shadow-red-900/20">
        <div className="relative h-72 w-full overflow-hidden bg-gray-800">
          <Image
            src={posterUrl}
            alt={movie.title}
            fill
            unoptimized
            className="object-cover group-hover:scale-105 transition-transform duration-300"
            sizes="(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 20vw"
          />
          <div className="absolute top-2 right-2 flex flex-col gap-1 items-end">
            <span className="bg-red-600 text-white font-extrabold text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider shadow">
              {movie.quality || 'HD'}
            </span>
          </div>
          {movie.category && (
            <div className="absolute bottom-2 left-2">
              <span className="bg-black/70 backdrop-blur text-gray-300 font-medium text-[11px] px-2.5 py-0.5 rounded-md border border-gray-700">
                {movie.category}
              </span>
            </div>
          )}
        </div>
        <div className="p-3">
          <h3 className="font-bold text-sm text-white group-hover:text-red-400 transition-colors line-clamp-2 leading-snug">
            {movie.title}
          </h3>
          <p className="text-xs text-gray-400 mt-1">{movie.year || '2024'} • FilmFeed</p>
        </div>
      </div>
    </Link>
  )
}
