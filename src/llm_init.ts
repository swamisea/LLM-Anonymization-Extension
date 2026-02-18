import type { MLCEngine } from "@mlc-ai/web-llm";

const initProgressCallback = (progress: any) => {
    console.log("Model loading progress:", progress);
};

let engine: MLCEngine | null = null;

export async function initEngine(model: string) {
    if (!engine) {
        const { CreateMLCEngine } = await import("@mlc-ai/web-llm");
        engine = await CreateMLCEngine(model, { initProgressCallback });
    }
    return engine;
}

