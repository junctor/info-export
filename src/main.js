import firebaseInit from "./init.js";
import conference from "./conf.js";

void (async () => {
  const args = process.argv.slice(2);
  const confCode = args[0];

  if (!confCode) {
    console.error("🚨 Please provide a conference code as the first argument.");
    process.exit(1);
  }

  const outputDir = `./out/ht/${confCode.toLowerCase()}`;

  (async () => {
    try {
      const fbDb = await firebaseInit();
      await conference(fbDb, outputDir, confCode);
    } catch (err) {
      console.error("🚨 Export failed:", err);
    }
  })();
})();
