import systemPrompt from '@/assets/prompt.md?raw';

const OFFSCREEN_DOCUMENT_PATH = '/offscreen.html';
declare const self: ServiceWorkerGlobalScope;

export default defineBackground(() => {
  // Create offscreen document if it doesn't exist
  setupOffscreenDocument(OFFSCREEN_DOCUMENT_PATH);

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessages(message, sender, sendResponse, systemPrompt);
    return true; // Response sent async
  });
});

const handleMessages = async (message: any, sender: any, sendResponse: (res: any) => void, systemPrompt: string) => {
  if (message.type === "PROCESS_WITH_LLM") {
    try {
      await setupOffscreenDocument(OFFSCREEN_DOCUMENT_PATH)
      // Forward message to offscreen document
      browser.runtime.sendMessage({
        type: 'PROCESS_WITH_LLM_OFFSCREEN',
        text: message.text,
        systemPrompt: systemPrompt
      }).then((response) => {
        sendResponse(response);
      });
    } catch (error) {
      sendResponse({ success: false, error: String(error) });
    }
  }
};

let creating: Promise<void> | null = null;
async function setupOffscreenDocument(path: string) {
  // 1. Check if it already exists in the browser's eyes
  const existingContexts = await browser.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [browser.runtime.getURL('/offscreen.html')]
  });

  if (existingContexts.length > 0) {
    return;
  }

  // 2. Handle the "In Progress" lock
  if (creating) {
    await creating;
    return;
  }

  // 3. Create and store the promise immediately
  creating = browser.offscreen.createDocument({
    url: path,
    reasons: [browser.offscreen.Reason.DOM_SCRAPING], // Use the enum if possible
    justification: 'Inference with WebLLM requires DOM access',
  });

  try {
    await creating;
  } catch (err) {
    creating = null; // Reset if creation fails so we can try again
    throw err;
  }
}

async function hasOffscreenDocument(path: string) {
  const matchedClients = await self.clients.matchAll();
  return matchedClients.some((c: any) => c.url.endsWith(path));
}
