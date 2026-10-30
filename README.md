# post-graphics-kit-starter

Starter kit for the **Creative Illustrator** Grok Bot template (`setup-graphics-kit` skill).

Includes renderer `src/`, `templates/`, `scripts/`, `tokens.json` (styles kitten, expo, devlog, blueprint, ember, layers), Expo brand SVGs, OFL licence texts, and example specs.

**Fonts (installed by setup, not in this repo):**
- [TailRecursive](https://github.com/kitten/tailrecursive-font) `v0.100` release (`TailRecursiveVF.woff2` / `.ttf`)
- Inter + JetBrains Mono (OFL)

```sh
export KIT=/workspace/shared/graphics-kit
mkdir -p "$KIT"
curl -fsSL https://github.com/kitten/post-graphics-kit-starter/archive/refs/heads/main.tar.gz   | tar xz --strip-components=1 -C "$KIT"
# then run the setup-graphics-kit skill (fonts + pnpm install + pnpm fonts)
```

Use **pnpm** only; never `nodeLinker: hoisted`.
