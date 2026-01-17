import assert from 'assert';

console.log("Starting verification of prerequisite filtering logic...");

// Mock data setup
const allTopicStatusMap = new Map<string, string>();
allTopicStatusMap.set("topic-1", "not_started");
allTopicStatusMap.set("topic-2", "done");
allTopicStatusMap.set("topic-3", "in_progress");

// Topic under test with prerequisites
const topic = {
  id: "topic-A",
  prerequisite_ids: ["topic-1", "topic-2", "topic-3", "topic-missing"],
};

console.log("Mock Status Map:", Object.fromEntries(allTopicStatusMap));
console.log("Topic Prerequisites:", topic.prerequisite_ids);

// The logic to verify (copied from generate-smart-plan/index.ts)
// P0 FIX: Filter out prerequisites that are already done (satisfied)
const rawPrereqs = topic.prerequisite_ids || [];
const pendingPrereqs = rawPrereqs.filter(prereqId =>
  allTopicStatusMap.get(prereqId) !== 'done'
);

console.log("Pending Prerequisites (Result):", pendingPrereqs);

// Assertions
try {
  assert.strictEqual(pendingPrereqs.includes("topic-1"), true, "topic-1 should be included (not_started)");
  assert.strictEqual(pendingPrereqs.includes("topic-2"), false, "topic-2 should be filtered out (done)");
  assert.strictEqual(pendingPrereqs.includes("topic-3"), true, "topic-3 should be included (in_progress)");
  assert.strictEqual(pendingPrereqs.includes("topic-missing"), true, "topic-missing should be included (unknown status assumed pending)");
  assert.strictEqual(pendingPrereqs.length, 3, "Should have exactly 3 pending prerequisites");

  console.log("SUCCESS: All verification checks passed!");
} catch (error) {
  console.error("FAILURE: Verification failed", error);
  process.exit(1);
}
