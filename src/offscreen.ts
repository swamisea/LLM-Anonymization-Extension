import { browser } from "wxt/browser";
import { initEngine } from "./llm_init";

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PROCESS_WITH_LLM_OFFSCREEN') {
        processWithLLM(message.text, message.systemPrompt)
            .then(response => sendResponse({ success: true, processedText: response }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep the message channel open for async response
    }
});

async function processWithLLM(text: string, systemPrompt: string) {
    try {
        const engine = await initEngine("Llama-3.2-1B-Instruct-q4f32_1-MLC");
        const messages: Array<{ role: "system" | "user", content: string }> = [
            { role: "system", content: systemPrompt },
            { role: "user", content: text }
        ];
        const reply = await engine.chat.completions.create({ messages, temperature: 1, response_format: { type: "json_object" } });
        return reply.choices[0].message.content || "";
    } catch (error) {
        console.error("LLM processing error:", error);
        throw error;
    }
}
