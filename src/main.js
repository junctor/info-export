import firebaseInit from "./init.js";
import conference from "./conf.js";

void (async () => {
  const fbDb = await firebaseInit();
  const outputDir = "./out/ht";
  const htConf = "DEFCON33";

  await conference(fbDb, htConf, outputDir);
})();
