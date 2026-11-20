import { execFile } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Logger } from '@nestjs/common';

const execFileAsync = promisify(execFile);
const logger = new Logger('PdfGenerator');

export class BrowserResolver {
  private static resolvedPath: string | null = null;

  public static resolve(): string {
    if (this.resolvedPath) {
      return this.resolvedPath;
    }

    const platform = process.platform;
    const envPath = process.env.PDF_BROWSER_PATH;
    const attemptedLocations: string[] = [];

    // 1. Check process.env.PDF_BROWSER_PATH
    if (envPath) {
      attemptedLocations.push(envPath);
      if (fs.existsSync(envPath)) {
        this.resolvedPath = envPath;
        logger.log(
          `Selected browser path: ${envPath} (from PDF_BROWSER_PATH env variable). OS: ${platform}`,
        );
        return envPath;
      } else {
        logger.warn(
          `Browser path configured in PDF_BROWSER_PATH does not exist: ${envPath}`,
        );
      }
    }

    // 2. OS-specific auto-detection
    let candidates: string[] = [];
    if (platform === 'win32') {
      candidates = [
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      ];
    } else if (platform === 'linux') {
      candidates = [
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome',
        '/usr/bin/microsoft-edge',
      ];
    } else {
      logger.warn(`Unsupported OS platform for auto-detection: ${platform}`);
    }

    for (const candidate of candidates) {
      attemptedLocations.push(candidate);
      if (fs.existsSync(candidate)) {
        this.resolvedPath = candidate;
        logger.log(
          `Selected browser path: ${candidate} (via auto-detection). OS: ${platform}`,
        );
        return candidate;
      }
    }

    // 3. Fallback/Error if nothing resolved
    const errorMsg = `PDF Generation Error: No compatible browser executable found on this system. OS detected: ${platform}. Attempted locations:\n- ${attemptedLocations.join('\n- ')}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }
}

export interface PdfOptions {
  noHeaderFooter?: boolean;
}

export class PdfGenerator {
  public static async generateFromHtml(
    html: string,
    options: PdfOptions = {},
  ): Promise<Buffer> {
    const browserPath = BrowserResolver.resolve();

    const tempHtmlPath = path.join(
      os.tmpdir(),
      `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.html`,
    );
    const tempPdfPath = path.join(
      os.tmpdir(),
      `temp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}.pdf`,
    );

    logger.log(
      `PDF generation started. Temp HTML: ${tempHtmlPath}, Temp PDF: ${tempPdfPath}`,
    );

    const tStart = Date.now();
    try {
      const t0 = Date.now();
      await fs.promises.writeFile(tempHtmlPath, html, 'utf8');
      const t1 = Date.now();

      const args = [
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--no-proxy-server',
        '--disable-dev-shm-usage',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--incognito',
      ];

      if (options.noHeaderFooter) {
        args.push('--no-pdf-header-footer');
      }

      args.push(`--print-to-pdf=${tempPdfPath}`);
      args.push(tempHtmlPath);

      await execFileAsync(browserPath, args, { timeout: 25000 });
      const t2 = Date.now();

      if (!fs.existsSync(tempPdfPath)) {
        throw new Error(
          `Chromium process completed but did not write output file at ${tempPdfPath}`,
        );
      }

      const pdfBuffer = await fs.promises.readFile(tempPdfPath);
      const t3 = Date.now();

      logger.log(
        `PDF generation timings: Write HTML: ${t1 - t0}ms, Browser execution: ${t2 - t1}ms, Read PDF: ${t3 - t2}ms, Total: ${t3 - t0}ms. Output size: ${pdfBuffer.length} bytes`,
      );
      return pdfBuffer;
    } catch (err) {
      const error = err as any;
      logger.error(`PDF generation failed: ${error.message}`, error.stack);
      throw err;
    } finally {
      if (fs.existsSync(tempHtmlPath)) {
        await fs.promises.unlink(tempHtmlPath).catch(() => {});
      }
      if (fs.existsSync(tempPdfPath)) {
        await fs.promises.unlink(tempPdfPath).catch(() => {});
      }
    }
  }

  public static async generateToFile(
    html: string,
    outputPath: string,
    options: PdfOptions = {},
  ): Promise<void> {
    const browserPath = BrowserResolver.resolve();
    const tempHtmlPath = outputPath.replace(/\.pdf$/i, '.html');

    logger.log(
      `PDF generation started for output file: ${outputPath}. Temp HTML: ${tempHtmlPath}`,
    );

    try {
      await fs.promises.writeFile(tempHtmlPath, html, 'utf8');

      const args = [
        '--headless',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--no-proxy-server',
        '--disable-dev-shm-usage',
        '--disable-software-rasterizer',
        '--disable-extensions',
        '--incognito',
      ];

      if (options.noHeaderFooter) {
        args.push('--no-pdf-header-footer');
      }

      args.push(`--print-to-pdf=${outputPath}`);
      args.push(tempHtmlPath);

      await execFileAsync(browserPath, args, { timeout: 25000 });

      if (!fs.existsSync(outputPath)) {
        throw new Error(
          `Chromium process completed but did not write output file at ${outputPath}`,
        );
      }

      logger.log(`PDF generation succeeded for output file: ${outputPath}`);
    } catch (err) {
      const error = err as any;
      logger.error(
        `PDF generation to file failed: ${error.message}`,
        error.stack,
      );
      throw err;
    } finally {
      if (fs.existsSync(tempHtmlPath)) {
        await fs.promises.unlink(tempHtmlPath).catch(() => {});
      }
    }
  }
}
