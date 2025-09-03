import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// Error handling utility
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = params.id;
    const db = await getDatabase();

    // Build query based on ID type
    const query = ObjectId.isValid(id) 
      ? { _id: new ObjectId(id) }
      : { id: id };

    const batch = await db.collection('ams-batches').findOne(query);

    if (!batch) {
      return NextResponse.json({
        success: false,
        error: 'Batch not found'
      }, { status: 404 });
    }

    if (!batch.players || !Array.isArray(batch.players)) {
      return NextResponse.json({
        success: true,
        data: []
      });
    }

    // Convert string IDs to ObjectIds where possible
    const playerObjectIds = batch.players
      .map((id: string) => {
        try {
          return new ObjectId(id);
        } catch {
          return id; // Keep original if not valid ObjectId
        }
      });

    // Find all players in batch
    const players = await db.collection('ams-player-data')
      .find({
        $or: [
          { _id: { $in: playerObjectIds.filter((id: string | ObjectId) => id instanceof ObjectId) } },
          { id: { $in: playerObjectIds.filter((id: string | ObjectId) => typeof id === 'string') } }
        ]
      })
      .toArray();

    // Format response data
    const formattedPlayers = players.map(player => ({
      id: player.id || player._id.toString(),
      _id: player._id.toString(),
      name: player.name || player.username || 'Unknown Player',
      position: player.position || player.primaryPosition || 'Not specified',
      secondaryPosition: player.secondaryPosition || '',
      age: player.age || null,
      gender: player.gender || '',
      height: player.height || '',
      weight: player.weight || '',
      photoUrl: player.photoUrl || '',
      email: player.email || '',
      primaryGuardian: player.primaryGuardian || '',
      secondaryGuardian: player.secondaryGuardian || '',
      primaryPhone: player.primaryPhone || '',
      secondaryPhone: player.secondaryPhone || '',
      address: player.address || '',
      bloodGroup: player.bloodGroup || '',
      enrollmentDate: player.enrollmentDate || '',
      strongFoot: player.strongFoot || '',
      hasDisability: Boolean(player.hasDisability),
      disabilityType: player.disabilityType || '',
      status: player.status || 'Active',
      dob: player.dob || '',
      attributes: {
        Attack: player.attributes?.Attack || 0,
        pace: player.attributes?.pace || 0,
        Physicality: player.attributes?.Physicality || 0,
        Defense: player.attributes?.Defense || 0,
        passing: player.attributes?.passing || 0,
        Technique: player.attributes?.Technique || 0
      },
      overallRating: player.overallRating || 0,
      averagePerformance: player.averagePerformance || 0,
      performanceHistory: (player.performanceHistory || [])
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 5)
    }));

    return NextResponse.json({
      success: true,
      data: formattedPlayers
    });

  } catch (error) {
    console.error('Error fetching batch players:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch batch players',
      details: getErrorMessage(error)
    }, { status: 500 });
  }
}
