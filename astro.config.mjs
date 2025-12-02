// @ts-check
import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import gruvboxDarkMedium from 'shiki/themes/gruvbox-dark-medium.mjs';

// https://astro.build/config
export default defineConfig({
  integrations: [tailwind()],
  markdown: {
    syntaxHighlight: 'shiki',
    shikiConfig: {
      theme: gruvboxDarkMedium,
      wrap: true,
      transformers: [
        {
          pre(node) {
            const language = this.options.lang || 'text';
            node.properties['data-language'] = language;
          }
        }
      ]
    },
  },
});