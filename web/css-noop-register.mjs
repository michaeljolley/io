// Registers the CSS no-op loader using the stable Node.js module hooks API.
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'
register('./css-noop-loader.mjs', pathToFileURL('./'))
