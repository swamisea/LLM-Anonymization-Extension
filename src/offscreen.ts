import { browser } from "wxt/browser";
import { initEngine } from "./llm_init";
import type { MLCEngine } from "@mlc-ai/web-llm";

let engine: MLCEngine | null = null;

const responseSchema = {
    type: "object",
    properties: {
        elements: {
            type: "array",
            items: { type: "string" }
        },
        redacted_string: { type: "string" }
    },
    required: ["elements", "redacted_string"]
};

browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'PROCESS_WITH_LLM_OFFSCREEN') {
        processWithLLM(message.text, message.systemPrompt, message.userRules)
            .then(response => sendResponse({ success: true, processedText: response }))
            .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Keep the message channel open for async response
    }
});

async function processWithLLM(text: string, systemPrompt: string, userRules: string, modelName?: string) {
    try {
        if (!engine) {
            engine = await initEngine(modelName || "Llama-3.1-8B-Instruct-q4f16_1-MLC");
        }

        const messages: Array<{ role: "system" | "user", content: string }> = [
            { role: "system", content: systemPrompt },
            { role: "user", content: `Rules:\n${userRules}\n\nInput text:\n${text}\n\nReturn JSON only. ***ONLY*** Replace the ***ENTIRE*** all matches with [REDACTED] in ***redacted_string*** field ***ONLY***.` }
        ];
        const reply = await engine.chat.completions.create({
            messages, temperature: 0, response_format: {
                type: "json_object",
                schema: JSON.stringify(responseSchema)
            }
        });
        return reply.choices[0].message.content || "";
    } catch (error) {
        console.error("LLM processing error:", error);
        throw error;
    }
}

