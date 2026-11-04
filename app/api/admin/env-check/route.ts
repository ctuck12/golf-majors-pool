import { requireAdminRequest } from '@/app/lib/admin-auth';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const denied = await requireAdminRequest(request);
  if (denied) return denied;

  return Response.json({
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
    VERCEL_ENV: process.env.VERCEL_ENV,
  });
}
