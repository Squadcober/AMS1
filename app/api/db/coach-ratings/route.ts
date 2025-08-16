import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

// Add these exports to mark the route as dynamic
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const coachId = searchParams.get('coachId');
    
    if (!coachId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Coach ID is required' 
      }, { status: 400 });
    }

    const db = await getDatabase();
    
    // Get ratings from the ams-coaches collection
    const coach = await db.collection('ams-coaches').findOne({ userId: coachId });
    const ratings = coach?.ratings || [];

    // Also fetch player names for the ratings
    const playerIds = ratings.map((r: any) => r.playerId);
    const players = await db.collection('ams-users')
      .find({ id: { $in: playerIds } })
      .toArray();

    // Merge player names with ratings
    const ratingsWithNames = ratings.map((rating: any) => {
      const player = players.find(s => s.id === rating.playerId);
      return {
        ...rating,
        playerName: player?.name || 'Anonymous player'
      };
    });

    return NextResponse.json({
      success: true,
      data: ratingsWithNames
    });

  } catch (error) {
    console.error('Error fetching coach ratings:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch ratings'
    }, { status: 500 });
  }
}
