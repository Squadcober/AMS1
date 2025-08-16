import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID is required' 
      }, { status: 400 });
    }

    const db = await getDatabase();
    const userInfo = await db.collection('ams-users-info').findOne({ userId });

    return NextResponse.json({
      success: true,
      data: userInfo || {}
    });
  } catch (error) {
    console.error('Error fetching user info:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch user info'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();
    const { userId, academyId, ...rest } = data;

    if (!userId || !academyId) {
      return NextResponse.json({ 
        success: false, 
        error: 'User ID and Academy ID are required' 
      }, { status: 400 });
    }

    const db = await getDatabase();

    // Only include certificates/specializations in $setOnInsert if not present in $set
    const setOnInsert: any = {
      createdAt: new Date().toISOString()
    };
    if (rest.certificates === undefined) setOnInsert.certificates = [];
    if (rest.specializations === undefined) setOnInsert.specializations = [];

    const updatePayload = {
      $set: {
        userId,
        academyId,
        ...rest,
        updatedAt: new Date().toISOString()
      },
      $setOnInsert: setOnInsert
    };

    const opts: any = { upsert: true, returnDocument: 'after' };
    const result = await db.collection('ams-users-info').findOneAndUpdate(
      { userId, academyId },
      updatePayload,
      opts
    );

    const updatedDoc = result.value;

    return NextResponse.json({
      success: true,
      data: updatedDoc || {}
    });
  } catch (error) {
    console.error('Error updating user info (POST /api/db/ams-users-info):', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update user info'
    }, { status: 500 });
  }
}
