import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
export async function middleware(request: NextRequest) { return updateSession(request); }
export const config = { matcher: ["/home/:path*", "/overview/:path*", "/analysis/:path*", "/discover/:path*", "/technical/:path*", "/sentiment/:path*", "/portfolio/:path*"] };
