import { NextResponse } from 'next/server';

export async function GET() {
    const urn = process.env.APS_URN;
    return NextResponse.json({ urn });
}
