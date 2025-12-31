export type AspectRatio = "1:1" | "2:3" | "3:2" | "3:4" | "4:3" | "16:9" | "9:16";

export type GeminiModel = "gemini-3-pro-image-preview" | "gemini-2.5-flash-image";

export interface GenerateImageInput {
  prompt: string;
  outputPath?: string;
  aspectRatio?: AspectRatio;
  model?: GeminiModel;
}

export interface GenerateImageResult {
  success: boolean;
  base64Data?: string;
  mimeType?: string;
  error?: string;
}

export interface SavedImageResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

export interface GeminiConfig {
  apiKey: string;
  defaultModel: GeminiModel;
  outputDirectory: string;
}
