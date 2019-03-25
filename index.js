#!/usr/bin/env node
/**
 * Parses a CSV file and ensures that not only is it valid CSV,
 * but the data in each column fits a defined schema.
 */

'use strict';
const fs = require('fs');
const csv = require('csv');
const yargs = require('yargs');
const checkCell = require('./checks').checkCell;

/**
 * Check whether we have a blank line in the file
 * @param  {Array|Object} rec One parsed record
 * @return {boolean}          True if it came from a blank line (not even any commas), else false
 */
const isRowBlank = (rec) => {
  if (Array.isArray(rec)) {
    return (rec.length === 1 && rec[0] === '');
  } else {
    const keys = Object.keys(rec);
    return (keys.length === 1 && rec[keys[0]] === '');
  }
};

const argv = yargs
  .alias({
    csv: 'c',
    errors: 'e',
    schema: 's',
  })
  .demand(['schema'])
  .describe({
    csv: 'CSV file to examine (else stdin)',
    errors: 'File to log problems (else stdout)',
    schema: 'Schema definition file',
  })
  .epilogue('Parses a CSV file and ensures that not only is it valid CSV, but the data in each column fits a defined schema.')
  .help()
  .string(['csv', 'errors', 'schema'])
  .version()
  .wrap(yargs.terminalWidth() - 5)
  .argv;

const instream = argv.csv ? fs.createReadStream(argv.csv) : process.stdin;
const outstream = argv.errors ? fs.createWriteStream(argv.errors) : process.stdout;
const schema = JSON.parse(fs.readFileSync(argv.schema, { encoding: 'utf8' }));
const namedColumnMode = !Array.isArray(schema.columnDefs);
let colsShould = schema.columns;
let row = namedColumnMode ? 1 : 0;

const parser = csv.parse({
  columns: namedColumnMode,
  relax_column_count: true,
})
  .on('end', () => {
    // Need to close output file if using one, but can't close stdout
    if (argv.errors) { outstream.end(); }
  })
  .on('readable', () => {
    // For each row...
    let rec;
    while (rec = parser.read()) {
      row++;
      if (row <= schema.skipRows) continue;

      // Check consistency of number of columns
      // BUG: Doesn't work with named column definitions
      const colsThis = namedColumnMode ? Object.keys(rec).length : rec.length;
      if (!colsShould) { colsShould = colsThis; }
      if (isRowBlank(rec)) {
        outstream.write(`(Row ${row}): is a blank line\n`);
        continue;
      }
      if (colsThis !== colsShould) {
        outstream.write(`(Row ${row}): inconsistent column count, expected ${colsShould}, found ${colsThis}\n`);
      }

      // For each cell in this row...
      if (namedColumnMode) {
        Object.keys(schema.columnDefs).forEach(key => {
          checkCell(rec[key], schema.columnDefs[key]).forEach(msgmid => {
            const msg = `(Row ${row}, Col '${key}'): ${msgmid}\n`;
            outstream.write(msg);
          });
        });
      } else {
        schema.columnDefs.forEach((colDef, idx) => {
          checkCell(rec[idx], colDef).forEach(msgmid => {
            const msg = `(Row ${row}, Col ${idx + 1}): ${msgmid}\n`;
            outstream.write(msg);
          });
        });
      }
    }
  });

instream.pipe(parser);
