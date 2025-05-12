import { authOptions } from "@/lib/auth-options";
import db from "@/lib/db";
import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user.id) {
    return NextResponse.json(
      { message: "Unauthenticated" },
      { status: 403 }
    );
  }

  const user = await db.user.findUnique({
    where: { id: session.user.id },
    select: { tokens: true }
  });

  return NextResponse.json({ tokens: user?.tokens ?? 0 });
} 