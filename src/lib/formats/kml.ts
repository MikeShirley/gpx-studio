// KML import/export
// Based on RideLeader's FileKML.pas

import type { GPXDocument, GPXWaypoint, GPXTrack, GPXTrackSegment, GPXRoute } from '../gpx/types';
import { generateId, getNextTrackColor, resetColorIndex } from '../gpx/types';

/**
 * Parse a KML string into a GPXDocument
 */
export function parseKML(kmlString: string): GPXDocument {
  const parser = new DOMParser();
  const doc = parser.parseFromString(kmlString, 'application/xml');

  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`KML Parse Error: ${parseError.textContent}`);
  }

  resetColorIndex();

  const waypoints: GPXWaypoint[] = [];
  const routes: GPXRoute[] = [];
  const tracks: GPXTrack[] = [];

  // Parse Placemarks
  const placemarks = doc.querySelectorAll('Placemark');
  placemarks.forEach((placemark) => {
    const name = placemark.querySelector('name')?.textContent || undefined;
    const desc = placemark.querySelector('description')?.textContent || undefined;

    // Check for Point (waypoint)
    const point = placemark.querySelector('Point');
    if (point) {
      const coords = parseCoordinates(point.querySelector('coordinates')?.textContent || '');
      if (coords.length > 0) {
        waypoints.push({
          id: generateId(),
          lat: coords[0].lat,
          lon: coords[0].lon,
          ele: coords[0].ele,
          name,
          desc,
          enabled: true,
        });
      }
    }

    // Check for LineString (route or track)
    const lineString = placemark.querySelector('LineString');
    if (lineString) {
      const coords = parseCoordinates(lineString.querySelector('coordinates')?.textContent || '');
      if (coords.length > 0) {
        const points = coords.map((c) => ({
          id: generateId(),
          lat: c.lat,
          lon: c.lon,
          ele: c.ele,
          enabled: true,
        }));

        // Treat as route
        routes.push({
          id: generateId(),
          name,
          desc,
          points,
          color: getNextTrackColor(),
          enabled: true,
        });
      }
    }

    // Check for gx:Track (track with timestamps)
    const gxTrack = placemark.querySelector('Track, gx\\:Track');
    if (gxTrack) {
      const track = parseGxTrack(gxTrack, name, desc);
      if (track) tracks.push(track);
    }

    // Check for MultiGeometry
    const multiGeometry = placemark.querySelector('MultiGeometry');
    if (multiGeometry) {
      const lineStrings = multiGeometry.querySelectorAll('LineString');
      if (lineStrings.length > 0) {
        const segments: GPXTrackSegment[] = [];
        lineStrings.forEach((ls) => {
          const coords = parseCoordinates(ls.querySelector('coordinates')?.textContent || '');
          if (coords.length > 0) {
            segments.push({
              id: generateId(),
              points: coords.map((c) => ({
                id: generateId(),
                lat: c.lat,
                lon: c.lon,
                ele: c.ele,
                enabled: true,
              })),
              enabled: true,
            });
          }
        });

        if (segments.length > 0) {
          tracks.push({
            id: generateId(),
            name,
            desc,
            segments,
            color: getNextTrackColor(),
            enabled: true,
            expanded: true,
          });
        }
      }
    }
  });

  return {
    waypoints,
    routes,
    tracks,
    modified: false,
  };
}

function parseCoordinates(coordString: string): { lat: number; lon: number; ele?: number }[] {
  const coords: { lat: number; lon: number; ele?: number }[] = [];
  const lines = coordString.trim().split(/\s+/);

  for (const line of lines) {
    const parts = line.split(',');
    if (parts.length >= 2) {
      const lon = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      const ele = parts.length >= 3 ? parseFloat(parts[2]) : undefined;

      if (!isNaN(lat) && !isNaN(lon)) {
        coords.push({ lat, lon, ele: ele && !isNaN(ele) ? ele : undefined });
      }
    }
  }

  return coords;
}

function parseGxTrack(trackEl: Element, name?: string, desc?: string): GPXTrack | null {
  const coords: Element[] = Array.from(trackEl.querySelectorAll('coord, gx\\:coord'));
  const whens: Element[] = Array.from(trackEl.querySelectorAll('when'));

  if (coords.length === 0) return null;

  const points: GPXWaypoint[] = [];
  for (let i = 0; i < coords.length; i++) {
    const coordText = coords[i].textContent || '';
    const parts = coordText.trim().split(/\s+/);

    if (parts.length >= 2) {
      const lon = parseFloat(parts[0]);
      const lat = parseFloat(parts[1]);
      const ele = parts.length >= 3 ? parseFloat(parts[2]) : undefined;
      const time = whens[i]?.textContent || undefined;

      if (!isNaN(lat) && !isNaN(lon)) {
        points.push({
          id: generateId(),
          lat,
          lon,
          ele: ele && !isNaN(ele) ? ele : undefined,
          time,
          enabled: true,
        });
      }
    }
  }

  if (points.length === 0) return null;

  return {
    id: generateId(),
    name,
    desc,
    segments: [{ id: generateId(), points, enabled: true }],
    color: getNextTrackColor(),
    enabled: true,
    expanded: true,
  };
}

/**
 * Export a GPXDocument to KML string
 */
export function exportKML(doc: GPXDocument): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">');
  lines.push('<Document>');

  if (doc.metadata?.name) {
    lines.push(`  <name>${escapeXml(doc.metadata.name)}</name>`);
  }
  if (doc.metadata?.desc) {
    lines.push(`  <description>${escapeXml(doc.metadata.desc)}</description>`);
  }

  // Waypoints
  for (const wpt of doc.waypoints) {
    if (!wpt.enabled) continue;
    lines.push('  <Placemark>');
    if (wpt.name) lines.push(`    <name>${escapeXml(wpt.name)}</name>`);
    if (wpt.desc) lines.push(`    <description>${escapeXml(wpt.desc)}</description>`);
    lines.push('    <Point>');
    lines.push(`      <coordinates>${wpt.lon},${wpt.lat}${wpt.ele !== undefined ? ',' + wpt.ele : ''}</coordinates>`);
    lines.push('    </Point>');
    lines.push('  </Placemark>');
  }

  // Routes
  for (const rte of doc.routes) {
    if (!rte.enabled) continue;
    lines.push('  <Placemark>');
    if (rte.name) lines.push(`    <name>${escapeXml(rte.name)}</name>`);
    if (rte.desc) lines.push(`    <description>${escapeXml(rte.desc)}</description>`);
    lines.push('    <Style>');
    lines.push(`      <LineStyle><color>${colorToKml(rte.color)}</color><width>3</width></LineStyle>`);
    lines.push('    </Style>');
    lines.push('    <LineString>');
    lines.push('      <tessellate>1</tessellate>');
    lines.push('      <coordinates>');
    for (const pt of rte.points) {
      if (pt.enabled) {
        lines.push(`        ${pt.lon},${pt.lat}${pt.ele !== undefined ? ',' + pt.ele : ''}`);
      }
    }
    lines.push('      </coordinates>');
    lines.push('    </LineString>');
    lines.push('  </Placemark>');
  }

  // Tracks
  for (const trk of doc.tracks) {
    if (!trk.enabled) continue;
    lines.push('  <Placemark>');
    if (trk.name) lines.push(`    <name>${escapeXml(trk.name)}</name>`);
    if (trk.desc) lines.push(`    <description>${escapeXml(trk.desc)}</description>`);
    lines.push('    <Style>');
    lines.push(`      <LineStyle><color>${colorToKml(trk.color)}</color><width>3</width></LineStyle>`);
    lines.push('    </Style>');

    const allPoints = trk.segments.filter(s => s.enabled).flatMap(s => s.points.filter(p => p.enabled));
    const hasTime = allPoints.some(p => p.time);

    if (hasTime) {
      // Use gx:Track for timestamped data
      lines.push('    <gx:Track>');
      for (const pt of allPoints) {
        lines.push(`      <when>${pt.time || ''}</when>`);
      }
      for (const pt of allPoints) {
        lines.push(`      <gx:coord>${pt.lon} ${pt.lat}${pt.ele !== undefined ? ' ' + pt.ele : ''}</gx:coord>`);
      }
      lines.push('    </gx:Track>');
    } else {
      // Use LineString for non-timestamped data
      lines.push('    <LineString>');
      lines.push('      <tessellate>1</tessellate>');
      lines.push('      <coordinates>');
      for (const pt of allPoints) {
        lines.push(`        ${pt.lon},${pt.lat}${pt.ele !== undefined ? ',' + pt.ele : ''}`);
      }
      lines.push('      </coordinates>');
      lines.push('    </LineString>');
    }

    lines.push('  </Placemark>');
  }

  lines.push('</Document>');
  lines.push('</kml>');

  return lines.join('\n');
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function colorToKml(hexColor: string): string {
  // KML uses AABBGGRR format
  const hex = hexColor.replace('#', '');
  const r = hex.substring(0, 2);
  const g = hex.substring(2, 4);
  const b = hex.substring(4, 6);
  return `ff${b}${g}${r}`;
}
