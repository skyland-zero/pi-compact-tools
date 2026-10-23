import assert from "node:assert/strict";
import test from "node:test";
import { stripTerminalSequences, visibleWidth } from "@earendil-works/pi-tui";
import { loadExtension, makeRow, shutdown, text } from "./indicator-harness.ts";

// opencode is compact with the status dot replaced by the tool's own glyph: the
// same one-line call, summary, rails, and completion line.
const plain = (lines: string[]) => lines.map(stripTerminalSequences).filter((line) => line.trim());

test("opencode draws compact rows with a tool glyph", async () => {
	const harness = await loadExtension({ style: "opencode" }, { tui: true, idle: true });
	try {
		const read = makeRow("read", "oc-read", { path: "src/app.ts" }, harness.definitions.get("read"));
		read.updateResult({ ...text("line 1\nline 2"), isError: false } as never);
		assert.deepEqual(plain(read.render(100)), [" → read src/app.ts", " └ Done (2 lines)"], "a settled call keeps compact's quiet completion line");
		read.setExpanded(true);
		assert.deepEqual(plain(read.render(100)), [" → read src/app.ts", " │  1 line 1", " │  2 line 2", " └ Done (2 lines)"]);
		for (const width of [12, 20, 44, 100]) {
			assert.ok(read.render(width).every((line) => visibleWidth(line) <= width), `width ${width}`);
		}
	} finally {
		shutdown(harness);
	}
});

test("opencode writes a search, a command, and a custom call the compact way", async () => {
	const harness = await loadExtension({ style: "opencode" }, { tui: true, idle: true });
	try {
		const grep = makeRow("grep", "oc-grep", { pattern: "tgrep", path: "src" }, harness.definitions.get("grep"));
		grep.updateResult({ ...text("src/a.ts:1: hit"), isError: false } as never);
		assert.deepEqual(plain(grep.render(100)), [" ✱ grep /tgrep/ in src", " └ Done (1 line)"], "a search keeps compact's pattern form");

		const bash = makeRow("bash", "oc-bash", { command: "npm test -- --watch=false" }, harness.definitions.get("bash"));
		bash.updateResult({ ...text("out 1"), isError: false } as never);
		assert.deepEqual(plain(bash.render(100)), [" $ bash Run tests", " └ Done (1 line)"]);

		const custom = makeRow("demo_search", "oc-custom", { query: "keyboard" }, harness.definitions.get("demo_search"));
		custom.updateResult({ ...text("a"), isError: false } as never);
		const row = plain(custom.render(100));
		assert.deepEqual(row, [" ◈ demo_search keyboard", " └ Done (1 line)"]);
	} finally {
		shutdown(harness);
	}
});

test("opencode collapses a long command like compact and expands it whole", async () => {
	const harness = await loadExtension({ style: "opencode" }, { tui: true, idle: true });
	try {
		const command = Array.from({ length: 200 }, (_, index) => `echo line ${index}`).join("\n");
		const bash = makeRow("bash", "oc-long", { command }, harness.definitions.get("bash"));
		bash.updateResult({ ...text("done"), isError: false } as never);
		const closed = plain(bash.render(100));
		assert.equal(closed.length, 2, `a collapsed row stays two lines: ${closed.join(" | ")}`);
		assert.match(closed[0]!, /^ \$ bash /u);
		assert.doesNotMatch(closed[0]!, /echo line 199/u, "the collapsed row is a summary, not the command");

		bash.setExpanded(true);
		const expanded = plain(bash.render(100));
		assert.ok(expanded.some((line) => line.includes("echo line 199")), "expanded shows the whole command");
		assert.ok(expanded.length > 100, "expanded rows carry every command line");
	} finally {
		shutdown(harness);
	}
});

test("opencode gives PowerShell its own one-column prompt glyph", async () => {
	const harness = await loadExtension({ style: "opencode" }, { tui: true, idle: true });
	try {
		const pwsh = makeRow("powershell", "oc-pwsh", { command: "Get-ChildItem -Recurse" }, harness.definitions.get("powershell"));
		pwsh.updateResult({ ...text("match 1"), isError: false } as never);
		assert.deepEqual(plain(pwsh.render(100)), [" ❯ powershell List files", " └ Done (1 line)"]);

		// The glyph is one column wide, so a pwsh label starts where a bash label does.
		const bash = makeRow("bash", "oc-bash-align", { command: "npm test" }, harness.definitions.get("bash"));
		bash.updateResult({ ...text("ok"), isError: false } as never);
		assert.equal(plain(pwsh.render(100))[0]!.indexOf("powershell"), plain(bash.render(100))[0]!.indexOf("bash"));
	} finally {
		shutdown(harness);
	}
});

test("opencode keeps compact's failure reason and success count", async () => {
	const harness = await loadExtension({ style: "opencode" }, { tui: true, idle: true });
	try {
		const failed = makeRow("bash", "oc-failed", { command: "npm run build" }, harness.definitions.get("bash"));
		failed.updateResult({ ...text("npm ERR! missing script\n\nCommand exited with code 1"), isError: true } as never);
		assert.deepEqual(plain(failed.render(100)), [" $ bash Run build task", " └ Failed · Command exited with code 1"]);

		const read = makeRow("read", "oc-read-ok", { path: "src/app.ts" }, harness.definitions.get("read"));
		read.updateResult({ ...text("line 1"), isError: false } as never);
		assert.deepEqual(plain(read.render(100)), [" → read src/app.ts", " └ Done (1 line)"], "a success counts what it returned");
	} finally {
		shutdown(harness);
	}
});
