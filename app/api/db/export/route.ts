import { NextRequest, NextResponse } from 'next/server';
import { getClientPromise } from '@/lib/mongodb';
import * as XLSX from 'xlsx';

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

// Helper functions for formatting
const calculateOverallRating = (attributes: any) => {
  const stats = [
    attributes?.Attack || 0,
    attributes?.pace || 0,
    attributes?.Physicality || 0,
    attributes?.Defense || 0,
    attributes?.passing || 0,
    attributes?.Technique || 0
  ];

  const validStats = stats.filter(stat => stat > 0);
  if (validStats.length === 0) return 0;

  const total = validStats.reduce((sum, stat) => sum + Number(stat), 0);
  return Math.round((total / (validStats.length * 10)) * 100);
};

const formatDateTime = (dateTimeStr: string) => {
  const date = new Date(dateTimeStr);
  return {
    date: date.toLocaleDateString(),
    time: date.toLocaleTimeString()
  };
};

const formatCSV = (data: any[], type: string) => {
  if (!data.length) return '';

  let csvContent = '';

  switch (type) {
    case 'players':
      csvContent = [
        'ID,Name,Position,Age,Overall Rating,Attack,Pace,Physicality,Defense,passing,Technique,Average Performance,Stamina,Enrollment Date',
        ...data.map(p => {
          const attrs = p.attributes || {};
          const overallRating = calculateOverallRating(attrs);
          return [
            p.id || p._id,
            `"${p.name || ''}"`,
            `"${p.position || ''}"`,
            p.age || '',
            `${overallRating}`,
            attrs.Attack || '',
            attrs.pace || '',
            attrs.Physicality || '',
            attrs.Defense || '',
            attrs.passing || '',
            attrs.Technique || '',
            p.averagePerformance || '',
            p.stamina || '',
            p.enrollmentDate || ''
          ].join(',');
        }),
      ].join('\n');
      break;

    case 'coaches':
      csvContent = [
        'ID,Name,Email,Specialization,Experience,Rating',
        ...data.map(c => [
          c.id || c._id,
          `"${c.name || ''}"`,
          `"${c.email || ''}"`,
          `"${c.specialization || ''}"`,
          `"${c.experience || ''}"`,
          c.rating || ''
        ].join(',')),
      ].join('\n');
      break;

    case 'performance':
      if (!data || !Array.isArray(data) || data.length === 0) {
        return 'Player ID,Player Name,Date,Time,Session ID,Type,Attack,Pace,Physicality,Defense,passing,Technique,Session Rating,Overall\n';
      }

      csvContent = [
        'Player ID,Player Name,Date,Time,Session ID,Type,Attack,Pace,Physicality,Defense,passing,Technique,Session Rating,Overall',
        ...data.map((session: any) => {
          const { date, time } = formatDateTime(session.date);
          const attrs = session.attributes || {};
          const overallRating = calculateOverallRating(attrs);

          return [
            session.playerId || '',
            `"${session.playerName || ''}"`,
            date,
            time,
            session.sessionId || '',
            session.type || 'training',
            attrs.Attack || session.Attack || '',
            attrs.pace || session.pace || '',
            attrs.Physicality || session.Physicality || '',
            attrs.Defense || session.Defense || '',
            attrs.passing || session.passing || '',
            attrs.Technique || session.Technique || '',
            session.sessionRating || '',
            `${overallRating}`
          ].join(',');
        }),
      ].join('\n');
      break;

    case 'batches':
      data.forEach((batch: any, idx: number) => {
        csvContent += `Batch No.,${idx + 1},Batch Name,"${batch.name || ''}"\n`;
        csvContent += '\n';

        csvContent += 'Role,ID,Name,Email,Specialization,Experience,Rating\n';
        if (batch.coaches?.length > 0) {
          batch.coaches.forEach((coach: any) => {
            csvContent += [
              'Coach',
              `"${coach.id || coach._id || ''}"`,
              `"${coach.name || coach.fullName || coach.coachName || ''}"`,
              `"${coach.email || ''}"`,
              `"${coach.specialization || ''}"`,
              `"${coach.experience || ''}"`,
              `"${coach.rating || ''}"`
            ].join(',') + '\n';
          });
        }

        csvContent += '\n';

        csvContent += [
          'Role', 'ID', 'Name', 'Position', 'Age', 'Overall Rating',
          'Attack', 'pace', 'Physicality', 'Defense', 'passing', 'Technique',
          'averagePerformance', 'stamina', 'lastUpdated'
        ].join(',') + '\n';

        if (batch.playersData?.length > 0) {
          batch.playersData.forEach((player: any) => {
            const attrs = player.attributes || {};
            const overallRating = calculateOverallRating(attrs);

            csvContent += [
              'Player',
              `"${player.id || player._id}"`,
              `"${player.name}"`,
              `"${player.position}"`,
              `"${player.age}"`,
              `"${overallRating}"`,
              `"${attrs.Attack}"`,
              `"${attrs.pace}"`,
              `"${attrs.Physicality}"`,
              `"${attrs.Defense}"`,
              `"${attrs.passing}"`,
              `"${attrs.Technique}"`,
              `"${player.averagePerformance}"`,
              `"${player.stamina}"`,
              `"${player.lastUpdated}"`
            ].join(',') + '\n';
          });
        }

        csvContent += '\n\n\n';
      });
      break;
  }

  return csvContent.trim();
};

const formatFinancialData = (data: any[]) => {
  const pickTransactionId = (item: any) =>
    item.transactionId || item.transaction_id || item.id || item._id || '';

  const toDateTimeFields = (rawDate: any) => {
    if (!rawDate) return { date: '', time: '' };
    try {
      const { date, time } = formatDateTime(String(rawDate));
      return { date, time };
    } catch {
      return { date: String(rawDate), time: '' };
    }
  };

  const income = data
    .filter(item => item.type === 'income')
    .map(item => {
      const dt = toDateTimeFields(item.date);
      return {
        'Transaction ID': pickTransactionId(item),
        'Date': dt.date,
        'Time': dt.time,
        'Description': item.description,
        'Amount': item.amount,
        'Quantity': item.quantity || 1
      };
    });

  const expenses = data
    .filter(item => item.type === 'expense')
    .map(item => {
      const dt = toDateTimeFields(item.date);
      return {
        'Transaction ID': pickTransactionId(item),
        'Date': dt.date,
        'Time': dt.time,
        'Description': item.description,
        'Amount': item.amount,
        'Quantity': item.quantity || 1
      };
    });

  return { income, expenses };
};

const fetchCoachDetails = async (academyId: string, ids: string[]) => {
  if (!ids?.length) return [];
  const client = await getClientPromise();
  const db = client.db(process.env.MONGODB_DB);

  const coaches = await db.collection('ams-users')
    .find({ academyId, role: 'coach' })
    .toArray();

  const coachDetails = await db.collection('ams-coaches')
    .find({ academyId })
    .toArray();

  return ids.map(id => {
    const coach = coaches.find(c => String(c.id) === id || String(c._id) === id);
    const details = coachDetails.find(d => d.userId === id);
    return {
      id: id,
      name: coach?.name || coach?.fullName || '',
      email: coach?.email || '',
      specialization: details?.specialization || '',
      experience: details?.experience || '',
      rating: details?.rating || ''
    };
  });
};

const fetchPlayerDetails = async (academyId: string, ids: string[]) => {
  if (!ids?.length) return [];
  const client = await getClientPromise();
  const db = client.db(process.env.MONGODB_DB);

  const allPlayers = await db.collection('ams-player-data')
    .find({ academyId })
    .toArray();

  return ids.map(playerId => {
    const playerData = allPlayers.find(p => String(p.id) === playerId || String(p._id) === playerId) || {};
    return {
      id: playerId,
      name: (playerData as any).name || '',
      position: (playerData as any).position || '',
      age: (playerData as any).age || '',
      attributes: (playerData as any).attributes || {
        overall: (playerData as any).overall || '',
        Attack: (playerData as any).Attack || '',
        pace: (playerData as any).pace || '',
        Physicality: (playerData as any).Physicality || '',
        Defense: (playerData as any).Defense || '',
        passing: (playerData as any).passing || '',
        Technique: (playerData as any).Technique || ''
      },
      averagePerformance: (playerData as any).averagePerformance || '',
      stamina: (playerData as any).stamina || '',
      lastUpdated: (playerData as any).lastUpdated || ''
    };
  });
};

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
        const batches = await db.collection('ams-batches')
          .find({ academyId })
          .toArray();

        // Fetch additional coach and player details for each batch
        const enhancedBatches = await Promise.all(
          batches.map(async (batch: any) => {
            const coachIds = batch.coaches?.map((c: any) => c.id || c._id) || [];
            const playerIds = batch.players?.map((p: any) => p.id || p._id) || [];

            const coachesData = await fetchCoachDetails(academyId, coachIds);
            const playersData = await fetchPlayerDetails(academyId, playerIds);

            return {
              ...batch,
              coaches: coachesData,
              playersData: playersData
            };
          })
        );

        data = enhancedBatches;
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

    // For APK/WebView requests, return CSV file for download
    if (isApkWebViewRequest(request)) {
      let csvContent = '';

      if (collection === 'all' && typeof data === 'object' && !Array.isArray(data)) {
        // For 'all', generate separate CSV sections
        const { players, coaches, batches, finances } = data as any;
        csvContent = [
          'PLAYERS\n' + formatCSV(players || [], 'players'),
          '\n\nCOACHES\n' + formatCSV(coaches || [], 'coaches'),
          '\n\nBATCHES\n' + formatCSV(batches || [], 'batches'),
          '\n\nFINANCES\n' + formatFinancialData(finances || []).income.map(i => Object.values(i).join(',')).join('\n') +
            '\n\nEXPENSES\n' + formatFinancialData(finances || []).expenses.map(e => Object.values(e).join(',')).join('\n')
        ].join('\n\n');
      } else {
        csvContent = formatCSV(Array.isArray(data) ? data : [data], collection || 'data');
      }

      const filename = `export-${collection ?? 'data'}.csv`;

      return new Response(csvContent, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
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
