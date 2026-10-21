import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

const PROVINCE_COLORS: Record<string, string> = {
  '31': '#004d46', // DKI Jakarta (Darkest Teal)
  '32': '#00685f', // Jawa Barat (MayStudio Brand Teal)
  '33': '#0d9488', // Jawa Tengah
  '34': '#99f6e4', // DI Yogyakarta
  '35': '#0d9488', // Jawa Timur
  '36': '#2dd4bf', // Banten
};

function getGeoJsonData(): any {
  // The GeoJSON lives in api/assets so the API is deployable without the web folder.
  const possiblePaths = [
    path.join(process.cwd(), 'assets/javaProvinces.json'), // cwd = api/
    path.join(__dirname, '../../../../../assets/javaProvinces.json'), // running from src/ (tsx)
    path.join(__dirname, '../../../../../../assets/javaProvinces.json'), // running from dist/src/
  ];

  for (const p of possiblePaths) {
    if (fs.existsSync(p)) {
      try {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      } catch {
        // ignore parse error
      }
    }
  }
  return null;
}

function projectMercator(lng: number, lat: number, width = 750, height = 260): [number, number] {
  const centerLng = 110.25;
  const centerLat = -7.2;
  const scale = 4100;
  const rad = Math.PI / 180;

  const x = (lng - centerLng) * rad * scale + width / 2;
  const yCenter = Math.log(Math.tan(Math.PI / 4 + (centerLat * rad) / 2));
  const yLat = Math.log(Math.tan(Math.PI / 4 + (lat * rad) / 2));
  const y = height / 2 - (yLat - yCenter) * scale;

  return [Number(x.toFixed(2)), Number(y.toFixed(2))];
}

function ringToSvgPath(ring: [number, number][]): string {
  if (!ring || ring.length === 0) return '';
  return (
    ring
      .map((coord, i) => {
        const [x, y] = projectMercator(coord[0], coord[1]);
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
      })
      .join(' ') + ' Z'
  );
}

function geometryToSvgPath(geometry: any): string {
  if (!geometry) return '';
  if (geometry.type === 'Polygon') {
    return geometry.coordinates.map(ringToSvgPath).join(' ');
  } else if (geometry.type === 'MultiPolygon') {
    return geometry.coordinates
      .map((polygon: any) => polygon.map(ringToSvgPath).join(' '))
      .join(' ');
  }
  return '';
}

function generateMapSvg(pathsMarkup: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="750" height="260" viewBox="0 0 750 260">
    <rect width="750" height="260" fill="#f8fafc" rx="12" stroke="#e2e8f0" stroke-width="1" />
    <text x="20" y="30" font-family="Segoe UI, Arial, sans-serif" font-size="13" font-weight="bold" fill="#0f172a">Distribusi Regional — Pulau Jawa (6 Provinsi)</text>
    <text x="20" y="48" font-family="Segoe UI, Arial, sans-serif" font-size="10" fill="#64748b">Tingkat Penetrasi &amp; Pendapatan Tertinggi: DKI Jakarta &amp; Jawa Barat</text>
    <g transform="translate(-20, 10)">${pathsMarkup}</g>
  </svg>`;
}

export async function renderJavaMapPng(customBase64?: string): Promise<Buffer> {
  if (customBase64) {
    try {
      const cleanBase64 = customBase64.replace(/^data:image\/\w+;base64,/, '');
      return Buffer.from(cleanBase64, 'base64');
    } catch {
      // Continue to default generator
    }
  }

  try {
    const geo = getGeoJsonData();
    let paths = '';
    if (geo?.features) {
      paths = geo.features
        .map((feature: any) => {
          const d = geometryToSvgPath(feature.geometry);
          const fill = PROVINCE_COLORS[feature.id] || '#00685f';
          return `<path d="${d}" fill="${fill}" stroke="#ffffff" stroke-width="1.5" />`;
        })
        .join('');
    }
    const svg = generateMapSvg(paths);
    return await sharp(Buffer.from(svg)).png().toBuffer();
  } catch (err) {
    console.warn('Map PNG rendering fallback:', err);
    // Fallback minimal 1x1 png buffer in case sharp is unavailable
    return Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
  }
}
