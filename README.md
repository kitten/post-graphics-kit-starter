# post-graphics-kit-starter

Starter kit for the **Creative Illustrator** Grok Bot template (`setup-graphics-kit` skill).

Includes renderer `src/`, `templates/`, `scripts/`, `tokens.json` (styles kitten, expo, devlog, blueprint, ember, layers), Expo brand SVGs, OFL licence texts, and example specs.

**Fonts:** TailRecursive `.woff2` are not in this repo (public template size). Inter and JetBrains Mono are fetched at setup. If you have TailRecursive files, copy them into `fonts/variable` and `fonts/static`.

```sh
export KIT=/workspace/shared/graphics-kit
mkdir -p "$KIT"
curl -fsSL https://github.com/kitten/post-graphics-kit-starter/archive/refs/heads/main.tar.gz   | tar xz --strip-components=1 -C "$KIT"
cd "$KIT" && pnpm install
```

Use **pnpm** only; never `nodeLinker: hoisted`.
