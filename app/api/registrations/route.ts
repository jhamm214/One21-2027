import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    // basic validation
    if (!payload.agent_name || !payload.email || !payload.office) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    // persist the registration here — DB insert, sheet append, whatever you're using
    const id = /* your saved record id */ "";

    return NextResponse.json({ id }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Call Rebecca." },
      { status: 500 }
    );
  }
}
