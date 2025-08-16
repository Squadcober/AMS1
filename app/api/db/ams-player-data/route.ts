'use server'


import { NextRequest, NextResponse } from 'next/server';
import { getClientPromise } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { calculateOverall, calculateAveragePerformance } from '@/utils/calculations';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ids = searchParams.get('ids');
    const academyId = searchParams.get('academyId');

    if (!academyId && !ids) {
      return NextResponse.json({
        success: false,
        error: 'Either academyId or player IDs are required'
      }, { status: 400 });
    }

    const client = await getClientPromise();
    const db = client.db(process.env.MONGODB_DB);
    let query: any = {};

    if (academyId) {
      // Return players for academy — include active players (most common case).
      query = {
        academyId: academyId.trim(),
        status: { $in: ['active'] } // ensure active players are returned
      };
    } else if (ids) {
      const playerIds = ids.split(',').map(s => s.trim()).filter(Boolean);
      // Attempt to convert any valid ObjectId strings
      const objectIds = playerIds
        .filter(id => ObjectId.isValid(id))
        .map(id => new ObjectId(id));

      const orConditions: any[] = [];
      if (playerIds.length) {
        orConditions.push(
          { id: { $in: playerIds } },
          { pid: { $in: playerIds } },
          { userId: { $in: playerIds } },
          { username: { $in: playerIds } }
        );
      }
      if (objectIds.length) {
        orConditions.push({ _id: { $in: objectIds } });
      }

      query = orConditions.length === 1 ? orConditions[0] : { $or: orConditions };
    }

    const players = await db.collection('ams-player-data')
      .find(query)
      .toArray();

    const formattedPlayers = players.map(player => {
      const idVal = player.id || player.pid || (player._id ? player._id.toString() : undefined) || player.userId;
      return {
        id: idVal,
        _id: player._id ? player._id.toString() : undefined,
        pid: player.pid || undefined,
        userId: player.userId || undefined,
        username: player.username || undefined,
        name: player.name || player.username || 'Unknown Player',
        position: player.position || 'Not specified',
        photoUrl: player.photoUrl || '/default-avatar.png',
        academyId: player.academyId,
        age: player.age || null,
        attributes: player.attributes || {},
        performanceHistory: Array.isArray(player.performanceHistory) ? player.performanceHistory : [],
        trainingHistory: Array.isArray(player.trainingHistory) ? player.trainingHistory : [],
        phone: player.phone || null,
        emergencyContact: player.emergencyContact || null,
        sessionsAttended: player.sessionsAttended || 0,
        status: player.status || 'active'
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedPlayers
    });

  } catch (error) {
    console.error('Error fetching players:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch players'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    const { playerId, attributes, performanceHistory } = data;

    if (!playerId || !playerId.startsWith('player_')) {
      return NextResponse.json({ 
        success: false, 
        error: 'Player ID is required and must start with "player_"' 
      }, { status: 400 });
    }

    const client = await getClientPromise();
    const db = client.db(process.env.MONGODB_DB);

    // Calculate new overall and average performance
    const overall = calculateOverall(attributes, performanceHistory);
    const averagePerformance = calculateAveragePerformance(performanceHistory);

    const updateData: any = {
      updatedAt: new Date().toISOString()
    };

    if (attributes) {
      updateData['attributes'] = {
        ...attributes,
        overall
      };
    }

    if (performanceHistory) {
      updateData['performanceHistory'] = performanceHistory;
      updateData['averagePerformance'] = averagePerformance;
    }

    // Only update by string id field
    const result = await db.collection('ams-player-data').updateOne(
      { id: playerId },
      { $set: updateData }
    );

    return NextResponse.json({
      success: true,
      data: {
        modifiedCount: result.modifiedCount,
        overall,
        averagePerformance
      }
    });

  } catch (error) {
    console.error('Error updating player:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update player',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
