import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://tjrobertson.com',
  // 4321 is used by another local project on this machine.
  server: { port: 4322 },
});
