import { getPlayers } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type') ?? 'quests';
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100'), 500);

    const players = await getPlayers();

    let sortField: string;
    const sortOrder = -1;

    if (type === 'level') {
      sortField = 'level';
    } else if (type === 'quests') {
      sortField = 'questsCompleted';
    } else if (type === 'distance') {
      sortField = 'totalDistance';
    } else {
      sortField = 'questsCompleted';
    }

    const leaderboard = await players
      .find({
        $or: [
          { level: { $ne: 1 } },
          { xp: { $ne: 0 } },
          { questsCompleted: { $ne: 0 } },
        ],
      })
      .sort({ [sortField]: sortOrder, xp: -1 })
      .limit(limit)
      .toArray();

    const ranked = leaderboard.map((p, i) => ({
      rank: i + 1,
      playerId: p.playerId,
      username: p.username,
      level: p.level,
      xp: p.xp,
      questsCompleted: p.questsCompleted,
      totalDistance: p.totalDistance,
    }));

    return Response.json({ type, leaderboard: ranked });
  } catch (err) {
    console.error('[leaderboard GET]', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
};