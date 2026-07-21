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
    const record = await db.registration.create({ data: payload });
return NextResponse.json({ id: record.id }, { status: 201 });
    return NextResponse.json({ id }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Something went wrong. Call Rebecca." },
      { status: 500 }
    );
  }
}
