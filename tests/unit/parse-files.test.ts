import { describe, expect, it } from "vitest";
import { appTitle, applyFiles, cleanFiles, hasApp, mergeFiles, parseAiOutput } from "../../src/lib/parse-files";

describe("parseAiOutput", () => {
  it("splits text, files, and suggestions", () => {
    const raw = `I built it.
<file name="index.html">
<!doctype html><title>Water Saver</title><h1>Hi</h1>
</file>
<file name="style.css">
body { color: green; }
</file>
<suggestions>
Add a chart
- Change colors
</suggestions>`;
    const out = parseAiOutput(raw);
    expect(out.text).toBe("I built it.");
    expect(out.files.map((f) => [f.name, f.complete])).toEqual([
      ["index.html", true],
      ["style.css", true],
    ]);
    expect(out.files[1].content).toBe("body { color: green; }\n");
    expect(out.suggestions).toEqual(["Add a chart", "Change colors"]);
  });

  it("marks a file that is still streaming as incomplete and hides partial tags", () => {
    const out = parseAiOutput(`Working on it.\n<file name="script.js">\nlet a = 1;\nlet b = 2;</fi`);
    expect(out.text).toBe("Working on it.");
    expect(out.files).toHaveLength(1);
    expect(out.files[0].complete).toBe(false);
    expect(out.files[0].content).toContain("let b = 2;");
    expect(parseAiOutput("Hello <fil").text).toBe("Hello");
  });

  it("ignores files that are not part of the app", () => {
    const out = parseAiOutput(`<file name="../../etc/passwd">x</file><file name="server.js">y</file>`);
    expect(out.files).toHaveLength(0);
  });

  it("strips markdown fences the model put inside a file block", () => {
    const out = parseAiOutput('<file name="script.js">\n```js\nconsole.log(1);\n```\n</file>');
    expect(out.files[0].content).toBe("console.log(1);\n");
  });

  it("falls back to an html code block when the model forgets the file tags", () => {
    const out = parseAiOutput("Here you go\n```html\n<!doctype html><body>Hi</body>\n```\nEnjoy");
    expect(out.files[0].name).toBe("index.html");
    expect(out.files[0].complete).toBe(true);
    expect(out.text).toContain("Here you go");
  });

  it("answers plain chat without files", () => {
    const out = parseAiOutput("You could build a compost tracker.");
    expect(out.files).toHaveLength(0);
    expect(out.text).toBe("You could build a compost tracker.");
  });
});

describe("file helpers", () => {
  it("only applies complete files and reports what changed", () => {
    const current = { "index.html": "<h1>Old</h1>\n", "style.css": "a{}\n" };
    const { files, changed } = applyFiles(current, [
      { name: "index.html", content: "<h1>New</h1>\n", complete: true },
      { name: "style.css", content: "a{}\n", complete: true },
      { name: "script.js", content: "half", complete: false },
    ]);
    expect(changed).toEqual(["index.html"]);
    expect(files["index.html"]).toBe("<h1>New</h1>\n");
    expect(files["script.js"]).toBeUndefined();
  });

  it("knows when an app exists and reads its title", () => {
    expect(hasApp({})).toBe(false);
    expect(hasApp({ "index.html": "  " })).toBe(false);
    expect(hasApp({ "index.html": "<p>x</p>" })).toBe(true);
    expect(appTitle({ "index.html": "<title> Water Saver </title>" })).toBe("Water Saver");
  });

  it("rejects oversized saves and unknown file names", () => {
    expect(cleanFiles({ "index.html": "x".repeat(400_000) })).toBeNull();
    expect(cleanFiles({ "index.html": "ok", "evil.php": "no" })).toEqual({ "index.html": "ok" });
  });
});

describe("mergeFiles", () => {
  const base = { "index.html": "<h1>Hi</h1>", "style.css": "h1 { color: green; }", "script.js": "let n = 0;" };

  it("keeps both edits when teammates changed different files", () => {
    const mine = { ...base, "index.html": "<h1>Hi</h1><p>Ben</p>" };
    const theirs = { ...base, "style.css": "h1 { color: blue; }" };
    expect(mergeFiles(base, mine, theirs)).toEqual({ ...base, "index.html": mine["index.html"], "style.css": theirs["style.css"] });
  });

  it("gives up when both changed the same file in different ways", () => {
    const mine = { ...base, "index.html": "<h1>Mine</h1>" };
    const theirs = { ...base, "index.html": "<h1>Theirs</h1>" };
    expect(mergeFiles(base, mine, theirs)).toBeNull();
  });

  it("accepts the same change made on both sides, and files that are missing", () => {
    const same = { ...base, "script.js": "let n = 1;" };
    expect(mergeFiles(base, same, same)).toEqual(same);
    expect(mergeFiles({}, { "index.html": "<p>a</p>" }, { "style.css": "p {}" })).toEqual({ "index.html": "<p>a</p>", "style.css": "p {}" });
  });
});
