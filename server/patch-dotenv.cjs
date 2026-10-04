/* One-time patch: add require("dotenv").config() to server.js if absent. */
const fs = require("fs");
let s = fs.readFileSync("server.js", "utf8");
if (!s.includes("dotenv")) {
    s = s.replace(
        'const fs = require("fs");',
        'const fs = require("fs");\nrequire("dotenv").config();'
    );
    fs.writeFileSync("server.js", s);
    console.log("PATCHED: dotenv added to server.js");
} else {
    console.log("already has dotenv");
}
