/**
 * Applies the saved theme before first paint. Without this the page renders in
 * the system theme and then snaps to the chosen one, which is exactly the kind
 * of flash you notice at six in the morning.
 */
export function ThemeScript() {
  // Olive is the stylesheet's base, so it needs no attribute and cannot flash.
  // Any other scheme is stamped here, before the first paint, for the same
  // reason light and dark are.
  const code = `(function(){try{var d=document.documentElement;var t=localStorage.getItem("manna-theme");if(t==="dark"||t==="light"){d.setAttribute("data-theme",t);}var p=localStorage.getItem("manna-palette");if(p&&/^[a-z]{4,8}$/.test(p)&&p!=="olive"){d.setAttribute("data-palette",p);}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
