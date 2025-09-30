declare module "pdfreader" {
  export class PdfReader {
    parseBuffer(
      buffer: Buffer,
      callback: (error: Error | null, item: { page?: number; text?: string; x?: number; y?: number } | null) => void,
    ): void
  }
}
