'use server'

import { NextRequest, NextResponse } from 'next/server';
import { getClientPromise } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { points, drillId, previousPoints } = await request.json();
    const client = await getClientPromise();
    const db = client.db(process.env.MONGODB_DB);

    // Handle multiple ID formats like the main route does
    const playerId = params.id;
    const objectIds = ObjectId.isValid(playerId) ? [new ObjectId(playerId)] : [];
    
    const orConditions: any[] = [
      { id: playerId },
      { pid: playerId },
      { userId: playerId },
      { username: playerId }
    ];
    
    if (objectIds.length) {
      orConditions.push({ _id: { $in: objectIds } });
    }

    const query = orConditions.length === 1 ? orConditions[0] : { $or: orConditions };

    // First get current player data
    const player = await db.collection('ams-player-data').findOne(query);

    if (!player) {
      return NextResponse.json({ 
        success: false, 
        error: 'Player not found' 
      }, { status: 404 });
    }

    // Create history entry
    const historyEntry = {
      date: new Date(),
      type: 'drill_training',
      drillId,
      previousPoints,
      newPoints: points,
      difference: points - (previousPoints || 0),
    };

    // Update player document using the same query
    const result = await db.collection('ams-player-data').updateOne(
      query,
      {
        $set: {
          'attributes.trainingPoints': points,
          'attributes.drillTrainingPoints': points, // New drill-specific field
          'attributes.lastUpdated': new Date()
        },
        $push: {
          performanceHistory: historyEntry,
          drillPerformanceHistory: { // New drill-specific history
            date: new Date(),
            drillId,
            points,
            type: 'drill_training'
          }
        } as any // Cast $push as any to avoid TypeScript type error with MongoDB driver
      }
    );

    if (result.modifiedCount === 0) {
      throw new Error('Failed to update player');
    }

    // Get updated player data
    const updatedPlayer = await db.collection('ams-player-data').findOne(query);

    return NextResponse.json({
      success: true,
      data: updatedPlayer
    });

  } catch (error) {
    console.error('Error updating training points:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update training points'
    }, { status: 500 });
  }
}
