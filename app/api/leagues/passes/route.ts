import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { currentSeason } from '../../../lib/league-passes';
import { getSessionContext, listUnusedPasses, SESSION_COOKIE_NAME } from '../../../lib/pool-store';
import { purchasesConfigured } from '../../../lib/revenuecat';

// GET → the current season, whether purchases are set up, and this user's paid-but-unused passes.
export async function GET() {
  const cookieStore = await cookies();
  const session = await getSessionContext(cookieStore.get(SESSION_COOKIE_NAME)?.value);

  if (!session.user) {
    return NextResponse.json({ error: 'Sign in to see your passes.' }, { status: 401 });
  }

  const configured = purchasesConfigured();
  try {
    const unused = configured ? await listUnusedPasses(session.user.id) : [];
    return NextResponse.json({
      season: currentSeason(),
      configured,
      unused: unused.map((pass) => ({
        id: pass.id,
        productId: pass.product_id,
        purchasedAt: pass.purchased_at?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to load your passes.' },
      { status: 502 },
    );
  }
}
