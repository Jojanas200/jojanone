import { NextResponse } from "next/server";
import { getClaims } from "@/server/auth/session";
import { adoptPolicy } from "@/server/services/policies";

// Adopt a policy: runs the Jova Policy Check server-side and refuses while
// critical issues remain, so a document can never be adopted with unresolved
// placeholders, missing core sections or advice inside the wording.
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const claims = await getClaims();
  if (!claims)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const result = await adoptPolicy(claims, id);
  if (!result)
    return NextResponse.json({ error: "not found" }, { status: 404 });
  if (!result.ok)
    return NextResponse.json(
      {
        error: "Critical issues must be resolved before adoption.",
        check: result.check,
      },
      { status: 409 },
    );
  return NextResponse.json({ policy: result.policy, check: result.check });
}
