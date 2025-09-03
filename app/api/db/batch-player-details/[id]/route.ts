import { NextRequest, NextResponse } from 'next/server';
import { getClientPromise } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client = await getClientPromise();
    const db = client.db(process.env.MONGODB_DB);

    let player;
    try {
      player = await db.collection('ams-player-data').findOne({
        _id: new ObjectId(params.id)
      });
    } catch {
      player = await db.collection('ams-player-data').findOne({
        id: params.id
      });
    }

    if (!player) {
      return NextResponse.json({
        success: false,
        error: 'Player not found'
      }, { status: 404 });
    }

    // Format the response with all required fields
    const formattedPlayer = {
      id: player._id.toString(),
      _id: player._id.toString(),
      name: player.name,
      position: player.position || player.primaryPosition,
      secondaryPosition: player.secondaryPosition || "",
      age: player.age || null,
      gender: player.gender || "",
      height: player.height || "",
      weight: player.weight || "",
      photoUrl: player.photoUrl || "",
      email: player.email || "",
      primaryGuardian: player.primaryGuardian || "",
      secondaryGuardian: player.secondaryGuardian || "",
      primaryPhone: player.primaryPhone || "",
      secondaryPhone: player.secondaryPhone || "",
      address: player.address || "",
      bloodGroup: player.bloodGroup || "",
      enrollmentDate: player.enrollmentDate || "",
      strongFoot: player.strongFoot || "",
      hasDisability: Boolean(player.hasDisability),
      disabilityType: player.disabilityType || "",
      status: player.status || "Active",
      dob: player.dob || "",
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
    };

    return NextResponse.json({
      success: true,
      data: formattedPlayer
    });
  } catch (error) {
    console.error('Error fetching player details:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch player details'
    }, { status: 500 });
  }
}
