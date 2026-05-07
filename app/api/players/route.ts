import { getPlayers } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { playerId, username, level, xp, questsCompleted, totalDistance, achievements, lastLocation } = body;

    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      return Response.json({ error: 'username required' }, { status: 400 });
    }

    const players = await getPlayers();
    const finalPlayerId = playerId || crypto.randomUUID();

    if (playerId) {
      const existing = await players.findOne({ playerId });
      if (existing) {
        await players.updateOne(
          { playerId },
          {
            $set: {
              username: username.trim(),
              level: level ?? existing.level,
              xp: xp ?? existing.xp,
              questsCompleted: questsCompleted ?? existing.questsCompleted,
              totalDistance: totalDistance ?? existing.totalDistance,
              achievements: achievements ?? existing.achievements,
              lastLocation: lastLocation ?? existing.lastLocation,
              lastActive: new Date(),
            },
          }
        );
        return Response.json({ playerId: finalPlayerId, username: username.trim(), isNew: false });
      }
    }

    await players.insertOne({
      playerId: finalPlayerId,
      username: username.trim(),
      level: level ?? 1,
      xp: xp ?? 0,
      questsCompleted: questsCompleted ?? 0,
      totalDistance: totalDistance ?? 0,
      achievements: achievements ?? [],
      lastLocation: lastLocation ?? null,
      lastActive: new Date(),
      createdAt: new Date(),
    });

    return Response.json({ playerId: finalPlayerId, username: username.trim(), isNew: true });
  } catch (err) {
    console.error('[players POST]', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '100'), 500);
    const players = await getPlayers();

    const topPlayers = await players
      .find({})
      .sort({ questsCompleted: -1, level: -1 })
      .limit(limit)
      .toArray();

    return Response.json({ players: topPlayers });
  } catch (err) {
    console.error('[players GET]', err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}