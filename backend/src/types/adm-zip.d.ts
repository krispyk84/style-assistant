declare module 'adm-zip' {
  export type ZipEntry = {
    entryName: string;
    isDirectory: boolean;
    getData: () => Buffer;
  };

  export default class AdmZip {
    constructor(path?: string);
    getEntries(): ZipEntry[];
    addFile(entryName: string, data: Buffer): void;
    toBuffer(): Buffer;
  }
}
