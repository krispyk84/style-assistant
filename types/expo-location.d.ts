declare module 'expo-location' {
  export type PermissionResponse = {
    granted: boolean;
    status: string;
  };

  export type LocationObject = {
    coords: {
      latitude: number;
      longitude: number;
    };
  };

  export type LocationGeocodedAddress = {
    city?: string | null;
    region?: string | null;
    district?: string | null;
  };

  export enum Accuracy {
    Balanced = 3,
  }

  export function requestForegroundPermissionsAsync(): Promise<PermissionResponse>;
  export function getCurrentPositionAsync(options?: { accuracy?: Accuracy }): Promise<LocationObject>;
  export function reverseGeocodeAsync(input: { latitude: number; longitude: number }): Promise<LocationGeocodedAddress[]>;
}
