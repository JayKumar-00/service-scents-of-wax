import { Injectable } from '@nestjs/common';
import { Franchise } from '@prisma/client';

/** Haversine distance in kilometres */
function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

@Injectable()
export class GeoRoutingService {
  pickNearestFranchise(
    latitude: number,
    longitude: number,
    franchises: Pick<Franchise, 'id' | 'latitude' | 'longitude' | 'status'>[],
  ): { franchiseId: string; distanceKm: number } | null {
    const active = franchises.filter((f) => f.status === 'ACTIVE');
    if (!active.length) {
      return null;
    }
    let best: { franchiseId: string; distanceKm: number } | null = null;
    for (const f of active) {
      const d = distanceKm(latitude, longitude, f.latitude, f.longitude);
      if (!best || d < best.distanceKm) {
        best = { franchiseId: f.id, distanceKm: d };
      }
    }
    return best;
  }
}
