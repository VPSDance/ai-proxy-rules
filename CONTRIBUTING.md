# Contributing

欢迎补充新的 AI 服务规则、修复上游变更、增加客户端格式。

## 新增或修改 Provider

主要维护入口是 `data/sources/<provider>.yaml`。`<provider>` 使用小写 + 连字符，并和文件名保持一致。

最小示例：

```yaml
provider: foo-ai
name: Foo AI
description: Foo AI services.
groups:
  - name: Core
    include:
      domainSuffix:
        - foo.ai
```

如果有公开规则来源，可以放到 `sources` 里自动同步：

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

常用 parser：

- `classical`：Surge / Clash classical 规则，如 `DOMAIN-SUFFIX,foo.ai`
- `clash-yaml`：带 `payload:` 的 YAML 规则
- `domain-list-community`：v2fly/domain-list-community 格式

如果上游包含无关规则，用 `patch.remove` 剔除。对容易被误删的手工规则或 patch，请加简短注释说明原因。

## 本地检查

提交前建议跑：

```bash
pnpm install
pnpm sync
pnpm guard
pnpm check
pnpm check:metadata
pnpm check:readme
pnpm test
pnpm generate
pnpm status
```

新增 provider 时，同时更新 `README.md` 的规则覆盖范围列表。

## 新增客户端格式

1. 在 `scripts/types.ts` 的 `formats` 里加入格式名。
2. 在 `scripts/generators/index.ts` 增加渲染逻辑。
3. 在 `tests/generators.test.ts` 加断言。
4. 更新 README 的客户端格式列表。

