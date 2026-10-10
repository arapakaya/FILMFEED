# FilmFeed Deployment Script for Windows
Write-Host "🚀 Deploying FilmFeed to Vercel..." -ForegroundColor Green

Set-Location filmfeed-website

# Check if Vercel CLI is installed
if (-not (Get-Command vercel -ErrorAction SilentlyContinue)) {
    Write-Host "📦 Installing Vercel CLI..." -ForegroundColor Yellow
    npm install -g vercel
}

# Set Vercel token
$env:VERCEL_TOKEN = "YOUR_VERCEL_TOKEN_HERE"

# Deploy to production
Write-Host "🌐 Deploying to production..." -ForegroundColor Cyan
vercel --token $env:VERCEL_TOKEN --prod --yes

Write-Host "✅ Deployment complete!" -ForegroundColor Green
Write-Host "📱 Your website is live!" -ForegroundColor Yellow
