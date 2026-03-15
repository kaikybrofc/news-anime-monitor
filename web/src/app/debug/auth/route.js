import { NextResponse } from "next/server";
import {
  createDebugSessionCookie,
  getDebugDashboardPassword,
  isDebugPasswordValid,
} from "@/lib/debug-auth";

function buildRelativeLocation(pathname = "/", query = {}) {
  const url = new URL(pathname, "http://localhost");
  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    url.searchParams.set(key, String(value));
  });
  return `${url.pathname}${url.search}`;
}

function redirectRelative(pathname, query = {}) {
  const location = buildRelativeLocation(pathname, query);
  return new NextResponse(null, {
    status: 303,
    headers: {
      Location: location,
    },
  });
}

export async function POST(request) {
  const formData = await request.formData();
  const password = String(formData.get("password") || "").trim();

  if (!getDebugDashboardPassword()) {
    return redirectRelative("/debug/login", { error: "not_configured" });
  }

  if (!password) {
    return redirectRelative("/debug/login", { error: "password_missing" });
  }

  if (!isDebugPasswordValid(password)) {
    return redirectRelative("/debug/login", { error: "invalid_password" });
  }

  const response = redirectRelative("/debug");
  const sessionCookie = createDebugSessionCookie();
  response.cookies.set(
    sessionCookie.name,
    sessionCookie.value,
    sessionCookie.options
  );

  return response;
}
