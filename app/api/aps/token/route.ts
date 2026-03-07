import { NextResponse } from 'next/server';

export async function GET() {
    const client_id = process.env.APS_CLIENT_ID;
    const client_secret = process.env.APS_CLIENT_SECRET;

    if (!client_id || !client_secret) {
        return NextResponse.json({ error: 'APS Credentials missing' }, { status: 500 });
    }

    try {
        const response = await fetch('https://developer.api.autodesk.com/authentication/v2/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
                client_id,
                client_secret,
                grant_type: 'client_credentials',
                scope: 'viewables:read',
            }),
        });

        const data = await response.json();
        return NextResponse.json({
            ...data,
            urn: process.env.APS_URN
        });
    } catch (error) {
        return NextResponse.json({ error: 'Failed to fetch token' }, { status: 500 });
    }
}
