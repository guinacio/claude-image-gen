import { GoogleGenAI } from "@google/genai";
export class GeminiImageClient {
    ai;
    config;
    constructor(config) {
        this.ai = new GoogleGenAI({ apiKey: config.apiKey });
        this.config = config;
    }
    async generateImage(input) {
        try {
            const modelName = input.model || this.config.defaultModel;
            // Build generation config
            const generationConfig = {
                responseModalities: ["TEXT", "IMAGE"],
            };
            // Add image config if aspect ratio is specified
            if (input.aspectRatio) {
                generationConfig.imageConfig = {
                    aspectRatio: input.aspectRatio,
                };
            }
            const response = await this.ai.models.generateContent({
                model: modelName,
                contents: input.prompt,
                config: generationConfig,
            });
            // Extract image from response
            const candidates = response.candidates;
            if (!candidates || candidates.length === 0) {
                return {
                    success: false,
                    error: "No candidates in response",
                };
            }
            const parts = candidates[0].content?.parts;
            if (!parts) {
                return {
                    success: false,
                    error: "No content parts in response",
                };
            }
            // Find the image part in the response
            for (const part of parts) {
                if ("inlineData" in part && part.inlineData) {
                    return {
                        success: true,
                        base64Data: part.inlineData.data,
                        mimeType: part.inlineData.mimeType || "image/png",
                    };
                }
            }
            return {
                success: false,
                error: "No image data found in response",
            };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                error: `Gemini API error: ${errorMessage}`,
            };
        }
    }
}
