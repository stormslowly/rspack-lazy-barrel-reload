# rspack-lazy-barrel-reload

最小复现：`lazyCompilation` 和 lazy barrel 同时生效时，首次激活懒编译模块会让整个页面刷新，而不是走 HMR 热更新。

## 运行

```sh
pnpm install
pnpm exec playwright install chromium   # 首次运行需要
pnpm repro     # 复现 bug，退出码 1
pnpm control   # 对照组，退出码 0
pnpm dev       # 手动在浏览器里点按钮观察
```

## 场景

```
index.js ──静态──> infrastructure.js ──> lib/index.js (barrel, sideEffects: false)
    └──── import() ──> feature.js（懒编译）──┘
```

- `src/lib/index.js` 模仿 `zustand/esm/index.mjs`：自己导出 `create`，同时 `export * from './vanilla.js'`。
- `src/lib/package.json` 声明 `"sideEffects": false`，于是 barrel 走 lazy barrel 优化，只编译用到的导出。
- 首屏只有 `infrastructure.js` 用到 barrel 的 `create`。
- `feature.js` 走懒编译，用到 barrel 的 `createStore`。
- `infrastructure.js` 没有 HMR accept 边界。

## 现象

点击 “activate lazy feature” 之后：

1. 懒编译 `feature.js`，它需要 barrel 的 `createStore`。
2. barrel 的导出列表从 `{ create }` 变成 `{ create, createStore }`，`./src/lib/index.js` 被打进 hot update。
3. 这个更新冒泡到 `infrastructure.js` → `index.js`，一路都没有 accept：

   ```
   [HMR] Cannot apply update. Need to do a full reload!
   [HMR] Error: Aborted because ./src/lib/index.js is not accepted
   ```

4. 页面整体刷新，`documentLoads` 变成 2。

对照组（`CONTROL=1`）用 `module.rules` 把 `lib` 标记为 `sideEffects: true`，关掉 lazy barrel。首屏 barrel 就已经带上全部导出，激活时 hot update 只包含 `lazy-compilation-proxy`，页面不刷新。
