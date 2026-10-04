/* Verify the .xlsx export is a genuine ZIP/OOXML workbook. */
const fs = require("fs");
const zlib = require("zlib");

/* --- minimal ZIP reader (inflate + CRC verify + central dir parse) --- */
function readZip(buf) {
    const files = {};
    let i = buf.length - 22;
    while (i >= 0 && buf.readUInt32LE(i) !== 0x06054b50) i--;
    if (i < 0) throw new Error("EOCD not found — not a ZIP");
    const count = buf.readUInt16LE(i + 10);
    let off = buf.readUInt32LE(i + 16);

    for (let n = 0; n < count; n++) {
        if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error("bad central header at " + off);
        const method = buf.readUInt16LE(off + 10);
        const compSize = buf.readUInt32LE(off + 20);
        const nameLen = buf.readUInt16LE(off + 28);
        const extraLen = buf.readUInt16LE(off + 30);
        const cmtLen = buf.readUInt16LE(off + 32);
        const localOff = buf.readUInt32LE(off + 42);
        const name = buf.toString("utf8", off + 46, off + 46 + nameLen);

        const lo = localOff;
        if (buf.readUInt32LE(lo) !== 0x04034b50) throw new Error("bad local header for " + name);
        const lNameLen = buf.readUInt16LE(lo + 26);
        const lExtraLen = buf.readUInt16LE(lo + 28);
        const dataStart = lo + 30 + lNameLen + lExtraLen;
        const raw = buf.slice(dataStart, dataStart + compSize);
        const data = method === 8 ? zlib.inflateRawSync(raw) : raw;

        /* CRC verification */
        let c = 0xffffffff;
        for (let k = 0; k < data.length; k++) {
            c = (c >>> 8) ^ crcTableRef[(c ^ data[k]) & 0xff];
        }
        c = (c ^ 0xffffffff) >>> 0;
        const stored = buf.readUInt32LE(lo + 14);
        if (c !== stored) throw new Error("CRC mismatch for " + name);

        files[name] = data;
        off += 46 + nameLen + extraLen + cmtLen;
    }
    return files;
}
const crcTableRef = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();

/* --- checks --- */
const buf = fs.readFileSync("export-test.xlsx");
const results = [];
const record = (name, ok, detail) => results.push({ name, ok, detail: detail || "" });

try {
    record("xlsx: ZIP magic (PK\\x03\\x04)", buf.readUInt32LE(0) === 0x04034b50, buf.slice(0, 4).toString("hex"));
    const parts = readZip(buf);
    record("xlsx: ZIP parses, all CRCs OK", true, Object.keys(parts).join(", "));

    record("xlsx: [Content_Types].xml present", !!parts["[Content_Types].xml"]);
    record("xlsx: _rels/.rels present", !!parts["_rels/.rels"]);
    record("xlsx: xl/workbook.xml present", !!parts["xl/workbook.xml"]);
    record("xlsx: xl/styles.xml present", !!parts["xl/styles.xml"]);

    const ct = (parts["[Content_Types].xml"] || Buffer.alloc(0)).toString("utf8");
    record("xlsx: content type = spreadsheetml.sheet", ct.includes("spreadsheetml.sheet.main+xml"));

    const wb = (parts["xl/workbook.xml"] || Buffer.alloc(0)).toString("utf8");
    record("xlsx: workbook declares Users + Activities sheets", wb.includes('name="Users"') && wb.includes('name="Activities"'), wb.slice(0, 120));

    const s1 = (parts["xl/worksheets/sheet1.xml"] || Buffer.alloc(0)).toString("utf8");
    const s2 = (parts["xl/worksheets/sheet2.xml"] || Buffer.alloc(0)).toString("utf8");
    record("xlsx: sheet1 (Users) has data", s1.includes("email") && s1.includes("inlineStr"), "sheet1 length=" + s1.length);
    record("xlsx: sheet2 (Activities) has data", s2.includes("activity"), "sheet2 length=" + s2.length);

    const verifyEmail = fs.readFileSync("e2e-verify-email.txt", "utf8").trim();
    record("xlsx: Users sheet contains verify user", s1.includes(verifyEmail));
    record("xlsx: Activities sheet contains verify user", s2.includes(verifyEmail));

    /* each worksheet XML must be well-formed enough to parse */
    [[ "sheet1", s1 ], [ "sheet2", s2 ]].forEach(([n, x]) => {
        record("xlsx: " + n + " worksheet XML balanced", x.startsWith("<?xml") && x.trim().endsWith("</worksheet>"));
    });
} catch (e) {
    record("xlsx: ZIP parse FAILED", false, e.message);
}

console.log(JSON.stringify({ size: buf.length, results }, null, 2));
const failed = results.filter(r => !r.ok);
console.log(failed.length ? (failed.length + " FAILED") : "ALL PASS");
process.exit(failed.length ? 1 : 0);
