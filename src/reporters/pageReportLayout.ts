export function escapeReportHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function statusClass(status: string): string {
  return status.toLowerCase();
}

export function renderAccordion(options: {
  id: string;
  title: string;
  subtitle?: string;
  status?: string;
  open?: boolean;
  body: string;
  className?: string;
}): string {
  const statusPill = options.status
    ? `<span class="pill ${statusClass(options.status)}">${escapeReportHtml(options.status)}</span>`
    : "";

  return `<details class="report-accordion ${options.className || ""}" id="${escapeReportHtml(options.id)}"${
    options.open ? " open" : ""
  }>
    <summary class="accordion-summary">
      <span class="accordion-heading">
        <span class="accordion-title">${escapeReportHtml(options.title)}</span>
        ${options.subtitle ? `<span class="accordion-subtitle">${options.subtitle}</span>` : ""}
      </span>
      <span class="accordion-meta">
        ${statusPill}
        <span class="accordion-chevron" aria-hidden="true"></span>
      </span>
    </summary>
    <div class="accordion-body">${options.body}</div>
  </details>`;
}

export const pageReportDashboardCss = `
  :root,
  [data-theme="light"] {
    color-scheme: light;
    --bg: #f0f4f9;
    --bg-elevated: #ffffff;
    --panel: #ffffff;
    --border: #d9e2ec;
    --text: #1f2933;
    --muted: #62748e;
    --accent: #0067c5;
    --accent-soft: rgba(0, 103, 197, 0.1);
    --header-bg: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    --table-head: #eef2f7;
    --row-warn: #fffbeb;
    --row-fail: #fef2f2;
    --shadow: 0 10px 30px rgba(15, 23, 42, 0.08);
    --code-bg: #f8fafc;
  }

  [data-theme="dark"] {
    color-scheme: dark;
    --bg: #0b0f14;
    --bg-elevated: #111820;
    --panel: #151c26;
    --border: #243044;
    --text: #e8edf5;
    --muted: #8b9cb3;
    --accent: #3b82f6;
    --accent-soft: rgba(59, 130, 246, 0.12);
    --header-bg: linear-gradient(135deg, #151c26 0%, #111820 100%);
    --table-head: #1a2330;
    --row-warn: rgba(245, 158, 11, 0.12);
    --row-fail: rgba(239, 68, 68, 0.12);
    --shadow: 0 12px 40px rgba(0, 0, 0, 0.35);
    --code-bg: #0f1419;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    width: 100%;
    font-family: "Inter", "Segoe UI", system-ui, sans-serif;
    background: var(--bg);
    color: var(--text);
    line-height: 1.5;
  }

  .report-shell {
    width: 100%;
    max-width: none;
    margin: 0;
    padding: 24px 28px 48px;
    box-sizing: border-box;
  }

  .report-topbar {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 20px;
  }

  .report-brand {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }

  .report-brand-logo {
    max-height: 50px;
    height: auto;
    width: auto;
    display: block;
    object-fit: contain;
    flex-shrink: 0;
  }

  .report-topbar-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .settings-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 999px;
    border: 1px solid var(--border);
    background: var(--panel);
    color: var(--muted);
    text-decoration: none;
    transition: color 0.15s, border-color 0.15s, background 0.15s;
  }

  .settings-link:hover {
    color: var(--accent);
    border-color: var(--accent);
    background: var(--accent-soft);
  }

  .theme-toggle {
    border: 1px solid var(--border);
    background: var(--panel);
    color: var(--text);
    border-radius: 999px;
    padding: 8px 14px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
  }

  .report-header {
    background: var(--header-bg);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 22px 24px;
    margin-bottom: 20px;
    box-shadow: var(--shadow);
  }

  .report-header h1 {
    margin: 0 0 8px;
    font-size: 1.6rem;
    letter-spacing: -0.02em;
  }

  .report-header .meta-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 10px 18px;
    margin-top: 14px;
    font-size: 14px;
    color: var(--muted);
  }

  .report-header .meta-grid strong { color: var(--text); }

  .report-header a { color: var(--accent); word-break: break-all; }

  .report-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    margin-bottom: 20px;
  }

  .report-actions a {
    display: inline-block;
    padding: 10px 16px;
    background: var(--accent);
    color: #fff !important;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 14px;
  }

  .report-actions a.secondary {
    background: var(--panel);
    color: var(--accent) !important;
    border: 1px solid var(--accent);
  }

  .report-accordions {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .report-accordion {
    border: 1px solid var(--border);
    border-radius: 14px;
    background: var(--panel);
    box-shadow: var(--shadow);
    overflow: hidden;
    scroll-margin-top: 80px;
    transition: box-shadow 0.25s ease, border-color 0.25s ease;
  }

  .report-accordion.module-scroll-target,
  .summary-section.module-scroll-target,
  .summary-results-panel th.module-scroll-target {
    border-color: var(--accent);
    box-shadow: 0 0 0 2px var(--accent-soft), var(--shadow);
  }

  .summary-section,
  .summary-results-panel th[id] {
    scroll-margin-top: 80px;
  }

  .accordion-summary {
    list-style: none;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 18px 20px;
    cursor: pointer;
    user-select: none;
    background: var(--bg-elevated);
    border-bottom: 1px solid transparent;
  }

  .report-accordion[open] .accordion-summary {
    border-bottom-color: var(--border);
  }

  .accordion-summary::-webkit-details-marker { display: none; }

  .accordion-heading {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .accordion-title {
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--text);
  }

  .accordion-subtitle {
    font-size: 13px;
    color: var(--muted);
  }

  .accordion-meta {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .accordion-chevron {
    width: 10px;
    height: 10px;
    border-right: 2px solid var(--muted);
    border-bottom: 2px solid var(--muted);
    transform: rotate(45deg);
    transition: transform 0.2s ease;
    margin-top: -4px;
  }

  .report-accordion[open] .accordion-chevron {
    transform: rotate(225deg);
    margin-top: 4px;
  }

  .accordion-body {
    padding: 18px 20px 22px;
  }

  .panel-subtitle {
    margin: 0 0 14px;
    color: var(--muted);
    font-size: 14px;
  }

  .panel-subtitle a { color: var(--accent); }

  .panel-section-title {
    margin: 20px 0 10px;
    font-size: 0.95rem;
  }

  .pill {
    border-radius: 999px;
    padding: 4px 10px;
    color: #fff;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .pass { background: #18794e; }
  .fail { background: #c92a2a; }
  .warning { background: #b7791f; }
  .skipped, .info { background: #62748e; }

  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    gap: 12px;
  }

  .card {
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 12px;
    background: var(--bg-elevated);
  }

  .card p {
    margin: 8px 0 0;
    font-size: 13px;
    color: var(--muted);
  }

  table {
    border-collapse: collapse;
    width: 100%;
    margin-top: 8px;
    font-size: 13px;
  }

  th, td {
    border: 1px solid var(--border);
    padding: 8px 10px;
    vertical-align: top;
    text-align: left;
  }

  th {
    background: var(--table-head);
    color: var(--muted);
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  pre {
    background: var(--code-bg);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 14px;
    overflow: auto;
    font-size: 12px;
    color: var(--text);
  }

  @media print {
    .no-print { display: none !important; }
    .report-accordion { break-inside: avoid; }
    .accordion-body { display: block !important; }
    .report-accordion .all-meta-scroll,
    .report-accordion .screens-compare-scroll {
      max-height: none !important;
      overflow: visible !important;
    }
  }
`;

export const pageReportDashboardScript = `
  (function () {
    const storageKey = "migration-report-theme";
    const root = document.documentElement;
    const toggle = document.getElementById("theme-toggle");

    function applyTheme(theme) {
      root.setAttribute("data-theme", theme);
      if (toggle) toggle.textContent = theme === "dark" ? "Light mode" : "Dark mode";
      try { localStorage.setItem(storageKey, theme); } catch (_) {}
    }

    const saved = (function () {
      try { return localStorage.getItem(storageKey); } catch (_) { return null; }
    })();
    applyTheme(saved === "light" || saved === "dark" ? saved : "dark");

    if (toggle) {
      toggle.addEventListener("click", function () {
        const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
        applyTheme(next);
      });
    }

    function scrollOffset() {
      const topbar = document.querySelector(".report-topbar");
      return topbar ? topbar.getBoundingClientRect().height + 16 : 16;
    }

    function highlightTarget(target) {
      document.querySelectorAll(".module-scroll-target").forEach(function (node) {
        node.classList.remove("module-scroll-target");
      });
      target.classList.add("module-scroll-target");
      window.setTimeout(function () {
        target.classList.remove("module-scroll-target");
      }, 1800);
    }

    function scrollToModuleTarget(target) {
      if (!target) return;
      if (target.tagName === "DETAILS") {
        target.open = true;
      }
      const top = target.getBoundingClientRect().top + window.scrollY - scrollOffset();
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
      highlightTarget(target);
    }

    function navigateToHash(hash, replaceHistory) {
      if (!hash || hash === "#") return;
      const target = document.querySelector(hash);
      if (!target) return;
      scrollToModuleTarget(target);
      if (replaceHistory) {
        history.replaceState(null, "", hash);
      } else {
        history.pushState(null, "", hash);
      }
    }

    document.querySelectorAll('.module-score-card[href^="#"]').forEach(function (card) {
      card.addEventListener("click", function (event) {
        const hash = card.getAttribute("href");
        const target = hash ? document.querySelector(hash) : null;
        if (!target) return;
        event.preventDefault();
        navigateToHash(hash, false);
      });
    });

    if (location.hash) {
      window.setTimeout(function () {
        navigateToHash(location.hash, true);
      }, 120);
    }
  })();
`;
