export const dynamic = 'force-dynamic';

import { currentTournamentMeta } from '@/app/lib/tournament-config';
import { getScorecardCache, readLeaderboardCache, normName } from '@/app/lib/scorecard-store';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const tournamentId = searchParams.get('tournamentId') ?? 'pga';
  const playerName = searchParams.get('playerName') ?? '';
  // Client-side clock hint: use this round number when it's ahead of what ESPN reports
  const clientRound = parseInt(searchParams.get('round') ?? '') || null;

  const meta = currentTournamentMeta(tournamentId);
  if (!meta) return Response.json({ error: 'Unknown tournament' }, { status: 400 });

  const [cache, lbCache] = await Promise.all([
    getScorecardCache(tournamentId),
    readLeaderboardCache(tournamentId),
  ]);

  // Prefer the client-side clock round when it's ahead (midnight CST transition)
  const currentRound = Math.max(clientRound ?? 1, lbCache?.currentRound ?? 1);

  if (cache) {
    const stored = Object.values(cache.players).find(
      (p) => normName(p.playerName) === normName(playerName),
    );

    const completedRounds = stored?.rounds ?? [];
    const maxStoredRound = completedRounds.length
      ? Math.max(...completedRounds.map((r) => r.roundId))
      : 0;

    // Build completed rounds for response
    const rounds = completedRounds.map((r) => {
      const toPar = r.holes.reduce((sum, h) => sum + h.score - h.par, 0);
      const score = toPar === 0 ? 'E' : toPar > 0 ? `+${toPar}` : String(toPar);
      return {
        round: r.roundId,
        score,
        holes: r.holes.map((h) => ({
          hole: h.holeNumber,
          par: h.par,
          score: h.score,
          label: String(h.score),
        })),
      };
    });

    // If the player hasn't started the current round, add an empty template round
    if (currentRound > maxStoredRound) {
      // Find par template from any cached player's data
      let parTemplate: { holeNumber: number; par: number }[] | null = null;
      for (const p of Object.values(cache.players)) {
        const templateRound = p.rounds.find((r) => r.roundId === currentRound) ?? p.rounds[0];
        if (templateRound?.holes.length === 18) {
          parTemplate = templateRound.holes.map((h) => ({
            holeNumber: h.holeNumber,
            par: h.par,
          }));
          break;
        }
      }

      if (parTemplate) {
        rounds.push({
          round: currentRound,
          score: null as unknown as string,
          holes: parTemplate.map((h) => ({
            hole: h.holeNumber,
            par: h.par,
            score: null as unknown as number,
            label: '',
          })),
        });
      }
    }

    if (rounds.length > 0) {
      return Response.json({
        courseName: meta.courseName,
        par: meta.par,
        rounds,
        source: 'cache',
      });
    }
  }

  return Response.json({
    courseName: meta.courseName,
    par: meta.par,
    rounds: [],
    source: 'unavailable',
    message: 'Scorecard data is not yet available for this round.',
  });
}
