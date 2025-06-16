import firebaseInit from "./init.js";
import conference from "./conf.js";

void (async () => {
  const outputDir = "./out/ht";
  const htConf = "DEFCON33";

  (async () => {
    try {
      const fbDb = await firebaseInit();
      await conference(fbDb, htConf, outputDir);
    } catch (err) {
      console.error("🚨 Export failed:", err);
      process.exit(1);
    }
  })();
})();
