// /map 及其子路径
//   GET  /map          → 导航页（公开，靠路径隐匿）
//   GET  /map/tsz      → 后台（密码保护）
//   POST /map/tsz      → 登录 / 保存 / 退出
//
// 环境变量：ADMIN_PASSWORD（默认 6966@Map）、ADMIN_SECRET、
//           GITHUB_TOKEN、GITHUB_REPO、GITHUB_BRANCH、GITHUB_FILE

const COOKIE = 'map_admin';
const SESSION_DAYS = 30;

// ---------- 工具 ----------
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
function parseCookies(header) {
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(msg));
  const bytes = new Uint8Array(sig);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
async function makeSession(secret) {
  const exp = Date.now() + SESSION_DAYS * 86400 * 1000;
  return exp + '.' + await hmac(secret, String(exp));
}
async function verifySession(secret, token) {
  if (typeof token !== 'string') return false;
  const i = token.lastIndexOf('.');
  if (i <= 0) return false;
  const exp = token.slice(0, i), sig = token.slice(i + 1);
  const expect = await hmac(secret, exp);
  if (sig.length !== expect.length) return false;
  let diff = 0;
  for (let k = 0; k < sig.length; k++) diff |= sig.charCodeAt(k) ^ expect.charCodeAt(k);
  if (diff !== 0) return false;
  return Number(exp) > Date.now();
}
function cfg(env) {
  const e = env || {};
  return {
    password: e.ADMIN_PASSWORD || '6966@Map',
    secret: e.ADMIN_SECRET || 'root-map-default-secret-change-me',
    token: e.GITHUB_TOKEN || '',
    repo: e.GITHUB_REPO || '',
    branch: e.GITHUB_BRANCH || 'main',
    file: e.GITHUB_FILE || 'map.json',
  };
}
function b64decodeUtf8(content) {
  const bin = atob(String(content || '').replace(/\n/g, ''));
  const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
function b64encodeUtf8(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
const ghHeaders = (t) => ({ Authorization: 'Bearer ' + t, Accept: 'application/vnd.github+json', 'User-Agent': 'root-map', 'Content-Type': 'application/json' });

async function ghRead(c) {
  if (!c.token || !c.repo) throw new Error('服务端未配置 GITHUB_TOKEN / GITHUB_REPO');
  const r = await fetch(`https://api.github.com/repos/${c.repo}/contents/${c.file}?ref=${c.branch}`, { headers: ghHeaders(c.token) });
  if (!r.ok) throw new Error('读取失败 ' + r.status);
  const j = await r.json();
  const data = JSON.parse(b64decodeUtf8(j.content));
  return { links: Array.isArray(data.links) ? data.links : [], sha: j.sha };
}
async function ghWrite(c, links, sha) {
  const r = await fetch(`https://api.github.com/repos/${c.repo}/contents/${c.file}`, {
    method: 'PUT',
    headers: ghHeaders(c.token),
    body: JSON.stringify({
      message: 'update map links',
      content: b64encodeUtf8(JSON.stringify({ links }, null, 2) + '\n'),
      branch: c.branch,
      sha,
    }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error('写入失败 ' + r.status + ' ' + (j.message || ''));
  return j;
}

// ---------- 前台样式 ----------
const VIEW_STYLE = `
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
footer{margin-top:34px;text-align:center}
footer span{font-size:11.5px;color:#c9ccd4}
@media(prefers-reduced-motion:reduce){a.card{transition:none}}
`;

// ---------- 后台样式 ----------
const ADMIN_STYLE = `
*{box-sizing:border-box}
body{margin:0;background:#0f1218;color:#e6e8ee;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;font-size:15px;line-height:1.6}
.wrap{max-width:820px;margin:0 auto;padding:24px 18px 60px}
h1{font-size:19px;margin:0}
.top{display:flex;justify-content:space-between;align-items:center;padding-bottom:14px;border-bottom:1px solid #1e2531;margin-bottom:18px}
.inp{width:100%;background:#151a23;border:1px solid #252c3a;color:#e6e8ee;border-radius:9px;padding:10px 12px;outline:none;font-size:14px}
.inp:focus{border-color:#3b82f6}
.btn{background:#2563eb;color:#fff;border:0;border-radius:9px;padding:10px 18px;font-weight:600;cursor:pointer;font-size:14px}
.btn.ghost{background:#1c232f;color:#c3cad8}
.btn.danger{background:#7f1d1d;color:#fecaca}
.btn.sm{padding:6px 11px;font-size:13px}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.login{max-width:320px;margin:18vh auto;padding:0 18px}
.login h1{font-size:20px;margin-bottom:6px}
.login p{color:#8b93a7;font-size:13px;margin:0 0 20px}
.err{color:#fca5a5;font-size:13px;margin-top:10px}
.panel{background:#141922;border:1px solid #1e2531;border-radius:12px;padding:14px;margin-bottom:18px}
.item{display:flex;align-items:center;gap:12px;background:#141922;border:1px solid #1e2531;border-radius:11px;padding:12px 14px;margin-bottom:9px}
.sorter{display:flex;flex-direction:column;gap:3px;flex:0 0 auto}
.mv{background:#1c232f;border:0;color:#c3cad8;border-radius:6px;font-size:10px;line-height:1;padding:4px 6px;cursor:pointer}
.mv:hover{background:#27303f;color:#fff}
.mv:disabled{opacity:.25;cursor:default}
.meta{flex:1;min-width:0}
.meta .n{font-weight:600;font-size:15px}
.meta .u{font-size:12px;color:#8b93a7;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.meta .t{font-size:11px;color:#6b7488;margin-top:2px}
.acts{display:flex;gap:6px;flex:0 0 auto}
.hint{color:#6b7488;font-size:12.5px;margin-top:10px}
.toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);background:#1e293b;border:1px solid #334155;color:#e6e8ee;padding:9px 16px;border-radius:9px;font-size:13.5px;opacity:0;transition:opacity .2s;pointer-events:none;z-index:9}
.toast.on{opacity:1}
@media(max-width:600px){.item{flex-wrap:wrap}.meta{flex:1 0 100%}}
`;

const VIEW_PAGE = (links) => `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow,noarchive,nosnippet">
<meta name="referrer" content="no-referrer">
<meta name="theme-color" content="#ffffff">
<title>Map</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect width='100' height='100' rx='20' fill='%232d3142'/%3E%3Ctext x='50' y='68' font-size='52' font-family='system-ui,sans-serif' font-weight='800' fill='%2352d6a8' text-anchor='middle'%3EM%3C/text%3E%3C/svg%3E">
<style>${VIEW_STYLE}</style></head><body><main>
<header><h1>Map</h1><p>去往各处</p></header>
<div class="grid">
${links.length ? links.map(l => `<a class="card" href="${esc(l.url)}" rel="noopener">
  <span class="row1"><span class="nm">${esc(l.name)}</span><span class="arrow">→</span></span>
  ${l.hideHost ? '' : `<span class="host">${esc(hostOf(l.url))}</span>`}
  ${l.tag ? `<span class="tag">${esc(l.tag)}</span>` : ''}
</a>`).join('\n') : '<div style="grid-column:1/-1;text-align:center;color:#8a90a2;padding:40px 0">还没有条目</div>'}
</div>
<footer><span>只有知道这个地址的人能看到本页</span></footer>
</main></body></html>`;

const LOGIN = (err) => `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Map 管理</title>
<style>${ADMIN_STYLE}</style></head><body><div class="login">
<h1>Map 管理</h1><p>请输入密码</p>
<form method="POST" action="/map/tsz">
<input type="hidden" name="action" value="login">
<input class="inp" type="password" name="pw" placeholder="密码" autofocus autocomplete="current-password">
<div style="margin-top:12px"><button class="btn" type="submit" style="width:100%">进入</button></div>
${err ? `<div class="err">${esc(err)}</div>` : ''}
</form></div></body></html>`;

const ADMIN = (links) => `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Map 管理</title>
<style>${ADMIN_STYLE}</style></head><body><div class="wrap">
<div class="top"><h1>Map 管理</h1><div class="row">
<a class="btn ghost sm" href="/map" target="_blank">看页面</a>
<button class="btn ghost sm" onclick="logout()">退出</button></div></div>

<div class="panel">
  <div class="row">
    <input class="inp" id="f-name" placeholder="名称，如 博客" style="flex:1 1 140px">
    <input class="inp" id="f-url" placeholder="网址，如 https://blog.example.com" style="flex:2 1 240px">
    <input class="inp" id="f-tag" placeholder="角标（选填）" style="flex:0 1 110px">
  </div>
  <div class="row" style="margin-top:10px">
    <button class="btn" id="btn-save" onclick="submitForm()">添加</button>
    <button class="btn ghost" onclick="resetForm()">清空</button>
    <span class="hint" id="edit-hint"></span>
  </div>
  <div class="row" style="margin-top:12px;padding-top:12px;border-top:1px solid #1e2531">
    <button class="btn ghost" onclick="toggleAllHosts()" id="btn-host">${links.length && links.every(l => l.hideHost) ? "全部显示域名" : "全部隐藏域名"}</button>
    <span class="hint" id="host-hint"></span>
  </div>
</div>

<div id="list">
${links.length ? links.map((l, i) => `<div class="item">
  <div class="sorter">
    <button class="mv" onclick="moveUp(${i})" ${i === 0 ? 'disabled' : ''}>▲</button>
    <button class="mv" onclick="moveDown(${i})" ${i === links.length - 1 ? 'disabled' : ''}>▼</button>
  </div>
  <div class="meta">
    <div class="n">${esc(l.name)}${l.tag ? ` <span style="font-size:11px;color:#6b7488">[${esc(l.tag)}]</span>` : ''}</div>
    <div class="u">${esc(l.url)}</div>
  </div>
  <div class="acts">
    <button class="btn ghost sm" onclick="toggleHost(${i})" title="切换前台是否显示域名">${l.hideHost ? '🚫 域名已隐藏' : '👁 域名显示中'}</button>
    <button class="btn ghost sm" onclick="edit(${i})">编辑</button>
    <button class="btn danger sm" onclick="del(${i})">删除</button>
  </div>
</div>`).join('\n') : '<div class="hint">还没有条目</div>'}
</div>

<div class="toast" id="toast"></div>
</div>
<script>
var links = ${JSON.stringify(links)};
var editIndex = -1;
function toast(m){var t=document.getElementById('toast');t.textContent=m;t.className='toast on';setTimeout(function(){t.className='toast'},1800);}
function resetForm(){
  editIndex = -1;
  ['f-name','f-url','f-tag'].forEach(function(id){ document.getElementById(id).value = ''; });
  document.getElementById('btn-save').textContent = '添加';
  document.getElementById('edit-hint').textContent = '';
}
function submitForm(){
  var name = document.getElementById('f-name').value.trim();
  var url = document.getElementById('f-url').value.trim();
  var tag = document.getElementById('f-tag').value.trim();
  if(!name){ toast('名称不能为空'); return; }
  if(!url){ toast('网址不能为空'); return; }
  if(!/^https?:\\/\\//i.test(url)) url = 'https://' + url;
  var next = links.slice();
  var keepHide = (editIndex >= 0 && links[editIndex] && links[editIndex].hideHost) ? true : false;
  var item = { name: name, url: url, tag: tag, hideHost: keepHide };
  if(editIndex >= 0) next[editIndex] = item; else next.push(item);
  save(next);
}
function edit(i){
  document.getElementById('f-name').value = links[i].name || '';
  document.getElementById('f-url').value = links[i].url || '';
  document.getElementById('f-tag').value = links[i].tag || '';
  editIndex = i;
  document.getElementById('btn-save').textContent = '保存修改';
  document.getElementById('edit-hint').textContent = '正在编辑：' + (links[i].name || '');
  window.scrollTo({top:0,behavior:'smooth'});
}
function del(i){
  if(!confirm('删除「' + (links[i].name || '') + '」？')) return;
  var next = links.slice(); next.splice(i,1); save(next);
}
function toggleHost(i){
  var n = links.slice();
  var it = n[i] || {};
  n[i] = { name: it.name, url: it.url, tag: it.tag || '', hideHost: !it.hideHost };
  save(n);
}
function toggleAllHosts(){
  var allHidden = links.length > 0 && links.every(function(x){ return !!x.hideHost; });
  var next = links.map(function(x){ return { name: x.name, url: x.url, tag: x.tag || '', hideHost: !allHidden }; });
  save(next);
}
function moveUp(i){ if(i<=0) return; var n=links.slice(); var t=n[i-1]; n[i-1]=n[i]; n[i]=t; save(n); }
function moveDown(i){ if(i>=links.length-1) return; var n=links.slice(); var t=n[i+1]; n[i+1]=n[i]; n[i]=t; save(n); }
function save(next){
  fetch('/map/tsz', {method:'POST', headers:{'content-type':'application/json'},
    body: JSON.stringify({action:'save', links: next})})
   .then(function(r){ return r.json(); })
   .then(function(j){ if(!j.ok){ toast(j.error||'保存失败'); return; } location.reload(); })
   .catch(function(){ toast('保存失败'); });
}
function logout(){ fetch('/map/tsz', {method:'POST', headers:{'content-type':'application/json'},
  body: JSON.stringify({action:'logout'})}).then(function(){ location.href='/map/tsz'; }); }
</script></body></html>`;

// ---------- 主处理 ----------
export async function onRequest(ctx) {
  const c = cfg(ctx.env);
  const { request } = ctx;
  const url = new URL(request.url);
  const sub = url.pathname.replace(/^\/map\/?/, '').replace(/\/$/, ''); // '' 或 'tsz'

  const HTML = (body, status) => new Response(body, { status: status || 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
  const JSONR = (o, status, extra) => new Response(JSON.stringify(o), { status: status || 200, headers: Object.assign({ 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, extra || {}) });

  const cookies = parseCookies(request.headers.get('cookie'));
  const loggedIn = await verifySession(c.secret, cookies[COOKIE]).catch(() => false);

  // ---------- 后台 ----------
  if (sub === 'tsz') {
    if (request.method === 'GET') {
      if (!loggedIn) return HTML(LOGIN(''));
      let links = [];
      try { links = (await ghRead(c)).links; } catch (e) { return HTML(LOGIN('读取数据失败：' + esc(e.message))); }
      return HTML(ADMIN(links));
    }

    if (request.method === 'POST') {
      let body = {};
      const ct = request.headers.get('content-type') || '';
      try {
        if (ct.includes('application/json')) body = await request.json();
        else { const fd = await request.formData(); fd.forEach((v, k) => { body[k] = v; }); }
      } catch (e) { }

      const action = body.action;

      if (action === 'login') {
        if (String(body.pw || '') !== c.password) return HTML(LOGIN('密码不对'), 401);
        const token = await makeSession(c.secret);
        const cookie = `${COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
        if (ct.includes('application/json')) return JSONR({ ok: true }, 200, { 'set-cookie': cookie });
        return new Response(null, { status: 303, headers: { location: '/map/tsz', 'set-cookie': cookie } });
      }

      if (action === 'logout') {
        return JSONR({ ok: true }, 200, { 'set-cookie': `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0` });
      }

      if (!loggedIn) return JSONR({ ok: false, error: '未登录' }, 401);

      if (action === 'save') {
        const list = Array.isArray(body.links) ? body.links : [];
        const clean = list.map(x => ({
          name: String(x.name || '').trim().slice(0, 60),
          url: String(x.url || '').trim().slice(0, 300),
          tag: String(x.tag || '').trim().slice(0, 20),
          hideHost: !!x.hideHost,
        })).filter(x => x.name && /^https?:\/\//i.test(x.url));
        try {
          const cur = await ghRead(c);
          await ghWrite(c, clean, cur.sha);
          return JSONR({ ok: true, count: clean.length });
        } catch (e) {
          return JSONR({ ok: false, error: String((e && e.message) || e) }, 500);
        }
      }

      return JSONR({ ok: false, error: '未知操作' }, 400);
    }

    return JSONR({ ok: false, error: 'Method Not Allowed' }, 405);
  }

  // ---------- 前台 ----------
  if (request.method !== 'GET') return new Response('405', { status: 405 });
  let links = [];
  try {
    links = (await ghRead(c)).links;
  } catch (e) {
    links = [];
  }
  return HTML(VIEW_PAGE(links));
}
