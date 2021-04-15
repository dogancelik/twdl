#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
require('yargs/yargs')(process.argv.slice(2))
  .commandDir('cmds')
  .demandCommand()
  .help()
  .argv;
