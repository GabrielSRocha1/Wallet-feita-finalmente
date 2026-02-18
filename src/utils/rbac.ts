export const ADMIN_WALLETS = [
    "Da51JLCnUfN3L3RDNeYkn7kxr7C3otnLaLvbsjmTTzE8",
    process.env.NEXT_PUBLIC_ADMIN_WALLET_ADDRESS || "",
].filter(Boolean);

// Função para verificar se é admin (Sem suporte a abreviações por segurança)
export const isAdmin = (walletAddress: string | null | undefined): boolean => {
    if (!walletAddress) return false;

    // Converte para string para garantir tipo correto (PublicKey vs string)
    const address = walletAddress.toString().trim();

    return ADMIN_WALLETS.some(admin => {
        const adminAddress = admin.trim();
        // Comparação EXATA: Solana addresses são case-sensitive (Base58)
        return address === adminAddress;
    });
};

export const ROUTES = {
    ADMIN_DASHBOARD: '/',
    CLIENT_DASHBOARD: '/home-cliente',
    CREATE_CONTRACT: '/contract-creation',
    SETTINGS: '/configuracao',
    CONTRACT_DETAILS: '/contrato-detalhes' // Shared route? Or Client restricted?
};

// List of routes restricted to ADMIN only
export const ADMIN_ONLY_ROUTES = [
    ROUTES.ADMIN_DASHBOARD,
    ROUTES.CREATE_CONTRACT,
    ROUTES.SETTINGS
];

// List of routes available to CLIENT
export const CLIENT_ALLOWED_ROUTES = [
    ROUTES.CLIENT_DASHBOARD,
    ROUTES.CONTRACT_DETAILS
];

/**
 * Check if the current route is allowed for the given wallet address.
 * returns true if allowed, false otherwise.
 */
export const isRouteAllowed = (path: string, walletAddress: string | null | undefined): boolean => {
    const isUserAdmin = isAdmin(walletAddress);

    // If Admin, allowed everywhere (except maybe login if logged in, but let's assume allowed)
    if (isUserAdmin) return true;

    // If Client (not admin)
    // Check if path is in allowed list (exact match or starts within for sub-routes if needed)
    // For simplicity, checking if path is one of the explicitly allowed client routes
    // OR if the path is NOT in the admin only list (safer is whitelist approach)

    // Whitelist approach:
    // /home-cliente and /contrato-detalhes are allowed.
    // Root '/' is Admin dashboard -> blocked.
    // /configuracao -> blocked.

    if (path === ROUTES.CLIENT_DASHBOARD || path.startsWith(ROUTES.CONTRACT_DETAILS)) {
        return true;
    }

    return false;
};

export const getWalletCookie = (): string | null => {
    if (typeof document === 'undefined') return null;
    const value = `; ${document.cookie}`;
    const parts = value.split(`; wallet_address=`);
    if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
    return null;
};
