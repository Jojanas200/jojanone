"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fades content up as it enters the viewport - the one motion idiom the
 * project owner's design uses throughout.
 *
 * Deliberately not a motion library: the effect is two CSS properties, and the
 * marketing site is the one place where shipping less JavaScript is visible to
 * the visitor. The hidden state lives behind `.s-js` (stamped by the layout),
 * so a visitor without JavaScript reads the whole page rather than a blank one.
 */
export function Reveal({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
}: {
  children: React.ReactNode;
  /** Stagger, in ms, for items revealed as a group. */
  delay?: number;
  as?: "div" | "section" | "li" | "article";
  className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Anything already on screen at mount reveals immediately; IntersectionObserver
    // fires on first observe, so this needs no separate initial check.
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <Tag
      ref={ref as React.Ref<never>}
      className={`s-reveal ${shown ? "is-in" : ""} ${className}`.trim()}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
