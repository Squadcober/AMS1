import { NextRequest, NextResponse } from 'next/server';
import { getClientPromise } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const fileId = searchParams.get('fileId');
    const academyId = searchParams.get('academyId');

    if (!fileId || !academyId) {
      return NextResponse.json({ error: 'fileId and academyId are required' }, { status: 400 });
    }

    const client = await getClientPromise();
    const db = client.db(process.env.MONGODB_DB);

    // First try to find the file in the about collection
    const aboutDoc = await db.collection('ams-about').findOne({
      academyId,
      'collaterals.files.id': fileId
    });

    if (!aboutDoc) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Find the specific file in the collaterals
    let fileData = null;
    let fileName = '';
    let fileType = '';

    for (const collateral of aboutDoc.collaterals || []) {
      const file = collateral.files.find((f: any) => f.id === fileId);
      if (file) {
        fileData = file.url;
        fileName = file.name;
        fileType = file.type;
        break;
      }
    }

    if (!fileData) {
      return NextResponse.json({ error: 'File data not found' }, { status: 404 });
    }

    // Handle base64 data URLs
    if (fileData.startsWith('data:')) {
      const [mimePart, base64Data] = fileData.split(',');
      const mimeType = mimePart.split(':')[1].split(';')[0];

      // Convert base64 to buffer
      const buffer = Buffer.from(base64Data, 'base64');

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Cache-Control': 'public, max-age=31536000',
        },
      });
    }

    // If it's a URL to a stored file, redirect or handle accordingly
    return NextResponse.json({ error: 'Unsupported file format' }, { status: 400 });

  } catch (error) {
    console.error('Download error:', error);
    return NextResponse.json({ error: 'Failed to download file' }, { status: 500 });
  }
}
