/**
 * Applies the saved theme before first paint. Without this the page renders in
 * the system theme and then snaps to the chosen one, which is exactly the kind
 * of flash you notice at six in the morning.
 */
export function ThemeScript() {
  const code = `(function(){try{var t=localStorage.getItem("manna-theme");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t);}}catch(e){}})();`;
  return <script dangerouslySetInnerHTML={{ __html: code }} />;
}
