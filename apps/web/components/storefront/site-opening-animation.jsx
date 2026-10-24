"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Image from "next/image";

export default function SiteOpeningAnimation() {
  const pathname = usePathname();
  const [isDone, setIsDone] = useState(false);

  useEffect(() => {
    // Exactly 1.5s (1500ms) animation + 50ms buffer to unmount cleanly
    const timer = setTimeout(() => {
      setIsDone(true);
    }, 1550);

    return () => clearTimeout(timer);
  }, []);

  // Do not show opening splash on administrative back-office routes
  if (pathname?.startsWith("/admin")) {
    return null;
  }

  if (isDone) {
    return null;
  }

  return (
    <div className="site-intro-curtain" aria-hidden="true">
      <div className="site-intro-content">
        <div className="site-intro-emblem">
          <Image
            src="/images/xura-brand-mark.png"
            alt="Xura Lab"
            width={46}
            height={46}
            priority
          />
        </div>
        <span className="site-intro-wordmark">XURA LAB</span>
        <div className="site-intro-accent-line" />
        <span className="site-intro-tagline">FRAGRANCE</span>
      </div>
    </div>
  );
}
