import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readSquadWikiPages, writePage, deletePage } from "./fs.js";

describe("readSquadWikiPages", () => {
  it("returns empty array for non-existent squad", () => {
    const pages = readSquadWikiPages("nonexistent-squad-xyz");
    assert.ok(Array.isArray(pages));
    assert.equal(pages.length, 0);
  });

  it("returns pages under pages/squads/{slug}/ prefix", () => {
    const testSlug = `test-squad-${Date.now()}`;
    const pagePath = `pages/squads/${testSlug}/workflow.md`;

    try {
      writePage(pagePath, "# Workflow Rules\nAlways use feature branches.");
      const pages = readSquadWikiPages(testSlug);
      assert.equal(pages.length, 1);
      assert.equal(pages[0].path, pagePath);
      assert.ok(pages[0].content.includes("feature branches"));
    } finally {
      deletePage(pagePath);
    }
  });

  it("filters out empty pages", () => {
    const testSlug = `test-squad-empty-${Date.now()}`;
    const pagePath = `pages/squads/${testSlug}/empty.md`;

    try {
      writePage(pagePath, "");
      const pages = readSquadWikiPages(testSlug);
      assert.equal(pages.length, 0);
    } finally {
      deletePage(pagePath);
    }
  });

  it("returns multiple pages for a squad", () => {
    const testSlug = `test-squad-multi-${Date.now()}`;
    const page1 = `pages/squads/${testSlug}/workflow.md`;
    const page2 = `pages/squads/${testSlug}/coding-standards.md`;

    try {
      writePage(page1, "# Workflow\nUse PRs.");
      writePage(page2, "# Standards\nESLint required.");
      const pages = readSquadWikiPages(testSlug);
      assert.equal(pages.length, 2);
      const paths = pages.map(p => p.path).sort();
      assert.deepEqual(paths, [page2, page1].sort());
    } finally {
      deletePage(page1);
      deletePage(page2);
    }
  });
});
