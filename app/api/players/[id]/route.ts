import { getPlayers } from '@/lib/db';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const players = await getPlayers();
    const player = await players.findOne({ playerId: id });

    if (!player) {
      return Response.json({ error: 'player not found' }, { status: 404 });
    }

    return Response.json({ player });
  } catch (err) {
    console.error('[players/[id] GET]', err);
    return Response.json({ error: 'internal error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const players = await getPlayers();

    const updateFields: Record<string, unknown> = {};
    const allowedFields = ['username', 'level', 'xp', 'questsCompleted', 'totalDistance', 'achievements', 'lastLocation', 'lastActive'];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields[field] = field === 'lastActive' ? new Date(body[field]) : body[field];
      }
    }

    const result = await players.updateOne({ playerId: id }, { $set: updateFields });

    if (result.matchedCount === 0) {
      return Response.json({ error: 'player not found' }, { status: 404 });
    }

    const updated = await players.findOne({ playerId: id });
    return Response.json({ player: updated });
  } catch (err) {
    console.error('[players/[id] PATCH]', err);
    return Response.json({ error: 'internal error' }, { status: 500 });
  }
}