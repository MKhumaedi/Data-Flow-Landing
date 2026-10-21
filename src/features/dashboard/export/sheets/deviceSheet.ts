import { Workbook, Worksheet } from 'exceljs';
import { DeviceDataRow } from '../types';

const TEAL_HEADER = 'FF00685F';

function styleHeaderRow(ws: Worksheet): void {
  ws.getRow(1).values = ['Tipe Perangkat', 'Persentase Pengguna (%)'];
  ws.getRow(1).eachCell((cell) => {
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TEAL_HEADER } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });
  ws.getRow(1).height = 26;
}

function populateDeviceRows(ws: Worksheet, data: DeviceDataRow[]): void {
  data.forEach((row) => {
    const r = ws.addRow([row.device, row.percentage]);
    const pctCell = r.getCell(2);
    pctCell.numFmt = '0"%"';
    pctCell.alignment = { horizontal: 'right' };
  });
}

export function buildDeviceSheet(wb: Workbook, data: DeviceDataRow[]): Worksheet {
  const ws = wb.addWorksheet('Perangkat', {
    views: [{ state: 'frozen', ySplit: 1, showGridLines: true }],
  });
  styleHeaderRow(ws);
  populateDeviceRows(ws, data);
  ws.columns = [{ width: 24 }, { width: 26 }];
  return ws;
}
