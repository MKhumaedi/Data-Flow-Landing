import { Workbook, Worksheet } from 'exceljs';
import { ProvinceDataRow } from '../types';

const TEAL_HEADER = 'FF00685F';

function addProvinceHeaders(ws: Worksheet): void {
  ws.getCell('A1').value = 'DISTRIBUSI REGIONAL PULAU JAWA';
  ws.getCell('A1').font = { name: 'Segoe UI', size: 12, bold: true, color: { argb: TEAL_HEADER } };

  ws.getCell('F1').value = 'Peta bersifat statis. Data mentah tersedia di tabel kiri untuk diolah lebih lanjut.';
  ws.getCell('F1').font = { name: 'Segoe UI', size: 9, italic: true, color: { argb: 'FF64748B' } };

  ws.getRow(3).values = ['Provinsi', 'Kode', 'Pendapatan (Juta Rp)', 'Pengguna Aktif', 'Pangsa Pasar (%)'];
  ws.getRow(3).eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_HEADER } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  ws.getRow(3).height = 26;
}

function populateProvinceRows(ws: Worksheet, data: ProvinceDataRow[]): void {
  data.forEach((p, index) => {
    const r = ws.addRow([p.province, p.code, p.revenue, p.activeUsers, p.marketShare / 100]);
    r.getCell(2).alignment = { horizontal: 'center' };
    r.getCell(3).numFmt = '#,##0';
    r.getCell(4).numFmt = '#,##0';
    r.getCell(5).numFmt = '0.0%';
    if (index % 2 === 1) {
      r.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }
  });
}

function embedMapImage(wb: Workbook, ws: Worksheet, mapImageBuffer: Buffer): void {
  const imageId = wb.addImage({
    buffer: mapImageBuffer,
    extension: 'png',
  });
  ws.addImage(imageId, {
    tl: { col: 5.5, row: 2.5 },
    ext: { width: 580, height: 210 },
  });
}

export function buildProvinceSheet(
  wb: Workbook,
  data: ProvinceDataRow[],
  mapImageBuffer: Buffer
): Worksheet {
  const ws = wb.addWorksheet('Peta Provinsi', {
    views: [{ state: 'frozen', ySplit: 3, showGridLines: true }],
  });
  addProvinceHeaders(ws);
  populateProvinceRows(ws, data);
  embedMapImage(wb, ws, mapImageBuffer);
  ws.columns = [
    { width: 18 },
    { width: 10 },
    { width: 22 },
    { width: 18 },
    { width: 18 },
  ];
  return ws;
}
