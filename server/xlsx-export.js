/* ============================================================
 * InvestAI — GENUINE OOXML .xlsx WRITER (dependency-free)
 *
 * Builds a real Excel 2007+ workbook: a ZIP archive (compressed
 * via Node's built-in zlib DEFLATE) containing the minimal set
 * of OPC parts Excel expects:
 *   [Content_Types].xml, _rels/.rels,
 *   xl/workbook.xml, xl/_rels/workbook.xml.rels,
 *   xl/styles.xml, xl/worksheets/sheetN.xml
 *
 * Cells are emitted as inline strings (t="inlineStr") so no
 * sharedStrings part is required.
 * ============================================================ */

const zlib = require("zlib");

/* --- minimal ZIP (deflate) with CRC32 --- */

const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
}

function buildZip(entries) {
    const chunks = [];
    const central = [];
    let offset = 0;

    entries.forEach(({ name, data }) => {
        const nameBuf = Buffer.from(name, "utf8");
        const comp = zlib.deflateRawSync(data, { level: 9 });
        const crc = crc32(data);

        const local = Buffer.alloc(30);
        local.writeUInt32LE(0x04034b50, 0);      // local file header signature
        local.writeUInt16LE(20, 4);              // version needed (2.0)
        local.writeUInt16LE(0, 6);               // flags
        local.writeUInt16LE(8, 8);               // method 8 = deflate
        local.writeUInt16LE(0, 10);              // mod time
        local.writeUInt16LE(0x5180, 12);         // mod date
        local.writeUInt32LE(crc, 14);
        local.writeUInt32LE(comp.length, 18);    // compressed size
        local.writeUInt32LE(data.length, 22);    // uncompressed size
        local.writeUInt16LE(nameBuf.length, 26);
        local.writeUInt16LE(0, 28);              // extra len

        chunks.push(local, nameBuf, comp);

        const cen = Buffer.alloc(46);
        cen.writeUInt32LE(0x02014b50, 0);        // central dir signature
        cen.writeUInt16LE(20, 4);                // version made by
        cen.writeUInt16LE(20, 6);                // version needed
        cen.writeUInt16LE(0, 8);
        cen.writeUInt16LE(8, 10);                // method deflate
        cen.writeUInt16LE(0, 12);
        cen.writeUInt16LE(0x5180, 14);
        cen.writeUInt32LE(crc, 16);
        cen.writeUInt32LE(comp.length, 20);
        cen.writeUInt32LE(data.length, 24);
        cen.writeUInt16LE(nameBuf.length, 28);
        cen.writeUInt16LE(0, 30);                // extra
        cen.writeUInt16LE(0, 32);                // comment
        cen.writeUInt16LE(0, 34);                // disk
        cen.writeUInt16LE(0, 36);                // internal attrs
        cen.writeUInt32LE(0, 38);                // external attrs
        cen.writeUInt32LE(offset, 42);           // local header offset

        central.push(Buffer.concat([cen, nameBuf]));
        offset += local.length + nameBuf.length + comp.length;
    });

    const centralBuf = Buffer.concat(central);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);            // end of central dir
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralBuf.length, 12);
    end.writeUInt32LE(offset, 16);
    end.writeUInt16LE(0, 20);

    return Buffer.concat([...chunks, centralBuf, end]);
}

/* --- XML helpers --- */

const esc = v => String(v == null ? "" : v)
    .replace(/[<>&"']/g, c =>
        ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]));

function colName(i) {
    let s = "";
    i += 1;
    while (i > 0) {
        const m = (i - 1) % 26;
        s = String.fromCharCode(65 + m) + s;
        i = Math.floor((i - 1) / 26);
    }
    return s;
}

function sheetXml(cols, rows) {
    const lastCol = colName(cols.length - 1);
    const lastRow = rows.length + 1;
    let out =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<dimension ref="A1:' + lastCol + lastRow + '"/>' +
        '<sheetViews><sheetView workbookViewId="0"/></sheetViews>' +
        '<sheetFormatPr defaultRowHeight="15"/>' +
        '<sheetData>';

    out += '<row r="1">' + cols.map((c, i) =>
        '<c r="' + colName(i) + '1" t="inlineStr"><is><t>' + esc(c) + '</t></is></c>'
    ).join("") + '</row>';

    rows.forEach((r, ri) => {
        out += '<row r="' + (ri + 2) + '">' + cols.map((c, ci) =>
            '<c r="' + colName(ci) + (ri + 2) + '" t="inlineStr"><is><t>' + esc(r[c]) + '</t></is></c>'
        ).join("") + '</row>';
    });

    out += '</sheetData></worksheet>';
    return out;
}

/* --- main builder: sheets = [{ name, rows, cols }] --- */

function buildXlsx(sheets) {
    const contentTypes =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        sheets.map((s, i) =>
            '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
        ).join("") +
        '</Types>';

    const rels =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>';

    const workbook =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        '<sheets>' +
        sheets.map((s, i) =>
            '<sheet name="' + esc(s.name) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'
        ).join("") +
        '</sheets></workbook>';

    const workbookRels =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        sheets.map((s, i) =>
            '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>'
        ).join("") +
        '</Relationships>';

    const styles =
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>' +
        '<borders count="1"><border/></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs>' +
        '</styleSheet>';

    const entries = [
        { name: "[Content_Types].xml", data: Buffer.from(contentTypes, "utf8") },
        { name: "_rels/.rels", data: Buffer.from(rels, "utf8") },
        { name: "xl/workbook.xml", data: Buffer.from(workbook, "utf8") },
        { name: "xl/_rels/workbook.xml.rels", data: Buffer.from(workbookRels, "utf8") },
        { name: "xl/styles.xml", data: Buffer.from(styles, "utf8") }
    ];
    sheets.forEach((s, i) => {
        entries.push({
            name: "xl/worksheets/sheet" + (i + 1) + ".xml",
            data: Buffer.from(sheetXml(s.cols, s.rows), "utf8")
        });
    });

    return buildZip(entries);
}

module.exports = { buildXlsx };
