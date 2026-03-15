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

function redirectToLogin() {
  const response = new NextResponse(null, {
    status: 303,
    headers: {
      Location: "/debug/login",
    },
  });
  clearSessionCookie(response);
  return response;
}

export async function POST() {
  return redirectToLogin();
}

export async function GET() {
  return redirectToLogin();
}
