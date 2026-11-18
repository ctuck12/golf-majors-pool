import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { claimReminder, getSessionContext, SESSION_COOKIE_NAME, TOURNAMENT_IDS, type TournamentId } from '../../../lib/pool-store';
import { isEmailConfigured, sendReminderEmail } from '../../../lib/email';

const NAMES: Record<TournamentId, string> = {
  players: 'The Players',
  masters: 'The Masters',
  pga: 'PGA Championship',
  'us-open': 'U.S. Open',
  open: 'The Open',
};

// The commissioner emails a reminder: { kind: 'pay' } to members with picks in who haven't paid,
// { kind: 'picks' } to members without picks. One of each every few hours.
export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = await getSessionContext(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session.user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });
  if (session.pool?.role !== 'commissioner') {
    return NextResponse.json({ error: 'You do not have access to commissioner tools.' }, { status: 403 });
  }
  if (!isEmailConfigured()) return NextResponse.json({ error: 'Email is not set up yet.' }, { status: 503 });
  try {
    const body = (await request.json()) as { tournamentId?: string; kind?: string };
    const tournamentId = body.tournamentId as TournamentId;
    if (!TOURNAMENT_IDS.includes(tournamentId)) return NextResponse.json({ error: 'Unknown tournament.' }, { status: 400 });
    if (body.kind !== 'pay' && body.kind !== 'picks') return NextResponse.json({ error: 'Unknown reminder.' }, { status: 400 });
    const kind = body.kind;
    const { leagueName, entryFee, recipients } = await claimReminder(session.user.id, tournamentId, kind);
    const commissionerName = session.user.displayName;
    const results = await Promise.allSettled(
      recipients.map((r) =>
        sendReminderEmail({ to: r.email, displayName: r.display_name, kind, leagueName, tournamentName: NAMES[tournamentId], entryFee, commissionerName }),
      ),
    );
    return NextResponse.json({
      sent: results.filter((r) => r.status === 'fulfilled').length,
      failed: results.filter((r) => r.status === 'rejected').length,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to send reminders.' }, { status: 400 });
  }
}
