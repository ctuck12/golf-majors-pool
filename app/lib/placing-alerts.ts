// "In the money" alerts during a live tournament: who is in their league's paying places right
// now, and when a change is worth a notification. Kept free of I/O so it can be tested.

export type PlacingEntry = { userId: string; golferIds: number[] };
export type Placing = { userId: string; points: number; rank: number; tied: boolean; inMoney: boolean };

// Live standings for one league. Rank is 1 + the number of entries with more points. An entry is
// in the money only when it holds a paying spot outright: if a tie spills past the last paid
// place (e.g. everyone level on 0 points at the start), the tied entries are not counted in yet.
export function leaguePlacings(entries: PlacingEntry[], pointsByGolfer: Map<number, number>, places: number): Placing[] {
  const totals = entries.map((e) => ({
    userId: e.userId,
    points: Math.round(e.golferIds.reduce((sum, id) => sum + (pointsByGolfer.get(id) ?? 0), 0) * 10) / 10,
  }));
  return totals.map((t) => {
    const ahead = totals.filter((o) => o.points > t.points).length;
    const level = totals.filter((o) => o.points === t.points).length;
    return {
      userId: t.userId,
      points: t.points,
      rank: ahead + 1,
      tied: level > 1,
      inMoney: ahead + level <= places,
    };
  });
}

export type AlertState = {
  // In the money as of the last notification (members start out of it).
  notified: boolean;
  // A change seen but not yet sent, and since when.
  pending?: boolean;
  pendingSince?: number;
  lastSentAt?: number;
};

export const HOLD_MS = 10 * 60 * 1000; // a change has to last 10 minutes
export const COOLDOWN_MS = 45 * 60 * 1000; // and alerts are at least 45 minutes apart

// Given the last state and whether the member is in the money now: send an alert or not, and the
// state to keep. Back-and-forth swings inside the hold time never notify.
export function nextAlert(state: AlertState | undefined, inMoney: boolean, now: number): { send: boolean; state: AlertState } {
  const s: AlertState = state ?? { notified: false };
  if (inMoney === s.notified) return { send: false, state: { notified: s.notified, lastSentAt: s.lastSentAt } };
  if (s.pending !== inMoney || s.pendingSince === undefined) {
    return { send: false, state: { ...s, pending: inMoney, pendingSince: now } };
  }
  if (now - s.pendingSince < HOLD_MS) return { send: false, state: s };
  if (s.lastSentAt !== undefined && now - s.lastSentAt < COOLDOWN_MS) return { send: false, state: s };
  return { send: true, state: { notified: inMoney, lastSentAt: now } };
}
