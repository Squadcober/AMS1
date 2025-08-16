import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const username = searchParams.get('username');
    const academyId = searchParams.get('academyId');

    if (!username || !academyId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Username and Academy ID are required' 
      }, { status: 400 });
    }

    const db = await getDatabase();
    const playerInfo = await db.collection('ams-player-data').findOne({
      username,
      academyId
    });

    if (!playerInfo) {
      return NextResponse.json({
        success: false,
        error: 'player not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: playerInfo
    });
  } catch (error) {
    console.error('Error fetching player info:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch player info'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { username, academyId } = data;

    if (!username || !academyId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Username and Academy ID are required' 
      }, { status: 400 });
    }

    // Validate blood group if present
    if (data.bloodGroup && !['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].includes(data.bloodGroup)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid blood group'
      }, { status: 400 });
    }

    const db = await getDatabase();
    const result = await db.collection('ams-player-data').updateOne(
      { username, academyId },
      { 
        $set: {
          ...data,
          updatedAt: new Date().toISOString()
        }
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error updating player info:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update player info'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    const { _id, ...updateData } = data;

    if (!_id) {
      return NextResponse.json({ 
        success: false, 
        error: 'player ID is required' 
      }, { status: 400 });
    }

    // Validate blood group if present
    if (updateData.bloodGroup && !['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-'].includes(updateData.bloodGroup)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid blood group'
      }, { status: 400 });
    }

    const db = await getDatabase();
    const result = await db.collection('ams-player-data').findOneAndUpdate(
      { _id: new ObjectId(_id) },
      { 
        $set: {
          ...updateData,
          updatedAt: new Date().toISOString()
        }
      },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json({
        success: false,
        error: 'player not found'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: result.value
    });
  } catch (error) {
    console.error('Error updating player:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update player'
    }, { status: 500 });
  }
}
