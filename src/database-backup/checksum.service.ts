import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';

@Injectable()
export class ChecksumService {
  async calculateFileChecksum(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = fs.createReadStream(filePath);

      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', (err) => reject(err));
    });
  }

  async verifyChecksum(
    filePath: string,
    expectedChecksum: string,
  ): Promise<boolean> {
    try {
      const actualChecksum = await this.calculateFileChecksum(filePath);
      return actualChecksum.toLowerCase() === expectedChecksum.toLowerCase();
    } catch {
      return false;
    }
  }

  calculateStringChecksum(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}
