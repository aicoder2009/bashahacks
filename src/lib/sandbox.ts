import type { Files } from "./types";

/**
 * Student apps run inside an iframe with sandbox="allow-scripts allow-forms allow-modals".
 * Without allow-same-origin the app gets its own throwaway origin: it cannot read this
 * site's cookies or storage, so it cannot touch anyone's login. This shim runs first inside
 * the frame and gives the app a working localStorage that the parent page saves for it.
 */
function shim(initial: Record<string, string>): string {
  return `(function(){
var data=${JSON.stringify(initial).replace(/</g, "\\u003c")};
function post(m){try{parent.postMessage(m,'*')}catch(e){}}
function make(persist){
  var d=persist?data:{};
  var api={
    getItem:function(k){k=String(k);return Object.prototype.hasOwnProperty.call(d,k)?d[k]:null},
    setItem:function(k,v){d[String(k)]=String(v);if(persist)post({__bh:'storage',data:d})},
    removeItem:function(k){delete d[String(k)];if(persist)post({__bh:'storage',data:d})},
    clear:function(){for(var k in d)delete d[k];if(persist)post({__bh:'storage',data:d})},
    key:function(i){return Object.keys(d)[i]||null}
  };
  return new Proxy(api,{
    get:function(t,p){if(p==='length')return Object.keys(d).length;if(p in t)return t[p];return typeof p==='string'&&Object.prototype.hasOwnProperty.call(d,p)?d[p]:undefined},
    set:function(t,p,v){t.setItem(p,v);return true},
    deleteProperty:function(t,p){t.removeItem(p);return true},
    has:function(t,p){return p in t||Object.prototype.hasOwnProperty.call(d,p)},
    ownKeys:function(){return Object.keys(d)},
    getOwnPropertyDescriptor:function(t,p){return Object.prototype.hasOwnProperty.call(d,p)?{value:d[p],writable:true,enumerable:true,configurable:true}:undefined}
  });
}
try{Object.defineProperty(window,'localStorage',{value:make(true),configurable:true})}catch(e){}
try{Object.defineProperty(window,'sessionStorage',{value:make(false),configurable:true})}catch(e){}
window.addEventListener('error',function(e){post({__bh:'error',message:String(e.message||'Error'),line:e.lineno||0})});
window.addEventListener('unhandledrejection',function(e){post({__bh:'error',message:String((e.reason&&e.reason.message)||e.reason||'Error'),line:0})});
document.addEventListener('submit',function(e){setTimeout(function(){},0);if(!e.defaultPrevented){e.preventDefault()}},false);
document.addEventListener('click',function(e){var a=e.target&&e.target.closest?e.target.closest('a[href]'):null;if(a){var h=a.getAttribute('href')||'';if(h.charAt(0)!=='#'){e.preventDefault()}}},true);
})();`;
}

const CSP =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob: https:; media-src data: blob:; font-src data:";

const escScript = (js: string) => js.replace(/<\/script/gi, "<\\/script");
const escStyle = (css: string) => css.replace(/<\/style/gi, "<\\/style");

export function buildSrcdoc(files: Files, storage: Record<string, string> = {}): string {
  let html = files["index.html"] || "";
  const css = files["style.css"] || "";
  const js = files["script.js"] || "";

  const styleTag = css ? `<style>\n${escStyle(css)}\n</style>` : "";
  const scriptTag = js ? `<script>\n${escScript(js)}\n</script>` : "";

  let cssPlaced = false;
  html = html.replace(/<link\b[^>]*href=["']\.?\/?style\.css["'][^>]*>/gi, () => {
    if (cssPlaced) return "";
    cssPlaced = true;
    return styleTag;
  });
  let jsPlaced = false;
  html = html.replace(/<script\b[^>]*src=["']\.?\/?script\.js["'][^>]*>\s*<\/script>/gi, () => {
    if (jsPlaced) return "";
    jsPlaced = true;
    return scriptTag;
  });

  const head = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${CSP}"><meta name="viewport" content="width=device-width, initial-scale=1"><script>${escScript(
    shim(storage)
  )}</script>${cssPlaced ? "" : styleTag}`;

  if (/<head[^>]*>/i.test(html)) html = html.replace(/<head[^>]*>/i, (m) => m + head);
  else if (/<html[^>]*>/i.test(html)) html = html.replace(/<html[^>]*>/i, (m) => m + "<head>" + head + "</head>");
  else html = "<!doctype html><html><head>" + head + "</head><body>" + html + "</body></html>";

  if (!jsPlaced && scriptTag) {
    if (/<\/body>/i.test(html)) html = html.replace(/<\/body>/i, scriptTag + "</body>");
    else html += scriptTag;
  }
  if (!/^\s*<!doctype/i.test(html)) html = "<!doctype html>" + html;
  return html;
}

export const SANDBOX_ATTR = "allow-scripts allow-forms allow-modals";
