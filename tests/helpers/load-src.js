'use strict';
// Loads every src/*.js file into one shared node:vm context, the way Apps Script puts all of a
// project's files into a single global scope. Fake Google services are passed in as globals.
//
// Gotchas (see spec 001):
// - Top-level `const` values are not properties of the sandbox object. Use `get('NAME')`.
// - Objects made inside the sandbox have the sandbox's own built-in prototypes, so
//   assert.deepStrictEqual against plain test objects fails. Use `plain(x)` first.

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SRC_DIR = path.join(__dirname, '..', '..', 'src');

/** @returns {string[]} the src/*.js file names, in name order. */
function srcFiles() {
  return fs.readdirSync(SRC_DIR).filter((name) => name.endsWith('.js')).sort();
}

/**
 * @param {Object<string, unknown>} [globals] fakes to expose as globals (SpreadsheetApp, ...)
 * @param {{ order?: string[] }} [options] file load order (default: name order)
 */
function loadSrc(globals = {}, options = {}) {
  const sandbox = { ...globals };
  const globalNamesBefore = new Set(Object.keys(sandbox));
  const context = vm.createContext(sandbox);
  for (const name of options.order || srcFiles()) {
    const file = path.join(SRC_DIR, name);
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  }
  return {
    context,
    sandbox,
    globalNamesBefore,
    /** Reads any global from the sandbox, including top-level `const` values. */
    get(name) {
      return vm.runInContext(name, context);
    },
  };
}

/** Copies a sandbox value into plain test-realm objects, for deepStrictEqual. */
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = { SRC_DIR, srcFiles, loadSrc, plain };
