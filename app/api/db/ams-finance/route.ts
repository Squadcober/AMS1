import { NextRequest, NextResponse } from 'next/server';
import { getClientPromise } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const academyId = searchParams.get('academyId');

    if (!academyId) {
      return NextResponse.json({ error: 'Academy ID is required' }, { status: 400 });
    }

    const client = await getClientPromise();
    const db = client.db(process.env.MONGODB_DB);

    const finances = await db
      .collection('ams-finance')
      .find({ academyId, status: { $ne: 'deleted' } }) // Exclude deleted records
      .sort({ date: -1 })
      .toArray();

    return NextResponse.json(finances);
  } catch (error) {
    console.error('Error in GET /api/db/ams-finance:', error);
    return NextResponse.json(
      { error: 'Failed to fetch finance data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { academyId, type, amount, description, date, documentUrl } = body;

    if (!academyId || !type || !amount) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const client = await getClientPromise();
    const db = client.db(process.env.MONGODB_DB);

    // Generate transaction ID
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0');
    const transactionId = `TXN-${timestamp}-${random}`;

    const newTransaction = {
      academyId,
      type,
      amount: parseFloat(amount),
      description,
      date: date || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      transactionId,
      documentId: documentUrl ? documentUrl.split('/').pop() : null, // Extract document ID from URL
      status: 'active', // Add default status
    };

    const result = await db.collection('ams-finance').insertOne(newTransaction);

    return NextResponse.json({
      id: result.insertedId,
      ...newTransaction,
    });
  } catch (error) {
    console.error('Error in POST /api/db/ams-finance:', error);
    return NextResponse.json(
      { error: 'Failed to create transaction' },
      { status: 500 }
    );
  }
}

// Add new PATCH endpoint for status updates
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, status } = body;

    if (!id) {
      return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });
    }

    const client = await getClientPromise();
    const db = client.db(process.env.MONGODB_DB);

    const result = await db.collection('ams-finance').updateOne(
      { _id: new ObjectId(id) },
      { $set: { status } }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
  }
}

