import { BrowserResolver, PdfGenerator } from './pdf-generator.util';
import * as fs from 'fs';
import * as path from 'path';

describe('BrowserResolver', () => {
  it('should resolve the browser path', () => {
    const browserPath = BrowserResolver.resolve();
    expect(browserPath).toBeDefined();
    expect(fs.existsSync(browserPath)).toBe(true);
  });
});

describe('PdfGenerator', () => {
  it('should generate a PDF from HTML', async () => {
    const html = '<h1>Hello World</h1>';
    const pdfBuffer = await PdfGenerator.generateFromHtml(html);
    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer.length).toBeGreaterThan(0);
    // Check PDF magic number: %PDF
    expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF');
  }, 20000);

  it('should generate a PDF file from HTML', async () => {
    const html = '<h1>Hello World File</h1>';
    const outputPath = path.join(process.cwd(), 'test_output.pdf');
    try {
      await PdfGenerator.generateToFile(html, outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);
      const fileContent = fs.readFileSync(outputPath);
      expect(fileContent.toString('utf8', 0, 4)).toBe('%PDF');
    } finally {
      if (fs.existsSync(outputPath)) {
        fs.unlinkSync(outputPath);
      }
    }
  }, 20000);
});
