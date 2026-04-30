#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-var-requires */
const esbuild = require('esbuild');
const pkg = require('../package.json');

esbuild
  .build({
    entryPoints: ['server.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    outfile: 'dist/server.cjs',
    legalComments: 'none',
    banner: {
      js: "const __IMPORT_META_URL=require('url').pathToFileURL(__filename).href;",
    },
    define: {
      'import.meta.url': '__IMPORT_META_URL',
      'process.env.THOR_VERSION': JSON.stringify(pkg.version),
    },
  })
  .catch(() => process.exit(1));
