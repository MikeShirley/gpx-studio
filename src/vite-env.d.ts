/// <reference types="vite/client" />

// Image imports
declare module '*.png' {
  const value: string;
  export default value;
}

declare module '*.jpg' {
  const value: string;
  export default value;
}

declare module '*.svg' {
  const value: string;
  export default value;
}

declare module 'leaflet/dist/images/marker-icon.png' {
  const value: string;
  export default value;
}

declare module 'leaflet/dist/images/marker-icon-2x.png' {
  const value: string;
  export default value;
}

declare module 'leaflet/dist/images/marker-shadow.png' {
  const value: string;
  export default value;
}
