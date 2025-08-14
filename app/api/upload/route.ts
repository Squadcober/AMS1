import { NextRequest, NextResponse } from 'next/server';
import { getClientPromise } from '@/lib/mongodb';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB limit

export async function POST(request: NextRequest) {
  try {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;
    const academyId = data.get('academyId') as string;

    if (!file || !academyId) {
      return NextResponse.json({ error: "File and academyId are required." }, { status: 400 });
    }

    // Validate file size and type
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File too large. Maximum size is 5MB." }, { status: 400 });
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: "Invalid file type. Only JPG, PNG and PDF allowed." }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create document metadata
    const timestamp = Date.now();
    const docData = {
      filename: file.name,
      contentType: file.type,
      size: file.size,
      uploadDate: new Date(timestamp),
      academyId: academyId,
      data: buffer.toString('base64'), // Store file as base64
    };

    // Save to MongoDB
    const client = await getClientPromise();
    const db = client.db(process.env.MONGODB_DB);
    const result = await db.collection('ams-finance-docs').insertOne(docData);

    console.log('File saved to MongoDB:', result.insertedId);

    return NextResponse.json({ 
      docId: result.insertedId.toString(),
      success: true,
    });

  } catch (error) {
    console.error('Upload error:', error);
    const errorMessage = (error instanceof Error) ? error.message : String(error);
    return NextResponse.json(
      { error: 'Failed to upload file', details: errorMessage }, 
      { status: 500 }
    );
  }
}

