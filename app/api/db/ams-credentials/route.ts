import { NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const academyId = searchParams.get('academyId');
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const skip = (page - 1) * limit;

    console.log('GET credentials - Query params:', { userId, academyId, page, limit });

    if (!userId || !academyId) {
      console.error('Missing required parameters:', { userId, academyId });
      return NextResponse.json({ 
        success: false, 
        error: 'Missing required parameters' 
      }, { status: 400 });
    }

    const db = await getDatabase();
    
    // Create compound index for better performance
    await db.collection('ams-credentials').createIndex(
      { userId: 1, academyId: 1, createdAt: -1 }
    );
    
    const query = { 
      userId,
      academyId,
      isDeleted: { $ne: true }
    };

    // Get total count
    const total = await db.collection('ams-credentials').countDocuments(query);
    
    // Use cursor with allowDiskUse and lean projection
    const credentials = await db.collection('ams-credentials')
      .find(query)
      .project({
        title: 1,
        issuer: 1,
        date: 1,
        document: 1,
        createdAt: 1,
        _id: 1
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .allowDiskUse(true)
      .toArray();

    console.log(`Found ${credentials.length} credentials for page ${page}`);

    return NextResponse.json({
      success: true,
      data: credentials.map(cred => ({
        ...cred,
        _id: cred._id.toString()
      })),
      pagination: {
        total,
        page,
        limit,
        hasMore: total > skip + credentials.length
      }
    });

  } catch (error) {
    console.error('Error fetching credentials:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch credentials'
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    console.log('Received credential data:', data);

    // Validate required fields with detailed logging
    const requiredFields = ['title', 'issuer', 'date', 'userId', 'academyId'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      console.error('Validation failed: Missing fields:', missingFields, 'Data:', data);
      return NextResponse.json({ 
        success: false, 
        error: `Missing required fields: ${missingFields.join(', ')}`,
        receivedData: data
      }, { status: 400 });
    }

    const db = await getDatabase();

    // Verify user exists in ams-users collection using the id field
    const user = await db.collection('ams-users').findOne({ id: data.userId });
    if (!user) {
      console.error('User not found:', data.userId);
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 400 });
    }

    const documentToInsert = {
      ...data,
      createdAt: new Date().toISOString(),
      isDeleted: false
    };

    console.log('Inserting credential:', documentToInsert);

    const result = await db.collection('ams-credentials').insertOne(documentToInsert);
    console.log('Credential created:', result.insertedId);

    const createdDocument = {
      _id: result.insertedId.toString(),
      ...documentToInsert
    };

    return NextResponse.json({
      success: true,
      data: createdDocument
    });

  } catch (error) {
    console.error('Error creating credential:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create credential'
    }, { status: 500 });
  }
}
