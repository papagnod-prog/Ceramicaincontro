import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import {
  PAGE_META, DEFAULT_DESCRIPTION, DEFAULT_IMAGE, SITE_NAME,
  canonicalUrl, fullTitle, isNoindexPath,
} from "@/lib/seo.mjs";

const upsert = (selector, create, attrs) => {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
  return el;
};
const meta = (key, content, attr = "name") =>
  upsert(`meta[${attr}="${key}"]`, () => {
    const m = document.createElement("meta");
    m.setAttribute(attr, key);
    return m;
  }, { content });

/**
 * Sets document.title to "<page title> | Ceramica Incontro" for as long as
 * the component using it is mounted, and restores the previous title on
 * unmount (so navigating between pages never leaves a stale tab name).
 * Pass just the page name — the site name is appended automatically.
 *
 * It also keeps the SEO tags in <head> in sync with the current page:
 * description, canonical, robots (private pages are "noindex"), the
 * link-sharing preview (Open Graph) and, when given, the JSON-LD data.
 * Values for the fixed public pages come from PAGE_META in lib/seo.mjs;
 * pages with live data (product page) pass them in `seo`.
 */
export function usePageTitle(pageTitle, seo = {}) {
  const { pathname } = useLocation();
  const fixed = PAGE_META[pathname.replace(/\/+$/, "") || "/"] || {};
  const description = seo.description || fixed.description || DEFAULT_DESCRIPTION;
  const image = seo.image || DEFAULT_IMAGE;
  const noindex = seo.noindex || isNoindexPath(pathname);
  const jsonLd = seo.jsonLd ? JSON.stringify(seo.jsonLd) : "";
  const ogType = seo.ogType || "website";

  useEffect(() => {
    const previous = document.title;
    const title = fullTitle(pageTitle);
    document.title = title;
    const url = canonicalUrl(pathname);

    meta("description", description);
    meta("robots", noindex ? "noindex, nofollow" : "index, follow");
    upsert('link[rel="canonical"]', () => {
      const l = document.createElement("link");
      l.setAttribute("rel", "canonical");
      return l;
    }, { href: url });
    meta("og:site_name", SITE_NAME, "property");
    meta("og:locale", "it_IT", "property");
    meta("og:type", ogType, "property");
    meta("og:title", title, "property");
    meta("og:description", description, "property");
    meta("og:url", url, "property");
    meta("og:image", image, "property");
    meta("twitter:card", "summary_large_image");

    let ld = document.getElementById("ld-json");
    if (jsonLd) {
      if (!ld) {
        ld = document.createElement("script");
        ld.type = "application/ld+json";
        ld.id = "ld-json";
        document.head.appendChild(ld);
      }
      ld.textContent = jsonLd;
    } else if (ld) {
      ld.remove();
    }

    return () => {
      document.title = previous;
    };
  }, [pageTitle, pathname, description, image, noindex, jsonLd, ogType]);
}
