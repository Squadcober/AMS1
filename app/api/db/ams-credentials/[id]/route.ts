import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log('Deleting credential with ID:', params.id);
    
    const db = await getDatabase();

    // Validate ObjectId format
    if (!ObjectId.isValid(params.id)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid credential ID format'
      }, { status: 400 });
    }

    const result = await db.collection('ams-credentials').updateOne(
      { _id: new ObjectId(params.id) },
      { $set: { isDeleted: true } }
    );

    console.log('Delete operation result:', result);

    if (result.matchedCount === 0) {
      return NextResponse.json({
        success: false,
        error: 'Credential not found'
      }, { status: 404 });
    }

    if (result.modifiedCount === 0) {
      return NextResponse.json({
        success: false,
        error: 'Credential already deleted'
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: 'Credential deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting credential:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to delete credential'
    }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const db = await getDatabase()
    const credential = await db.collection('ams-credentials').findOne(
      { _id: new ObjectId(params.id) },
      { projection: { document: 1 } }
    )

    if (!credential) {
      return NextResponse.json(
        { success: false, error: 'Credential not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ success: true, data: credential.document })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to fetch document' },
      { status: 500 }
    )
  }
}
