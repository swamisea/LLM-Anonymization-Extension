import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    permissions: [
      "offscreen",
      "storage"],
    web_accessible_resources: [
      {
        resources: ['assets/prompt.md'],
        matches: ["<all_urls>"]
      }
    ]
  },
});
