![twdl](https://user-images.githubusercontent.com/486818/50049631-7ff38300-00fa-11e9-91e9-8403da26613f.png)  
**A tool for downloading media of individual tweets**

[![Build Status](https://travis-ci.com/dogancelik/twdl.svg?branch=master)](https://travis-ci.com/dogancelik/twdl)

**Update for June 2022:**
1. The `thread` command is temporarily disabled until further notice.
2. Breaking change in v2.6.0+, see Wiki for more info.

## Install

You need [Node.js](https://nodejs.org/en/) (at least version 14) to use *twdl*.
You can also use `npx` (available with NPM 5+).

```sh
npm i -g twdl      # Stable version
npm i -g twdl@beta # Beta version
```

## Usage

```sh
twdl "https://twitter.com/username/status/111" "https://twitter.com/username/status/222"
twdl --help # show available options
```

[See Wiki](https://github.com/dogancelik/twdl/wiki) for more examples.

## Alternatives

⚠ **twdl is a tool for downloading individual tweets only,**  
if you want something more, check the alternatives below:

| Repo | Last Update |
| --- | --- |
| [gallery-dl](https://github.com/mikf/gallery-dl) | April 2021 |
| [youtube-dl](https://github.com/ytdl-org/youtube-dl) | April 2021 |
| [snscrape](https://github.com/JustAnotherArchivist/snscrape/) | April 2021 |
| [GetOldTweets3](https://github.com/Mottl/GetOldTweets3/) | May 2020 |
| [twitter-photos](https://github.com/shichao-an/twitter-photos) | March 2018 |
