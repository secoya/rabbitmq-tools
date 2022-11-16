import { libraryConfig } from '@secoya/nodejs-build-tools/tsup.library.config.js';
import { defineConfig } from 'tsup';
export default defineConfig({
	...libraryConfig,
	format: ['esm'],
});
