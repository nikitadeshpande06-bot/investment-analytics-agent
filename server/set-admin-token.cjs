/* Generates and stores a strong ADMIN_TOKEN in .env (never printed).
 * Safe to re-run: it only sets ADMIN_TOKEN if absent. */
const crypto = require("crypto");
const fs = require("fs");

const envPath = ".env";
let s = fs.readFileSync(envPath, "utf8");

if (!/^ADMIN_TOKEN=/m.test(s)) {
    const tok = crypto.randomBytes(32).toString("hex");
    s = s.replace(/\n*$/, "\n") + "ADMIN_TOKEN=" + tok + "\n";
    fs.writeFileSync(envPath, s);
    console.log("ADMIN_TOKEN set in .env (value hidden).");
} else {
    console.log("ADMIN_TOKEN already present in .env (value hidden).");
}
