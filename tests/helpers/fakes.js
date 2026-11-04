'use strict';
// Minimal fakes for the Google services the src/ code calls. Only the methods the code uses
// exist; calling anything else fails loudly ("is not a function"), which is what we want.
// Where the code depends on how Google behaves, the fakes copy that behaviour:
// - an empty sheet's data range is A1 (one empty cell);
// - getValues() returns a full rectangle, blanks as '';
// - setValues() throws unless the array exactly fits the range;
// - insertSheet() throws if the name is taken; deleteSheet() refuses the last tab;
// - getLastRow() / getLastColumn() are 0 on an empty sheet;
// - getRange() throws if the range runs past the tab's rows or columns (1000 x 26 when new).

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const SRC_DIR = path.join(__dirname, '..', '..', 'src');
const DEFAULT_MAX_ROWS = 1000;
const DEFAULT_MAX_COLUMNS = 26;

function isEmptyCell(value) {
  return value === '' || value === null || value === undefined;
}

/**
 * A fake spreadsheet.
 * @param {Object<string, unknown[][]>} tabs tab name -> rows (row 1 first). Order is kept.
 * @param {{ timeZone?: string, readOnly?: boolean, name?: string }} [options]
 *   readOnly: every write method throws (used for Meta-Data).
 */
function makeSpreadsheet(tabs = {}, options = {}) {
  const readOnly = Boolean(options.readOnly);
  const label = options.name || 'spreadsheet';
  let timeZone = options.timeZone || 'Asia/Karachi';
  /** @type {ReturnType<typeof makeSheet>[]} */
  let sheets = [];
  const log = { writes: [] };

  function write(what) {
    if (readOnly) throw new Error(`${label} is read-only: the code tried to ${what}`);
    log.writes.push(what);
  }

  function makeSheet(name, rows) {
    // cells[r][c], 0-based, sparse; missing = ''.
    const cells = rows.map((row) => row.slice());
    const fontWeights = new Map();
    const numberFormats = new Map();
    const charts = [];
    const images = [];
    let frozenRows = 0;
    let maxRows = Math.max(DEFAULT_MAX_ROWS, cells.length);
    let maxColumns = Math.max(DEFAULT_MAX_COLUMNS, ...cells.map((r) => r.length), 0);

    function lastRow() {
      for (let r = cells.length - 1; r >= 0; r--) {
        if ((cells[r] || []).some((v) => !isEmptyCell(v))) return r + 1;
      }
      return 0;
    }
    function lastColumn() {
      let last = 0;
      for (const row of cells) {
        for (let c = (row || []).length - 1; c >= last; c--) {
          if (!isEmptyCell(row[c])) { last = c + 1; break; }
        }
      }
      return last;
    }
    function cell(r, c) {
      const v = (cells[r - 1] || [])[c - 1];
      return isEmptyCell(v) ? '' : v;
    }

    function makeRange(row, column, numRows = 1, numColumns = 1) {
      for (const [k, v] of Object.entries({ row, column, numRows, numColumns })) {
        if (!Number.isInteger(v) || v < 1) throw new Error(`getRange: bad ${k} ${v}`);
      }
      if (row + numRows - 1 > maxRows || column + numColumns - 1 > maxColumns) {
        throw new Error('The coordinates of the range are outside the dimensions of the sheet.');
      }
      const eachCell = (fn) => {
        for (let r = row; r < row + numRows; r++) {
          for (let c = column; c < column + numColumns; c++) fn(r, c);
        }
      };
      const range = {
        getRow: () => row,
        getColumn: () => column,
        getNumRows: () => numRows,
        getNumColumns: () => numColumns,
        getValues() {
          const out = [];
          for (let r = row; r < row + numRows; r++) {
            const line = [];
            for (let c = column; c < column + numColumns; c++) line.push(cell(r, c));
            out.push(line);
          }
          return out;
        },
        setValues(values) {
          write(`setValues on ${name}`);
          if (!Array.isArray(values) || values.length !== numRows ||
              values.some((line) => !Array.isArray(line) || line.length !== numColumns)) {
            throw new Error(`setValues: data does not fit a ${numRows}x${numColumns} range`);
          }
          values.forEach((line, i) => line.forEach((v, j) => {
            const r = row + i - 1;
            while (cells.length <= r) cells.push([]);
            cells[r][column + j - 1] = v;
          }));
          return range;
        },
        setFontWeight(weight) {
          write(`setFontWeight on ${name}`);
          eachCell((r, c) => fontWeights.set(`${r},${c}`, weight));
          return range;
        },
        setNumberFormat(format) {
          write(`setNumberFormat on ${name}`);
          eachCell((r, c) => numberFormats.set(`${r},${c}`, format));
          return range;
        },
      };
      return range;
    }

    const sheet = {
      getName: () => name,
      getLastRow: lastRow,
      getLastColumn: lastColumn,
      getMaxRows: () => maxRows,
      getMaxColumns: () => maxColumns,
      getFrozenRows: () => frozenRows,
      setFrozenRows(n) {
        write(`setFrozenRows on ${name}`);
        frozenRows = n;
        return sheet;
      },
      getRange: makeRange,
      insertRowsAfter(afterPosition, howMany) {
        write(`insertRowsAfter on ${name}`);
        if (afterPosition !== maxRows) {
          throw new Error('fake insertRowsAfter only supports adding rows at the end');
        }
        maxRows += howMany;
        return sheet;
      },
      getCharts: () => charts.slice(),
      getImages: () => images.slice(),
      /** Test helper: puts a chart on this tab (no cell values change). */
      _addChart() { charts.push({}); },
      /** Test helper: puts an image over the cells (no cell values change). */
      _addImage() { images.push({}); },
      getDataRange() {
        return makeRange(1, 1, Math.max(lastRow(), 1), Math.max(lastColumn(), 1));
      },
      /** Test helper (not a Google method): everything about this tab, as plain data. */
      _snapshot() {
        const sorted = (map) => Object.fromEntries([...map].sort());
        return {
          name,
          values: makeRange(1, 1, Math.max(lastRow(), 1), Math.max(lastColumn(), 1)).getValues(),
          fontWeights: sorted(fontWeights),
          numberFormats: sorted(numberFormats),
          frozenRows,
        };
      },
      /** Test helper: the number format of one cell, or undefined. */
      _numberFormat: (r, c) => numberFormats.get(`${r},${c}`),
      /** Test helper: the font weight of one cell, or undefined. */
      _fontWeight: (r, c) => fontWeights.get(`${r},${c}`),
    };
    return sheet;
  }

  sheets = Object.entries(tabs).map(([name, rows]) => makeSheet(name, rows));

  const spreadsheet = {
    getSpreadsheetTimeZone: () => timeZone,
    setSpreadsheetTimeZone(tz) {
      write('setSpreadsheetTimeZone');
      timeZone = tz;
    },
    getSheets: () => sheets.slice(),
    getSheetByName: (name) => sheets.find((s) => s.getName() === name) || null,
    insertSheet(name, index) {
      write(`insertSheet ${name}`);
      if (sheets.some((s) => s.getName().toLowerCase() === String(name).toLowerCase())) {
        throw new Error(`A sheet with the name "${name}" already exists.`);
      }
      const sheet = makeSheet(name, []);
      const at = index === undefined ? sheets.length : index;
      if (!Number.isInteger(at) || at < 0 || at > sheets.length) {
        throw new Error(`insertSheet: bad index ${index}`);
      }
      sheets.splice(at, 0, sheet);
      return sheet;
    },
    deleteSheet(sheet) {
      write(`deleteSheet ${sheet.getName()}`);
      if (sheets.length <= 1) throw new Error("You can't remove all the sheets in a document.");
      const i = sheets.indexOf(sheet);
      if (i < 0) throw new Error('deleteSheet: not a sheet of this spreadsheet');
      sheets.splice(i, 1);
    },
    /** Test helper: every tab and the timezone, as plain data. */
    _snapshot: () => ({ timeZone, sheets: sheets.map((s) => s._snapshot()) }),
    /** Test helper: what the code has written, in order. */
    _writes: () => log.writes.slice(),
  };
  return spreadsheet;
}

/**
 * Fake `Utilities`. formatDate supports only the patterns the code uses. getUuid gives real
 * random v4 UUIDs, like Google's; every one made is kept in `_uuids` for tests.
 */
function makeUtilities() {
  const uuids = [];
  return {
    formatDate(date, timeZone, pattern) {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone, year: 'numeric', month: '2-digit', day: 'numeric',
      }).formatToParts(date);
      const part = (type) => parts.find((p) => p.type === type).value;
      if (pattern === 'yyyy-MM') return `${part('year')}-${part('month')}`;
      if (pattern === 'yyyy-MM-dd') return `${part('year')}-${part('month')}-${part('day').padStart(2, '0')}`;
      if (pattern === 'd MMM yyyy') {
        const month = new Intl.DateTimeFormat('en-US', { timeZone, month: 'short' }).format(date);
        return `${part('day')} ${month} ${part('year')}`;
      }
      throw new Error(`fake Utilities.formatDate does not support "${pattern}"`);
    },
    /** Midnight at the start of a yyyy-MM-dd day in `timeZone` (the only pattern the code uses). */
    parseDate(text, timeZone, pattern) {
      if (pattern !== 'yyyy-MM-dd') throw new Error(`fake Utilities.parseDate does not support "${pattern}"`);
      const [y, m, d] = text.split('-').map(Number);
      const guess = Date.UTC(y, m - 1, d);
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
      }).formatToParts(new Date(guess));
      const part = (type) => Number(parts.find((p) => p.type === type).value);
      const asIfUtc = Date.UTC(part('year'), part('month') - 1, part('day'), part('hour'), part('minute'), part('second'));
      return new Date(guess - (asIfUtc - guess));
    },
    getUuid() {
      const uuid = crypto.randomUUID();
      uuids.push(uuid);
      return uuid;
    },
    /** Test helper: every UUID handed out. */
    _uuids: uuids,
  };
}

/**
 * Fake `LockService`. One script lock. `busy: true` makes waitLock time out, as Google's does
 * when another run holds the lock.
 * @param {{ busy?: boolean }} [options]
 */
function makeLockService(options = {}) {
  const events = [];
  let held = false;
  const lock = {
    waitLock(ms) {
      events.push(`waitLock ${ms}`);
      if (options.busy) throw new Error('Lock timeout: another process was holding the lock.');
      held = true;
    },
    releaseLock() {
      events.push('releaseLock');
      held = false;
    },
    hasLock: () => held,
  };
  return {
    getScriptLock: () => lock,
    /** Test helper: what happened to the lock, in order. */
    _events: events,
  };
}

/**
 * Fake `SpreadsheetApp`. (The fake sheets write at once, so flush only records that it was
 * called; `onFlush` lets a test see when.)
 * @param {{ byId?: Object<string, object>, active?: object | null, onFlush?: () => void }} [options]
 *   byId: spreadsheets openById can open; any other ID throws, like a deleted or
 *   unshared sheet. active: what getActiveSpreadsheet returns.
 */
function makeSpreadsheetApp(options = {}) {
  const byId = options.byId || {};
  const ui = makeUi();
  const flushes = { count: 0 };
  return {
    openById(id) {
      if (!Object.prototype.hasOwnProperty.call(byId, id)) {
        throw new Error('Exception: Unexpected error while getting the method or property ' +
          'openById on object SpreadsheetApp.');
      }
      return byId[id];
    },
    getActiveSpreadsheet: () => (options.active === undefined ? null : options.active),
    flush() {
      flushes.count++;
      if (options.onFlush) options.onFlush();
    },
    /** Test helper: how many times flush was called. */
    _flushes: flushes,
    getUi: () => ui,
    /** Test helper: the fake UI, to read alerts and menus. */
    _ui: ui,
  };
}

function makeUi() {
  const ui = {
    ButtonSet: { OK: 'OK' },
    /** Every alert shown: { args }. */
    alerts: [],
    /** Every menu added: { name, items: [{ caption, functionName }] }. */
    menus: [],
    /** Every dialog shown: { output, title }. */
    dialogs: [],
    showModalDialog(output, title) {
      ui.dialogs.push({ output, title });
    },
    alert(...args) {
      ui.alerts.push({ args });
      return 'OK';
    },
    createMenu(name) {
      const items = [];
      const menu = {
        addItem(caption, functionName) {
          items.push({ caption, functionName });
          return menu;
        },
        addToUi() {
          ui.menus.push({ name, items });
        },
      };
      return menu;
    },
  };
  return ui;
}

/**
 * Fake `Session`.
 * @param {{ activeEmail?: string, effectiveEmail?: string }} [options]
 */
function makeSession(options = {}) {
  const active = options.activeEmail === undefined ? '' : options.activeEmail;
  const effective = options.effectiveEmail === undefined ? '' : options.effectiveEmail;
  return {
    getActiveUser: () => ({ getEmail: () => active }),
    getEffectiveUser: () => ({ getEmail: () => effective }),
  };
}

function makeHtmlOutput(content) {
  let title = '';
  const metaTags = [];
  const output = {
    getContent: () => content,
    getTitle: () => title,
    setTitle(t) { title = t; return output; },
    addMetaTag(n, c) { metaTags.push({ name: n, content: c }); return output; },
    setWidth(w) { output._width = w; return output; },
    setHeight(h) { output._height = h; return output; },
    /** Test helper. */
    _metaTags: metaTags,
  };
  return output;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[ch]);
}

/**
 * Fake `HtmlService`. Reads `src/<name>.html`, as Apps Script does for a project file.
 * Templates support only `<?= name ?>` (printed escaped, like Google's), the one form the
 * code uses; any other scriptlet, or a name that was never set, throws.
 */
function makeHtmlService() {
  const read = (name) => fs.readFileSync(path.join(SRC_DIR, `${name}.html`), 'utf8');
  return {
    createHtmlOutputFromFile: (name) => makeHtmlOutput(read(name)),
    createTemplateFromFile(name) {
      const source = read(name);
      const template = {
        evaluate() {
          const leftover = source.replace(/<\?=\s*([A-Za-z_$][\w$]*)\s*\?>/g, '');
          if (/<\?/.test(leftover)) throw new Error(`fake template: unsupported scriptlet in ${name}`);
          return makeHtmlOutput(source.replace(/<\?=\s*([A-Za-z_$][\w$]*)\s*\?>/g, (_, key) => {
            if (!Object.prototype.hasOwnProperty.call(template, key)) {
              throw new Error(`ReferenceError: "${key}" is not defined.`);
            }
            return escapeHtml(template[key]);
          }));
        },
      };
      return template;
    },
  };
}

module.exports = {
  makeSpreadsheet,
  makeUtilities,
  makeSpreadsheetApp,
  makeSession,
  makeHtmlService,
  makeLockService,
};
