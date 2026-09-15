#!/usr/bin/env node
/**
 * Re-opens the setup wizard.
 *
 * Removes the lock file only. The database, the .env file and any data in them
 * are left exactly as they are — setup will refuse to install over a database
 * that already has user accounts, so re-running it against the same database
 * is safe but will not get far. To start genuinely fresh, drop the database
 * (or point setup at a new one) after running this.
 */
import { rmSync, existsSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const targets = [".setup-complete.json", ".setup-key"];

let removed = 0;
for (const name of targets) {
  const file = path.join(root, name);
  if (existsSync(file)) {
    rmSync(file, { force: true });
    console.log(`Removed ${name}`);
    removed += 1;
  }
}

if (removed === 0) {
  console.log("Nothing to remove — setup is already open.");
} else {
  console.log("\nRestart the server; it will print a new setup key and serve /setup.");
}
