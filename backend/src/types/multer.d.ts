declare module 'multer' {
  import type { RequestHandler } from 'express';

  type File = {
    path: string;
    originalname: string;
    mimetype: string;
    size: number;
  };

  type Options = {
    dest?: string;
    limits?: {
      fileSize?: number;
    };
    fileFilter?: (
      request: unknown,
      file: { mimetype: string },
      callback: (error: Error | null, acceptFile?: boolean) => void
    ) => void;
  };

  type MulterInstance = {
    single: (fieldName: string) => RequestHandler;
  };

  export default function multer(options?: Options): MulterInstance;
  export type MulterFile = File;
}
