import firebaseInit from "./init.js";
import conference from "./conf.js";

void (async () => {
  const outputDir = "./out/ht";

  (async () => {
    try {
      const fbDb = await firebaseInit();
      await conference(fbDb, outputDir);
    } catch (err) {
      console.error("🚨 Export failed:", err);
    }
  })();
})();
