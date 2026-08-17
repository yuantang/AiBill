import { NextResponse } from "next/server";
import { auth } from "@/auth";

export async function requireUser() {
  const session = await auth();
  const userId = session?.user?.id;
  const email = session?.user?.email;
  if (!userId || !email) {
    return { error: NextResponse.json({ error: "Sign in first" }, { status: 401 }) };
  }
  return { userId, email };
}
