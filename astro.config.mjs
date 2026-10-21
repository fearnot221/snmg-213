import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://fearnot221.github.io',
  base: '/snmg-213',
  output: 'static',
  trailingSlash: 'always',
  devToolbar: { enabled: false },
});
