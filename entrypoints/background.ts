// 
const STORAGE_KEYS = {
  PII_COUNT: 'piiCountHashmap',
  PII_MAP: 'piiHashmap',
  PII_REVERSE_MAP: 'piiReverseHashmap',
  CUSTOM_PII: 'customPII',
  LLM_INSTRUCTS: 'llmInstructs',
};

const piiCountHashmap: Record<string, number> = {};
const piiHashmap: Record<string, string> = {};
const piiReverseHashmap: Record<string, string> = {};
let customPII: Set<string> = new Set();
let llmInstructs: string = "";
let llmMode: boolean = false;
let offscreenPromise: Promise<void> | null = null;
const systemPrompt: string = `**Role:** You are a strict Redaction Engine. Your job is to process input text and remove specific information based *only* on the rules provided by the user.

**Operational Constraints:**
1. **Strict Fidelity:** Do not change, rewrite, or correct the input text. No summarization or formatting changes are permitted.
2. **Exclusivity:** Only redact items that fall under the user's defined rules. Do not apply "common sense" redactions.
3. **Format:** You must output a single, valid JSON object. No text before or after.
4. Replace each occurrence of redacted words with '[REDACTED]' in the redacted_string field.

**Output Format:**
{"elements": ["exact strings that were redacted"], "redacted_string": "full text with redactions applied"}

**Instruction:**
Awaiting user rules and input text.`

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => pushToStorage(), 500);
}

async function pushToStorage() {
  await chrome.storage.local.set({
    [STORAGE_KEYS.PII_COUNT]: piiCountHashmap,
    [STORAGE_KEYS.PII_MAP]: piiHashmap,
    [STORAGE_KEYS.PII_REVERSE_MAP]: piiReverseHashmap,
    [STORAGE_KEYS.CUSTOM_PII]: Array.from(customPII),
    [STORAGE_KEYS.LLM_INSTRUCTS]: llmInstructs,
  });
}

async function loadFromStorage() {
  const data = await chrome.storage.local.get(Object.values(STORAGE_KEYS));
  Object.assign(piiCountHashmap, data[STORAGE_KEYS.PII_COUNT] ?? {});
  Object.assign(piiHashmap, data[STORAGE_KEYS.PII_MAP] ?? {});
  Object.assign(piiReverseHashmap, data[STORAGE_KEYS.PII_REVERSE_MAP] ?? {});
  customPII = new Set<string>((data[STORAGE_KEYS.CUSTOM_PII] as string[]) ?? []);
  llmInstructs = data[STORAGE_KEYS.LLM_INSTRUCTS] as string ?? '';
}


export default defineBackground(async () => {
  // fetching existing mappings, custom keywords and rules from browser storage
  await loadFromStorage();

  browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
      case "REDACT":
        const redactResponse = transformText(message.text);
        sendResponse(redactResponse);
        break;
      case "REHYDRATE":
        const rehydResponse = rehydratePII(message.text);
        sendResponse(rehydResponse);
        break;
      case "GET_PII_STATS":
        sendResponse(piiCountHashmap);
        break;
      case "ADD_CUSTOM_PII":
        const addCustomPIIResponse = addCustomPII(message.customPII);
        sendResponse({ success: true });
        break;
      case "GET_CUSTOM_PII":
        const getCustomPIIResponse = getCustomPII();
        sendResponse({
          success: true,
          customPII: Array.from(getCustomPIIResponse)
        });
        break;
      case "GET_LLM_INSTRUCTS":
        const getLLMInstructsResponse = getLLMInstruct();
        sendResponse({
          success: true,
          LLMInstructs: getLLMInstructsResponse
        });
        break;
      case "SET_LLM_INSTRUCTS":
        llmInstructs = message.rules;
        scheduleSave();
        sendResponse({ success: true });
        break;
      case "TOGGLE_LLM_MODE":
        llmMode = message.enabled;
        sendResponse({ success: true });
        break;
      case "GET_LLM_MODE":
        sendResponse({ success: true, enabled: llmMode });
        break;
      case "LLM_REDACTION":
        llmRedaction(message.input, message.modelName, message.userRules)
          .then(response => {
            sendResponse({
              success: true,
              response: response
            });
          })
          .catch(error => {
            sendResponse({
              success: false,
              error: error.message
            });
          });
        return true; // Keep channel open for async response
      default:
        console.log("Invalid message type");
        break;
    }
    return true; // Response sent async
  });
});

// PII Redaction function
// Supported PII: email, phone number, SSN, IpV4 address, Credit card
function transformText(text: string): string {
  console.log(text);
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
  const ssnRegex = /\b(?!000|666|9\d{2})\d{3}?-(?!00)\d{2}?-(?!0{4})\d{4}\b/g;
  const ipAddRegex = /\b(25[0-5]|2[0-4]\d|1?\d{1,2})(\.(25[0-5]|2[0-4]\d|1?\d{1,2})){3}\b/gi;
  const ccRegex = /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))\d{0,12}(?:[\s-]?\d{4}){0,3}\b/g; //TODO: Add support for AMEX cards
  const customPIIRegex = customPII2Regex();
  console.log("custom PII regex: ", customPIIRegex);

  let cleanedString = text
    .replace(emailRegex, (match) => {
      return replaceUpdateInput(match, 'email');
    })
    .replace(phoneRegex, (match) => {
      return replaceUpdateInput(match, 'phone');
    })
    .replace(ssnRegex, (match) => {
      return replaceUpdateInput(match, 'ssn');
    })
    .replace(ipAddRegex, (match) => {
      return replaceUpdateInput(match, 'ip_address');
    })
    .replace(ccRegex, (match) => {
      return replaceUpdateInput(match, 'credit_card');
    });

  if (customPII.size > 0) {
    cleanedString = cleanedString.replace(customPIIRegex, (match) => {
      return replaceUpdateInput(match, 'custom_pii');
    });
  }


  return cleanedString;
}

function replaceUpdateInput(matchText: string, type: string) {
  if (!piiHashmap[matchText]) {
    piiCountHashmap[type] = (piiCountHashmap[type] || 0) + 1;
    const key = `${type.toUpperCase()}${piiCountHashmap[type]}`;
    piiHashmap[matchText] = key;
    piiReverseHashmap[key] = matchText;

    // notify UI of the update
    browser.runtime.sendMessage({ type: 'PII_COUNT_UPDATED' }).catch(() => {
      console.log("IGNORE: Error due to popup not being open during pii count update");
    });
    scheduleSave();
    return key;
  }
  return piiHashmap[matchText];
}

function rehydratePII(text: string) {
  console.log(piiReverseHashmap);
  console.log(text);
  const pattern = new RegExp(Object.keys(piiReverseHashmap).join("|"), "g");
  const result = text.replace(pattern, (matched) => piiReverseHashmap[matched]);
  return result;
}

function addCustomPII(customList: string[]) {
  customList.forEach(item => customPII.add(item));
  scheduleSave();
}

function getCustomPII() {
  return customPII;
}

function getLLMInstruct() {
  return llmInstructs;
}

function escapeSpecialChars(text: string) {
  return text.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

function customPII2Regex() {
  const escCustomPII = Array.from(customPII, (text) => escapeSpecialChars(text));
  const strPattern = escCustomPII.join('|');
  console.log("string pattern of the regex: ", strPattern);
  return new RegExp(strPattern, 'gi');
}

async function setupOffscreenDocument(path: string) {
  // Check if offscreen document already exists
  const existingContexts = await browser.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT' as any],
  });

  if (existingContexts.length > 0) {
    return;
  }

  // Create offscreen document
  if (offscreenPromise) {
    await offscreenPromise;
    return;
  }

  offscreenPromise = chrome.offscreen.createDocument({
    url: path,
    reasons: [chrome.offscreen.Reason.DOM_PARSER],
    justification: "Running LLM inference using Web-LLM which requires a DOM environment.",
  });

  await offscreenPromise;
  offscreenPromise = null;
}

async function llmRedaction(input: string, modelName: string, userRules: string) {
  try {
    await setupOffscreenDocument('offscreen.html');
    if (userRules && !llmInstructs.split('\n').includes(userRules)) {
      llmInstructs = llmInstructs ? `${llmInstructs}\n${userRules}` : userRules;
    }
    const activeRules = llmInstructs;
    const response = await browser.runtime.sendMessage({
      type: 'PROCESS_WITH_LLM_OFFSCREEN',
      text: input,
      systemPrompt,
      userRules: activeRules,
      modelName
    });

    if (response && response.success) {
      console.log(response.processedText);
      const responseObj = JSON.parse(response.processedText);
      const elementsArray = [...new Set(responseObj["elements"])] as string[];

      let keyedRedactedString = input;
      for (const element of elementsArray) {
        if (!element) continue;
        const elementRegex = new RegExp(escapeSpecialChars(element), 'gi');
        keyedRedactedString = keyedRedactedString.replace(elementRegex, (match) => {
          return replaceUpdateInput(match, 'llm_redaction');
        });
      }

      console.log("Elements tracked:", elementsArray);
      console.log("Keyed string:", keyedRedactedString);
      return keyedRedactedString;
    } else {
      throw new Error(response?.error || `Error performing LLM redaction with ${modelName}`);
    }
  } catch (error) {
    console.error("Background LLM processing error:", error);
    throw error;
  }
}