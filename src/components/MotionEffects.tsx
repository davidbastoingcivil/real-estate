"use client";

import { useEffect } from "react";

const RIPPLE_TARGETS = [
  ".button", ".nav-cta", ".mobile-cta", ".home-search-submit", ".category-tile", ".quick-filters button",
  ".card-link", ".favorite-button", ".mobile-bottom-nav a", ".results-view-switch button", ".category-pills button",
  ".contact-button", ".financial-dossier-button", ".whatsapp", ".theme-toggle", ".admin-cms-nav",
  ".admin-cms-signout", ".admin-cms-actions a", ".admin-cms-actions button", ".hero-text-link",
].join(",");

const REVEAL_TARGETS = [
  ".property-card", ".category-tile", ".section-heading", ".intro-grid", ".trust-row > div", ".map-frame",
  ".advisor-photo", ".advisor-copy", ".closing-cta > *", ".services-grid article", ".services-steps article",
  ".owner-benefits article", ".owner-process article", ".services-faq details", ".detail-block", ".spec-row",
  ".contact-card", ".financial-calculator", ".avm-card", ".profile-card", ".profile-stats", ".profile-option",
  ".admin-cms-card", ".admin-cms-form-section", ".admin-cms-media-editor", ".admin-page-title",
].join(",");

/**
 * App-like feedback without touching each component:
 * - Material/Flutter style ink ripple on tappable elements.
 * - Staggered fade-up reveal as elements scroll into view (also for lists
 *   rendered after data loads, via MutationObserver).
 * Everything is skipped when the user prefers reduced motion.
 */
export default function MotionEffects() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    root.classList.add("motion-ready");

    function onPointerDown(event: PointerEvent) {
      const target = (event.target as Element | null)?.closest<HTMLElement>(RIPPLE_TARGETS);
      if (!target || target.hasAttribute("disabled")) return;
      const rect = target.getBoundingClientRect();
      const size = Math.max(rect.width, rect.height) * 2.2;
      const ink = document.createElement("span");
      ink.className = "ink-ripple";
      ink.style.width = ink.style.height = `${size}px`;
      ink.style.left = `${event.clientX - rect.left - size / 2}px`;
      ink.style.top = `${event.clientY - rect.top - size / 2}px`;
      if (getComputedStyle(target).position === "static") target.classList.add("ink-host");
      target.appendChild(ink);
      ink.addEventListener("animationend", () => ink.remove(), { once: true });
    }
    document.addEventListener("pointerdown", onPointerDown, { passive: true });

    const io = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-revealed");
        io.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

    const prepare = (scope: ParentNode) => {
      scope.querySelectorAll<HTMLElement>(REVEAL_TARGETS).forEach(element => {
        if (element.dataset.reveal) return;
        element.dataset.reveal = "1";
        const siblings = element.parentElement ? Array.from(element.parentElement.children) : [];
        const index = Math.max(0, siblings.indexOf(element));
        element.style.setProperty("--reveal-delay", `${Math.min(index, 8) * 70}ms`);
        element.classList.add("reveal");
        io.observe(element);
      });
    };
    prepare(document);
    const mo = new MutationObserver(records => {
      for (const record of records) record.addedNodes.forEach(node => { if (node instanceof HTMLElement) prepare(node.parentElement ?? node); });
    });
    mo.observe(document.body, { childList: true, subtree: true });

    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      io.disconnect();
      mo.disconnect();
      root.classList.remove("motion-ready");
    };
  }, []);
  return null;
}
