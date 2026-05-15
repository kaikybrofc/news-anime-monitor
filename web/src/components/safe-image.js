"use client";

import { useState } from "react";
import Image from "next/image";

export function SafeImage({
  src,
  alt,
  fallbackLabel = "Logo Anime Radar",
  className = "",
  fallbackClassName = "",
  ...props
}) {
  const [hasError, setHasError] = useState(false);

  if (!src || hasError) {
    return (
      <div
        className={`relative overflow-hidden bg-slate-100 ${fallbackClassName}`.trim()}
      >
        <Image
          src="/brand/logo-64.png"
          alt={fallbackLabel}
          fill
          sizes="100vw"
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      className={className}
      onError={() => setHasError(true)}
      {...props}
    />
  );
}
