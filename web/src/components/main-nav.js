"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { siteNav } from "@/lib/site-nav";

function isActive(pathname, href) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MainNav() {
  const pathname = usePathname();

  return (
    <nav className="main-nav" aria-label="Navegacao principal">
      <div className="flex items-center gap-1">
        {siteNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-link ${isActive(pathname, item.href) ? "active" : ""}`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
