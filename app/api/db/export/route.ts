import { NextRequest, NextResponse } from 'next/server';
import { getClientPromise } from '@/lib/mongodb';

// helper to detect Android WebView / wrapped APK requests
function isApkWebViewRequest(request: NextRequest) {
	// X-Requested-With is commonly sent by Android WebView with the package name
	const xr = request.headers.get('x-requested-with');
	if (xr) return true;

	// Fallback: try to detect WebView via user-agent heuristics (not perfect)
	const ua = (request.headers.get('user-agent') || '').toLowerCase();
	// "wv" and "android" together are a reasonable heuristic for WebView
	if (ua.includes('wv') || (ua.includes('android') && ua.includes('webview'))) return true;

	return false;
}

// helper to detect top-level navigation (so we can safely return HTML only on navigations)
function isNavigationRequest(request: NextRequest) {
	const accept = (request.headers.get('accept') || '').toLowerCase();
	if (accept.includes('text/html')) return true;

	// modern browsers/WebViews set sec-fetch-mode/dest for navigations
	const sfMode = request.headers.get('sec-fetch-mode') || '';
	const sfDest = request.headers.get('sec-fetch-dest') || '';
	if (sfMode === 'navigate' || sfDest === 'document') return true;

	// fallback: if referer is empty and accept prefers html, treat as navigation
	return false;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const academyId = searchParams.get('academyId');
    const collection = searchParams.get('collection');

    if (!academyId) {
      return NextResponse.json({ error: 'Academy ID is required' }, { status: 400 });
    }

    const client = await getClientPromise();
    const db = client.db(process.env.MONGODB_DB);

    let data;
    switch (collection) {
      case 'players':
        data = await db.collection('ams-player-data')
          .find({ academyId })
          .toArray();
        break;
      
      case 'coaches':
        // Fetch and combine coach data
        const coaches = await db.collection('ams-users')
          .find({ academyId, role: 'coach' })
          .toArray();
        
        const coachDetails = await db.collection('ams-coaches')
          .find({ academyId })
          .toArray();
        
        data = coaches.map(coach => {
          const details = coachDetails.find(d => d.userId === coach.id);
          return { ...coach, ...details };
        });
        break;
      
      case 'batches':
        data = await db.collection('ams-batches')
          .find({ academyId })
          .toArray();
        break;

      case 'finances':
        data = await db.collection('ams-finance')
          .find({ academyId })
          .toArray();
        break;

      case 'performance':
        // Fetch player performance data with details
        const players = await db.collection('ams-player-data')
          .find({ 
            academyId,
            performanceHistory: { $exists: true }
          })
          .toArray();

        data = players.flatMap(player => 
          (player.performanceHistory || []).map((ph: any) => ({
            playerId: player.id,
            playerName: player.name,
            ...ph
          }))
        );
        break;

      case 'all':
        // Fetch all collections
        const [
          allPlayers,
          allCoaches,
          allBatches,
          allFinances,
        ] = await Promise.all([
          db.collection('ams-player-data').find({ academyId }).toArray(),
          db.collection('ams-users').find({ academyId, role: 'coach' }).toArray(),
          db.collection('ams-batches').find({ academyId }).toArray(),
          db.collection('ams-finance').find({ academyId }).toArray(),
        ]);

        data = {
          players: allPlayers,
          coaches: allCoaches,
          batches: allBatches,
          finances: allFinances,
        };
        break;

      default:
        return NextResponse.json({ error: 'Invalid collection specified' }, { status: 400 });
    }

    // Only return HTML fallback when request is from APK/WebView AND is a top-level navigation.
    if (isApkWebViewRequest(request) && isNavigationRequest(request)) {
      const filename = `export-${collection ?? 'data'}.json`;
      const jsonString = JSON.stringify(data, null, 2); // pretty print for textarea
      const base64 = Buffer.from(jsonString, 'utf-8').toString('base64');

      const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>Export: ${filename}</title>
  <style>
    body{font-family:system-ui,Segoe UI,Roboto,Arial;padding:16px}
    h1{font-size:18px;margin-bottom:8px}
    textarea{width:100%;height:60vh;margin-top:12px;font-family:monospace;white-space:pre;overflow:auto}
    p.note{color:#444;font-size:13px}
  </style>
</head>
<body>
  <h1>Export Ready: ${filename}</h1>
  <p class="note">Copy the JSON from the textarea below and save it manually via your device.</p>
  <hr/>
  <p><strong>Raw JSON (copy/save manually)</strong></p>
  <textarea readonly>${jsonString.replace(/<\/textarea>/g, '<\\/textarea>')}</textarea>
</body>
</html>`;

      return new Response(html, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
        },
      });
    }

    // If request comes from APK/WebView but is NOT a navigation (likely a fetch/XHR), return base64 JSON payload
    if (isApkWebViewRequest(request)) {
      const filename = `export-${collection ?? 'data'}.json`;
      const jsonString = JSON.stringify(data);
      const base64 = Buffer.from(jsonString, 'utf-8').toString('base64');

      return NextResponse.json({
        apkExport: true,
        filename,
        mime: 'application/json',
        contentBase64: base64,
        originalSize: Buffer.byteLength(jsonString, 'utf-8')
      }, { status: 200 });
    }

    // Default: existing web behavior (unchanged)
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error exporting data:', error);
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    );
  }
}
