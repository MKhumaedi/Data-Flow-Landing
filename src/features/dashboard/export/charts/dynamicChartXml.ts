import { ChartExportDefinition } from '../types';

function escapeXml(str: string | number): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const MAYSTUDIO_CHART_PALETTE = [
  '00685F', // MayStudio Deep Teal (Primary)
  '1E293B', // Slate Navy (Secondary)
  'F59E0B', // Warm Amber (Accent)
  'F43F5E', // Muted Coral / Rose (Accent)
  '0284C7', // Sky Blue
  '10B981', // Emerald
  '8B5CF6', // Purple / Violet
  '64748B', // Cool Slate
];

export function generateDynamicChartXml(def: ChartExportDefinition): string {
  const {
    title,
    chartType,
    sheetName,
    dataSheetName,
    headerRow = 4,
    dimColLetter,
    startRow,
    endRow,
    series = [],
    categories = [],
    numFmt = '#,##0',
  } = def;

  const escapedTitle = escapeXml(title);
  // Target data sheet for series and category data points
  const targetDataSheet = dataSheetName || sheetName;
  const safeSheetName = `'${targetDataSheet.replace(/'/g, "''")}'`;
  const catRef = `${safeSheetName}!$${dimColLetter}$${startRow}:$${dimColLetter}$${endRow}`;
  const catPoints = categories
    .map((cat, i) => `<c:pt idx="${i}"><c:v>${escapeXml(cat)}</c:v></c:pt>`)
    .join('');

  const isPie = chartType === 'pie' || chartType === 'donut';
  const isHorizontalBar = chartType === 'bar-horizontal';
  const isArea = chartType === 'area';
  const isLine = chartType === 'line';

  let chartBody = '';

  if (isPie) {
    const s = series[0] || { name: 'Nilai', colLetter: 'C', values: [] };
    const valRef = `${safeSheetName}!$${s.colLetter}$${startRow}:$${s.colLetter}$${endRow}`;
    const valPoints = s.values
      .map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`)
      .join('');

    const sliceColors = categories
      .map((_, i) => {
        const clr = MAYSTUDIO_CHART_PALETTE[i % MAYSTUDIO_CHART_PALETTE.length];
        return `<c:dPt><c:idx val="${i}"/><c:spPr><a:gradFill flip="none" rotWithShape="1"><a:gsLst><a:gs pos="0"><a:srgbClr val="${clr}"><a:tint val="85000"/></a:srgbClr></a:gs><a:gs pos="100000"><a:srgbClr val="${clr}"/></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill><a:ln w="19050"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln><a:effectLst><a:outerShdw blurRad="30000" dist="15000" dir="5400000" algn="b" rotWithShape="0"><a:srgbClr val="0F172A"><a:alpha val="20000"/></a:srgbClr></a:outerShdw></a:effectLst></c:spPr></c:dPt>`;
      })
      .join('');

    const serXml = `
      <c:ser>
        <c:idx val="0"/><c:order val="0"/>
        <c:tx>
          <c:strRef>
            <c:f>${safeSheetName}!$${s.colLetter}$${headerRow}</c:f>
            <c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${escapeXml(s.name)}</c:v></c:pt></c:strCache>
          </c:strRef>
        </c:tx>
        ${sliceColors}
        <c:cat>
          <c:strRef>
            <c:f>${catRef}</c:f>
            <c:strCache><c:ptCount val="${categories.length}"/>${catPoints}</c:strCache>
          </c:strRef>
        </c:cat>
        <c:val>
          <c:numRef>
            <c:f>${valRef}</c:f>
            <c:numCache><c:formatCode>${escapeXml(numFmt)}</c:formatCode><c:ptCount val="${s.values.length}"/>${valPoints}</c:numCache>
          </c:numRef>
        </c:val>
      </c:ser>
    `;

    if (chartType === 'donut') {
      chartBody = `
        <c:doughnutChart>
          <c:varyColors val="1"/>
          ${serXml}
          <c:firstSliceAng val="0"/>
          <c:holeSize val="60"/>
        </c:doughnutChart>
      `;
    } else {
      chartBody = `
        <c:pieChart>
          <c:varyColors val="1"/>
          ${serXml}
          <c:firstSliceAng val="0"/>
        </c:pieChart>
      `;
    }
  } else if (isLine) {
    const seriesXml = series
      .map((s, idx) => {
        const clr = s.colorHex || MAYSTUDIO_CHART_PALETTE[idx % MAYSTUDIO_CHART_PALETTE.length];
        const valRef = `${safeSheetName}!$${s.colLetter}$${startRow}:$${s.colLetter}$${endRow}`;
        const valPoints = s.values
          .map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`)
          .join('');

        return `
          <c:ser>
            <c:idx val="${idx}"/><c:order val="${idx}"/>
            <c:tx>
              <c:strRef>
                <c:f>${safeSheetName}!$${s.colLetter}$${headerRow}</c:f>
                <c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${escapeXml(s.name)}</c:v></c:pt></c:strCache>
              </c:strRef>
            </c:tx>
            <c:spPr>
              <a:ln w="28800"><a:solidFill><a:srgbClr val="${clr}"/></a:solidFill></a:ln>
              <a:effectLst>
                <a:outerShdw blurRad="40000" dist="20000" dir="5400000" algn="b" rotWithShape="0">
                  <a:srgbClr val="0F172A"><a:alpha val="30000"/></a:srgbClr>
                </a:outerShdw>
              </a:effectLst>
            </c:spPr>
            <c:marker>
              <c:symbol val="circle"/><c:size val="6"/>
              <c:spPr>
                <a:solidFill><a:srgbClr val="${clr}"/></a:solidFill>
                <a:ln w="12700"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill></a:ln>
              </c:spPr>
            </c:marker>
            <c:cat>
              <c:strRef>
                <c:f>${catRef}</c:f>
                <c:strCache><c:ptCount val="${categories.length}"/>${catPoints}</c:strCache>
              </c:strRef>
            </c:cat>
            <c:val>
              <c:numRef>
                <c:f>${valRef}</c:f>
                <c:numCache><c:formatCode>${escapeXml(numFmt)}</c:formatCode><c:ptCount val="${s.values.length}"/>${valPoints}</c:numCache>
              </c:numRef>
            </c:val>
            <c:smooth val="1"/>
          </c:ser>
        `;
      })
      .join('');

    chartBody = `
      <c:lineChart>
        <c:grouping val="standard"/>
        <c:varyColors val="0"/>
        ${seriesXml}
        <c:axId val="148921101"/><c:axId val="148921102"/>
      </c:lineChart>
      <c:catAx>
        <c:axId val="148921101"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/><c:axPos val="b"/><c:tickLblPos val="nextTo"/><c:crossAx val="148921102"/><c:crosses val="autoZero"/>
      </c:catAx>
      <c:valAx>
        <c:axId val="148921102"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/><c:axPos val="l"/>
        <c:majorGridlines><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="E2E8F0"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>
        <c:tickLblPos val="nextTo"/><c:crossAx val="148921101"/><c:crosses val="autoZero"/><c:crossBetween val="between"/>
      </c:valAx>
    `;
  } else if (isArea) {
    const seriesXml = series
      .map((s, idx) => {
        const clr = s.colorHex || MAYSTUDIO_CHART_PALETTE[idx % MAYSTUDIO_CHART_PALETTE.length];
        const valRef = `${safeSheetName}!$${s.colLetter}$${startRow}:$${s.colLetter}$${endRow}`;
        const valPoints = s.values
          .map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`)
          .join('');

        return `
          <c:ser>
            <c:idx val="${idx}"/><c:order val="${idx}"/>
            <c:tx>
              <c:strRef>
                <c:f>${safeSheetName}!$${s.colLetter}$${headerRow}</c:f>
                <c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${escapeXml(s.name)}</c:v></c:pt></c:strCache>
              </c:strRef>
            </c:tx>
            <c:spPr>
              <a:gradFill flip="none" rotWithShape="1">
                <a:gsLst>
                  <a:gs pos="0">
                    <a:srgbClr val="${clr}">
                      <a:alpha val="85000"/>
                    </a:srgbClr>
                  </a:gs>
                  <a:gs pos="100000">
                    <a:srgbClr val="${clr}">
                      <a:alpha val="15000"/>
                    </a:srgbClr>
                  </a:gs>
                </a:gsLst>
                <a:lin ang="5400000" scaled="0"/>
              </a:gradFill>
              <a:ln w="19050"><a:solidFill><a:srgbClr val="${clr}"/></a:solidFill></a:ln>
              <a:effectLst>
                <a:outerShdw blurRad="40000" dist="20000" dir="5400000" algn="b" rotWithShape="0">
                  <a:srgbClr val="0F172A">
                    <a:alpha val="30000"/>
                  </a:srgbClr>
                </a:outerShdw>
              </a:effectLst>
            </c:spPr>
            <c:cat>
              <c:strRef>
                <c:f>${catRef}</c:f>
                <c:strCache><c:ptCount val="${categories.length}"/>${catPoints}</c:strCache>
              </c:strRef>
            </c:cat>
            <c:val>
              <c:numRef>
                <c:f>${valRef}</c:f>
                <c:numCache><c:formatCode>${escapeXml(numFmt)}</c:formatCode><c:ptCount val="${s.values.length}"/>${valPoints}</c:numCache>
              </c:numRef>
            </c:val>
            <c:smooth val="1"/>
          </c:ser>
        `;
      })
      .join('');

    chartBody = `
      <c:areaChart>
        <c:grouping val="standard"/>
        <c:varyColors val="0"/>
        ${seriesXml}
        <c:axId val="148921101"/><c:axId val="148921102"/>
      </c:areaChart>
      <c:catAx>
        <c:axId val="148921101"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/><c:axPos val="b"/><c:tickLblPos val="nextTo"/><c:crossAx val="148921102"/><c:crosses val="autoZero"/>
      </c:catAx>
      <c:valAx>
        <c:axId val="148921102"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/><c:axPos val="l"/>
        <c:majorGridlines><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="E2E8F0"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>
        <c:tickLblPos val="nextTo"/><c:crossAx val="148921101"/><c:crosses val="autoZero"/><c:crossBetween val="between"/>
      </c:valAx>
    `;
  } else if (isHorizontalBar) {
    const seriesXml = series
      .map((s, idx) => {
        const clr = s.colorHex || MAYSTUDIO_CHART_PALETTE[idx % MAYSTUDIO_CHART_PALETTE.length];
        const valRef = `${safeSheetName}!$${s.colLetter}$${startRow}:$${s.colLetter}$${endRow}`;
        const valPoints = s.values
          .map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`)
          .join('');

        return `
          <c:ser>
            <c:idx val="${idx}"/><c:order val="${idx}"/>
            <c:tx>
              <c:strRef>
                <c:f>${safeSheetName}!$${s.colLetter}$${headerRow}</c:f>
                <c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${escapeXml(s.name)}</c:v></c:pt></c:strCache>
              </c:strRef>
            </c:tx>
            <c:spPr>
              <a:solidFill><a:srgbClr val="${clr}"/></a:solidFill>
              <a:ln w="9525"><a:solidFill><a:srgbClr val="004D46"/></a:solidFill></a:ln>
              <a:effectLst>
                <a:outerShdw blurRad="30000" dist="15000" dir="5400000" algn="b" rotWithShape="0">
                  <a:srgbClr val="0F172A"><a:alpha val="25000"/></a:srgbClr>
                </a:outerShdw>
              </a:effectLst>
            </c:spPr>
            <c:cat>
              <c:strRef>
                <c:f>${catRef}</c:f>
                <c:strCache><c:ptCount val="${categories.length}"/>${catPoints}</c:strCache>
              </c:strRef>
            </c:cat>
            <c:val>
              <c:numRef>
                <c:f>${valRef}</c:f>
                <c:numCache><c:formatCode>${escapeXml(numFmt)}</c:formatCode><c:ptCount val="${s.values.length}"/>${valPoints}</c:numCache>
              </c:numRef>
            </c:val>
          </c:ser>
        `;
      })
      .join('');

    chartBody = `
      <c:barChart>
        <c:barDir val="bar"/>
        <c:grouping val="clustered"/>
        <c:varyColors val="0"/>
        ${seriesXml}
        <c:gapWidth val="100"/>
        <c:axId val="148921101"/><c:axId val="148921102"/>
      </c:barChart>
      <c:catAx>
        <c:axId val="148921101"/>
        <c:scaling><c:orientation val="maxMin"/></c:scaling>
        <c:delete val="0"/><c:axPos val="l"/><c:tickLblPos val="nextTo"/><c:crossAx val="148921102"/><c:crosses val="autoZero"/>
      </c:catAx>
      <c:valAx>
        <c:axId val="148921102"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/><c:axPos val="b"/>
        <c:majorGridlines><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="E2E8F0"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>
        <c:tickLblPos val="nextTo"/><c:crossAx val="148921101"/><c:crosses val="autoZero"/><c:crossBetween val="between"/>
      </c:valAx>
    `;
  } else {
    // Vertical column bar
    const seriesXml = series
      .map((s, idx) => {
        const clr = s.colorHex || MAYSTUDIO_CHART_PALETTE[idx % MAYSTUDIO_CHART_PALETTE.length];
        const valRef = `${safeSheetName}!$${s.colLetter}$${startRow}:$${s.colLetter}$${endRow}`;
        const valPoints = s.values
          .map((v, i) => `<c:pt idx="${i}"><c:v>${v}</c:v></c:pt>`)
          .join('');

        return `
          <c:ser>
            <c:idx val="${idx}"/><c:order val="${idx}"/>
            <c:tx>
              <c:strRef>
                <c:f>${safeSheetName}!$${s.colLetter}$${headerRow}</c:f>
                <c:strCache><c:ptCount val="1"/><c:pt idx="0"><c:v>${escapeXml(s.name)}</c:v></c:pt></c:strCache>
              </c:strRef>
            </c:tx>
            <c:spPr>
              <a:solidFill><a:srgbClr val="${clr}"/></a:solidFill>
              <a:ln w="9525"><a:solidFill><a:srgbClr val="004D46"/></a:solidFill></a:ln>
              <a:effectLst>
                <a:outerShdw blurRad="30000" dist="15000" dir="5400000" algn="b" rotWithShape="0">
                  <a:srgbClr val="0F172A"><a:alpha val="25000"/></a:srgbClr>
                </a:outerShdw>
              </a:effectLst>
            </c:spPr>
            <c:cat>
              <c:strRef>
                <c:f>${catRef}</c:f>
                <c:strCache><c:ptCount val="${categories.length}"/>${catPoints}</c:strCache>
              </c:strRef>
            </c:cat>
            <c:val>
              <c:numRef>
                <c:f>${valRef}</c:f>
                <c:numCache><c:formatCode>${escapeXml(numFmt)}</c:formatCode><c:ptCount val="${s.values.length}"/>${valPoints}</c:numCache>
              </c:numRef>
            </c:val>
          </c:ser>
        `;
      })
      .join('');

    chartBody = `
      <c:barChart>
        <c:barDir val="col"/>
        <c:grouping val="clustered"/>
        <c:varyColors val="0"/>
        ${seriesXml}
        <c:gapWidth val="120"/>
        <c:axId val="148921101"/><c:axId val="148921102"/>
      </c:barChart>
      <c:catAx>
        <c:axId val="148921101"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/><c:axPos val="b"/><c:tickLblPos val="nextTo"/><c:crossAx val="148921102"/><c:crosses val="autoZero"/>
      </c:catAx>
      <c:valAx>
        <c:axId val="148921102"/>
        <c:scaling><c:orientation val="minMax"/></c:scaling>
        <c:delete val="0"/><c:axPos val="l"/>
        <c:majorGridlines><c:spPr><a:ln w="9525"><a:solidFill><a:srgbClr val="E2E8F0"/></a:solidFill></a:ln></c:spPr></c:majorGridlines>
        <c:tickLblPos val="nextTo"/><c:crossAx val="148921101"/><c:crosses val="autoZero"/><c:crossBetween val="between"/>
      </c:valAx>
    `;
  }

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <c:date1904 val="0"/>
  <c:lang val="en-US"/>
  <c:roundedCorners val="1"/>
  <c:chart>
    <c:title>
      <c:tx>
        <c:rich>
          <a:bodyPr/>
          <a:lstStyle/>
          <a:p>
            <a:pPr><a:defRPr sz="1100" b="1"><a:solidFill><a:srgbClr val="004D46"/></a:solidFill></a:defRPr></a:pPr>
            <a:r>
              <a:rPr sz="1100" b="1"><a:solidFill><a:srgbClr val="004D46"/></a:solidFill></a:rPr>
              <a:t>${escapedTitle}</a:t>
            </a:r>
          </a:p>
        </c:rich>
      </c:tx>
      <c:layout/>
      <c:overlay val="0"/>
    </c:title>
    <c:autoTitleDeleted val="0"/>
    <c:plotArea>
      <c:layout/>
      ${chartBody}
    </c:plotArea>
    <c:legend>
      <c:legendPos val="${isPie ? 'r' : 'b'}"/>
      <c:layout/>
      <c:overlay val="0"/>
      <c:txPr>
        <a:bodyPr/>
        <a:lstStyle/>
        <a:p>
          <a:pPr>
            <a:defRPr sz="900">
              <a:solidFill><a:srgbClr val="0F172A"/></a:solidFill>
              <a:latin typeface="Segoe UI"/>
            </a:defRPr>
          </a:pPr>
        </a:p>
      </c:txPr>
    </c:legend>
    <c:plotVisOnly val="1"/>
  </c:chart>
  <c:spPr>
    <a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill>
    <a:ln w="9525">
      <a:solidFill><a:srgbClr val="E2E8F0"/></a:solidFill>
    </a:ln>
    <a:effectLst>
      <a:outerShdw blurRad="40000" dist="20000" dir="5400000" algn="b" rotWithShape="0">
        <a:srgbClr val="0F172A">
          <a:alpha val="35000"/>
        </a:srgbClr>
      </a:outerShdw>
    </a:effectLst>
  </c:spPr>
</c:chartSpace>`;
}
