/**
 * Lazy-load the compact STM embed when its automation-lab panel opens.
 * Avoids fetching GTFS feeds until the visitor actually opens that tab.
 */
(function initStmLabEmbed() {
  const frame = document.getElementById('stmMiniFrame');
  if (!frame) return;

  let loaded = false;

  function loadEmbed() {
    if (loaded) return;
    const src = frame.getAttribute('data-src');
    if (!src) return;
    frame.src = src;
    loaded = true;
  }

  function isStmPanelVisible() {
    const panel = document.getElementById('automation-panel-stm');
    return Boolean(panel && !panel.hidden);
  }

  document.addEventListener('automation-panel-open', (event) => {
    if (event.detail?.tabId === 'stm') {
      loadEmbed();
      // Leaflet maps in iframes need a size invalidate after the panel becomes visible.
      window.setTimeout(() => {
        try {
          frame.contentWindow?.StmMap?.invalidate?.();
        } catch (_) { /* cross-origin or not ready */ }
      }, 120);
    }
  });

  if (isStmPanelVisible()) loadEmbed();
})();
