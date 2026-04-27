# AI Proxy Rules

AI 服务代理规则集合。规则数据统一维护在 `data/`，并生成到多个代理客户端可直接引用的 `rules/` 文件。

当前已支持：

- Surge
- Clash / Mihomo
- sing-box
- Quantumult X
- Loon

## 规则文件

汇总规则使用 `all`：

```text
https://cdn.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/surge/all.list
https://cdn.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/mihomo/all.yaml
https://cdn.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/sing-box/all.json
https://cdn.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/quantumult-x/all.list
https://cdn.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/loon/all.list
```

单个 provider 使用对应的 provider id：

```text
https://cdn.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/surge/<provider>.list
https://cdn.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/mihomo/<provider>.yaml
https://cdn.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/sing-box/<provider>.json
https://cdn.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/quantumult-x/<provider>.list
https://cdn.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/loon/<provider>.list
```

## 目录结构

```text
data/     Provider 数据源
scripts/ 规则生成脚本
rules/   自动生成的规则文件
```

## 数据源

每个 provider 一个 YAML 文件：

```text
data/providers/<provider>.yaml
```

字段说明：

- `domain`: 精确域名。
- `domainSuffix`: 域名后缀。
- `domainKeyword`: 域名关键字。
- `ipCidr`: IPv4 CIDR。
- `ipCidr6`: IPv6 CIDR。
- `asn`: 自治系统号，仅输出到支持 ASN 规则的客户端。

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

- https://github.com/xiaolai/anthropic-claude-surge-rules-set
- https://ip.net.coffee/claude/site.html
- https://docs.anthropic.com/en/api/ip-addresses
