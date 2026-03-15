import { NextResponse } from "next/server";
import {
  createDebugSessionCookie,
  getDebugDashboardPassword,
  isDebugPasswordValid,
} from "@/lib/debug-auth";

export async function POST(request) {
  const formData = await request.formData();
  const password = String(formData.get("password") || "").trim();

  const loginUrl = new URL("/debug/login", request.url);
  const dashboardUrl = new URL("/debug", request.url);

  if (!getDebugDashboardPassword()) {
    loginUrl.searchParams.set("error", "not_configured");
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  if (!password) {
    loginUrl.searchParams.set("error", "password_missing");
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  if (!isDebugPasswordValid(password)) {
    loginUrl.searchParams.set("error", "invalid_password");
    return NextResponse.redirect(loginUrl, { status: 303 });
  }

  const response = NextResponse.redirect(dashboardUrl, { status: 303 });
  const sessionCookie = createDebugSessionCookie();
  response.cookies.set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.options
  );

  return response;
}
