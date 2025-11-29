import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function proxy(req: NextRequest) {
    const url = req.nextUrl

    // internal 鉴权
    if (url.pathname.startsWith('/internal')) {

        // 1. header 优先
        let token = req.headers.get('Authorization')?.replace(/Bearer /i, '') || null;
        // 2. 其次 query ?auth=xxx 或 ?token=xxx
        if (!token) {
            const params = url.searchParams
            token = params.get('auth') ?? params.get('token')
        }

        const valid = process.env.INTERNAL_TOKEN
        if (!token || !valid || token !== valid) {
            return NextResponse.json(
                { ok: false, error: 'Unauthorized' },
                { status: 401 }
            )
        }
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        '/internal/:path*',
    ],
}
