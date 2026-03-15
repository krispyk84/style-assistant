declare namespace Express {
  export interface MulterFile {
    path: string;
    originalname: string;
    mimetype: string;
    size: number;
  }

  export interface Request {
    file?: MulterFile;
  }
}
