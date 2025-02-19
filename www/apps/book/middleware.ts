import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname.replace("/index.html.md", "")
  if (
    !path.startsWith("/resources") &&
    !path.startsWith("/ui") &&
    !path.startsWith("/api") &&
    !path.startsWith("/user-guide")
  ) {
    return NextResponse.rewrite(
      new URL(`/md-content${path.replace("/index.html.md", "")}`, request.url)
    )
  }
}

export const config = {
  matcher: "/:path*/index.html.md",
}
