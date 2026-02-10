const piiCountHashmap: Record<string, number> = {};
const piiHashmap: Record<string, string> = {};
const piiReverseHashmap: Record<string, string> = {};

export default defineBackground(() => {
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
      default:
        console.log("Invalid message type");
    }
    return true; // Response sent async
  });
});

// PII Redaction function
// Supported PII: email, phone number, SSN, IpV4 address, Credit card
function transformText(text: string): string {
  console.log(text);
  // Scrubbing a specific word or adding a prefix
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;
  const phoneRegex = /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g;
  const ssnRegex = /\b(?!000|666|9\d{2})\d{3}?-(?!00)\d{2}?-(?!0{4})\d{4}\b/g;
  const ipAddRegex = /\b(25[0-5]|2[0-4]\d|1?\d{1,2})(\.(25[0-5]|2[0-4]\d|1?\d{1,2})){3}\b/gi;
  const ccRegex = /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))\d{0,12}(?:[\s-]?\d{4}){0,3}\b/g; //TODO: Add support for AMEX cards

  const cleanedString = text
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

    return key;
  }
  return piiHashmap[matchText];
}

function rehydratePII(text: string) {
  console.log("Came into regydration");
  console.log(piiReverseHashmap);
  console.log(text);
  const pattern = new RegExp(Object.keys(piiReverseHashmap).join("|"), "g");
  const result = text.replace(pattern, (matched) => piiReverseHashmap[matched]);
  return result;
}