import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: "PII Redactor for Gemini",
    description: "Secure your Gemini chats by locally redacting PII and sensitive data before it leaves your browser.",
    version: "1.0.0",
    icons: {
      "16": "icon/16.png",
      "32": "icon/32.png",
      "48": "icon/48.png",
      "96": "icon/96.png",
      "128": "icon/128.png"
    },
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
