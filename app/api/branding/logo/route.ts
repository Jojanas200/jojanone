import { NextResponse } from "next/server";
import { getSessionUser } from "@/server/auth/session";
import { createClient } from "@/lib/supabase/server";
import { getActiveWorkspaceId } from "@/server/services/workspaces";
import { getCurrentLogo } from "@/server/services/documents";

const BUCKET = "evidence";

/**
 * Streams the workspace's brand logo from the private 'evidence' bucket.
 * Auth + RLS-scoped, so members only ever see their own workspace's logo, and
 * there's no expiring signed URL to juggle. Cache-bust via ?v=<logo id>.
 */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const claims = { sub: user.sub };

  const ws = await getActiveWorkspaceId(claims);
  if (!ws) return new NextResponse("Not found", { status: 404 });

  const logo = await getCurrentLogo(claims);
  if (!logo?.objectKey) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .download(logo.objectKey);
  if (error || !data) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(await data.arrayBuffer(), {
    headers: {
      "Content-Type": logo.mimeType ?? "image/png",
      // Private to the viewer; short cache. The ?v=<id> query busts on change.
      "Cache-Control": "private, max-age=300",
    },
  });
}
