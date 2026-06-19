import fs from 'fs';
import pdfParse from 'pdf-parse';
import { AppError } from '../middleware/error.middleware.js';

/**
 * Extracts raw text from a PDF file.
 */
export async function parseResumePDF(filePath: string): Promise<string> {
  if (!fs.existsSync(filePath)) {
    throw new AppError('Resume file not found.', 404);
  }

  const buffer = fs.readFileSync(filePath);

  if (buffer.length === 0) {
    throw new AppError('The uploaded PDF file is empty.', 400);
  }

  try {
    const data = await pdfParse(buffer);

    if (!data.text || data.text.trim().length < 50) {
      throw new AppError(
        'Could not extract text from the PDF. Please ensure the PDF contains readable text (not a scanned image).',
        422
      );
    }

    // Clean the extracted text
    const cleaned = data.text
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim();

    return cleaned;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      'Failed to parse the PDF file. Please ensure it is a valid, non-corrupted PDF.',
      422
    );
  }
}

/**
 * Deletes a file from disk (cleanup after processing).
 */
export function deleteFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch {
    console.warn(`Could not delete file: ${filePath}`);
  }
}
