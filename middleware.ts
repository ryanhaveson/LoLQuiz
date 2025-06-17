import { getToken } from 'next-auth/jwt';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  const token = await getToken({ req });
  const isAuthenticated = !!token;

  // Allow these routes to be accessed without authentication
  const publicRoutes = ['/signin', '/register', '/api/auth'];
  const isPublicRoute = publicRoutes.some(path => req.nextUrl.pathname.startsWith(path));
  
  // Also allow public assets
  const isPublicAsset = req.nextUrl.pathname.startsWith('/_next') || 
                       req.nextUrl.pathname.includes('/images/');

  if (!isAuthenticated && !isPublicRoute && !isPublicAsset) {
    const signinUrl = req.nextUrl.clone();
    signinUrl.pathname = '/signin';
    return NextResponse.redirect(signinUrl);
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
};
