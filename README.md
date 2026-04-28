# AI Proxy Rules

[![daily sync](https://img.shields.io/github/actions/workflow/status/VPSDance/ai-proxy-rules/generate.yml?branch=main&label=daily%20sync)](https://github.com/VPSDance/ai-proxy-rules/actions/workflows/generate.yml)
[![providers](https://img.shields.io/github/directory-file-count/VPSDance/ai-proxy-rules/data/sources?type=file&extension=yaml&label=providers)](https://github.com/VPSDance/ai-proxy-rules/tree/main/data/sources)
[![last update](https://img.shields.io/github/last-commit/VPSDance/ai-proxy-rules/main?label=last%20update)](https://github.com/VPSDance/ai-proxy-rules/commits/main)

AI 服务分流规则聚合，每日自动更新，多源合并去重并修正上游错误。直接订阅 `rules/` 文件，覆盖 Clash / Mihomo / sing-box / Surge / Shadowrocket / Loon / Stash / Quantumult X。

规则覆盖范围：

- OpenAI / ChatGPT (`openai`)
- Anthropic / Claude (`anthropic`)
- Google AI / Gemini / AI Studio / NotebookLM / Antigravity (`google-ai`)
- xAI / Grok (`x-ai`)
- Meta AI / Llama (`meta-ai`)
- Mistral AI / Le Chat (`mistral-ai`)
- Cohere (`cohere`)
- GitHub Copilot (`copilot`)
- Cursor (`cursor`)
- Windsurf / Codeium (`windsurf`)
- JetBrains AI / Grazie (`jetbrains-ai`)
- Augment Code (`augment-code`)
- Sourcegraph / Amp / Cody (`sourcegraph`)
- Tabnine (`tabnine`)
- Replit (`replit`)
- Amazon Q Developer (`amazon-q`)
- Kiro (`kiro`)
- ByteDance AI / Trae / Coze / MarsCode / Cici (`bytedance-ai`)
- Devin (`devin`)
- v0 (`v0`)
- Bolt.new (`bolt`)
- Lovable (`lovable`)
- Continue (`continue`)
- CodeRabbit (`coderabbit`)
- Phind (`phind`)
- Midjourney (`midjourney`)
- Stability AI (`stability-ai`)
- Black Forest Labs / FLUX (`black-forest-labs`)
- Ideogram (`ideogram`)
- Adobe Firefly (`adobe-firefly`)
- Leonardo AI (`leonardo-ai`)
- Recraft (`recraft`)
- Civitai (`civitai`)
- Suno (`suno`)
- Udio (`udio`)
- Runway (`runway`)
- Pika (`pika`)
- Luma AI (`luma-ai`)
- HeyGen (`heygen`)
- Synthesia (`synthesia`)
- Descript (`descript`)
- Gamma (`gamma`)
- Hugging Face (`huggingface`)
- Groq (`groq`)
- OpenRouter (`openrouter`)
- Together AI (`together-ai`)
- Fireworks AI (`fireworks-ai`)
- Replicate (`replicate`)
- DeepInfra (`deepinfra`)
- Cerebras (`cerebras`)
- Cloudflare AI (`cloudflare-ai`)
- Perplexity (`perplexity`)
- You.com (`you`)
- Genspark (`genspark`)
- Poe (`poe`)
- Character.AI (`character-ai`)
- Inflection / Pi (`inflection`)
- ElevenLabs (`elevenlabs`)
- Otter.ai (`otter-ai`)
- Grammarly (`grammarly`)
- Manus (`manus`)
- Dify (`dify`)
- LangChain (`langchain`)
- CrewAI (`crewai`)
- Ollama (`ollama`)
- LM Studio (`lmstudio`)

支持的客户端格式：

- Clash / Mihomo
- sing-box
- Surge
- Shadowrocket
- Loon
- Stash
- Quantumult X

## 规则文件

把下面地址填到客户端的规则订阅、rule-set 或 rule-providers 配置里。

需要同时覆盖所有 AI 服务时，使用 `all`：

```text
https://cdn.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/clash/all.yaml
https://cdn.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/sing-box/all.json
https://cdn.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/surge/all.list
https://cdn.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/shadowrocket/all.list
https://cdn.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/loon/all.list
https://cdn.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/stash/all.list
https://cdn.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/quantumult-x/all.list
```

只需要某一个 AI 服务时，把 `<provider>` 换成上面括号里的 id，例如 `anthropic`、`openai`、`copilot`、`cursor` 或 `huggingface`：

```text
https://cdn.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/clash/<provider>.yaml
https://cdn.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/sing-box/<provider>.json
https://cdn.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/surge/<provider>.list
https://cdn.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/shadowrocket/<provider>.list
https://cdn.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/loon/<provider>.list
https://cdn.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/stash/<provider>.list
https://cdn.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/quantumult-x/<provider>.list
```

也可以把 `<provider>` 换成场景汇总 id：`assistant`、`coding`、`inference`、`media`、`search`、`agent`、`local`、`productivity`。

例如 Anthropic / Claude 的 Clash 规则：

```text
https://cdn.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/clash/anthropic.yaml
```

> 国内 jsDelivr 偶尔不稳定时，可把 `cdn.jsdelivr.net` 替换为 `testingcf.jsdelivr.net`、`fastly.jsdelivr.net` 或 `cdn.jsdmirror.com` 等镜像。

## 目录结构

```text
data/sources/   人工维护的来源配置
data/providers/ 由 data/sources/ 生成的 Provider 数据
data/cache/     上游响应缓存，上游故障时作为兜底
scripts/        同步与生成脚本
rules/          自动生成的规则文件
```

## 维护

安装依赖：

```bash
pnpm install
```

生成规则：

```bash
pnpm sync
pnpm generate
```

验证：

```bash
pnpm check
pnpm test
```

GitHub Actions 会在影响规则生成的文件变化时自动运行同步、检查和生成，并在 `data/` 或 `rules/` 有变化时提交生成结果。

## References

- https://github.com/xiaolai/anthropic-claude-surge-rules-set
- https://ip.net.coffee/claude/site.html
- https://docs.anthropic.com/en/api/ip-addresses
- https://github.com/blackmatrix7/ios_rule_script
- https://github.com/v2fly/domain-list-community
- https://github.com/SkywalkerJi/Clash-Rules
