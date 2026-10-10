/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['image.tmdb.org', 'cartoons.lk', 'www.animekaizen.org'],
    unoptimized: true
  },
  output: 'standalone'
}

module.exports = nextConfig
