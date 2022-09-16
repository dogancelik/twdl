#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
import { checkForUpdates, getCommand } from './util.js';
checkForUpdates();

import yargs from 'yargs';

import * as download from './cmds/download.js';
import * as info from './cmds/info.js';
import * as thread from './cmds/thread.js';

global.processStatus = { exitCode: 0 };

yargs(process.argv.slice(2))
	.scriptName('twdl')
	// .commandDir('cmds') // not supported, see issue #2152
	.command(getCommand(download as any), download.desc, download.builder, download.handler as any)
	.command(getCommand(info as any), info.desc, info.builder, info.handler as any)
	.command(getCommand(thread as any), thread.desc, thread.builder, thread.handler as any)
	.demandCommand()
	.help()
	.argv;
