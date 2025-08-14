import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';

// Add type for query object
type BatchQuery = {
  _id?: ObjectId;
  id?: string;
};

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    if (!params.id) {
      return NextResponse.json({
        success: false,
        error: 'Batch ID is required'
      }, { status: 400 });
    }

    const db = await getDatabase();
    
    // Build the query based on ID format with proper typing
    let query: BatchQuery = { id: params.id }; // Default to string ID
    if (ObjectId.isValid(params.id)) {
      query = { _id: new ObjectId(params.id) };
    }

    const batch = await db.collection('ams-batches').findOne(query);

    if (!batch) {
      return NextResponse.json({
        success: false,
        error: 'Batch not found'
      }, { status: 404 });
    }

    // Get coach names from users collection
    const coachIds = Array.isArray(batch.coachIds) ? batch.coachIds : 
                    batch.coachId ? [batch.coachId] : [];

    // Convert valid string IDs to ObjectIds, filtering out invalid ones
    const objectIds = coachIds
      .map(id => {
        try { 
          return ObjectId.isValid(id) ? new ObjectId(id) : null;
        } catch { 
          return null; 
        }
      })
      .filter((id): id is ObjectId => id !== null);

    const coaches = await db.collection('ams-users')
      .find({
        $or: [
          { id: { $in: coachIds } },
          { _id: { $in: objectIds } }
        ]
      })
      .toArray();

    // Format the response
    const formattedBatch = {
      ...batch,
      id: batch._id.toString(),
      _id: batch._id.toString(),
      name: batch.name || 'Unnamed Batch',
      coachNames: coaches.map(coach => coach.name || coach.username || 'Unknown Coach'),
      players: batch.players || [],
      coachIds: Array.isArray(batch.coachIds) ? batch.coachIds : 
                batch.coachId ? [batch.coachId] : []
    };

    console.log('Returning formatted batch:', formattedBatch);

    return NextResponse.json({
      success: true,
      data: formattedBatch
    });

  } catch (error) {
    console.error('Error fetching batch:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch batch details',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    console.log("Deleting batch with ID:", params.id);

    const db = await getDatabase();
    
    // Convert string ID to ObjectId
    const objectId = new ObjectId(params.id);
    console.log("Converted to ObjectId:", objectId);

    // Delete the batch
    const result = await db.collection('ams-batches').deleteOne({
      _id: objectId
    });

    console.log("Delete operation result:", result);

    if (result.deletedCount === 0) {
      console.log("No batch found with ID:", params.id);
      return NextResponse.json({
        success: false,
        error: "Batch not found"
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: "Batch deleted successfully"
    });

  } catch (error) {
    console.error("Error deleting batch:", error);
    return NextResponse.json({
      success: false,
      error: "Failed to delete batch",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const db = await getDatabase();
    const data = await request.json();
    const { name, coachIds, coachNames, players } = data;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Batch name is required" },
        { status: 400 }
      );
    }

    const result = await db.collection("ams-batches").updateOne(
      { _id: new ObjectId(params.id) },
      {
        $set: {
          name,
          coachIds,
          coachNames,
          players,
          updatedAt: new Date().toISOString(),
        },
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { success: false, error: "Batch not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Batch updated successfully",
    });
  } catch (error) {
    console.error("Error updating batch:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update batch" },
      { status: 500 }
    );
  }
}
