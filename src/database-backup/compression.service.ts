import { Injectable } from '@nestjs/common';
import * as zlib from 'zlib';

@Injectable()
export class CompressionService {
  createGzipStream(): zlib.Gzip {
    return zlib.createGzip();
  }

  createGunzipStream(): zlib.Gunzip {
    return zlib.createGunzip();
  }

  async compressString(data: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      zlib.gzip(data, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
  }

  async decompressBuffer(data: Buffer): Promise<string> {
    return new Promise((resolve, reject) => {
      zlib.gunzip(data, (err, result) => {
        if (err) reject(err);
        else resolve(result.toString('utf-8'));
      });
    });
  }
}
