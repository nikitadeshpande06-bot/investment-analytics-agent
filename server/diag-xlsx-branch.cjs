/* Diagnose: where is the xlsx branch in server.js, and why doesn't the
 * running server use it? Dump the region around each occurrence. */
const fs = require("fs");
const s = fs.readFileSync("server.js", "utf8");
console.log("total chars:", s.length);
console.log("has buildXlsx require:", s.includes('require("./xlsx-export")'));
console.log("has mso-application:", s.includes("mso-application"));

const needle = 'format === "';
let i = -1;
while ((i = s.indexOf(needle, i + 1)) !== -1) {
    console.log("--- occurrence at", i, "---");
    console.log(JSON.stringify(s.slice(i, i + 200)));
}

/* count 'if (format' occurrences */
let j = -1, count = 0;
while ((j = s.indexOf("if (format", j + 1)) !== -1) count++;
console.log("if (format occurrences:", count);
