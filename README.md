![twdl](https://user-images.githubusercontent.com/486818/50049631-7ff38300-00fa-11e9-91e9-8403da26613f.png)  
**A tool for downloading media of individual tweets**

[![Github CI: Build Status](https://github.com/dogancelik/twdl/actions/workflows/nodejs.yml/badge.svg)](https://github.com/dogancelik/twdl/actions/workflows/nodejs.yml)
[![Travis CI: Build Status](https://travis-ci.com/dogancelik/twdl.svg?branch=master)](https://travis-ci.com/dogancelik/twdl)

**Update for June 2022:**
1. The `thread` command is temporarily disabled until further notice.
2. Breaking change in v2.6.0+, see Wiki for more info.

## Install

You need [Node.js](https://nodejs.org/en/) (at least version 18) to use *twdl*.
You can also use `npx` (available with NPM 5+).

```sh
npm i -g twdl      # Stable version
npm i -g twdl@beta # Beta version
```

## Usage

```sh
twdl download "https://twitter.com/username/status/111" "https://twitter.com/username/status/222"
twdl --help # show available options
```

[See Wiki](https://github.com/dogancelik/twdl/wiki) for more examples.

## Alternatives

⚠ **twdl is a tool for downloading individual tweets only,**  
if you want something more, check the alternatives [here](https://github.com/dogancelik/twdl/wiki/Alternatives).
