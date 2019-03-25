'use strict';

/**
 * Check the contents of a single cell against the rules for that column
 * @param  {string}   cell   Contents of a single cell
 * @param  {Object}   colDef Definition of that column from the schema file
 * @return {string[]}        Array of messages describing problems found, empty if OK
 */
const checkCell = (cell, colDef) => {
  const msgs = [];

  // Column must/mustn't be empty
  if (colDef.isEmpty) {
    if (cell !== '') {
      msgs.push('isn\'t empty when it should be');
    }
  } else if (colDef.noEmpty) {
    if (cell === '') {
      msgs.push('is empty when it shouldn\'t be');
    }
  }

  // Column must consist only of 7-bit ASCII printing characters
  if (colDef.isAscii) {
    const buf = Buffer.from(cell);
    for (let i = 0; i < buf.length; i++) {
      if (buf[i] < 0x20 || buf[i] > 0x7E) {
        msgs.push('contains characters other than 7-bit ASCII printing characters');
        break;
      }
    }
  }

  // Column must not contain leading or trailing whitespace
  if (colDef.isTrim) {
    if (cell !== cell.trim()) {
      msgs.push('contains leading or trailing whitespace');
    }
  }

  // Column must match a regex (use ^ and $ for complete/exact match)
  if (colDef.regex) {
    const regex = new RegExp(colDef.regex);
    if (!regex.test(cell)) {
      msgs.push('does not match regular expression');
    }
  }

  // Column must parse as a finite integer
  if (colDef.isInt) {
    if (!isFinite(parseInt(cell))) {
      msgs.push('is not a finite integer');
    }
  }

  // Column must parse as a finite floating-point number (or an integer)
  if (colDef.isFloat) {
    if (!isFinite(parseFloat(cell))) {
      msgs.push('is not a finite floating-point number');
    }
  }

  // Column must meet a minimum (numeric or string) value
  if (typeof colDef.minVal === 'number') {
    if (!(parseFloat(cell) >= colDef.minVal)) {
      msgs.push('is below minimum numeric value or is not a number');
    }
  } else if (typeof colDef.minVal === 'string') {
    if (!(cell >= colDef.minVal)) {
      msgs.push('sorts before minimum string value');
    }
  }

  // Column must meet a maximum (numeric or string) value
  if (typeof colDef.maxVal === 'number') {
    if (!(parseFloat(cell) <= colDef.maxVal)) {
      msgs.push('is above maximum numeric value or is not a number');
    }
  } else if (typeof colDef.maxVal === 'string') {
    if (!(cell <= colDef.maxVal)) {
      msgs.push('sorts after maximum string value');
    }
  }

  return msgs;
};

module.exports = { checkCell };
