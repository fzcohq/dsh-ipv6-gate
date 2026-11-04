// 静态资源缓存策略：带内容哈希的文件名可长期 immutable 缓存
// 目的：74 个 client bundle + 带哈希的 assets 让手机重复访问几乎零下载
const HASHED_ASSET = /^\/assets\/[^/]+-[A-Za-z0-9_-]{6,}\.(?:js|mjs|css|woff2?|ttf|png|jpe?g|svg|webp|ico)$/;
const PLUGIN_CLIENT = /^\/plugins\/.+\/client\.js$/; // 允许 @scope/name 二级路径

export function isImmutableAsset(urlPath) {
  const p = String(urlPath || '').split('?')[0];
  return HASHED_ASSET.test(p) || PLUGIN_CLIENT.test(p);
}
