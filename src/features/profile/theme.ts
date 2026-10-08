export const THEME_COLORS = { dark: "#090909", light: "#fafafa" } as const;

/** Own the mutable theme tag so React's static metadata cannot duplicate it. */
export const THEME_BOOTSTRAP = `(() => {
  let theme = "dark";
  try { if (localStorage.getItem("arcus-theme") === "light") theme = "light"; } catch {}
  document.documentElement.dataset.theme = theme;
  const colors = ${JSON.stringify(THEME_COLORS)};
  let meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    meta.id = "arcus-theme-color";
    document.head.appendChild(meta);
  }
  meta.content = colors[theme];
})();`;
