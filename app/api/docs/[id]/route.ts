import { NextRequest, NextResponse } from 'next/server';
import { getClientPromise } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const docId = params.id;
    
    const client = await getClientPromise();
    const db = client.db(process.env.MONGODB_DB);
    
    const doc = await db.collection('ams-finance-docs').findOne({
      _id: new ObjectId(docId)
    });

    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Convert base64 back to buffer
    const buffer = Buffer.from(doc.data, 'base64');

    // Set appropriate headers
    const headers = new Headers();
    headers.set('Content-Type', doc.contentType);
    headers.set('Content-Disposition', `inline; filename="${doc.filename}"`);

    return new NextResponse(buffer, {
      status: 200,
      headers,
    });

  } catch (error) {
    console.error('Error retrieving document:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve document' },
      { status: 500 }
    );
  }
}
