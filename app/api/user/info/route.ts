import { NextResponse } from 'next/server';
import { getRA } from '@/lib/session';

export async function GET() {
  try {
    const ra = await getRA();
    return NextResponse.json({ ra });
  } catch (error) {
    return NextResponse.json({ ra: null }, { status: 200 });
  }
}
