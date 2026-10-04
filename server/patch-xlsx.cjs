/* One-time patch: replace legacy SpreadsheetML xlsx export with genuine
 * OOXML .xlsx (see xlsx-export.js). Adds require + replaces the branch. */
const fs = require("fs");
let s = fs.readFileSync("server.js", "utf8");
let changed = [];

if (!s.includes('require("./xlsx-export")')) {
    s = s.replace(
        'const tracking = require("./tracking");',
        'const tracking = require("./tracking");\nconst { buildXlsx } = require("./xlsx-export");'
    );
    changed.push("require added");
}

const LEGACY_START = '                if (format === "xlsx") {';
const LEGACY_END = '                }\n\n                /* default: CSV */';
const i0 = s.indexOf(LEGACY_START);
const i1 = s.indexOf(LEGACY_END);
if (i0 !== -1 && i1 !== -1) {
    const replacement =
        '                if (format === "xlsx") {\n' +
        '                    /* Genuine OOXML .xlsx (ZIP of XML parts) - see xlsx-export.js */\n' +
        '                    const xlsx = buildXlsx([\n' +
        '                        { name: "Users", rows: users, cols: ["email", "name", "language", "currency", "created_at"] },\n' +
        '                        { name: "Activities", rows: activities, cols: ["email", "session_id", "activity", "detail", "created_at"] }\n' +
        '                    ]);\n\n' +
        '                    res.set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");\n' +
        '                    res.set("Content-Disposition", \'attachment; filename="investai-export.xlsx"\');\n' +
        '                    return res.send(xlsx);\n' +
        '                }\n\n                /* default: CSV */';
    s = s.slice(0, i0) + replacement + s.slice(i1 + LEGACY_END.length);
    changed.push("xlsx branch replaced");
}

if (changed.length) {
    fs.writeFileSync("server.js", s);
    console.log("PATCHED:", changed.join(", "));
} else {
    console.log("already patched");
}
console.log("verify: buildXlsx require =", s.includes('require("./xlsx-export")'));
console.log("verify: mso-application =", s.includes("mso-application"));
