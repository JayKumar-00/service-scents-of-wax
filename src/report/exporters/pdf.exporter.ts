import { PdfGenerator } from '../../common/utils/pdf-generator.util';

export class PdfExporter {
  public static async export(html: string, outputPath: string): Promise<void> {
    await PdfGenerator.generateToFile(html, outputPath);
  }
}
