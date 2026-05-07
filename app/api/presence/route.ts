import { getPlayers } from '@/lib/db';
import { calculateDistance } from '@/lib/game';

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const lat = parseFloat(url.searchParams.get('lat') ?? '');
    const lng = parseFloat(url.searchParams.get('lng') ?? '');
    const radius = Math.min(parseInt(url.searchParams.get('radius') ?? '500'), 2000);
    const currentPlayerId = url.searchParams.get('playerId') ?? '';

    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return Response.json({ error: 'lat and lng required' }, { status: 400 });
    }

    const players = await getPlayers();

    const allPlayers = await players
      .find({ lastLocation: { $ne: null } })
      .toArray();

    const nearby = allPlayers
      .filter(p => p.lastLocation)
      .filter(p => {
        // Always include self
        if (p.playerId === currentPlayerId) return true;
        // Filter out accounts with level 1, 0 XP, and 0 quests
        return !(p.level === 1 && p.xp === 0 && p.questsCompleted === 0);
      })
      .map(p => ({
        playerId: p.playerId,
        username: p.username,
        level: p.level,
        lastLocation: p.lastLocation,
        distanceM: calculateDistance(lat, lng, p.lastLocation!.lat, p.lastLocation!.lng),
      }))
      .filter(p => p.distanceM <= radius)
      .sort((a, b) => a.distanceM - b.distanceM)
      .slice(0, 50);

    return Response.json({ nearby, center: { lat, lng }, radius });
  } catch (err) {
    console.error('[presence GET]', err);
    return Response.json({ error: 'internal error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { playerId, username, lat, lng } = body;

    if (!playerId || !username || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      return Response.json({ error: 'playerId, username, lat, lng required' }, { status: 400 });
    }

    const players = await getPlayers();
    const player = await players.findOne({ playerId });

    if (!player) {
      return Response.json({ error: 'player not found — must create player first' }, { status: 404 });
    }

    await players.updateOne(
      { playerId },
      {
        $set: {
          lastLocation: { lat, lng },
          lastActive: new Date(),
          username: username.trim(),
        },
      }
    );

    return Response.json({ ok: true, updatedAt: new Date() });
  } catch (err) {
    console.error('[presence POST]', err);
    return Response.json({ error: 'internal error' }, { status: 500 });
  }
}