import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

// Add server-side caching
const CACHE = new Map<string, { data: any, timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const playerIds = searchParams.get('playerIds')?.split(',');

    if (!playerIds?.length) {
      return NextResponse.json({ 
        success: false, 
        error: 'player IDs are required' 
      }, { status: 400 });
    }

    // Check cache for each player ID
    const now = Date.now();
    const uncachedIds = playerIds.filter(id => {
      const cached = CACHE.get(id);
      return !cached || (now - cached.timestamp > CACHE_DURATION);
    });

    if (uncachedIds.length === 0) {
      // All players are in cache
      const cachedData = playerIds.map(id => CACHE.get(id)?.data);
      return NextResponse.json({
        success: true,
        data: cachedData,
        fromCache: true
      });
    }

    // Fetch uncached player data
    const db = await getDatabase();
    const players = await db.collection('ams-users')
      .find({ id: { $in: uncachedIds } })
      .project({ id: 1, name: 1, photoUrl: 1 })
      .toArray();

    // Update cache
    players.forEach(player => {
      CACHE.set(player.id, {
        data: {
          id: player.id,
          name: player.name,
          photoUrl: player.photoUrl
        },
        timestamp: now
      });
    });

    // Combine cached and new data
    const allData = playerIds.map(id => CACHE.get(id)?.data);

    return NextResponse.json({
      success: true,
      data: allData
    });

  } catch (error) {
    console.error('Error fetching players:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch players'
    }, { status: 500 });
  }
}
