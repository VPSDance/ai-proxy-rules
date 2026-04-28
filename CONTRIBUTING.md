# Contributing

欢迎补充新的 AI 服务规则、修复上游变更、增加新客户端格式。

## 加一个 Provider

1. 在 `data/sources/` 下创建 `<id>.yaml`，`<id>` 用小写 + 连字符（如 `foo-ai`），与文件名一致：

   ```yaml
   provider: foo-ai
   name: Foo AI
   description: One-line description shown in rule file headers.
   groups:
     - name: Core
       include:
         domainSuffix:
           - foo.ai
   ```

2. 如果有可信上游（v2fly、blackmatrix7、SkywalkerJi 等），换成远程 source 让规则跟着上游每日更新：

   ```yaml
   sources:
     - name: v2fly
       type: remote-text
       url: https://cdn.jsdelivr.net/gh/v2fly/domain-list-community@master/data/foo-ai
       parser: domain-list-community
   groups:
     - name: Core
       fromSource: true
   ```

   - 远程 URL 用 `cdn.jsdelivr.net/gh/...` 而不是 `raw.githubusercontent.com`，国内拉取更快。
   - parser 选 `classical`（Surge 风 `DOMAIN,xxx,POLICY`）、`clash-yaml`（`payload:` 列表）、或 `domain-list-community`（v2fly 格式，自动按 `@!cn` 标签过滤）。

3. 上游里掺杂了不属于本服务的域名（被 OpenAI 文件里漏带 datadog、Copilot 文件里掺 ChatGPT 等），用 `patch.remove` 剔除：

   ```yaml
   patch:
     remove:
       domainSuffix:
         - unwanted.com
       domainKeyword:
         - colab
   ```

4. 跑本地 pipeline：

   ```bash
   pnpm install
   pnpm sync       # 拉上游 + 生成 data/providers/<id>.yaml
   pnpm guard      # 拦截规则数大幅减少（防误删/上游被劫持）
   pnpm check      # tsc 类型检查
   pnpm test       # vitest
   pnpm generate   # 输出 rules/*/<id>.*
   ```

5. 在 `README.md` 规则覆盖范围列表里加一行，按知名度顺序插入。

6. 提 PR。

## 修一个失效上游

只改 `data/sources/<id>.yaml` 即可。常见操作：

- 上游搬家：换 `url`
- 上游解析失败：换 `parser`，或对 domain-list-community 加 `followIncludes: false`（避免递归 include 引入无关分类）
- 上游噪声：在 `patch.remove` 里增删条目

跑 `pnpm sync && pnpm guard && pnpm generate` 验证。

## 加一个客户端格式

1. `scripts/types.ts`：往 `formats` 数组里加新格式名。
2. `scripts/generators/index.ts`：在 `render` switch 里加分支，写一个 `renderFoo(target)` 函数。规则集订阅文件**不要**附 policy 名字。
3. `tests/generators.test.ts`：加对应断言。
4. README 的"支持的客户端格式"列表加一行。

## 缓存与守门机制

- `data/cache/` 是每次 sync 落盘的上游响应，URL hash 命名。上游临时挂时自动 fallback，workflow 不会 fail；超过 30 天没刷新成功会升级为 stale 警告。
- `pnpm guard` 在 sync 后比较新数据 vs `HEAD`，任意 provider 规则数下降超 30% 就 fail，避免上游被劫持/parser 故障导致规则被悄悄刷空。
