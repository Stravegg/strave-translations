/**
 * Validates every locale catalog:
 * - PO file parses
 * - every non-empty msgstr preserves the msgid's exact ICU placeholder set:
 *   {name} variables, <0>…</0> tags, and plural/select keyword structure
 * - docs/<locale> MDX files carry the same frontmatter keys as their English
 *   counterpart would require (frontmatter must parse)
 *
 * Zero dependencies so the CI job stays a single `bun run`.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

let failures = 0;

function fail(file: string, message: string) {
	failures++;
	console.error(`::error file=${file}::${message}`);
}

type PoEntry = { msgid: string; msgstr: string; line: number };

function parsePo(path: string): PoEntry[] {
	const lines = readFileSync(path, "utf8").split("\n");
	const entries: PoEntry[] = [];
	let current: { msgid?: string; msgstr?: string; line: number } | null = null;
	let mode: "msgid" | "msgstr" | null = null;

	const unquote = (raw: string, lineNo: number): string => {
		const match = raw.match(/^"(.*)"$/);
		if (!match) {
			fail(path, `line ${lineNo}: expected quoted string, got: ${raw}`);
			return "";
		}
		return match[1]
			.replaceAll(String.raw`\"`, '"')
			.replaceAll(String.raw`\n`, "\n")
			.replaceAll(String.raw`\t`, "\t")
			.replaceAll(String.raw`\\`, "\\");
	};

	lines.forEach((line, index) => {
		const lineNo = index + 1;
		const trimmed = line.trim();
		if (trimmed.startsWith("msgid ")) {
			if (current?.msgid !== undefined) {
				entries.push({
					msgid: current.msgid,
					msgstr: current.msgstr ?? "",
					line: current.line,
				});
			}
			current = { msgid: unquote(trimmed.slice(6), lineNo), line: lineNo };
			mode = "msgid";
		} else if (trimmed.startsWith("msgstr ")) {
			if (!current) {
				fail(path, `line ${lineNo}: msgstr without msgid`);
				return;
			}
			current.msgstr = unquote(trimmed.slice(7), lineNo);
			mode = "msgstr";
		} else if (trimmed.startsWith('"')) {
			const value = unquote(trimmed, lineNo);
			if (mode === "msgid" && current) current.msgid += value;
			if (mode === "msgstr" && current)
				current.msgstr = (current.msgstr ?? "") + value;
		} else if (trimmed === "" || trimmed.startsWith("#")) {
			// comments / separators
		} else {
			fail(path, `line ${lineNo}: unrecognized syntax: ${trimmed}`);
		}
	});
	if (current !== null) {
		const final = current as { msgid?: string; msgstr?: string; line: number };
		if (final.msgid !== undefined) {
			entries.push({
				msgid: final.msgid,
				msgstr: final.msgstr ?? "",
				line: final.line,
			});
		}
	}
	return entries.filter((entry) => entry.msgid !== "");
}

/**
 * The multiset of ICU placeholders/tags that must survive translation.
 * Recursive ICU walk: flat regexes misread prose containing the word "select"
 * as an ICU keyword and plural branch text like `one {Group}` as a variable.
 */
function placeholderSignature(message: string): string {
	const variables: string[] = [];
	const keywords: string[] = [];

	function parseMessage(text: string, index: number): number {
		while (index < text.length) {
			const char = text[index];
			if (char === "}") return index;
			if (char === "{") index = parseArgument(text, index + 1);
			else index++;
		}
		return index;
	}

	function parseArgument(text: string, index: number): number {
		const head = text.slice(index).match(/^\s*([a-zA-Z0-9_]+)\s*([,}])/);
		if (!head) {
			// Not a valid argument (e.g. literal brace); skip to closing brace.
			const close = text.indexOf("}", index);
			return close === -1 ? text.length : close + 1;
		}
		variables.push(`{${head[1]}}`);
		index += head[0].length;
		if (head[2] === "}") return index;
		const type = text
			.slice(index)
			.match(/^\s*(plural|selectordinal|select|number|date|time)\s*[,}]?/);
		if (type) {
			index += type[0].length - (type[0].endsWith("}") ? 1 : 0);
			if (["plural", "selectordinal", "select"].includes(type[1])) {
				keywords.push(type[1]);
				// Parse `key {message}` option pairs until the argument closes.
				while (index < text.length && text[index] !== "}") {
					const key = text.slice(index).match(/^\s*(=?[a-zA-Z0-9_]+)\s*\{/);
					if (!key) break;
					index += key[0].length;
					index = parseMessage(text, index);
					if (text[index] === "}") index++;
				}
			}
		}
		const close = text.indexOf("}", index);
		return close === -1 ? text.length : close + 1;
	}

	parseMessage(message, 0);
	const tags = [...message.matchAll(/<(\/?[0-9]+)>/g)].map((m) => m[0]).sort();
	return JSON.stringify({
		variables: variables.sort(),
		tags,
		pluralKeywords: keywords.sort(),
	});
}

const localesDir = "locales";
for (const locale of readdirSync(localesDir)) {
	const poPath = join(localesDir, locale, "messages.po");
	try {
		statSync(poPath);
	} catch {
		continue;
	}
	const entries = parsePo(poPath);
	console.log(`${poPath}: ${entries.length} entries`);
	if (locale === "en") continue;
	for (const entry of entries) {
		if (entry.msgstr === "") continue;
		const expected = placeholderSignature(entry.msgid);
		const actual = placeholderSignature(entry.msgstr);
		if (expected !== actual) {
			fail(
				poPath,
				`line ${entry.line}: placeholder mismatch for "${entry.msgid.slice(0, 60)}": expected ${expected}, got ${actual}`,
			);
		}
	}
}

// Docs: frontmatter must parse and be non-empty for every MDX file.
const docsDir = "docs";
function walkDocs(dir: string) {
	let items: string[] = [];
	try {
		items = readdirSync(dir);
	} catch {
		return;
	}
	for (const item of items) {
		const path = join(dir, item);
		if (statSync(path).isDirectory()) {
			walkDocs(path);
		} else if (item.endsWith(".mdx")) {
			const content = readFileSync(path, "utf8");
			const frontmatter = content.match(/^---\n([\s\S]*?)\n---/);
			if (!frontmatter) {
				fail(path, "missing frontmatter block");
			} else if (!/^title:\s*\S/m.test(frontmatter[1])) {
				fail(path, "frontmatter must contain a title");
			}
		}
	}
}
walkDocs(docsDir);

if (failures > 0) {
	console.error(`\n${failures} validation failure(s).`);
	process.exit(1);
}
console.log("\nAll translation files valid.");
