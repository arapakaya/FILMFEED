#!/bin/bash

# FilmFeed Deployment Script
echo "🚀 Deploying FilmFeed to Vercel..."

cd filmfeed-website

# Install Vercel CLI if not installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
fi

# Login with token
echo "🔑 Authenticating with Vercel..."
export VERCEL_TOKEN="YOUR_VERCEL_TOKEN"

# Deploy to production
echo "🌐 Deploying to production..."
vercel --token $VERCEL_TOKEN --prod --yes

echo "✅ Deployment complete!"
echo "📱 Your website is live!"
