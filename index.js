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
let row = namedColumnMode ? 1 : 0;

const parser = csv.parse({ columns: namedColumnMode })
  .on('error', err => {
    outstream.write(`${err.message}\n`);
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

      // Explicit column count
      const colCnt = namedColumnMode ? Object.keys(rec).length : rec.length;
      if (schema.columns && schema.columns !== colCnt) {
        const msg = `(Row ${row}): Schema specifies ${schema.columns} columns, found ${colCnt}\n`;
        outstream.write(msg);
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
