import { NextResponse } from "next/server";
import { z } from "zod";
import { getClaims } from "@/server/auth/session";
import { setUserPrefs } from "@/server/services/prefs";

const schema = z.object({
  digestFrequency: z.enum(["daily", "weekly", "off"]).optional(),
  jovaStyle: z.enum(["concise", "detailed"]).optional(),
});

export async function PATCH(req: Request) {
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success)
    return NextResponse.json(
      { error: "Invalid preferences", issues: parsed.error.issues },
      { status: 400 },
    );
  const prefs = await setUserPrefs(claims, parsed.data);
  return NextResponse.json({ prefs });
}
