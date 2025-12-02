import { NextRequest, NextResponse } from 'next/server';
import { getClientPromise } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const academyId = searchParams.get('academyId');

    if (!academyId) {
      return NextResponse.json({ error: 'Academy ID is required' }, { status: 400 });
    }

    const client = await getClientPromise();
    const db = client.db(process.env.MONGODB_DB);

    // Fetch sessions for the academy
    const sessions = await db.collection('ams-sessions')
      .find({ academyId })
      .toArray();

    // Fetch batches for batch name lookup
    const batches = await db.collection('ams-batches')
      .find({ academyId })
      .toArray();

    // CSV headers (order matters)
    const headers = [
      "Session ID",
      "Session Name",
      "Is Recurring",
      "Parent Session ID",
      "Occurrence Date",
      "Date",
      "Start Time",
      "End Time",
      "Duration",
      "Status",
      "Days (selectedDays)",
      "Assigned Batch ID",
      "Assigned Batch Name",
      "Assigned Players (IDs)",
      "Assigned Players (Names)",
      "Assigned Coaches (IDs)",
      "Assigned Coaches (Names)",
      "Academy ID",
      "Notes"
    ];

    // Helper to escape values for CSV
    const escapeCsvValue = (value: any) => {
      if (value === null || value === undefined) return "";
      const str = typeof value === "string" ? value : JSON.stringify(value);
      if (str.includes('"') || str.includes(",") || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = sessions.map(session => {
      const batchObj = batches.find(b => b.id === session.assignedBatch);
      const batchName = batchObj?.name || "";
      const assignedPlayersIds = Array.isArray(session.assignedPlayers)
        ? session.assignedPlayers.join(", ")
        : session.assignedPlayers || "";
      const assignedPlayersNames = Array.isArray(session.assignedPlayersData)
        ? session.assignedPlayersData.map(p => p.name).join(", ")
        : "";

      const coachIds = Array.isArray(session.coachId) ? session.coachId.join(", ") : (session.coachId || "");
      const coachNames = Array.isArray(session.coachNames) ? session.coachNames.join(", ") : (session.coachNames || "");

      const duration = session.startTime && session.endTime
        ? (() => {
            try {
              const [sh, sm] = session.startTime.split(":").map(Number);
              const [eh, em] = session.endTime.split(":").map(Number);
              const start = new Date();
              start.setHours(sh, sm, 0, 0);
              const end = new Date();
              end.setHours(eh, em, 0, 0);
              const diffMs = end.getTime() - start.getTime();
              if (isNaN(diffMs) || diffMs <= 0) return "";
              const mins = Math.floor(diffMs / 60000);
              const h = Math.floor(mins / 60);
              const m = mins % 60;
              return h > 0 ? `${h}h ${m}m` : `${m}m`;
            } catch {
              return "";
            }
          })()
        : "";

      const values = [
        session.id ?? "",
        session.name ?? "",
        session.isRecurring ? "Yes" : "No",
        session.parentSessionId ?? "",
        session.occurrenceDate ?? "",
        session.date ?? "",
        session.startTime ?? "",
        session.endTime ?? "",
        duration,
        session.status ?? "",
        Array.isArray(session.selectedDays) ? session.selectedDays.join("; ") : (session.selectedDays || ""),
        session.assignedBatch ?? "",
        batchName,
        assignedPlayersIds,
        assignedPlayersNames,
        coachIds,
        coachNames,
        session.academyId ?? "",
        "" // Notes column reserved
      ];

      return values.map(escapeCsvValue).join(",");
    });

    // Combine header + rows
    const csvContent = [headers.join(","), ...rows].join("\n");

    // Return CSV as downloadable file
    const dateStr = new Date().toISOString().split("T")[0];
    const fileName = `sessions_export_${academyId}_${dateStr}.csv`;

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${fileName}"`,
      },
    });

  } catch (error) {
    console.error('Error exporting sessions CSV:', error);
    return NextResponse.json(
      { error: 'Failed to export sessions CSV' },
      { status: 500 }
    );
  }
}
