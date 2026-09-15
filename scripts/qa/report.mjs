/** Collects assertions and prints a grouped pass/fail report. */
export class Report {
  constructor() {
    this.rows = [];
    this.created = {};
  }

  /** Records one assertion. `detail` is shown only when it fails. */
  check(module, scenario, passed, detail = "") {
    this.rows.push({ module, scenario, passed: Boolean(passed), detail });
    return Boolean(passed);
  }

  /** Asserts an HTTP result matched one of the expected status codes. */
  status(module, scenario, result, expected, extra = "") {
    const list = Array.isArray(expected) ? expected : [expected];
    const passed = list.includes(result.status);
    return this.check(
      module,
      scenario,
      passed,
      `expected ${list.join("/")}, got ${result.status} — ${result.message ?? ""} ${extra}`.trim()
    );
  }

  /** Notes a row this run created and left in the database. */
  record(kind, value) {
    (this.created[kind] ??= []).push(value);
  }

  get failures() {
    return this.rows.filter((r) => !r.passed);
  }

  print() {
    const groups = [...new Set(this.rows.map((r) => r.module))];
    console.log("\n" + "=".repeat(78));
    console.log("RESULTS BY MODULE");
    console.log("=".repeat(78));

    for (const group of groups) {
      const rows = this.rows.filter((r) => r.module === group);
      const failed = rows.filter((r) => !r.passed);
      const mark = failed.length === 0 ? "PASS" : "FAIL";
      console.log(
        `  ${mark}  ${group.padEnd(30)} ${String(rows.length - failed.length).padStart(3)}/${String(rows.length).padEnd(3)} passed`
      );
      for (const row of failed) {
        console.log(`         ↳ ${row.scenario}\n           ${row.detail}`);
      }
    }

    console.log("=".repeat(78));
    const failed = this.failures.length;
    console.log(
      `  TOTAL: ${this.rows.length - failed}/${this.rows.length} checks passed` +
        (failed ? `  —  ${failed} FAILED` : "  —  all green")
    );
    console.log("=".repeat(78));

    const kinds = Object.keys(this.created);
    if (kinds.length) {
      console.log("\nDATA LEFT IN THE DATABASE");
      console.log("-".repeat(78));
      for (const kind of kinds) {
        console.log(`  ${kind.padEnd(28)} ${this.created[kind].length}`);
      }
    }
    return failed === 0;
  }
}
