import * as multer from 'multer';

declare global {
  namespace Express {
    // Augment Express namespace with Multer’s File type
    interface Multer {
      File: multer.File;
    }
  }
}
