declare module 'expo-image-picker' {
  export type ImagePickerAsset = {
    uri: string;
    width?: number;
    height?: number;
    fileName?: string | null;
    mimeType?: string | null;
  };

  export type PermissionResponse = {
    granted: boolean;
  };

  export type ImagePickerResult =
    | {
        canceled: true;
        assets: null;
      }
    | {
        canceled: false;
        assets: ImagePickerAsset[];
      };

  export function requestMediaLibraryPermissionsAsync(): Promise<PermissionResponse>;
  export function launchImageLibraryAsync(options?: {
    allowsEditing?: boolean;
    mediaTypes?: string[];
    quality?: number;
    selectionLimit?: number;
  }): Promise<ImagePickerResult>;
}
