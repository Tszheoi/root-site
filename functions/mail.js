// /mail —— 跳转到阿里云邮箱网页版
// 注意：不能把 mail.Tsz****.top 直接做成跳转，因为那个域名上挂着 MX 记录（收发邮件用），
// 加了 CNAME/A 会破坏邮件。所以用路径跳转替代。

export async function onRequest() {
  return new Response(
    '<!DOCTYPE html><html><head><meta charset="utf-8">' +
    '<meta http-equiv="refresh" content="0;url=https://mail.aliyun.com/">' +
    '<title>正在打开邮箱…</title></head>' +
    '<body style="font-family:-apple-system,\'PingFang SC\',sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;color:#2d3142">' +
    '<p>正在打开邮箱… 如果没有自动跳转，<a href="https://mail.aliyun.com/">点这里</a></p>' +
    '<script>location.replace("https://mail.aliyun.com/");</script>' +
    '</body></html>',
    {
      status: 200,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    }
  );
}
