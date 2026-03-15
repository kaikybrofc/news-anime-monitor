import { NextResponse } from "next/server";
import { DEBUG_SESSION_COOKIE } from "@/lib/debug-auth";

function clearSessionCookie(response) {
  response.cookies.set(DEBUG_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  });
}

function redirectToLogin(request) {
  const loginUrl = new URL("/debug/login", request.url);
  const response = NextResponse.redirect(loginUrl, { status: 303 });
  clearSessionCookie(response);
  return response;
}

export async function POST(request) {
  return redirectToLogin(request);
}

export async function GET(request) {
  return redirectToLogin(request);
}
