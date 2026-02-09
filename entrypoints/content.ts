import { browser } from 'wxt/browser';

let lastKeyPressTime = 0;
let lastPressedKey = "";
const DOUBLE_PRESS_THRESHOLD = 500; // This is the threshold between key presses (500ms)
const pii_hashmap: Record<string, string> = {};
const piiCountHashmap: Record<string, number> = {};
const piiHashmap: Record<string, string> = {};
const piiReverseHashmap: Record<string, string> = {};
let total_pii_count = 0;
let emailCount = 0;
let phoneCount = 0;

export default defineContentScript({
  matches: ["https://gemini.google.com/*"],
  main() {
    window.addEventListener('keydown', async (event) => {
      const currentTime = new Date().getTime();
      const key = event.shiftKey;
      if (event.key === 'Shift') {
        const timeDiff = currentTime - lastKeyPressTime;
        if (lastPressedKey === 'Shift' && timeDiff < DOUBLE_PRESS_THRESHOLD) // This checks for doublepressing the shift key 
        {
          const target = event.target as HTMLElement;
          const container = target.closest('.text-input-field');
          if (container) {
            const textInputContent = container.querySelector('p'); // user input content is inside a paragraph tag
            if (textInputContent) {
              const originalText = textInputContent.textContent || "";
              // Modify the text and update the DOM (text input field)
              const llm_response = await pii_scrub(originalText);
              textInputContent.textContent = llm_response;
              //textInputContent.textContent = transformText(originalText);
              lastPressedKey = "";
              lastKeyPressTime = 0;
              return;
            }
          }
        }
        lastPressedKey = "Shift";
        lastKeyPressTime = currentTime;
      } else {
        // Reset key if subsequent press is not Shift key
        lastPressedKey = "";
      }
    }, true); // Capture phase is critical here
  }
});

function transformText(text: string): string {
  // Scrubbing a specific word or adding a prefix
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/gi;

  const cleanedString = text
    .replace(emailRegex, (match) => {
      total_pii_count++;
      emailCount++;
      const key = `EMAIL${emailCount}`;
      pii_hashmap[key] = match;
      return key;
    })
    .replace(phoneRegex, (match) => {
      total_pii_count++;
      phoneCount++;
      const key = `PHONE${phoneCount}`;
      pii_hashmap[key] = match;
      return key;
    });

  localStorage.setItem('pii_map', JSON.stringify(pii_hashmap));
  return cleanedString;
}

async function pii_scrub(text: string): Promise<string> {//Promise<string> {
  const response = await browser.runtime.sendMessage(
    { type: 'PROCESS_WITH_LLM', text: text });

  if (response && response.success && response.processedText) {
    console.log("LLM Response:", response.processedText);
    updateHashmap(response.processedText);
    const updatedText = updateText(text);
    console.log(reverseRedaction(updatedText));
    return updatedText;
  }
  else {
    const errorMsg = response?.error || "Unknown error running inference with LLM";
    console.error("Error running inference with LLM:", errorMsg);
    throw new Error(errorMsg);
  }
}

function updateHashmap(response: string) {
  var responseObj = JSON.parse(response);
  console.log("JSN OBJ: ", responseObj);
  for (const pii of responseObj) {
    if (!piiHashmap[pii.value]) {
      piiCountHashmap[pii.category] = (piiCountHashmap[pii.category] || 0) + 1;
      let piiValue = pii.category + piiCountHashmap[pii.category];
      piiHashmap[pii.value] = piiValue;
      piiReverseHashmap[piiValue] = pii.value;
    }
  }
  console.log("Count hashmap: ", piiCountHashmap);
  console.log("PII hashmap: ", piiHashmap, piiReverseHashmap);
}

function updateText(text: string) {
  const pattern = new RegExp(Object.keys(piiHashmap).join("|"), "g");
  const result = text.replace(pattern, (matched) => piiHashmap[matched]);
  return result;
}

function reverseRedaction(text: string) {
  const pattern = new RegExp(Object.keys(piiReverseHashmap).join("|"), "g");
  const result = text.replace(pattern, (matched) => piiReverseHashmap[matched]);
  return result;
}