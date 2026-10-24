# root-site —— 根域名 + /map 导航

根域名保留纯文字名片；`/map` 是导航页，`/map/tsz` 是它的后台。

## 路由

```
GET  /            public/index.html（静态名片，不变）
GET  /map         functions/map/[[path]].js → 导航页（无密码，靠路径隐匿）
GET  /map/tsz     后台（密码保护）
POST /map/tsz     登录 / 保存 / 退出
```

## 文件

```
public/index.html            根页名片
map.json                     导航条目数据
functions/map/[[path]].js    /map 页面 + /map/tsz 后台
```

## Pages 配置

- 构建命令：**留空**
- 构建输出目录：`public`
- Functions：仓库根 `functions/`（自动识别）

## 环境变量

| 变量 | 值 |
|---|---|
| `ADMIN_PASSWORD` | `6966@Map` |
| `ADMIN_SECRET` | 随机长串 |
| `GITHUB_TOKEN` | PAT（repo 权限） |
| `GITHUB_REPO` | `Tszheoi/root-site` |
| `GITHUB_BRANCH` | `main` |
| `GITHUB_FILE` | `map.json` |

## 数据

```json
{
  "links": [
    { "name": "博客", "url": "https://blog.tszheoi-law.top/", "tag": "" }
  ]
}
```

`tag` 选填，例如「公开」「需密码」。

## 隐私

- `/map` 带 `noindex,nofollow,noarchive,nosnippet`
- 根页**不链接** `/map`
- 不列 `dsh.`、`/tsz` 等敏感地址
