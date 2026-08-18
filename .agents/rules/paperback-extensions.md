---
trigger: always_on
description: Guidelines and rules for building, testing, and deploying Paperback extensions and repositories
---

# Paperback Extension Repository Rules & Guidelines

## 1. Extension Architecture
* **Types Inlining**: Never leave `@paperback/types` external in esbuild. Paperback on iOS runs in a pure JavaScriptCore context with no `require()` support.
* **Bundle Format**: Always bundle extensions as an **IIFE** (`format: 'iife'`, `globalName: '_Sources'`) and attach `this.Sources = _Sources` in the bundle footer.
* **HTML Parsing**: Do not rely on `App.createCheerioAPI`. Import `cheerio` directly (`import * as cheerio from 'cheerio'`) and bundle it with esbuild. Provide a fallback `if (!App.createCheerioAPI) App.createCheerioAPI = (html) => cheerio.load(html)`.
* **Cloudflare Bypass**: Always implement both `getCloudflareBypassRequest()` and `getCloudflareBypassRequestAsync()` returning a request with realistic mobile Safari headers.

## 2. Multi-Source Organization
* Source files must reside in `src/<SourceName>/`:
  - `<SourceName>.ts`: Main `Source` class and `SourceInfo`.
  - `<SourceName>Parser.ts`: HTML / JSON parsing methods.
  - `<SourceName>Helper.ts`: Domain constants, URL normalizers, and date parsers.
  - `icon.png`: Extension icon.
* `build.js` must compile all configured sources into `./public/<SourceName>/`, `./public/0.9/<SourceName>/`, and `./public/0.8/<SourceName>/`.
* `versioning.json` must support Universal Paperback compatibility (both 0.8 and 0.9 schema fields).

## 3. Testing & Verification
* Before deploying any extension update, run a simulation test in a sandboxed Node.js `vm.createContext` to verify instantiation and method signatures without runtime exceptions.

## 4. Deployment Workflow
* Deploy compiled output from `./public/` to the `gh-pages` branch on GitHub.
* Trigger a GitHub Pages rebuild via `POST /repos/{owner}/{repo}/pages/builds`.
* When publishing bugfixes to existing sources, increment the source `version` string (e.g., `1.0.0` -> `1.0.1`) to invalidate the iOS client cache.
