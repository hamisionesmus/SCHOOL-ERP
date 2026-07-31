'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from './skeleton';

// Leaflet touches `window` at import time, so it can never run through Next.js's server render pass —
// loaded client-only, same pattern as any other browser-only widget in an App Router page.
const MapPickerInner = dynamic(() => import('./map-picker-inner'), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px] w-full rounded-md" />,
});

interface MapPickerProps {
  latitude: number | null;
  longitude: number | null;
  onChange: (lat: number, lng: number) => void;
}

export function MapPicker(props: MapPickerProps) {
  return (
    <div className="flex flex-col gap-1">
      <MapPickerInner {...props} />
      <p className="text-xs text-slate-400">
        Click the map to drop a pin at the student&apos;s home — helps the transport driver find the
        drop-off point.
      </p>
    </div>
  );
}
