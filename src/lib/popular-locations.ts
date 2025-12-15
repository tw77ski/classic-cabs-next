// Popular locations in Jersey with coordinates
export interface POILocation {
  label: string;
  lat: number;
  lng: number;
}

export const POPULAR_LOCATIONS: POILocation[] = [
  {
    label: "Jersey Airport",
    lat: 49.2051608,
    lng: -2.1946951,
  },
  {
    label: "Radisson Blu Waterfront Jersey",
    lat: 49.18406747471422,
    lng: -2.1169421152642984,
  },
  {
    label: "Merton Hotel",
    lat: 49.18005145026025,
    lng: -2.0939220017711953,
  },
];
