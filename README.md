# twdl

A tool for downloading media of individual tweets.
Requires [Node.js](https://nodejs.org/en/).

⚠ I don't plan to add support for anything else, that's not the goal of this tool.
You can use [twitter-photos](https://github.com/shichao-an/twitter-photos) instead if you want download all images of accounts. ⚠

## Usage

```sh
npm i -g twdl
twdl -u "https://twitter.com/username/status/111"
# or
npx twdl -u "https://twitter.com/username/status/111"
# you can supply many tweets
twdl -u "https://twitter.com/username/status/111" -u "https://twitter.com/username/status/222" # -u …
```

## To-do

* Load a list of tweets from a text file