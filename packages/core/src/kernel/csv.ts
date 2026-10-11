/*
 * Reading and writing CSV, to the letter of RFC 4180: quoted cells, doubled quotes inside them,
 * line breaks inside quoted cells, and either kind of line ending.
 */

/** Parses CSV text into rows of cells. A leading byte-order mark and blank lines are skipped. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const source = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  const endCell = () => {
    row.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    if (row.some((value) => value.trim() !== '')) rows.push(row);
    row = [];
  };

  for (let index = 0; index < source.length; index++) {
    const char = source[index];
    if (quoted) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index++;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"' && cell === '') {
      quoted = true;
    } else if (char === ',') {
      endCell();
    } else if (char === '\n') {
      endRow();
    } else if (char === '\r') {
      if (source[index + 1] === '\n') index++;
      endRow();
    } else {
      cell += char;
    }
  }
  if (cell !== '' || row.length > 0) endRow();
  return rows;
}

/**
 * A cell that a spreadsheet would run as a formula is written with a leading apostrophe, so a name
 * such as `=HYPERLINK(...)` typed into a form can never execute on the accountant's computer.
 */
function safeCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  let text =
    typeof value === 'string'
      ? value
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** One CSV line, without a line ending. */
export const csvLine = (cells: readonly unknown[]): string => cells.map(safeCell).join(',');

/** Rows as CSV text. Starts with a byte-order mark so spreadsheets read Urdu text correctly. */
export function toCsv(rows: readonly (readonly unknown[])[]): string {
  return `﻿${rows.map(csvLine).join('\r\n')}\r\n`;
}
