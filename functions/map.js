// GET /map —— 导航页（公开，靠路径隐匿；不链接 /mapp）
// 环境变量：GITHUB_TOKEN、GITHUB_REPO、GITHUB_BRANCH、GITHUB_FILE

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function hostOf(u) {
  const s = String(u || '');
  const i = s.indexOf('://');
  let t = i >= 0 ? s.slice(i + 3) : s;
  const j = t.indexOf('/');
  if (j >= 0) t = t.slice(0, j);
  return t;
}
function b64decodeUtf8(content) {
  const bin = atob(String(content || '').replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
function cfg(env) {
  const e = env || {};
  return {
    token: e.GITHUB_TOKEN || '',
    repo: e.GITHUB_REPO || '',
    branch: e.GITHUB_BRANCH || 'main',
    file: e.GITHUB_FILE || 'map.json',
  };
}
async function ghReadLinks(c) {
  if (!c.token || !c.repo) return [];
  const r = await fetch(`https://api.github.com/repos/${c.repo}/contents/${c.file}?ref=${c.branch}`, {
    headers: { Authorization: 'Bearer ' + c.token, Accept: 'application/vnd.github+json', 'User-Agent': 'root-map' },
  });
  if (!r.ok) return [];
  const j = await r.json();
  const data = JSON.parse(b64decodeUtf8(j.content));
  return Array.isArray(data.links) ? data.links : [];
}

const STYLE = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{min-height:100%}
body{background:#fff;color:#2d3142;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue","PingFang SC","Microsoft YaHei",sans-serif;-webkit-font-smoothing:antialiased;display:flex;align-items:flex-start;justify-content:center;padding:clamp(36px,9vh,96px) 20px 60px}
main{width:100%;max-width:760px}
header{text-align:center;margin-bottom:clamp(26px,5vh,42px)}
h1{font-size:clamp(24px,4.4vw,38px);font-weight:800;letter-spacing:-.02em;line-height:1.2}
header p{margin-top:9px;color:#8a90a2;font-size:13.5px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px}
a.card{display:flex;flex-direction:column;gap:5px;padding:18px 18px 16px;border:1px solid #eceef2;border-radius:14px;background:#f8fafb;text-decoration:none;color:inherit;transition:border-color .16s ease,transform .12s ease,background-color .16s ease;-webkit-tap-highlight-color:transparent}
a.card:hover{border-color:#52d6a8;background:#fff;transform:translateY(-1px)}
a.card:active{transform:scale(.99)}
.row1{display:flex;align-items:center;justify-content:space-between;gap:10px}
.nm{font-size:16.5px;font-weight:700;letter-spacing:-.01em}
.arrow{color:#52d6a8;font-weight:800;font-size:15px;line-height:1}
.host{font-size:12px;color:#8a90a2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tag{align-self:flex-start;margin-top:5px;display:inline-block;line-height:1.5;font-size:10.5px;color:#8a90a2;border:1px solid #eceef2;border-radius:999px;padding:2px 9px}
.empty{grid-column:1/-1;text-align:center;color:#8a90a2;padding:40px 0}
footer{margin-top:34px;text-align:center}
footer span{font-size:11.5px;color:#c9ccd4}
@media(prefers-reduced-motion:reduce){a.card{transition:none}}
`;

function page(links) {
  const cards = links.length
    ? links.map(l => `<a class="card" href="${esc(l.url)}" rel="noopener">
  <span class="row1"><span class="nm">${esc(l.name)}</span><span class="arrow">→</span></span>
  <span class="host">${esc(hostOf(l.url))}</span>
  ${l.tag ? `<span class="tag">${esc(l.tag)}</span>` : ''}
</a>`).join('\n')
    : '<div class="empty">还没有条目</div>';

  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#ffffff">
<title>Map</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%232d3142'/%3E%3Ctext x='50' y='68' font-size='52' font-family='system-ui,sans-serif' font-weight='800' fill='%2352d6a8' text-anchor='middle'%3EM%3C/text%3E%3C/svg%3E">
<style>${STYLE}</style></head><body><main>
<header><h1>Map</h1><p>去往各处</p></header>
<div class="grid">
${cards}
</div>
<footer><span>只有知道这个地址的人能看到本页</span></footer>
</main></body></html>`;
}

export async function onRequest(ctx) {
  const c = cfg(ctx.env);
  const links = await ghReadLinks(c).catch(() => []);
  return new Response(page(links), {
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
  });
}
