import { useEffect } from "react";

const SITE_NAME = "Ceramica Incontro";

/**
 * Sets document.title to "<page title> | Ceramica Incontro" for as long as
 * the component using it is mounted, and restores the previous title on
 * unmount (so navigating between pages never leaves a stale tab name).
 * Pass just the page name — the site name is appended automatically.
 */
export function usePageTitle(pageTitle) {
  useEffect(() => {
    const previous = document.title;
    document.title = pageTitle ? `${pageTitle} | ${SITE_NAME}` : SITE_NAME;
    return () => {
      document.title = previous;
    };
  }, [pageTitle]);
}
