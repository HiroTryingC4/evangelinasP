const fs = require("fs");
const path = require("path");

const nextDir = path.join(process.cwd(), ".next");

try {
  if (fs.existsSync(nextDir)) {
    fs.rmSync(nextDir, { recursive: true, force: true });
    console.log("[predev] Cleared stale .next cache");
  } else {
    console.log("[predev] No .next cache to clear");
  }
} catch (error) {
  console.warn("[predev] Failed to clear .next cache:", error?.message || error);
}
