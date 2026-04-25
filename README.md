# AI Proxy Rules

AI 服务代理规则集合。规则数据统一维护在 `data/`，并生成到多个代理客户端可直接引用的 `rules/` 文件。

当前已支持：

- Surge
- Clash / Mihomo
- sing-box
- Quantumult X
- Loon

## 规则文件

汇总规则：

```text
rules/surge/all.list
rules/mihomo/all.yaml
rules/sing-box/all.json
rules/quantumult-x/all.list
rules/loon/all.list
```

当前 provider：

```text
rules/surge/anthropic.list
rules/mihomo/anthropic.yaml
rules/sing-box/anthropic.json
rules/quantumult-x/anthropic.list
rules/loon/anthropic.list
```

## 目录结构

```text
data/     人工维护的数据源
scripts/ 规则生成脚本
rules/   生成后的规则文件
```

## 数据源

每个 provider 一个 YAML 文件：

```text
data/providers/<provider>.yaml
```

示例：

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

## 维护

安装依赖：

```bash
pnpm install
```

生成规则：

```bash
pnpm generate
```

验证：

```bash
pnpm check
pnpm test
```

GitHub Actions 会在影响规则生成的文件变化时自动运行检查和生成，并在 `rules/` 有变化时提交生成结果。

## References

规则维护参考公开资料和实际使用场景，不直接复制单一来源：

- https://github.com/xiaolai/anthropic-claude-surge-rules-set
- https://ip.net.coffee/claude/site.html
- https://docs.anthropic.com/en/api/ip-addresses
