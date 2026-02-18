let lastKeyPressTime = 0;
let lastPressedKey = "";
const DOUBLE_PRESS_THRESHOLD = 500; // threshold between key presses (500ms)
let rehydrationTimeout: number | null = null;
const REHYDRATION_DELAY = 300;

export default defineContentScript({
  matches: ["https://gemini.google.com/*"],
  main() {
    // below section deals with the logic to rehydrate the PII in the model responses
    const observer = new MutationObserver(async (mutations) => {
      if (rehydrationTimeout) {
        clearTimeout(rehydrationTimeout);
      }
      observer.disconnect();
      // schedule rehydration after delay
      rehydrationTimeout = window.setTimeout(async () => {
        observer.disconnect();

        // find all model response paragraphs
        const containers = document.querySelectorAll('.model-response-text');
        for (const container of Array.from(containers)) {
          const paragraphs = container.querySelectorAll('p');
          for (const p of Array.from(paragraphs)) {
            if (p.textContent) {
              const original = p.textContent;
              const rehydrated = await rehydrateModelResponse(p.textContent);
              if (original !== rehydrated) {
                console.log("[CONTENT] Rehydrated model response");
                p.textContent = rehydrated;
              }
            }
          }
        }

        start();
      }, REHYDRATION_DELAY);
    });

    function start() {
      observer.observe(document.body, {
        childList: true,      // detects when <p> tags are added
        subtree: true,
        characterData: true,  // Detects when text inside <p> changes when model is streaming content
      });
    }
    start();

    // below section deals with the activation sequence for redaction and the redaction logic 
    window.addEventListener('keydown', async (event) => {
      const currentTime = new Date().getTime();
      const key = event.shiftKey;
      if (event.key === 'Shift') {
        const timeDiff = currentTime - lastKeyPressTime;
        if (lastPressedKey === 'Shift' && timeDiff < DOUBLE_PRESS_THRESHOLD) // checks for doublepressing the shift key 
        {
          const target = event.target as HTMLElement;
          const container = target.closest('.text-input-field');
          if (container) {
            const textInputContents = container.querySelectorAll('p'); // user input content is inside a paragraph tag
            for (const textInputContent of Array.from(textInputContents)) {
              if (textInputContent) {
                const originalText = textInputContent.textContent || "";

                // regex Redaction
                let redactedTextResult = await regexRedactText(originalText);
                console.log("[CONTENT] Regex redaction complete");

                // LLM Redaction (if enabled)
                const { enabled: llmEnabled } = await browser.runtime.sendMessage({ type: 'GET_LLM_MODE' });
                if (llmEnabled) {
                  console.log("[CONTENT] LLM Mode active, performing second pass");
                  redactedTextResult = await llmRedactText(redactedTextResult);
                  console.log("[CONTENT] LLM redaction complete");
                }

                textInputContent.textContent = redactedTextResult;
                lastPressedKey = "";
                lastKeyPressTime = 0;
                return;
              }
            }

          }
        }
        lastPressedKey = "Shift";
        lastKeyPressTime = currentTime;
      } else {
        // reset key if subsequent press is not Shift key
        lastPressedKey = "";
      }
    }, true); // capture phase is critical here

    // listen for messages from the background
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (message.type === 'GET_INPUT_TEXT') {
        const inputField = document.querySelector('.text-input-field p');
        sendResponse({ text: inputField?.textContent || "" });
      } else if (message.type === 'SET_INPUT_TEXT') {
        const inputField = document.querySelector('.text-input-field p');
        if (inputField) {
          inputField.textContent = message.text;
          // trigger an input event so Gemini knows the content changed
          inputField.dispatchEvent(new Event('input', { bubbles: true }));
          sendResponse({ success: true });
        } else {
          sendResponse({ success: false, error: 'Input field not found' });
        }
      }
    });
  }
});

async function regexRedactText(text: string): Promise<string> {
  const response = await browser.runtime.sendMessage(
    { type: 'REDACT', text: text });
  return response;
}

async function llmRedactText(text: string): Promise<string> {
  const response = await browser.runtime.sendMessage({
    type: 'LLM_REDACTION',
    input: text,
    modelName: "Llama-3.1-8B-Instruct",
    userRules: "" // background will use its stored rules if empty
  });
  return response.response || text;
}

async function rehydrateModelResponse(text: string): Promise<string> {
  const response = await browser.runtime.sendMessage(
    { type: 'REHYDRATE', text: text });
  return response;
}