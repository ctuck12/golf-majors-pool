import { NextResponse } from 'next/server';

// Self-service reset used to set a new password for any email with no proof of ownership, which let
// anyone take over any account. Until emailed reset links land (Supabase Auth, Phase 2), resets go
// through the commissioner, who can already set a member's password from the members tool.
export async function POST() {
  return NextResponse.json(
    { error: 'Password resets are handled by your commissioner for now. Ask them to set a new password for you.' },
    { status: 403 },
  );
}
