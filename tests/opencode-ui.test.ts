import assert from "node:assert/strict";
import test from "node:test";
import { stripTerminalSequences, visibleWidth } from "@earendil-works/pi-tui";
import { loadExtension, makeRow, shutdown, text } from "./indicator-harness.ts";

// opencode's TUI draws a tool call as an indented glyph row: the verb and what it
// was given on one line, its result under the label, and nothing else once it ends.
const plain = (lines: string[]) => lines.map(stripTerminalSequences).filter((line) => line.trim());

test("opencode indents a glyph row and hangs the result under its label", async () => {
	const harness = await loadExtension({ style: "opencode" }, { tui: true, idle: true });
	try {
		const read = makeRow("read", "oc-read", { path: "src/app.ts" }, harness.definitions.get("read"));
		read.updateResult({ ...text("line 1\nline 2"), isError: false } as never);
		assert.deepEqual(plain(read.render(100)), ["   → Read src/app.ts"], "a settled call rests on its glyph");
		read.setExpanded(true);
		assert.deepEqual(plain(read.render(100)), ["   → Read src/app.ts", "      1 line 1", "      2 line 2"]);
		for (const width of [12, 20, 44, 100]) {
			assert.ok(read.render(width).every((line) => visibleWidth(line) <= width), `width ${width}`);
		}
	} finally {
		shutdown(harness);
	}
});

test("opencode writes a search, a command, and a custom call its own way", async () => {
	const harness = await loadExtension({ style: "opencode" }, { tui: true, idle: true });
	try {
		const grep = makeRow("grep", "oc-grep", { pattern: "tgrep", path: "src" }, harness.definitions.get("grep"));
		grep.updateResult({ ...text("src/a.ts:1: hit"), isError: false } as never);
		assert.deepEqual(plain(grep.render(100)), ["   ✱ Grep /tgrep/ in src"], "a search keeps compact's pattern form");

		const bash = makeRow("bash", "oc-bash", { command: "npm test -- --watch=false" }, harness.definitions.get("bash"));
		bash.updateResult({ ...text("out 1"), isError: false } as never);
		assert.deepEqual(plain(bash.render(100)), ["   $ npm test -- --watch=false"]);

		const custom = makeRow("demo_search", "oc-custom", { query: "keyboard" }, harness.definitions.get("demo_search"));
		custom.updateResult({ ...text("a"), isError: false } as never);
		const row = plain(custom.render(100));
		assert.equal(row.length, 1);
		assert.ok(row[0]!.startsWith("   ◈ demo_search "), `custom row: ${row[0]}`);
	} finally {
		shutdown(harness);
	}
});

test("opencode gives PowerShell its own one-column prompt glyph", async () => {
	const harness = await loadExtension({ style: "opencode" }, { tui: true, idle: true });
	try {
		const pwsh = makeRow("powershell", "oc-pwsh", { command: "Get-ChildItem -Recurse" }, harness.definitions.get("powershell"));
		pwsh.updateResult({ ...text("match 1"), isError: false } as never);
		assert.deepEqual(plain(pwsh.render(100)), ["   ❯ Get-ChildItem -Recurse"]);

		// The glyph is one column wide, so a pwsh label starts where a bash label does.
		const bash = makeRow("bash", "oc-bash-align", { command: "npm test" }, harness.definitions.get("bash"));
		bash.updateResult({ ...text("ok"), isError: false } as never);
		assert.equal(plain(pwsh.render(100))[0]!.indexOf("Get-ChildItem"), plain(bash.render(100))[0]!.indexOf("npm test"));
	} finally {
		shutdown(harness);
	}
});

test("opencode keeps a failure reason under the row and nothing under a success", async () => {
	const harness = await loadExtension({ style: "opencode" }, { tui: true, idle: true });
	try {
		const failed = makeRow("bash", "oc-failed", { command: "npm run build" }, harness.definitions.get("bash"));
		failed.updateResult({ ...text("npm ERR! missing script\n\nCommand exited with code 1"), isError: true } as never);
		assert.deepEqual(plain(failed.render(100)), ["   $ npm run build", "     Failed · Command exited with code 1"]);

		const read = makeRow("read", "oc-read-ok", { path: "src/app.ts" }, harness.definitions.get("read"));
		read.updateResult({ ...text("line 1"), isError: false } as never);
		assert.equal(plain(read.render(100)).length, 1, "a success adds no completion line");
	} finally {
		shutdown(harness);
	}
});
