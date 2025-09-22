#!/bin/bash

# Bulk add YouTube channels script
# Usage: ./bulk-add-channels.sh

API_BASE="https://rss-feed-podcasts.vercel.app/api"

# Array of YouTube channel URLs
channels=(
  "https://www.youtube.com/@themotoacademyYT"
  "https://www.youtube.com/@motocross"
  "https://www.youtube.com/@supermotocross"
  "https://www.youtube.com/@MXGB-TV"
  "https://www.youtube.com/@SupercrossLive"
  "https://www.youtube.com/@AmericanMotocross"
  "https://www.youtube.com/@mattburkeen820"
  "https://www.youtube.com/@DNXShow"
  "https://www.youtube.com/@nitrocircus"
  "https://www.youtube.com/@CarsonBrown910"
  "https://www.youtube.com/@DirtBikeMagazine"
  "https://www.youtube.com/@vurbmoto"
  "https://www.youtube.com/@KevinHorgmo24"
  "https://www.youtube.com/@LiveMotocross"
  "https://www.youtube.com/@Deegan38"
  "https://www.youtube.com/@441motocross"
  "https://www.youtube.com/@RacerXVideoVault"
  "https://www.youtube.com/@motofevermedia1"
  "https://www.youtube.com/@motocrossaction"
  "https://www.youtube.com/@PaigeChristianCraig"
  "https://www.youtube.com/@maineventmoto"
  "https://www.youtube.com/@RotoMoto"
  "https://www.youtube.com/@ClubMX"
  "https://www.youtube.com/@Keeferinctesting/"
  "https://www.youtube.com/@TwoTwo_TV"
  "https://www.youtube.com/@CboysTV"
  "https://www.youtube.com/@ashsowman"
  "https://www.youtube.com/@StartYourSystems"
  "https://www.youtube.com/@buttery_films_"
  "https://www.youtube.com/@JaumeSolerMovies"
  "https://www.youtube.com/@channel199official"
  "https://www.youtube.com/@DIRTRACKR"
  "https://www.youtube.com/@ThisisLawrence"
  "https://www.youtube.com/@deanwilson3194"
  "https://www.youtube.com/@chasesexton4"
  "https://www.youtube.com/@adamcianciarulo277/videos"
  "https://www.youtube.com/@AxellHodges96/videos"
  "https://www.youtube.com/@TylerBereman653"
  "https://www.youtube.com/@raha/videos"
  "https://www.youtube.com/GrahamJarvis/videos"
  "https://www.youtube.com/channel/UC2Jhqbj1NKCMdR0ky8mVvSw"
)

echo "🚀 Starting bulk YouTube channel import..."
echo "📊 Total channels to process: ${#channels[@]}"
echo "🌐 API endpoint: $API_BASE/add-youtube-channel-url"
echo ""

added=0
failed=0
duplicates=0

for i in "${!channels[@]}"; do
    url="${channels[$i]}"
    num=$((i + 1))
    
    echo "[$num/${#channels[@]}] 🔍 Processing: $url"
    
    response=$(curl -s -X POST "$API_BASE/add-youtube-channel-url" \
      -H "Content-Type: application/json" \
      -d "{\"url\": \"$url\", \"is_active\": true}")
    
    # Check if response contains success
    if echo "$response" | grep -q '"success":true'; then
        channel_name=$(echo "$response" | grep -o '"display_name":"[^"]*"' | cut -d'"' -f4)
        echo "    ✅ Added: $channel_name"
        ((added++))
    elif echo "$response" | grep -q "already exists"; then
        echo "    🔄 Already exists (skipped)"
        ((duplicates++))
    else
        error=$(echo "$response" | grep -o '"error":"[^"]*"' | cut -d'"' -f4)
        echo "    ❌ Failed: $error"
        ((failed++))
    fi
    
    # Small delay between requests
    sleep 1
done

echo ""
echo "============================================================"
echo "🎉 BULK IMPORT COMPLETE!"
echo "============================================================"
echo "✅ Successfully added: $added channels"
echo "🔄 Already existed: $duplicates channels"
echo "❌ Failed: $failed channels"
echo "📊 Total processed: ${#channels[@]} URLs"
echo ""
echo "🎬 Next steps:"
echo "1. Check /api/videos/channels to see all channels"
echo "2. Use /api/trigger-video-pull to fetch initial videos"
echo "3. Regular cron job will keep them updated"
