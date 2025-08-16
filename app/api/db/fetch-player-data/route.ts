import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

// Add these exports to mark the route as dynamic
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request: NextRequest) {
  try {
    const playerId = request.nextUrl.searchParams.get('playerId');
    const academyId = request.nextUrl.searchParams.get('academyId');

    if (!playerId || !academyId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required parameters' 
      }, { status: 400 });
    }

    const db = await getDatabase();

    // Fetch player data
    const playerData = await db.collection('ams-player-data').findOne({
      userId: playerId,
      academyId,
      isDeleted: { $ne: true },
    });

    // Fetch academy data
    const academyData = await db.collection('ams-academy').findOne({
      id: academyId,
    });

    if (!playerData && !academyData) {
      return NextResponse.json({
        success: false,
        error: 'No data found for the given player ID and Academy ID',
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        player: playerData || null,
        academy: academyData || null,
      },
    });
  } catch (error) {
    console.error('Error fetching player data:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch player data',
      details: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}
