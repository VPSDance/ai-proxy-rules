---
name: 添加 Provider
about: 请求把某个 AI 服务加进规则
title: "[Provider] <服务名>"
labels: provider-request
---

## 服务名 / 网站

例如：`Foo AI` — https://foo.ai/

## 主要域名

列出该服务对外用户访问的关键域名（不需要列后端的 CDN）：

- foo.ai
- api.foo.ai

## 是否有现成上游

- [ ] v2fly/domain-list-community (`data/<id>`)
- [ ] blackmatrix7/ios_rule_script (`rule/Shadowrocket/<Name>/`)
- [ ] SkywalkerJi/Clash-Rules (`AI/<Name>.yaml`)
- [ ] 没有，建议手写

## 备注

任何其他信息（产品类别、是否需要 patch.remove 哪些上游噪声等）。
