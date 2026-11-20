import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { BadRequestException } from '@nestjs/common';
import multer from 'multer';

// Allowed MIME types for image uploads
export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',

  // PDF
  'application/pdf',

  // Videos
  'video/mp4',
  'video/mpeg',
  'video/quicktime', // .mov
  'video/x-msvideo', // .avi
  'video/x-matroska', // .mkv
  'video/webm',
];

// File size limit (5MB)
export const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Custom file filter for multer
 * Validates file MIME type and size
 */
export const fileFilter = (
  req: any,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  // Check MIME type
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    return callback(
      new BadRequestException(
        'Only image files (JPEG, PNG, GIF, WebP) and PDF files are allowed',
      ),
      false,
    );
  }

  callback(null, true);
};

/**
 * Multer options for file upload
 * Stores files in memory for immediate processing
 */
export const multerOptions: MulterOptions = {
  storage: multer.memoryStorage(), // Some Change at (21-2026)
  fileFilter: fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
};

/**
 * Validates file before upload
 * @param file - The uploaded file
 * @throws BadRequestException if validation fails
 */
export const validateUploadFile = (file: Express.Multer.File): void => {
  if (!file) {
    throw new BadRequestException('No file provided');
  }

  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new BadRequestException(
      'Only image files (JPEG, PNG, GIF, WebP) and PDF files are allowed',
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new BadRequestException('File size must not exceed 5MB');
  }
};
