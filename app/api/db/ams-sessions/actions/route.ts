// app/api/db/ams-sessions/actions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getDatabase } from "@/lib/mongodb";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, academyId } = body || {};

    if (!action) {
      return NextResponse.json({ success: false, error: "Missing action" }, { status: 400 });
    }
    if (!academyId) {
      return NextResponse.json({ success: false, error: "Missing academyId" }, { status: 400 });
    }

    // Only implement 'clear' for now
    if (action !== "clear") {
      return NextResponse.json({ success: false, error: "Unsupported action" }, { status: 400 });
    }

    const db = await getDatabase();

    // Delete all sessions for the academyId.
    // Adjust query if you store academyId differently (e.g. Number)
    const deleteResult = await db.collection("ams-sessions").deleteMany({ academyId });

    return NextResponse.json({
      success: true,
      deletedCount: deleteResult.deletedCount ?? 0,
    });
  } catch (err) {
    console.error("api: /api/db/ams-sessions/actions POST error:", err);
    return NextResponse.json({ success: false, error: "Internal server error" }, { status: 500 });
  }
}
