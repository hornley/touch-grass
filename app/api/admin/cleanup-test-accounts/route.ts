import { NextResponse } from 'next/server';
import { getPlayers, getPresence } from '@/lib/db';

const ALLOW_DB_RESET = process.env.ALLOW_DB_RESET === 'true';

export async function POST() {
  if (!ALLOW_DB_RESET) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const players = await getPlayers();
  const presence = await getPresence();

  const playerFilter = {
    username: { $regex: /^Traveler #/ },
    level: 1,
    xp: 0,
    questsCompleted: 0,
  };

  const playerIds = await players
    .find(playerFilter, { projection: { playerId: 1 } })
    .toArray();

  const ids = playerIds.map((doc) => doc.playerId);

  const playerResult = await players.deleteMany(playerFilter);
  const presenceResult = ids.length
    ? await presence.deleteMany({ playerId: { $in: ids } })
    : { deletedCount: 0 };

  return NextResponse.json({
    deletedPlayers: playerResult.deletedCount ?? 0,
    deletedPresence: presenceResult.deletedCount ?? 0,
  });
}
