import { NextResponse } from "next/server";

export async function GET() {
  const today = new Date().toISOString().slice(0, 10);
  return NextResponse.json({ rate: 1, date: today, currency: "USD" });
}
