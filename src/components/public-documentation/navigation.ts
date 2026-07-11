import type { MouseEvent } from "react";

export function shouldHandlePublicDocumentationClick(
  event: MouseEvent<HTMLElement>,
  href: string,
) {
  if (
    event.defaultPrevented ||
    event.button !== 0 ||
    event.metaKey ||
    event.ctrlKey ||
    event.shiftKey ||
    event.altKey ||
    !isPublicDocumentationHref(href)
  ) {
    return false;
  }

  const url = new URL(href, window.location.href);
  return url.origin === window.location.origin;
}

export function isPublicDocumentationHref(value: string) {
  try {
    const pathname = /^https?:\/\//i.test(value)
      ? new URL(value).pathname
      : value.split(/[?#]/, 1)[0];

    return (
      pathname === "/docs" ||
      pathname.startsWith("/docs/") ||
      pathname === "/guides" ||
      pathname.startsWith("/guides/") ||
      pathname === "/reference" ||
      pathname.startsWith("/reference/") ||
      /^\/v\/[^/]+\/(?:guides|reference)(?:\/|$)/.test(pathname) ||
      /^\/[^/]+\/(?:docs|reference)(?:\/|$)/.test(pathname)
    );
  } catch {
    return false;
  }
}
