// inject-countdown.mjs — pre-deploy guard for cloudflare-drop (round-013 spec 01).
//
// Every page deployed to Cloudflare Drop gets a live 60-minute expiry countdown
// baked into its top-right corner, so the person viewing the LINK (not the chat
// caption) always knows when it dies. This is the same class of mechanized
// pre-deploy check as "every playground carries the light/dark toggle".
//
// injectCountdown(html, expiryEpochSeconds) -> html
//   - page already has the countdown  -> returned unchanged (idempotent)
//   - page lacks it                    -> the countdown is injected before </body>
//   - the REAL expiry timestamp (deploy time + 3600s) is stamped in at deploy time,
//     so the countdown is precise, not "first-open + 60min".
//   - fail-open: never throws; countdown is an enhancement, must not block delivery.

const MARKER_ID = 'drop-expiry-countdown';
// The injected block is fenced by a unique comment pair so strip can excise
// exactly it — never anything of the page's own (round-016 spec 02 / A3: the old
// content-shape regex spanned the page's own <style>/<div>/<script> and ate the
// whole body, renewing a 33.7KB page down to a 1.8KB head-only husk).
const FENCE_START = '<!--drop-expiry-countdown:start-->';
const FENCE_END = '<!--drop-expiry-countdown:end-->';

/**
 * @param {string} html          the page HTML
 * @param {number} expiryEpoch   unix epoch (seconds) when the Drop link expires
 * @returns {string}             HTML with the countdown ensured present
 */
export function injectCountdown(html, expiryEpoch) {
  try {
    const src = typeof html === 'string' ? html : '';
    // Idempotent: if the countdown is already there, leave the page untouched.
    if (src.includes(`id="${MARKER_ID}"`)) return src;

    const snippet = countdownSnippet(expiryEpoch);

    // Prefer to insert just before </body>; fall back to appending so a page
    // without a well-formed body still gets the countdown (fail-open).
    const idx = src.toLowerCase().lastIndexOf('</body>');
    if (idx !== -1) {
      return src.slice(0, idx) + snippet + src.slice(idx);
    }
    return src + snippet;
  } catch {
    // Enhancement only — on any error, hand back the original so delivery proceeds.
    return typeof html === 'string' ? html : '';
  }
}

/**
 * Remove a previously-injected countdown from a page (round-014 spec 05).
 *
 * A page pulled from the deploy archive already carries a countdown stamped with
 * the OLD expiry. On renew we strip it, then re-inject a fresh one — so the
 * renewed page counts down from the NEW deploy, never the stale one.
 * Idempotent + fail-open: a page with no countdown (or bad input) is returned
 * effectively unchanged.
 *
 * @param {string} html
 * @returns {string} html with the countdown block (style + div + script) removed
 */
export function stripCountdown(html) {
  try {
    const src = typeof html === 'string' ? html : '';
    if (!src.includes(`id="${MARKER_ID}"`)) return src;

    // Preferred path: the block is fenced by our unique comment pair, so we
    // excise EXACTLY it (start-marker … end-marker) and touch nothing else —
    // no dependence on how many <style>/<div>/<script> the page itself carries.
    const s = src.indexOf(FENCE_START);
    const e = src.indexOf(FENCE_END);
    if (s !== -1 && e !== -1 && e > s) {
      // Also swallow the leading newline we inserted before the fence, if present.
      let cut = s;
      if (cut > 0 && src[cut - 1] === '\n') cut -= 1;
      return src.slice(0, cut) + src.slice(e + FENCE_END.length);
    }

    // Fallback for a page injected by an older (pre-fence) version, or one
    // hand-edited so the fence is gone: drop just the marker <div>. This is the
    // narrowest possible non-greedy match — it cannot span the page body because
    // it starts at the marker div and stops at that div's own </div>.
    return src.replace(
      new RegExp(`<div id="${MARKER_ID}"[\\s\\S]*?<\\/div>`, 'i'),
      '',
    );
  } catch {
    return typeof html === 'string' ? html : '';
  }
}

function countdownSnippet(expiryEpoch) {
  const epoch = Number.isFinite(expiryEpoch) ? Math.floor(expiryEpoch) : 0;
  // Colors go through :root vars so light/dark themes override the same set.
  // Defaults are provided inline (var(--x, fallback)) so the pill also renders on
  // pages that don't define these variables.
  // Fenced by a unique comment pair so stripCountdown excises exactly this block.
  return `
${FENCE_START}
<style>
  #${MARKER_ID}{
    position:fixed;top:12px;right:12px;z-index:2147483647;
    display:flex;align-items:center;gap:6px;
    padding:6px 12px;border-radius:999px;
    font:600 13px/1.2 ui-sans-serif,system-ui,-apple-system,"PingFang SC",sans-serif;
    background:var(--drop-cd-bg,rgba(20,20,24,.86));
    color:var(--drop-cd-fg,#fff);
    border:1px solid var(--drop-cd-border,rgba(255,255,255,.14));
    box-shadow:0 4px 14px var(--drop-cd-shadow,rgba(0,0,0,.28));
    backdrop-filter:blur(6px);
  }
  #${MARKER_ID}.expired{background:var(--drop-cd-bg-expired,#7f1d1d)}
  #${MARKER_ID} .dot{width:7px;height:7px;border-radius:50%;
    background:var(--drop-cd-dot,#34d399)}
  #${MARKER_ID}.expired .dot{background:var(--drop-cd-dot-expired,#fca5a5)}
</style>
<div id="${MARKER_ID}" data-expiry-epoch="${epoch}" role="status" aria-live="polite">
  <span class="dot"></span><span class="txt">链接有效性检测中…</span>
</div>
<script>(function(){
  var el=document.getElementById(${JSON.stringify(MARKER_ID)});
  if(!el)return;
  var expiry=parseInt(el.getAttribute('data-expiry-epoch'),10)||0;
  var txt=el.querySelector('.txt');
  function pad(n){return(n<10?'0':'')+n;}
  function tick(){
    var left=expiry-Math.floor(Date.now()/1000);
    if(left<=0){el.classList.add('expired');txt.textContent='已过期，让主人重新生成';return;}
    var m=Math.floor(left/60),s=left%60;
    txt.textContent='链接将在 '+pad(m)+':'+pad(s)+' 后过期';
    setTimeout(tick,1000);
  }
  tick();
})();</script>
${FENCE_END}
`;
}
