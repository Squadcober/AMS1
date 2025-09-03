'use server'

import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const db = await getDatabase();
    const userId = params.id;

    // Try to find user by both _id and id fields
    const user = await db.collection('ams-users').findOne({
      $or: [
        { _id: { $eq: ObjectId.isValid(userId) ? new ObjectId(userId) : undefined } },
        { id: userId }
      ]
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...user,
        _id: user._id.toString(),
      }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch user' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { status } = await request.json();

    const db = await getDatabase();
    const result = await db.collection('ams-users').updateOne(
      { id: id },
      { 
        $set: { 
          status,
          updatedAt: new Date().toISOString()
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: `User status updated to ${status}`
    });

  } catch (error) {
    console.error('Error updating user status:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to update user status'
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const db = await getDatabase();

    // First check if user exists
    const existingUser = await db.collection('ams-users').findOne({ id: id });
    
    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: 'User not found' },
        { status: 404 }
      );
    }

    // Delete the user
    const result = await db.collection('ams-users').deleteOne({ id: id });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete user' },
        { status: 500 }
      );
    }

    // If the user is a player, also delete from ams-player-data collection
    if (existingUser.role === 'player') {
      try {
        await db.collection('ams-player-data').deleteOne({
          username: existingUser.username,
          academyId: existingUser.academyId
        });
      } catch (playerError) {
        console.warn('Failed to delete player data:', playerError);
        // Continue even if player data deletion fails
      }
    }

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}