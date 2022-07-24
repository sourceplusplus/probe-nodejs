# ![](https://github.com/sourceplusplus/live-platform/blob/master/.github/media/sourcepp_logo.svg)

[![License](https://img.shields.io/github/license/sourceplusplus/probe-python)](LICENSE)
[![NPM](https://img.shields.io/npm/v/sourceplusplus?color=blue)](https://www.npmjs.com/package/sourceplusplus)
<!--[![E2E](https://github.com/sourceplusplus/probe-python/actions/workflows/e2e.yml/badge.svg)](https://github.com/sourceplusplus/probe-python/actions/workflows/e2e.yml)-->

# What is this?

This project provides Node.js support to the [Source++](https://github.com/sourceplusplus/live-platform) open-source live coding platform.

# Usage

- `npm i sourceplusplus`

## Attach

```node
import SorcePlusPlus from "sourceplusplus";
SourcePlusPlus.start();
```

### Config

Add `spp-probe.yml` to working directory (or set `SPP_PROBE_CONFIG_FILE` env):

```yml
spp:
  platform_host: "localhost"
  ssl_enabled: false
skywalking:
  collector:
    backend_service: "localhost:11800"
```
