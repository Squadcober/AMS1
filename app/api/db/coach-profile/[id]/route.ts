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

    // Get coach data and include player info for ratings
    const [coachInfo, userData, sessions] = await Promise.all([
      db.collection('ams-coaches').findOne({ userId: params.id }),
      db.collection('ams-users').findOne({ id: params.id }),
      db.collection('ams-sessions').find({ 
        coachId: params.id,
        status: "Finished"
      }).toArray()
    ]);

    if (!userData && !coachInfo) {
      return NextResponse.json({ 
        success: false, 
        error: 'Coach not found' 
      }, { status: 404 });
    }

    interface Rating {
      playerId: string;
      [key: string]: any;
    }

    // If there are ratings, fetch player names
    let ratings = coachInfo?.ratings || [] as Rating[];
    if (ratings.length > 0) {
      const playerIds = ratings.map((r: Rating) => r.playerId);
      const players = await db.collection('ams-users')
        .find({ id: { $in: playerIds } })
        .toArray();

      // Map player names to ratings
      ratings = ratings.map((rating: Rating) => {
        const player = players.find(s => s.id === rating.playerId);
        return {
          ...rating,
          playerName: player?.name || 'Anonymous player'
        };
      });
    }

    const combinedData = {
      ...userData,
      ...coachInfo,
      ratings,
      sessionsCount: sessions.length,
      id: params.id
    };

    return NextResponse.json({ 
      success: true, 
      data: combinedData 
    });

  } catch (error) {
    console.error('Error fetching coach profile:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch coach profile'
    }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const updates = await request.json();
    const client = await getClientPromise();
    const db = client.db(process.env.MONGODB_DB);

    // Update coach data
    const result = await db.collection('ams-coaches').updateOne(
      { userId: params.id },
      {
        $set: {
          name: updates.name,
          age: updates.age,
          license: updates.license,
          about: updates.about,
          photoUrl: updates.photoUrl,
          ratings: updates.ratings,
          updatedAt: new Date().toISOString()
        },
        $setOnInsert: {
          userId: params.id,
          academyId: updates.academyId,
          createdAt: new Date().toISOString()
        }
      },
      { upsert: true }
    );

    if (!result.acknowledged) {
      throw new Error('Failed to update coach data');
    }

    return NextResponse.json({ 
      success: true,
      data: {
        ...updates,
        userId: params.id
      }
    });

  } catch (error) {
    console.error('Error updating coach profile:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update coach profile'
    }, { status: 500 });
  }
}
