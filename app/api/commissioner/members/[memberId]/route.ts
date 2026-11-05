import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  deletePoolMember,
  getSessionContext,
  SESSION_COOKIE_NAME,
  TOURNAMENT_IDS,
  type TournamentId,
  updatePoolMember,
} from '../../../../lib/pool-store';

function parseTieBreaks(input: unknown) {
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  const parsed: Partial<Record<TournamentId, number | null>> = {};

  for (const tournamentId of TOURNAMENT_IDS) {
    if (Object.prototype.hasOwnProperty.call(input, tournamentId)) {
      const value = (input as Record<string, unknown>)[tournamentId];
      parsed[tournamentId] = value === null ? null : typeof value === 'number' ? value : undefined;
    }
  }

  return parsed;
}

function parseRosters(input: unknown) {
  if (!input || typeof input !== 'object') {
    return undefined;
  }

  const parsed: Partial<Record<TournamentId, unknown>> = {};

  for (const tournamentId of TOURNAMENT_IDS) {
    if (Object.prototype.hasOwnProperty.call(input, tournamentId)) {
      parsed[tournamentId] = (input as Record<string, unknown>)[tournamentId];
    }
  }

  return parsed;
}

export async function PATCH(request: Request, context: { params: Promise<{ memberId: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in to manage pool members.' }, { status: 401 });
  }

  // League tools: only a commissioner of the user's current league.
  if (session.pool?.role !== 'commissioner') {
    return NextResponse.json({ error: 'You do not have access to commissioner tools.' }, { status: 403 });
  }

  try {
    const { memberId } = await context.params;
    const body = (await request.json()) as {
      displayName?: string;
      email?: string;
      password?: string;
      rosters?: unknown;
      tieBreaks?: unknown;
    };

    const member = await updatePoolMember(session.user.id, memberId, {
      displayName: body.displayName,
      email: body.email,
      password: body.password,
      rosters: parseRosters(body.rosters),
      tieBreaks: parseTieBreaks(body.tieBreaks),
    });

    return NextResponse.json({ member });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to update pool member.' },
      { status: 400 },
    );
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ memberId: string }> }) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = await getSessionContext(token);

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in to manage pool members.' }, { status: 401 });
  }

  // League tools: only a commissioner of the user's current league.
  if (session.pool?.role !== 'commissioner') {
    return NextResponse.json({ error: 'You do not have access to commissioner tools.' }, { status: 403 });
  }

  try {
    const { memberId } = await context.params;
    await deletePoolMember(session.user.id, memberId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to delete pool member.' },
      { status: 400 },
    );
  }
}
