// Escape table text before placing it in an Office Open XML document.
function escapeSpreadsheetXml(value) {
  return value
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Convert a one-based column number to an Excel column name, such as AA.
function spreadsheetColumnName(columnNumber) {
  var name = "";
  while (columnNumber > 0) {
    columnNumber -= 1;
    name = String.fromCharCode(65 + (columnNumber % 26)) + name;
    columnNumber = Math.floor(columnNumber / 26);
  }
  return name;
}

// Encode strings as UTF-8 without depending on TextEncoder browser support.
function spreadsheetUtf8(value) {
  var encoded = unescape(encodeURIComponent(value));
  var bytes = new Uint8Array(encoded.length);
  for (var i = 0; i < encoded.length; ++i) {
    bytes[i] = encoded.charCodeAt(i);
  }
  return bytes;
}

// Build the CRC-32 lookup table required by every ZIP directory entry.
function spreadsheetCrcTable() {
  var table = [];
  for (var i = 0; i < 256; ++i) {
    var value = i;
    for (var bit = 0; bit < 8; ++bit) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[i] = value >>> 0;
  }
  return table;
}

var spreadsheetZipCrcTable = spreadsheetCrcTable();

// Calculate the checksum Excel uses to verify each file in the XLSX archive.
function spreadsheetCrc32(bytes) {
  var crc = 0xffffffff;
  for (var i = 0; i < bytes.length; ++i) {
    crc = spreadsheetZipCrcTable[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

// Write an unsigned integer to a ZIP header in little-endian byte order.
function writeSpreadsheetZipNumber(target, offset, value, byteCount) {
  for (var i = 0; i < byteCount; ++i) {
    target[offset + i] = value & 0xff;
    value = Math.floor(value / 256);
  }
}

// Join typed arrays without coercing their binary data to strings.
function joinSpreadsheetBytes(parts) {
  var length = 0;
  for (var i = 0; i < parts.length; ++i) length += parts[i].length;

  var joined = new Uint8Array(length);
  var offset = 0;
  for (var j = 0; j < parts.length; ++j) {
    joined.set(parts[j], offset);
    offset += parts[j].length;
  }
  return joined;
}

// Package the workbook parts in an uncompressed ZIP, the container used by XLSX.
function createSpreadsheetZip(files) {
  var localParts = [];
  var centralParts = [];
  var localOffset = 0;

  for (var i = 0; i < files.length; ++i) {
    var name = spreadsheetUtf8(files[i].name);
    var data = spreadsheetUtf8(files[i].content);
    var checksum = spreadsheetCrc32(data);

    var localHeader = new Uint8Array(30);
    writeSpreadsheetZipNumber(localHeader, 0, 0x04034b50, 4);
    writeSpreadsheetZipNumber(localHeader, 4, 20, 2);
    writeSpreadsheetZipNumber(localHeader, 6, 0x0800, 2);
    // Use the ZIP epoch (1980-01-01) instead of leaving an invalid zero date.
    writeSpreadsheetZipNumber(localHeader, 12, 33, 2);
    writeSpreadsheetZipNumber(localHeader, 14, checksum, 4);
    writeSpreadsheetZipNumber(localHeader, 18, data.length, 4);
    writeSpreadsheetZipNumber(localHeader, 22, data.length, 4);
    writeSpreadsheetZipNumber(localHeader, 26, name.length, 2);
    localParts.push(localHeader, name, data);

    var centralHeader = new Uint8Array(46);
    writeSpreadsheetZipNumber(centralHeader, 0, 0x02014b50, 4);
    writeSpreadsheetZipNumber(centralHeader, 4, 20, 2);
    writeSpreadsheetZipNumber(centralHeader, 6, 20, 2);
    writeSpreadsheetZipNumber(centralHeader, 8, 0x0800, 2);
    writeSpreadsheetZipNumber(centralHeader, 14, 33, 2);
    writeSpreadsheetZipNumber(centralHeader, 16, checksum, 4);
    writeSpreadsheetZipNumber(centralHeader, 20, data.length, 4);
    writeSpreadsheetZipNumber(centralHeader, 24, data.length, 4);
    writeSpreadsheetZipNumber(centralHeader, 28, name.length, 2);
    writeSpreadsheetZipNumber(centralHeader, 42, localOffset, 4);
    centralParts.push(centralHeader, name);

    localOffset += localHeader.length + name.length + data.length;
  }

  var centralDirectory = joinSpreadsheetBytes(centralParts);
  var endRecord = new Uint8Array(22);
  writeSpreadsheetZipNumber(endRecord, 0, 0x06054b50, 4);
  writeSpreadsheetZipNumber(endRecord, 8, files.length, 2);
  writeSpreadsheetZipNumber(endRecord, 10, files.length, 2);
  writeSpreadsheetZipNumber(endRecord, 12, centralDirectory.length, 4);
  writeSpreadsheetZipNumber(endRecord, 16, localOffset, 4);

  return joinSpreadsheetBytes(localParts.concat([centralDirectory, endRecord]));
}

// Turn the rendered table into worksheet XML while deliberately omitting A1.
function createSpreadsheetWorksheet(table) {
  var rows = table.getElementsByTagName("tr");
  var maximumColumns = 1;
  var worksheetRows = [];

  for (var rowIndex = 0; rowIndex < rows.length; ++rowIndex) {
    var cells = rows[rowIndex].children;
    maximumColumns = Math.max(maximumColumns, cells.length);
    var worksheetCells = [];

    for (var cellIndex = 0; cellIndex < cells.length; ++cellIndex) {
      // The export button and the existing heading both belong to A1, which must be blank.
      if (rowIndex === 0 && cellIndex === 0) continue;

      var cellText = getCellText(cells[cellIndex]);
      if (cellText === "") continue;

      var reference = spreadsheetColumnName(cellIndex + 1) + (rowIndex + 1);
      worksheetCells.push(
        '<c r="' +
          reference +
          '" t="inlineStr"><is><t xml:space="preserve">' +
          escapeSpreadsheetXml(cellText) +
          "</t></is></c>"
      );
    }

    worksheetRows.push(
      '<row r="' + (rowIndex + 1) + '">' + worksheetCells.join("") + "</row>"
    );
  }

  var lastCell = spreadsheetColumnName(maximumColumns) + Math.max(rows.length, 1);
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    '<dimension ref="A1:' +
    lastCell +
    '"/><sheetViews><sheetView workbookViewId="0"/></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/><sheetData>' +
    worksheetRows.join("") +
    "</sheetData></worksheet>"
  );
}

// Assemble the minimal set of Office Open XML files needed for an XLSX workbook.
function createSpreadsheetWorkbook(table) {
  var documentTimestamp = new Date().toISOString();
  var files = [
    {
      name: "[Content_Types].xml",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
        '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
        "</Types>"
    },
    {
      name: "_rels/.rels",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
        '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
        "</Relationships>"
    },
    {
      name: "docProps/app.xml",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" ' +
        'xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
        "<Application>Biomarkers</Application></Properties>"
    },
    {
      name: "docProps/core.xml",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" ' +
        'xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" ' +
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
        "<dc:creator>Biomarkers</dc:creator><cp:lastModifiedBy>Biomarkers</cp:lastModifiedBy>" +
        '<dcterms:created xsi:type="dcterms:W3CDTF">' +
        documentTimestamp +
        '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' +
        documentTimestamp +
        "</dcterms:modified></cp:coreProperties>"
    },
    {
      name: "xl/workbook.xml",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets><sheet name="Biomarkers" sheetId="1" r:id="rId1"/></sheets></workbook>'
    },
    {
      name: "xl/_rels/workbook.xml.rels",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        "</Relationships>"
    },
    {
      name: "xl/styles.xml",
      content:
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<fonts count="1"><font><sz val="11"/><name val="Calibri"/><family val="2"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>' +
        '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
        "</styleSheet>"
    },
    {
      name: "xl/worksheets/sheet1.xml",
      content: createSpreadsheetWorksheet(table)
    }
  ];

  return createSpreadsheetZip(files);
}

// Download bytes via an object URL so the table never has to leave the browser.
function downloadSpreadsheet(bytes) {
  var blob = new Blob([bytes], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  });
  var objectUrl = URL.createObjectURL(blob);
  var link = document.createElement("a");
  var date = new Date().toISOString().slice(0, 10);

  link.href = objectUrl;
  link.download = "biomarkers-" + date + ".xlsx";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Keep the URL alive until the browser has accepted the download request.
  window.setTimeout(function () {
    URL.revokeObjectURL(objectUrl);
  }, 0);
}

// Add the export control beside the original contents of the top-left table cell.
function SetupExportXlsx() {
  var table = document.getElementsByTagName("table")[0];
  if (!table) return;

  var firstCell = table.getElementsByTagName("th")[0];
  if (!firstCell) return;

  var button = document.createElement("button");
  button.type = "button";
  button.className = "export-btn";
  button.textContent = "Export";
  button.title = "Export the table as an XLSX workbook";
  button.onclick = function (event) {
    // Do not let button clicks participate in the header's triple-click handler.
    event.stopPropagation();
    downloadSpreadsheet(createSpreadsheetWorkbook(table));
  };
  firstCell.appendChild(button);
}
