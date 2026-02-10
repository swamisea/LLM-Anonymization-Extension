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
      // Schedule rehydration after delay
      rehydrationTimeout = window.setTimeout(async () => {
        observer.disconnect();

        // Find all model response paragraphs
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
                // modify text and update DOM (text input field)
                textInputContent.textContent = await redactText(originalText); // redacted text
                console.log("[CONTENT] Redacted user input");
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
  }
});

async function redactText(text: string): Promise<string> {
  const response = await browser.runtime.sendMessage(
    { type: 'REDACT', text: text });
  return response;
}

async function rehydrateModelResponse(text: string): Promise<string> {
  const response = await browser.runtime.sendMessage(
    { type: 'REHYDRATE', text: text });
  return response;
}