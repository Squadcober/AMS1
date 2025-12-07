import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { ObjectId, Filter, Document, UpdateFilter } from 'mongodb';

interface Rating {
  playerId: string;
  playerInfo: {
    id: string;
    name: string;
    photoUrl: string;
  };
  rating: number;
  date: string;
  academyId: string;
}

interface CoachDocument extends Document {
  ratings: Rating[];
}

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

    // Create base query conditions
    const queryConditions: Filter<Document>['$or'] = [
      { id: coachId },
      { userId: coachId },
      { username: coachId },
      { coachId: coachId }
    ];

    // Only add ObjectId condition if valid
    if (ObjectId.isValid(coachId)) {
      queryConditions.push({ _id: new ObjectId(coachId) });
    }

    // Find coach with properly typed query
    const coach = await db.collection('ams-coaches').findOne({
      $or: queryConditions
    });

    if (!coach?.ratings?.length) {
      return NextResponse.json({
        success: true,
        data: []
      });
    }

    // Get all unique player IDs from ratings
    const playerIds = [...new Set(coach.ratings.map((r: any) => r.playerId))];

    // Fetch player information
    const players = await db.collection('ams-player-data')
      .find({
        $or: [
          { id: { $in: playerIds } },
          { userId: { $in: playerIds } },
          { _id: { $in: playerIds.filter((id): id is string => typeof id === 'string' && ObjectId.isValid(id)).map(id => new ObjectId(id)) } }
        ]
      })
      .toArray();

    // Create a map of player info
    const playerMap = new Map(
      players.map(player => [
        player.id || player._id.toString(),
        {
          name: player.name || player.username || 'Unknown player',
          photoUrl: player.photoUrl || '/placeholder.svg'
        }
      ])
    );

    // Combine ratings with player info
    const ratingsWithplayerInfo = coach.ratings.map((rating: any) => ({
      ...rating,
      player: playerMap.get(rating.playerId) || {
        name: 'Unknown player',
        photoUrl: '/placeholder.svg'
      }
    }));

    return NextResponse.json({
      success: true,
      data: ratingsWithplayerInfo
    });

  } catch (error) {
    console.error('Error fetching ratings:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch ratings'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { coachId, playerId, rating, academyId, date } = await request.json();

    if (!coachId || !playerId || !rating || !academyId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required fields' 
      }, { status: 400 });
    }

    const db = await getDatabase();

    // Get player info first
    const queryConditions: Filter<Document>[] = [
      { id: playerId },
      { userId: playerId }
    ];
    
    if (ObjectId.isValid(playerId)) {
      queryConditions.push({ _id: new ObjectId(playerId) });
    }

    const player = await db.collection('ams-player-data').findOne({
      $or: queryConditions
    });

    const playerInfo = {
      id: player?._id.toString() || playerId,
      name: player?.name || player?.username || 'Unknown player',
      photoUrl: player?.photoUrl || '/placeholder.svg'
    };

    // Build query conditions
    const coachQueryConditions: Filter<Document>[] = [
      { id: coachId },
      { userId: coachId },
      { username: coachId },
      { coachId: coachId }
    ];

    // Only add ObjectId condition if valid
    if (ObjectId.isValid(coachId)) {
      coachQueryConditions.push({ _id: new ObjectId(coachId) });
    }

    // Find existing coach
    const coach = await db.collection('ams-coaches').findOne({
      $or: coachQueryConditions
    });

    let result;
    if (coach) {
      // Update existing coach
      result = await db.collection('ams-coaches').updateOne(
        { _id: coach._id },
        {
          $push: {
            ratings: {
              playerId,
              playerInfo,
              rating,
              date,
              academyId
            }
          },
          $inc: {
            totalRatings: 1,
            ratingSum: rating
          }
        } as any
      );
      if (result.modifiedCount === 0) {
        return NextResponse.json({
          success: false,
          error: 'Failed to update rating'
        }, { status: 500 });
      }
    } else {
      // Insert new coach document
      const newCoach = {
        id: coachId,
        ratings: [{
          playerId,
          playerInfo,
          rating,
          date,
          academyId
        }],
        totalRatings: 1,
        ratingSum: rating
      };
      result = await db.collection('ams-coaches').insertOne(newCoach);
      if (!result.insertedId) {
        return NextResponse.json({
          success: false,
          error: 'Failed to update rating'
        }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      data: result
    });

  } catch (error) {
    console.error('Error updating coach rating:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update rating'
    }, { status: 500 });
  }
}
