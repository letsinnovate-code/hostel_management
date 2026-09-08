import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('hostel_token')?.value;

  // Paths that require authentication
  const protectedPrefixes = [
    '/student',
    '/owner',
    '/warden',
    '/cleaner',
    '/security',
    '/superadmin',
  ];

  const isSuperadminLogin = pathname === '/superadmin/login';
  const isProtectedPath = protectedPrefixes.some(prefix => pathname.startsWith(prefix)) && !isSuperadminLogin;

  if (isProtectedPath && !token) {
    const loginUrl = new URL(
      pathname.startsWith('/superadmin') ? '/superadmin/login' : '/login',
      request.url
    );
    loginUrl.searchParams.set('returnUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // If already logged in and visiting /login or /register, allow them to proceed or let client navigate
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/student/:path*',
    '/owner/:path*',
    '/warden/:path*',
    '/cleaner/:path*',
    '/security/:path*',
    '/superadmin/:path*',
  ],
};
