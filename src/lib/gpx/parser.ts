// GPX file parser
// Ported from RideLeader's FileGPX.pas

import type {
  GPXDocument,
  GPXWaypoint,
  GPXTrack,
  GPXTrackSegment,
  GPXRoute,
  GPXMetadata,
  GPXLink
} from './types';
import { generateId, getNextTrackColor, resetColorIndex } from './types';

/**
 * Parse a GPX XML string into a GPXDocument
 */
export function parseGPX(xmlString: string): GPXDocument {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlString, 'application/xml');

  // Check for parse errors
  const parseError = doc.querySelector('parsererror');
  if (parseError) {
    throw new Error(`XML Parse Error: ${parseError.textContent}`);
  }

  const gpx = doc.querySelector('gpx');
  if (!gpx) {
    throw new Error('Invalid GPX file: no <gpx> element found');
  }

  resetColorIndex();

  return {
    metadata: parseMetadata(gpx.querySelector('metadata')),
    waypoints: parseWaypoints(gpx),
    routes: parseRoutes(gpx),
    tracks: parseTracks(gpx),
    modified: false,
  };
}

function parseMetadata(metadataEl: Element | null): GPXMetadata | undefined {
  if (!metadataEl) return undefined;

  const metadata: GPXMetadata = {};

  const name = metadataEl.querySelector('name');
  if (name?.textContent) metadata.name = name.textContent;

  const desc = metadataEl.querySelector('desc');
  if (desc?.textContent) metadata.desc = desc.textContent;

  const time = metadataEl.querySelector('time');
  if (time?.textContent) metadata.time = time.textContent;

  const keywords = metadataEl.querySelector('keywords');
  if (keywords?.textContent) metadata.keywords = keywords.textContent;

  const authorEl = metadataEl.querySelector('author');
  if (authorEl) {
    metadata.author = {};
    const authorName = authorEl.querySelector('name');
    if (authorName?.textContent) metadata.author.name = authorName.textContent;

    const email = authorEl.querySelector('email');
    if (email) {
      const id = email.getAttribute('id');
      const domain = email.getAttribute('domain');
      if (id && domain) {
        metadata.author.email = { id, domain };
      }
    }

    metadata.author.link = parseLink(authorEl.querySelector('link'));
  }

  const copyrightEl = metadataEl.querySelector('copyright');
  if (copyrightEl) {
    const author = copyrightEl.getAttribute('author');
    if (author) {
      metadata.copyright = { author };
      const year = copyrightEl.querySelector('year');
      if (year?.textContent) metadata.copyright.year = parseInt(year.textContent, 10);
      const license = copyrightEl.querySelector('license');
      if (license?.textContent) metadata.copyright.license = license.textContent;
    }
  }

  metadata.link = parseLink(metadataEl.querySelector('link'));

  const bounds = metadataEl.querySelector('bounds');
  if (bounds) {
    metadata.bounds = {
      minlat: parseFloat(bounds.getAttribute('minlat') || '0'),
      minlon: parseFloat(bounds.getAttribute('minlon') || '0'),
      maxlat: parseFloat(bounds.getAttribute('maxlat') || '0'),
      maxlon: parseFloat(bounds.getAttribute('maxlon') || '0'),
    };
  }

  return metadata;
}

function parseLink(linkEl: Element | null): GPXLink | undefined {
  if (!linkEl) return undefined;

  const href = linkEl.getAttribute('href');
  if (!href) return undefined;

  const link: GPXLink = { href };

  const text = linkEl.querySelector('text');
  if (text?.textContent) link.text = text.textContent;

  const type = linkEl.querySelector('type');
  if (type?.textContent) link.type = type.textContent;

  return link;
}

function parseWaypoints(gpx: Element): GPXWaypoint[] {
  const waypoints: GPXWaypoint[] = [];
  const wptElements = gpx.querySelectorAll(':scope > wpt');

  wptElements.forEach((wpt) => {
    const waypoint = parseWaypoint(wpt);
    if (waypoint) waypoints.push(waypoint);
  });

  return waypoints;
}

function parseWaypoint(wpt: Element): GPXWaypoint | null {
  const lat = parseFloat(wpt.getAttribute('lat') || '');
  const lon = parseFloat(wpt.getAttribute('lon') || '');

  if (isNaN(lat) || isNaN(lon)) return null;

  const waypoint: GPXWaypoint = {
    id: generateId(),
    lat,
    lon,
    enabled: true,
  };

  const ele = wpt.querySelector('ele');
  if (ele?.textContent) waypoint.ele = parseFloat(ele.textContent);

  const time = wpt.querySelector('time');
  if (time?.textContent) waypoint.time = time.textContent;

  const name = wpt.querySelector('name');
  if (name?.textContent) waypoint.name = name.textContent;

  const desc = wpt.querySelector('desc');
  if (desc?.textContent) waypoint.desc = desc.textContent;

  const cmt = wpt.querySelector('cmt');
  if (cmt?.textContent) waypoint.cmt = cmt.textContent;

  const src = wpt.querySelector('src');
  if (src?.textContent) waypoint.src = src.textContent;

  const sym = wpt.querySelector('sym');
  if (sym?.textContent) waypoint.sym = sym.textContent;

  const type = wpt.querySelector('type');
  if (type?.textContent) waypoint.type = type.textContent;

  waypoint.link = parseLink(wpt.querySelector('link'));

  const sat = wpt.querySelector('sat');
  if (sat?.textContent) waypoint.sat = parseInt(sat.textContent, 10);

  const hdop = wpt.querySelector('hdop');
  if (hdop?.textContent) waypoint.hdop = parseFloat(hdop.textContent);

  const vdop = wpt.querySelector('vdop');
  if (vdop?.textContent) waypoint.vdop = parseFloat(vdop.textContent);

  const pdop = wpt.querySelector('pdop');
  if (pdop?.textContent) waypoint.pdop = parseFloat(pdop.textContent);

  const fix = wpt.querySelector('fix');
  if (fix?.textContent) {
    const fixValue = fix.textContent as GPXWaypoint['fix'];
    if (['none', '2d', '3d', 'dgps', 'pps'].includes(fixValue || '')) {
      waypoint.fix = fixValue;
    }
  }

  const magvar = wpt.querySelector('magvar');
  if (magvar?.textContent) waypoint.magvar = parseFloat(magvar.textContent);

  const geoidheight = wpt.querySelector('geoidheight');
  if (geoidheight?.textContent) waypoint.geoidheight = parseFloat(geoidheight.textContent);

  return waypoint;
}

function parseRoutes(gpx: Element): GPXRoute[] {
  const routes: GPXRoute[] = [];
  const rteElements = gpx.querySelectorAll(':scope > rte');

  rteElements.forEach((rte) => {
    const route: GPXRoute = {
      id: generateId(),
      points: [],
      color: getNextTrackColor(),
      enabled: true,
    };

    const name = rte.querySelector('name');
    if (name?.textContent) route.name = name.textContent;

    const desc = rte.querySelector('desc');
    if (desc?.textContent) route.desc = desc.textContent;

    const cmt = rte.querySelector('cmt');
    if (cmt?.textContent) route.cmt = cmt.textContent;

    const src = rte.querySelector('src');
    if (src?.textContent) route.src = src.textContent;

    const type = rte.querySelector('type');
    if (type?.textContent) route.type = type.textContent;

    const number = rte.querySelector('number');
    if (number?.textContent) route.number = parseInt(number.textContent, 10);

    route.link = parseLink(rte.querySelector('link'));

    // Parse route points
    const rteptElements = rte.querySelectorAll('rtept');
    rteptElements.forEach((rtept) => {
      const point = parseWaypoint(rtept);
      if (point) route.points.push(point);
    });

    routes.push(route);
  });

  return routes;
}

function parseTracks(gpx: Element): GPXTrack[] {
  const tracks: GPXTrack[] = [];
  const trkElements = gpx.querySelectorAll(':scope > trk');

  trkElements.forEach((trk) => {
    const track: GPXTrack = {
      id: generateId(),
      segments: [],
      color: getNextTrackColor(),
      enabled: true,
      expanded: true,
    };

    const name = trk.querySelector('name');
    if (name?.textContent) track.name = name.textContent;

    const desc = trk.querySelector('desc');
    if (desc?.textContent) track.desc = desc.textContent;

    const cmt = trk.querySelector('cmt');
    if (cmt?.textContent) track.cmt = cmt.textContent;

    const src = trk.querySelector('src');
    if (src?.textContent) track.src = src.textContent;

    const type = trk.querySelector('type');
    if (type?.textContent) track.type = type.textContent;

    const number = trk.querySelector('number');
    if (number?.textContent) track.number = parseInt(number.textContent, 10);

    track.link = parseLink(trk.querySelector('link'));

    // Parse track segments
    const trksegElements = trk.querySelectorAll('trkseg');
    trksegElements.forEach((trkseg) => {
      const segment: GPXTrackSegment = {
        id: generateId(),
        points: [],
        enabled: true,
      };

      const trkptElements = trkseg.querySelectorAll('trkpt');
      trkptElements.forEach((trkpt) => {
        const point = parseWaypoint(trkpt);
        if (point) segment.points.push(point);
      });

      if (segment.points.length > 0) {
        track.segments.push(segment);
      }
    });

    if (track.segments.length > 0) {
      tracks.push(track);
    }
  });

  return tracks;
}
