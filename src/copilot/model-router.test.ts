import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { classifyComplexity } from "./model-router.js";

describe("classifyComplexity", () => {
  describe("high complexity", () => {
    it("returns high when multiple high keywords are present", () => {
      assert.equal(classifyComplexity("Refactor and redesign the auth module"), "high");
    });

    it("returns high with architect + security keywords", () => {
      assert.equal(classifyComplexity("Architect a security overhaul"), "high");
    });

    it("returns high with debug + investigate", () => {
      assert.equal(classifyComplexity("Investigate and debug the memory leak"), "high");
    });

    it("returns high for performance + optimize", () => {
      assert.equal(classifyComplexity("Optimize performance of the query engine"), "high");
    });
  });

  describe("low complexity", () => {
    it("returns low when multiple low keywords are present", () => {
      assert.equal(classifyComplexity("Read the file and check status"), "low");
    });

    it("returns low for simple rename task", () => {
      assert.equal(classifyComplexity("Simple rename of the variable"), "low");
    });

    it("returns low for list + format", () => {
      assert.equal(classifyComplexity("List all entries and format them"), "low");
    });

    it("returns low for delete file + remove file", () => {
      assert.equal(classifyComplexity("Delete file foo.txt and remove file bar.txt"), "low");
    });
  });

  describe("medium complexity", () => {
    it("returns medium for ambiguous description with no keywords", () => {
      assert.equal(classifyComplexity("Update the user profile page"), "medium");
    });

    it("returns medium for empty string", () => {
      assert.equal(classifyComplexity(""), "medium");
    });

    it("returns medium when one high and one low keyword tie", () => {
      // highScore=1, lowScore=1 — both weak, neither wins, falls to default
      assert.equal(classifyComplexity("Debug and check the output"), "medium");
    });
  });

  describe("weak signal tiebreaker", () => {
    it("returns high when single high keyword beats zero low keywords", () => {
      assert.equal(classifyComplexity("Refactor the utils module"), "high");
    });

    it("returns low when single low keyword beats zero high keywords", () => {
      assert.equal(classifyComplexity("Check the build output"), "low");
    });
  });

  describe("case insensitivity", () => {
    it("matches keywords regardless of case", () => {
      assert.equal(classifyComplexity("REFACTOR and REDESIGN everything"), "high");
    });

    it("matches low keywords in mixed case", () => {
      assert.equal(classifyComplexity("FORMAT the List of entries"), "low");
    });
  });

  describe("multi-word keywords", () => {
    it("matches 'delete file' as a single keyword", () => {
      assert.equal(classifyComplexity("Please delete file and copy file"), "low");
    });

    it("does not match partial multi-word keywords", () => {
      // "delete" alone is not a keyword, only "delete file" is
      assert.equal(classifyComplexity("Delete the branch"), "medium");
    });
  });
});
