
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // We can't easily check Firebase Auth server-side without cookies
  // but we can protect routes by looking for a 'session' hint if we were using it.
  // For this scaffold, we'll implement heavy client-side redirection in the provider
  // or layout, but we define the matcher here for clarity.
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/ujian/:path*', '/admin/:path*'],
};
