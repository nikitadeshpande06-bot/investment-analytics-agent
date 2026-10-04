/* Test /api/admin/summary + exports (xlsx and csv), saving files. */
const fs = require("fs");
const BASE = "http://localhost:4000";
const TOKEN = "investai-admin";
const results = [];
const record = (name, ok, detail) => results.push({ name, ok, detail: detail || "" });

/* --- minimal ZIP reader (inflate + CRC verify) --- */
const zlib = require("zlib");
const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c >>> 0;
    }
    return t;
})();
function readZip(buf) {
    const files = {};
    let i = buf.length - 22;
    while (i >= 0 && buf.readUInt32LE(i) !== 0x06054b50) i--;
    if (i < 0) throw new Error("EOCD not found - not a ZIP");
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
        let c = 0xffffffff;
        for (let k = 0; k < data.length; k++) c = (c >>> 8) ^ crcTable[(c ^ data[k]) & 0xff];
        c = (c ^ 0xffffffff) >>> 0;
        if (c !== buf.readUInt32LE(lo + 14)) throw new Error("CRC mismatch for " + name);
        files[name] = data;
        off += 46 + nameLen + extraLen + cmtLen;
    }
    return files;
}

(async () => {
    /* summary */
    const s = await fetch(BASE + "/api/admin/summary?token=" + TOKEN);
    const sd = await s.json();
    record("summary: 200 + success", s.status === 200 && sd.success === true);
    record("summary: counts present", sd.counts && typeof sd.counts.users === "number" && typeof sd.counts.activities === "number", JSON.stringify(sd.counts || {}).slice(0, 80));
    const verifyEmail = fs.readFileSync("e2e-verify-email.txt", "utf8").trim();
    const verifyUser = sd.users.find(u => u.email === verifyEmail);
    record("summary: verify user appears", !!verifyUser, verifyUser ? verifyEmail : JSON.stringify(sd.users.map(u => u.email).slice(0, 5)));
    const verifyActs = sd.activities.filter(a => a.email === verifyEmail);
    record("summary: verify activities appear (3)", verifyActs.length === 3, "found " + verifyActs.length);

    /* xlsx export — genuine OOXML (ZIP of XML parts) */
    const x = await fetch(BASE + "/api/admin/export?token=" + TOKEN + "&format=xlsx");
    const xbuf = Buffer.from(await x.arrayBuffer());
    fs.writeFileSync("export-test.xlsx", xbuf);
    record("xlsx: 200 + OOXML content type", x.status === 200 && /spreadsheetml\.sheet/i.test(x.headers.get("content-type") || ""), x.headers.get("content-type"));
    record("xlsx: filename .xlsx", /\.xlsx/i.test(x.headers.get("content-disposition") || ""), x.headers.get("content-disposition"));
    record("xlsx: ZIP magic PK\\x03\\x04", xbuf.readUInt32LE(0) === 0x04034b50, xbuf.slice(0, 4).toString("hex"));

    /* parse the ZIP: verify OOXML parts + Users/Activities data */
    let zipOk = false, zipDetail = "";
    try {
        const parts = readZip(xbuf);
        zipOk = true;
        const wb = (parts["xl/workbook.xml"] || Buffer.alloc(0)).toString("utf8");
        const s1 = (parts["xl/worksheets/sheet1.xml"] || Buffer.alloc(0)).toString("utf8");
        const s2 = (parts["xl/worksheets/sheet2.xml"] || Buffer.alloc(0)).toString("utf8");
        record("xlsx: required OOXML parts present", !!parts["[Content_Types].xml"] && !!parts["_rels/.rels"] && !!parts["xl/workbook.xml"] && !!parts["xl/_rels/workbook.xml.rels"] && !!parts["xl/styles.xml"]);
        record("xlsx: workbook declares Users + Activities", wb.includes('name="Users"') && wb.includes('name="Activities"'));
        record("xlsx: Users sheet contains verify user", s1.includes(verifyEmail));
        record("xlsx: Activities sheet contains verify user", s2.includes(verifyEmail));
        zipDetail = Object.keys(parts).join(", ");
    } catch (e) {
        zipDetail = e.message;
    }
    record("xlsx: ZIP parses, all CRCs OK", zipOk, zipDetail);

    /* csv export */
    const c = await fetch(BASE + "/api/admin/export?token=" + TOKEN + "&format=csv");
    const ctext = await c.text();
    fs.writeFileSync("export-test.csv", ctext);
    record("csv: 200 + csv content type", c.status === 200 && /text\/csv/i.test(c.headers.get("content-type") || ""), c.headers.get("content-type"));
    record("csv: header row", ctext.startsWith("type,email,name,language,currency,session_id,activity,detail,created_at"));
    record("csv: verify user rows", ctext.split("\n").filter(l => l.includes(verifyEmail)).length >= 4, "rows with verify email: " + ctext.split("\n").filter(l => l.includes(verifyEmail)).length);
    record("csv: user + activity types present", ctext.includes('"user"') && ctext.includes('"activity"'));

    /* bad token */
    const b = await fetch(BASE + "/api/admin/summary?token=wrong");
    record("summary: bad token -> 401", b.status === 401);

    console.log(JSON.stringify({ results }, null, 2));
})().catch(e => { console.error("crash:", e); process.exit(1); });
