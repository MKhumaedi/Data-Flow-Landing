import JSZip from 'jszip';
import { ChartExportDefinition } from '../types';
import { generateDynamicChartXml } from './dynamicChartXml';

function buildDrawingXml(
  chartRelId: string,
  title: string,
  chartIndex: number,
  fromCol = 5,
  fromRow = 3,
  toCol = 15,
  toRow = 22
): string {
  const cNvId = chartIndex + 10;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <xdr:twoCellAnchor editAs="oneCell">
    <xdr:from><xdr:col>${fromCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${fromRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>${toCol}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${toRow}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr>
        <xdr:cNvPr id="${cNvId}" name="${title.replace(/"/g, '&quot;')}"/>
        <xdr:cNvGraphicFramePr/>
      </xdr:nvGraphicFramePr>
      <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
      <a:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
          <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${chartRelId}"/>
        </a:graphicData>
      </a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>
</xdr:wsDr>`;
}

function buildDrawingRelsXml(chartTarget: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="${chartTarget}"/>
</Relationships>`;
}

/**
 * Parses xl/workbook.xml and xl/_rels/workbook.xml.rels to build a map of sheetName -> worksheet file path
 * (e.g. "1_Tren List Price" -> "xl/worksheets/sheet2.xml").
 */
async function getSheetPathMap(zip: JSZip): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const wbFile = zip.file('xl/workbook.xml');
    const relsFile = zip.file('xl/_rels/workbook.xml.rels');
    if (!wbFile || !relsFile) return map;

    const wbXml = await wbFile.async('text');
    const relsXml = await relsFile.async('text');

    const relTargetMap = new Map<string, string>();
    const relMatches = [...relsXml.matchAll(/<Relationship[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"/g)];
    for (const m of relMatches) {
      relTargetMap.set(m[1], m[2]);
    }

    const sheetMatches = [...wbXml.matchAll(/<sheet[^>]+name="([^"]+)"[^>]+r:id="([^"]+)"/g)];
    for (const m of sheetMatches) {
      const name = m[1];
      const rId = m[2];
      const target = relTargetMap.get(rId);
      if (target) {
        // Target can be "worksheets/sheet2.xml" or "/xl/worksheets/sheet2.xml"
        const cleanPath = target.replace(/^\/?(xl\/)?/, 'xl/');
        map.set(name, cleanPath);
      }
    }
  } catch (err) {
    console.warn('Error resolving sheet paths from workbook.xml:', err);
  }
  return map;
}

/**
 * Dynamically injects native OpenXML chart objects into the ExcelJS-generated workbook ZIP.
 * Supports multiple charts per worksheet placed on a consolidated Dashboard sheet.
 */
export async function injectOpenXmlCharts(
  workbookBuffer: Buffer,
  chartDefs: ChartExportDefinition[]
): Promise<Buffer> {
  if (!chartDefs || chartDefs.length === 0) {
    return workbookBuffer;
  }

  const zip = await JSZip.loadAsync(workbookBuffer);
  const sheetPathMap = await getSheetPathMap(zip);

  // Group chart definitions by worksheet name
  const chartsBySheet = new Map<string, ChartExportDefinition[]>();
  for (const def of chartDefs) {
    const sName = def.sheetName || 'Dashboard';
    if (!chartsBySheet.has(sName)) {
      chartsBySheet.set(sName, []);
    }
    chartsBySheet.get(sName)!.push(def);
  }

  // Find next available drawing index
  let nextDrawingNum = 1;
  while (zip.file(`xl/drawings/drawing${nextDrawingNum}.xml`)) {
    nextDrawingNum++;
  }

  let globalChartNum = 1;
  const contentTypeOverrides: string[] = [];

  for (const [sheetName, defs] of chartsBySheet.entries()) {
    let sheetPath = sheetPathMap.get(sheetName);
    if (!sheetPath) {
      sheetPath = 'xl/worksheets/sheet2.xml';
    }

    const sheetFile = zip.file(sheetPath);
    if (!sheetFile) {
      console.warn(`Worksheet file not found for sheet: ${sheetName} at path: ${sheetPath}`);
      continue;
    }

    const sheetFilename = sheetPath.split('/').pop();
    const sheetRelsPath = `xl/worksheets/_rels/${sheetFilename}.rels`;
    const sheetRelsFile = zip.file(sheetRelsPath);
    let sheetRelsXml = sheetRelsFile ? await sheetRelsFile.async('text') : '';

    let drawingFilePath = '';
    let drawingRelsPath = '';
    let isNewDrawing = false;

    // Check if the sheet already has a drawing relationship
    const drawingMatch =
      sheetRelsXml.match(/<Relationship[^>]+Type="[^"]*\/relationships\/drawing"[^>]+Target="([^"]+)"/) ||
      sheetRelsXml.match(/<Relationship[^>]+Target="([^"]+)"[^>]+Type="[^"]*\/relationships\/drawing"/);

    if (drawingMatch) {
      const targetRel = drawingMatch[1]; // e.g. "../drawings/drawing1.xml"
      const fname = targetRel.split('/').pop() || 'drawing1.xml';
      drawingFilePath = `xl/drawings/${fname}`;
      drawingRelsPath = `xl/drawings/_rels/${fname}.rels`;
    } else {
      isNewDrawing = true;
      const drawingNum = nextDrawingNum++;
      drawingFilePath = `xl/drawings/drawing${drawingNum}.xml`;
      drawingRelsPath = `xl/drawings/_rels/drawing${drawingNum}.xml.rels`;
    }

    // Load or initialize drawing XML
    let drawingXml = '';
    const drawingFile = zip.file(drawingFilePath);
    if (drawingFile) {
      drawingXml = await drawingFile.async('text');
      // Ensure namespaces are present on root wsDr
      if (!drawingXml.includes('xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart"')) {
        drawingXml = drawingXml.replace(
          '<xdr:wsDr ',
          '<xdr:wsDr xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" '
        );
      }
      if (!drawingXml.includes('xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"')) {
        drawingXml = drawingXml.replace(
          '<xdr:wsDr ',
          '<xdr:wsDr xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" '
        );
      }
    } else {
      drawingXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart">
</xdr:wsDr>`;
    }

    // Load or initialize drawing rels XML
    let drawingRelsXml = '';
    const drawingRelsFile = zip.file(drawingRelsPath);
    if (drawingRelsFile) {
      drawingRelsXml = await drawingRelsFile.async('text');
    } else {
      drawingRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;
    }

    // Process all charts for this worksheet
    const chartAnchors: string[] = [];
    for (const def of defs) {
      const currentChartNum = globalChartNum++;
      const chartFilePath = `xl/charts/chart${currentChartNum}.xml`;

      // Determine next available sequential rId in drawingRelsXml
      const existingRels = drawingRelsXml.match(/Id="rId(\d+)"/g) || [];
      let maxRelId = 0;
      for (const r of existingRels) {
        const num = parseInt(r.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(num) && num > maxRelId) maxRelId = num;
      }
      const nextRelNum = maxRelId + 1;
      const chartRelId = `rId${nextRelNum}`;

      // 1. Generate & store Chart XML
      const chartXml = generateDynamicChartXml(def);
      zip.file(chartFilePath, chartXml);

      // 2. Add chart relationship to drawing rels
      const chartRelTag = `<Relationship Id="${chartRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart" Target="../charts/chart${currentChartNum}.xml"/>`;
      drawingRelsXml = drawingRelsXml.replace('</Relationships>', `  ${chartRelTag}\n</Relationships>`);

      // 3. Register chart content type
      contentTypeOverrides.push(
        `<Override PartName="/xl/charts/chart${currentChartNum}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`
      );

      // 4. Build twoCellAnchor for this chart
      const fromCol = def.fromCol ?? 1;
      const fromRow = def.fromRow ?? 4;
      const toCol = def.toCol ?? 7;
      const toRow = def.toRow ?? 20;
      const fromColOff = def.fromColOff ?? 0;
      const fromRowOff = def.fromRowOff ?? 0;
      const toColOff = def.toColOff ?? 0;
      const toRowOff = def.toRowOff ?? 0;
      const cNvId = 100 + currentChartNum;
      const escapedChartTitle = def.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

      const anchorXml = `  <xdr:twoCellAnchor editAs="oneCell">
    <xdr:from><xdr:col>${fromCol}</xdr:col><xdr:colOff>${fromColOff}</xdr:colOff><xdr:row>${fromRow}</xdr:row><xdr:rowOff>${fromRowOff}</xdr:rowOff></xdr:from>
    <xdr:to><xdr:col>${toCol}</xdr:col><xdr:colOff>${toColOff}</xdr:colOff><xdr:row>${toRow}</xdr:row><xdr:rowOff>${toRowOff}</xdr:rowOff></xdr:to>
    <xdr:graphicFrame macro="">
      <xdr:nvGraphicFramePr>
        <xdr:cNvPr id="${cNvId}" name="${escapedChartTitle}"/>
        <xdr:cNvGraphicFramePr/>
      </xdr:nvGraphicFramePr>
      <xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm>
      <a:graphic>
        <a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">
          <c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="${chartRelId}"/>
        </a:graphicData>
      </a:graphic>
    </xdr:graphicFrame>
    <xdr:clientData/>
  </xdr:twoCellAnchor>`;
      chartAnchors.push(anchorXml);
    }

    // Append all chart anchors before </xdr:wsDr>
    drawingXml = drawingXml.replace('</xdr:wsDr>', `${chartAnchors.join('\n')}\n</xdr:wsDr>`);

    // Save drawing XML & rels
    zip.file(drawingFilePath, drawingXml);
    zip.file(drawingRelsPath, drawingRelsXml);

    if (isNewDrawing) {
      // Register drawing in content types
      const drawingPartName = `/${drawingFilePath}`;
      contentTypeOverrides.push(
        `<Override PartName="${drawingPartName}" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>`
      );

      // Link drawing in worksheet rels
      const drawingRelId = 'rIdChartDrawing';
      if (!sheetRelsXml) {
        sheetRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="${drawingRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/${drawingFilePath.split('/').pop()}"/>
</Relationships>`;
      } else {
        sheetRelsXml = sheetRelsXml.replace(
          '</Relationships>',
          `  <Relationship Id="${drawingRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/${drawingFilePath.split('/').pop()}"/>\n</Relationships>`
        );
      }
      zip.file(sheetRelsPath, sheetRelsXml);

      // Add <drawing> element to sheet XML if not present
      let sheetXml = await sheetFile.async('text');
      if (!sheetXml.includes('<drawing')) {
        const drawingTag = `<drawing r:id="${drawingRelId}"/>`;
        if (sheetXml.includes('<legacyDrawing')) {
          sheetXml = sheetXml.replace('<legacyDrawing', `${drawingTag}<legacyDrawing`);
        } else if (sheetXml.includes('<extLst')) {
          sheetXml = sheetXml.replace('<extLst', `${drawingTag}<extLst`);
        } else {
          sheetXml = sheetXml.replace('</worksheet>', `${drawingTag}</worksheet>`);
        }
        zip.file(sheetPath, sheetXml);
      }
    }
  }

  // Update [Content_Types].xml
  const ctFile = zip.file('[Content_Types].xml');
  if (ctFile) {
    let ct = await ctFile.async('text');
    for (const item of contentTypeOverrides) {
      if (!ct.includes(item)) {
        ct = ct.replace('</Types>', `${item}</Types>`);
      }
    }
    zip.file('[Content_Types].xml', ct);
  }

  return (await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })) as Buffer;
}
