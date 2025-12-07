import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const playerIds = searchParams.get('playerIds');

    if (!playerIds) {
      return NextResponse.json({
        success: false,
        error: 'Player IDs are required'
      }, { status: 400 });
    }

    const ids = playerIds.split(',').map(id => id.trim());

    const db = await getDatabase();

    const players = await db.collection('ams-player-data')
      .find({
        $or: [
          { id: { $in: ids } },
          { userId: { $in: ids } },
          { _id: { $in: ids.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id)) } }
        ]
      })
      .toArray();

    const playerMap: { [key: string]: { name: string; photoUrl: string } } = {};
    players.forEach(player => {
      const name = player.name || player.username || 'Anonymous Player';
      const photoUrl = player.photoUrl || '/placeholder.svg';
      if (player.id) playerMap[player.id] = { name, photoUrl };
      if (player.userId) playerMap[player.userId] = { name, photoUrl };
      if (player._id) playerMap[player._id.toString()] = { name, photoUrl };
    });

    return NextResponse.json({
      success: true,
      data: playerMap
    });

  } catch (error) {
    console.error('Error fetching players:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch players'
    }, { status: 500 });
  }
}
