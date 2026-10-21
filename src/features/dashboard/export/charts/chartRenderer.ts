import sharp from 'sharp';

interface AreaChartOptions {
  title: string;
  categories: string[];
  values: number[];
  currency?: string;
  width?: number;
  height?: number;
}

interface PieChartOptions {
  title: string;
  categories: string[];
  values: number[];
  currency?: string;
  width?: number;
  height?: number;
}

function polarToCartesian(centerX: number, centerY: number, radius: number, angleInDegrees: number) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

function describeArc(x: number, y: number, radius: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(x, y, radius, endAngle);
  const end = polarToCartesian(x, y, radius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
  return [
    'M', x, y,
    'L', start.x, start.y,
    'A', radius, radius, 0, largeArcFlag, 0, end.x, end.y,
    'Z',
  ].join(' ');
}

function formatCurrencyShort(val: number, currency: string = 'IDR'): string {
  if (currency === 'IDR') {
    if (val >= 1000000000) return `Rp ${(val / 1000000000).toFixed(1)} M`;
    if (val >= 1000000) return `Rp ${(val / 1000000).toFixed(1)} Jt`;
    if (val >= 1000) return `Rp ${(val / 1000).toFixed(0)} Rb`;
    return `Rp ${val}`;
  }
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
  return `$${val}`;
}

export async function renderAreaChartPng(options: AreaChartOptions): Promise<Buffer> {
  const width = options.width || 640;
  const height = options.height || 360;
  const { title, categories, values, currency = 'IDR' } = options;

  const padLeft = 90;
  const padRight = 40;
  const padTop = 75;
  const padBottom = 55;
  const plotWidth = width - padLeft - padRight;
  const plotHeight = height - padTop - padBottom;

  const maxVal = Math.max(...values, 1000);
  const minVal = 0;
  const valRange = maxVal - minVal;

  const numTicks = 5;
  const gridLines: string[] = [];
  const yLabels: string[] = [];

  for (let i = 0; i <= numTicks; i++) {
    const yVal = minVal + (valRange * i) / numTicks;
    const yPos = padTop + plotHeight - (plotHeight * i) / numTicks;
    gridLines.push(`<line x1="${padLeft}" y1="${yPos}" x2="${width - padRight}" y2="${yPos}" stroke="#E2E8F0" stroke-width="1" stroke-dasharray="4,4"/>`);
    yLabels.push(`<text x="${padLeft - 12}" y="${yPos + 4}" font-family="Segoe UI, sans-serif" font-size="11" fill="#64748B" text-anchor="end">${formatCurrencyShort(yVal, currency)}</text>`);
  }

  if (values.length === 0) {
    const emptySvg = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#F8FAFC"/>
      <text x="${width / 2}" y="${height / 2}" font-family="Segoe UI, sans-serif" font-size="12" fill="#94A3B8" text-anchor="middle">Tidak ada data visualisasi</text>
    </svg>`;
    return Buffer.from(emptySvg);
  }

  const pointCount = Math.max(values.length, 2);
  const points: Array<{ x: number; y: number; val: number; cat: string }> = [];

  for (let i = 0; i < values.length; i++) {
    const xPos = padLeft + (plotWidth * i) / (pointCount - 1);
    const yPos = padTop + plotHeight - (plotHeight * (values[i] - minVal)) / valRange;
    points.push({ x: xPos, y: yPos, val: values[i], cat: categories[i] || `P${i + 1}` });
  }

  // Generate Area Path
  let pathD = `M ${points[0]?.x || padLeft} ${points[0]?.y || (padTop + plotHeight)}`;
  for (let i = 1; i < points.length; i++) {
    pathD += ` L ${points[i].x} ${points[i].y}`;
  }
  const strokePath = pathD;
  const lastPt = points[points.length - 1];
  const firstPt = points[0];
  const areaPath = `${pathD} L ${lastPt?.x || padLeft} ${padTop + plotHeight} L ${firstPt?.x || padLeft} ${padTop + plotHeight} Z`;

  // Data dots & X labels
  const dots: string[] = [];
  const xLabels: string[] = [];
  const step = Math.ceil(points.length / 6);

  points.forEach((pt, idx) => {
    dots.push(`<circle cx="${pt.x}" cy="${pt.y}" r="4" fill="#00685F" stroke="#FFFFFF" stroke-width="2"/>`);
    if (idx % step === 0 || idx === points.length - 1) {
      const shortCat = pt.cat.length > 12 ? pt.cat.slice(0, 10) + '...' : pt.cat;
      xLabels.push(`<text x="${pt.x}" y="${padTop + plotHeight + 22}" font-family="Segoe UI, sans-serif" font-size="11" fill="#64748B" text-anchor="middle">${shortCat}</text>`);
    }
  });

  const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#00685F" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#00685F" stop-opacity="0.02"/>
    </linearGradient>
  </defs>
  <!-- Background Card -->
  <rect width="${width}" height="${height}" fill="#FFFFFF" rx="8" stroke="#E2E8F0" stroke-width="1"/>
  
  <!-- Header -->
  <text x="24" y="34" font-family="Segoe UI, sans-serif" font-size="15" font-weight="bold" fill="#0F172A">${escapeXml(title)}</text>
  <text x="24" y="52" font-family="Segoe UI, sans-serif" font-size="11" fill="#64748B">Grafik Native MayStudio • Nilai agregasi berdasarkan sumbu waktu</text>

  <!-- Grid lines -->
  ${gridLines.join('\n')}
  
  <!-- Area & Line -->
  <path d="${areaPath}" fill="url(#areaGradient)"/>
  <path d="${strokePath}" fill="none" stroke="#00685F" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
  
  <!-- Dots -->
  ${dots.join('\n')}
  
  <!-- Labels -->
  ${yLabels.join('\n')}
  ${xLabels.join('\n')}
</svg>`;

  return await sharp(Buffer.from(svg)).png().toBuffer();
}

export async function renderPieChartPng(options: PieChartOptions): Promise<Buffer> {
  const width = options.width || 640;
  const height = options.height || 360;
  const { title, categories, values, currency = 'IDR' } = options;

  const total = values.reduce((a, b) => a + b, 0) || 1;
  const colors = ['#00685F', '#1E293B', '#F59E0B', '#F43F5E', '#0284C7', '#10B981', '#8B5CF6', '#64748B'];

  const centerX = 175;
  const centerY = 195;
  const radius = 105;

  let currentAngle = 0;
  const slicePaths: string[] = [];
  const legendItems: string[] = [];

  const topItems = categories.slice(0, 6).map((cat, i) => ({
    cat,
    val: values[i] || 0,
    pct: ((values[i] || 0) / total) * 100,
    color: colors[i % colors.length],
  }));

  // If more than 6, group into 'Lainnya'
  if (categories.length > 6) {
    const otherVal = values.slice(6).reduce((a, b) => a + b, 0);
    topItems.push({
      cat: 'Lainnya',
      val: otherVal,
      pct: (otherVal / total) * 100,
      color: '#94A3B8',
    });
  }

  topItems.forEach((item, idx) => {
    const angle = (item.val / total) * 360;
    if (angle > 0.5) {
      const path = describeArc(centerX, centerY, radius, currentAngle, currentAngle + angle);
      slicePaths.push(`<path d="${path}" fill="${item.color}" stroke="#FFFFFF" stroke-width="2"/>`);
      currentAngle += angle;
    }

    const legendY = 95 + idx * 36;
    legendItems.push(`
      <g transform="translate(360, ${legendY})">
        <rect width="14" height="14" rx="3" fill="${item.color}"/>
        <text x="22" y="12" font-family="Segoe UI, sans-serif" font-size="12" font-weight="600" fill="#0F172A">${escapeXml(item.cat)}</text>
        <text x="250" y="12" font-family="Segoe UI, sans-serif" font-size="12" fill="#64748B" text-anchor="end">${item.pct.toFixed(1)}% (${formatCurrencyShort(item.val, currency)})</text>
      </g>
    `);
  });

  const svg = `
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <!-- Background Card -->
  <rect width="${width}" height="${height}" fill="#FFFFFF" rx="8" stroke="#E2E8F0" stroke-width="1"/>
  
  <!-- Header -->
  <text x="24" y="34" font-family="Segoe UI, sans-serif" font-size="15" font-weight="bold" fill="#0F172A">${escapeXml(title)}</text>
  <text x="24" y="52" font-family="Segoe UI, sans-serif" font-size="11" fill="#64748B">Grafik Native MayStudio • Distribusi proporsi dan kontribusi kategori</text>

  <!-- Slices -->
  ${slicePaths.join('\n')}
  
  <!-- Legend list -->
  ${legendItems.join('\n')}
</svg>`;

  return await sharp(Buffer.from(svg)).png().toBuffer();
}

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
