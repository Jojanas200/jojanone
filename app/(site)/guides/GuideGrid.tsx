"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { guides, siteHref } from "@/content/site";

/**
 * The guide library with its category filter. Filtering happens here rather
 * than on the server because the whole library is nine cards - a round trip to
 * hide six of them would be slower and no more correct.
 */
export function GuideGrid() {
  const [active, setActive] = useState("all");

  const shown =
    active === "all"
      ? guides.guides
      : guides.guides.filter((guide) => guide.category === active);

  return (
    <>
      <div className="s-toc" style={{ marginBottom: 40 }}>
        {guides.filters.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setActive(filter.value)}
            className={`s-filter ${active === filter.value ? "is-active" : ""}`}
            aria-pressed={active === filter.value}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="s-grid s-grid-3" style={{ marginTop: 0 }}>
        {shown.map((guide) => (
          <Link
            key={guide.id}
            href={siteHref(guide.href)}
            className="s-card s-card-link"
            style={{ height: "100%" }}
          >
            <span className="s-tag">{guide.categoryLabel}</span>
            <h3 className="s-h4" style={{ margin: "14px 0 10px" }}>
              {guide.title}
            </h3>
            <p className="s-small">{guide.description}</p>
            <span
              className="s-link-blue"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                marginTop: 18,
                fontSize: 14,
              }}
            >
              {guide.readTime}
              <ChevronRight size={14} />
            </span>
          </Link>
        ))}
      </div>
    </>
  );
}
