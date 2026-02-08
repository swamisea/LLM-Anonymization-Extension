let lastKeyPressTime = 0;
let lastPressedKey = "";
const DOUBLE_PRESS_THRESHOLD = 500; // This is the threshold between key presses (500ms)
const pii_hashamp: { [key: string]: string } = {};
let total_pii_count = 0;
let emailCount = 0;
let phoneCount = 0;

export default defineContentScript({
  matches: ["https://gemini.google.com/*"],
  main() {
    window.addEventListener('keydown', (event) => {
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
              textInputContent.textContent = transformText(originalText);
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
      pii_hashamp[key] = match;
      return key;
    })
    .replace(phoneRegex, (match) => {
      total_pii_count++;
      phoneCount++;
      const key = `PHONE${phoneCount}`;
      pii_hashamp[key] = match;
      return key;
    });

  localStorage.setItem('pii_map', JSON.stringify(pii_hashamp));
  return cleanedString;
}