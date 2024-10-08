// app/api/spotify/now-playing/route.ts

import { getCurrentlyPlaying } from '@/lib/spotify'
import { NextResponse } from 'next/server'

const SPOTIFY_API_URL = 'https://api.spotify.com/v1'
let accessToken: string | null = null
let tokenExpirationTime = 0

async function refreshAccessToken() {
  const response = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': 'Basic ' + Buffer.from(process.env.SPOTIFY_CLIENT_ID + ':' + process.env.SPOTIFY_CLIENT_SECRET).toString('base64')
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: process.env.SPOTIFY_REFRESH_TOKEN!,
    })
  })

  if (!response.ok) {
    throw new Error('Failed to refresh access token')
  }

  const data = await response.json()
  accessToken = data.access_token
  tokenExpirationTime = Date.now() + data.expires_in * 1000
}

async function getcurrentlyPlaying() {
  if (!accessToken || Date.now() > tokenExpirationTime) {
    await refreshAccessToken()
  }

  const response = await fetch(`${SPOTIFY_API_URL}/me/player/currently-playing`, {
    headers: {
      'Authorization': `Bearer ${accessToken}`
    }
  })

  if (response.status === 204) {
    return { isPlaying: false }
  }

  if (!response.ok) {
    throw new Error('Failed to fetch now playing')
  }

  const data = await response.json()

  if (data.is_playing) {
    return {
      isPlaying: true,
      name: data.item.name,
      artist: data.item.artists[0].name,
      album: data.item.album.name,
      albumArt: data.item.album.images[0].url,
      progress: data.progress_ms,
      duration: data.item.duration_ms,
      timestamp: Date.now(),
    }
  }

  return { isPlaying: false }
}

export async function GET() {
  try {
    const nowPlaying = await getCurrentlyPlaying(true);  // Force refresh on each request
    return NextResponse.json(nowPlaying);
  } catch (error) {
    console.error('Error fetching now playing:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}