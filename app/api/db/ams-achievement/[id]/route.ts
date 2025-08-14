import { NextRequest, NextResponse } from 'next/server';
import { getClientPromise } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client = await getClientPromise();
    const db = client.db(process.env.MONGODB_DB);
    
    const result = await db.collection('ams-achievement').deleteOne({
      _id: new ObjectId(params.id)
    });

    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Achievement not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting achievement:', error);
    return NextResponse.json(
      { error: 'Failed to delete achievement' },
      { status: 500 }
    );
  }
}
const MAX_FILE_SIZE = 1024 * 1024; // 1MB in bytes

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const client = await getClientPromise();
    const db = client.db("ams");
    
    const contentType = request.headers.get('content-type') || '';
    let data;
    
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const jsonData = formData.get('data');
      if (!jsonData) {
        throw new Error('No data provided');
      }
      data = JSON.parse(jsonData.toString());
      
      // Handle file if present with size validation
      const file = formData.get('certificate') as File;
      if (file) {
        if (file.size > MAX_FILE_SIZE) {
          return NextResponse.json(
            { success: false, error: 'File size must be less than 1MB' },
            { status: 400 }
          );
        }
        const buffer = Buffer.from(await file.arrayBuffer());
        data.certificateUrl = `data:${file.type};base64,${buffer.toString('base64')}`;
      }
    } else {
      data = await request.json();
    }

    // Update the document
    const result = await db.collection("achievements").findOneAndUpdate(
      { _id: new ObjectId(params.id) },
      { $set: data },
      { returnDocument: 'after' }
    );

    if (!result) {
      return NextResponse.json(
        { success: false, error: 'Achievement not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: result }, { status: 200 });
  } catch (error) {
    console.error('Error updating achievement:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update achievement' },
      { status: 500 }
    );
  }
}
