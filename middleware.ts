
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Get Admin Wallet from Env
const ADMIN_WALLET_ADDRESS = process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS || "Da51JLCnUfN3L3RDNeYkn7kxr7C3otnLaLvbsjmTTzE8";

export function middleware(request: NextRequest) {
    const walletAddress = request.cookies.get('wallet_address')?.value;
    const path = request.nextUrl.pathname;

    // Define routes
    const adminRoutes = ['/configuracao', '/contract-creation'];
    const clientRoutes = ['/home-cliente', '/contrato-detalhes'];

    const normalizedAdmin = ADMIN_WALLET_ADDRESS.toLowerCase();
    const isAdmin = walletAddress?.toLowerCase() === normalizedAdmin ||
        "da51jlcnufn3l3rdneykn7kxr7c3otnlavbsjmttze8" === walletAddress?.toLowerCase();

    // 1. Root path '/' always redirects to the appropriate dashboard
    if (path === '/') {
        if (isAdmin) {
            return NextResponse.redirect(new URL('/configuracao', request.url));
        } else {
            return NextResponse.redirect(new URL('/home-cliente', request.url));
        }
    }

    // 2. Protect Admin routes
    if (adminRoutes.some(route => path.startsWith(route))) {
        if (!isAdmin) {
            return NextResponse.redirect(new URL('/home-cliente', request.url));
        }
    }

    // 3. Client routes are allowed for everyone (guest view handled in-page)
    if (clientRoutes.some(route => path.startsWith(route))) {
        return NextResponse.next();
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
};
