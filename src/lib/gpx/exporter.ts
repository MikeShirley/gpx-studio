// GPX file exporter
// Ported from RideLeader's FileGPX.pas

import type { GPXDocument, GPXWaypoint, GPXTrack, GPXRoute, GPXMetadata, GPXLink } from './types';

/**
 * Export a GPXDocument to GPX XML string
 */
export function exportGPX(doc: GPXDocument): string {
  const lines: string[] = [];

  lines.push('<?xml version="1.0" encoding="UTF-8"?>');
  lines.push('<gpx version="1.1" creator="GPX Studio"');
  lines.push('  xmlns="http://www.topografix.com/GPX/1/1"');
  lines.push('  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"');
  lines.push('  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">');

  // Metadata
  if (doc.metadata) {
    lines.push('  <metadata>');
    lines.push(...exportMetadata(doc.metadata, '    '));
    lines.push('  </metadata>');
  }

  // Waypoints
  for (const wpt of doc.waypoints) {
    if (wpt.enabled) {
      lines.push(...exportWaypoint(wpt, 'wpt', '  '));
    }
  }

  // Routes
  for (const rte of doc.routes) {
    if (rte.enabled) {
      lines.push(...exportRoute(rte, '  '));
    }
  }

  // Tracks
  for (const trk of doc.tracks) {
    if (trk.enabled) {
      lines.push(...exportTrack(trk, '  '));
    }
  }

  lines.push('</gpx>');

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

function exportMetadata(metadata: GPXMetadata, indent: string): string[] {
  const lines: string[] = [];

  if (metadata.name) {
    lines.push(`${indent}<name>${escapeXml(metadata.name)}</name>`);
  }
  if (metadata.desc) {
    lines.push(`${indent}<desc>${escapeXml(metadata.desc)}</desc>`);
  }
  if (metadata.author) {
    lines.push(`${indent}<author>`);
    if (metadata.author.name) {
      lines.push(`${indent}  <name>${escapeXml(metadata.author.name)}</name>`);
    }
    if (metadata.author.email) {
      lines.push(`${indent}  <email id="${escapeXml(metadata.author.email.id)}" domain="${escapeXml(metadata.author.email.domain)}"/>`);
    }
    if (metadata.author.link) {
      lines.push(...exportLink(metadata.author.link, `${indent}  `));
    }
    lines.push(`${indent}</author>`);
  }
  if (metadata.copyright) {
    lines.push(`${indent}<copyright author="${escapeXml(metadata.copyright.author)}">`);
    if (metadata.copyright.year) {
      lines.push(`${indent}  <year>${metadata.copyright.year}</year>`);
    }
    if (metadata.copyright.license) {
      lines.push(`${indent}  <license>${escapeXml(metadata.copyright.license)}</license>`);
    }
    lines.push(`${indent}</copyright>`);
  }
  if (metadata.link) {
    lines.push(...exportLink(metadata.link, indent));
  }
  if (metadata.time) {
    lines.push(`${indent}<time>${metadata.time}</time>`);
  }
  if (metadata.keywords) {
    lines.push(`${indent}<keywords>${escapeXml(metadata.keywords)}</keywords>`);
  }
  if (metadata.bounds) {
    lines.push(`${indent}<bounds minlat="${metadata.bounds.minlat}" minlon="${metadata.bounds.minlon}" maxlat="${metadata.bounds.maxlat}" maxlon="${metadata.bounds.maxlon}"/>`);
  }

  return lines;
}

function exportLink(link: GPXLink, indent: string): string[] {
  const lines: string[] = [];
  lines.push(`${indent}<link href="${escapeXml(link.href)}">`);
  if (link.text) {
    lines.push(`${indent}  <text>${escapeXml(link.text)}</text>`);
  }
  if (link.type) {
    lines.push(`${indent}  <type>${escapeXml(link.type)}</type>`);
  }
  lines.push(`${indent}</link>`);
  return lines;
}

function exportWaypoint(wpt: GPXWaypoint, tagName: string, indent: string): string[] {
  const lines: string[] = [];
  lines.push(`${indent}<${tagName} lat="${wpt.lat}" lon="${wpt.lon}">`);

  if (wpt.ele !== undefined) {
    lines.push(`${indent}  <ele>${wpt.ele}</ele>`);
  }
  if (wpt.time) {
    lines.push(`${indent}  <time>${wpt.time}</time>`);
  }
  if (wpt.magvar !== undefined) {
    lines.push(`${indent}  <magvar>${wpt.magvar}</magvar>`);
  }
  if (wpt.geoidheight !== undefined) {
    lines.push(`${indent}  <geoidheight>${wpt.geoidheight}</geoidheight>`);
  }
  if (wpt.name) {
    lines.push(`${indent}  <name>${escapeXml(wpt.name)}</name>`);
  }
  if (wpt.cmt) {
    lines.push(`${indent}  <cmt>${escapeXml(wpt.cmt)}</cmt>`);
  }
  if (wpt.desc) {
    lines.push(`${indent}  <desc>${escapeXml(wpt.desc)}</desc>`);
  }
  if (wpt.src) {
    lines.push(`${indent}  <src>${escapeXml(wpt.src)}</src>`);
  }
  if (wpt.link) {
    lines.push(...exportLink(wpt.link, `${indent}  `));
  }
  if (wpt.sym) {
    lines.push(`${indent}  <sym>${escapeXml(wpt.sym)}</sym>`);
  }
  if (wpt.type) {
    lines.push(`${indent}  <type>${escapeXml(wpt.type)}</type>`);
  }
  if (wpt.fix) {
    lines.push(`${indent}  <fix>${wpt.fix}</fix>`);
  }
  if (wpt.sat !== undefined) {
    lines.push(`${indent}  <sat>${wpt.sat}</sat>`);
  }
  if (wpt.hdop !== undefined) {
    lines.push(`${indent}  <hdop>${wpt.hdop}</hdop>`);
  }
  if (wpt.vdop !== undefined) {
    lines.push(`${indent}  <vdop>${wpt.vdop}</vdop>`);
  }
  if (wpt.pdop !== undefined) {
    lines.push(`${indent}  <pdop>${wpt.pdop}</pdop>`);
  }
  if (wpt.ageofdgpsdata !== undefined) {
    lines.push(`${indent}  <ageofdgpsdata>${wpt.ageofdgpsdata}</ageofdgpsdata>`);
  }
  if (wpt.dgpsid !== undefined) {
    lines.push(`${indent}  <dgpsid>${wpt.dgpsid}</dgpsid>`);
  }

  lines.push(`${indent}</${tagName}>`);
  return lines;
}

function exportRoute(rte: GPXRoute, indent: string): string[] {
  const lines: string[] = [];
  lines.push(`${indent}<rte>`);

  if (rte.name) {
    lines.push(`${indent}  <name>${escapeXml(rte.name)}</name>`);
  }
  if (rte.cmt) {
    lines.push(`${indent}  <cmt>${escapeXml(rte.cmt)}</cmt>`);
  }
  if (rte.desc) {
    lines.push(`${indent}  <desc>${escapeXml(rte.desc)}</desc>`);
  }
  if (rte.src) {
    lines.push(`${indent}  <src>${escapeXml(rte.src)}</src>`);
  }
  if (rte.link) {
    lines.push(...exportLink(rte.link, `${indent}  `));
  }
  if (rte.number !== undefined) {
    lines.push(`${indent}  <number>${rte.number}</number>`);
  }
  if (rte.type) {
    lines.push(`${indent}  <type>${escapeXml(rte.type)}</type>`);
  }

  for (const pt of rte.points) {
    if (pt.enabled) {
      lines.push(...exportWaypoint(pt, 'rtept', `${indent}  `));
    }
  }

  lines.push(`${indent}</rte>`);
  return lines;
}

function exportTrack(trk: GPXTrack, indent: string): string[] {
  const lines: string[] = [];
  lines.push(`${indent}<trk>`);

  if (trk.name) {
    lines.push(`${indent}  <name>${escapeXml(trk.name)}</name>`);
  }
  if (trk.cmt) {
    lines.push(`${indent}  <cmt>${escapeXml(trk.cmt)}</cmt>`);
  }
  if (trk.desc) {
    lines.push(`${indent}  <desc>${escapeXml(trk.desc)}</desc>`);
  }
  if (trk.src) {
    lines.push(`${indent}  <src>${escapeXml(trk.src)}</src>`);
  }
  if (trk.link) {
    lines.push(...exportLink(trk.link, `${indent}  `));
  }
  if (trk.number !== undefined) {
    lines.push(`${indent}  <number>${trk.number}</number>`);
  }
  if (trk.type) {
    lines.push(`${indent}  <type>${escapeXml(trk.type)}</type>`);
  }

  for (const seg of trk.segments) {
    if (seg.enabled && seg.points.length > 0) {
      lines.push(`${indent}  <trkseg>`);
      for (const pt of seg.points) {
        if (pt.enabled) {
          lines.push(...exportWaypoint(pt, 'trkpt', `${indent}    `));
        }
      }
      lines.push(`${indent}  </trkseg>`);
    }
  }

  lines.push(`${indent}</trk>`);
  return lines;
}
