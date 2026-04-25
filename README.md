# AI Proxy Rules

从一个固定数据源生成多个代理客户端的 AI 服务规则。

当前默认数据源支持 `anthropic`，生成目标支持：

- Surge
- Clash / Mihomo
- sing-box
- Quantumult X
- Loon
- 汇总规则 `all`

## 设计目标

- 单一数据源维护：每个 AI 服务只维护一个 YAML 文件。
- 多客户端输出：同一份数据生成多个客户端格式。
- 支持聚合：多个 provider 可以合并成 `all` 规则。
- 易于扩展：后续新增 `cursor`、`openai`、`gemini` 等 provider 时，只需要添加 YAML。
- 无构建产物：TypeScript 源码通过 `tsx` 直接运行，最终产物只有 `rules/`。

## 快速开始

```bash
pnpm install
pnpm generate
```

默认会读取 `data/providers/*.yaml`，并输出到 `rules`：

```text
rules/
  surge/anthropic.list
  mihomo/anthropic.yaml
  sing-box/anthropic.json
  quantumult-x/anthropic.list
  loon/anthropic.list
  surge/all.list
  ...
```

## 常用命令

生成全部 provider 和汇总规则：

```bash
pnpm generate
```

只生成 Anthropic：

```bash
pnpm generate -- --provider anthropic
```

生成多个 provider，并额外生成 `all`：

```bash
pnpm generate -- --provider anthropic,cursor
```

只生成指定客户端：

```bash
pnpm generate -- --format surge,mihomo,sing-box
```

自定义 Quantumult X / Loon 策略名：

```bash
pnpm generate -- --policy "AI Proxy"
```

## 数据源格式

每个 provider 一个文件，放在 `data/providers/<provider>.yaml`：

```yaml
provider: anthropic
name: Anthropic
description: Claude and Anthropic API domains.
rules:
  domain:
    - api.anthropic.com
  domainSuffix:
    - anthropic.com
  domainKeyword:
    - claude
  ipCidr:
    - 203.0.113.0/24
  ipCidr6:
    - 2001:db8::/32
```

字段说明：

- `domain`: 精确域名。
- `domainSuffix`: 域名后缀。
- `domainKeyword`: 域名关键字。
- `ipCidr`: IPv4 CIDR。
- `ipCidr6`: IPv6 CIDR。

## 输出格式说明

Surge / Mihomo 输出的是 rule-set 片段，不带策略名，适合远程规则集引用。

Quantumult X / Loon 规则通常需要策略名，因此默认策略名是 `AI`，可以通过 `--policy` 修改。

sing-box 输出 source rule-set JSON：

```json
{
  "version": 3,
  "rules": [
    {
      "domain": ["api.anthropic.com"],
      "domain_suffix": ["anthropic.com"],
      "domain_keyword": ["claude"],
      "ip_cidr": ["203.0.113.0/24", "2001:db8::/32"]
    }
  ]
}
```

## GitHub Actions

`.github/workflows/generate.yml` 会在 push 和 pull request 时运行类型检查、测试和生成命令。这个项目不需要编译 `dist/`，规则产物直接写入 `rules/`。

## 新增 provider

1. 新增 `data/providers/cursor.yaml`。
2. 按现有 schema 填写域名和 CIDR。
3. 运行 `pnpm test && pnpm generate`。
4. 检查 `rules/*/cursor.*` 和 `rules/*/all.*`。
