import { Workbook, Worksheet } from 'exceljs';
import { CategoryDataRow } from '../types';

const TEAL_HEADER = 'FF00685F';

function styleHeaderRow(ws: Worksheet): void {
  ws.getRow(1).values = ['Kategori Produk', 'Total Penjualan (Juta Rp)'];
  ws.getRow(1).eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_HEADER } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  ws.getRow(1).height = 26;
}

function populateCategoryRows(ws: Worksheet, data: CategoryDataRow[]): void {
  data.forEach((row, index) => {
    const r = ws.addRow([row.category, row.revenue]);
    const numCell = r.getCell(2);
    numCell.numFmt = '#,##0';
    numCell.alignment = { horizontal: 'right' };
    if (index % 2 === 1) {
      r.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF8FAFC' } };
      });
    }
  });
}

export function buildCategorySheet(wb: Workbook, data: CategoryDataRow[]): Worksheet {
  const ws = wb.addWorksheet('Kategori Produk', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
  });
  styleHeaderRow(ws);
  populateCategoryRows(ws, data);
  ws.columns = [{ width: 28 }, { width: 28 }];
  return ws;
}
