import firebaseInit from "./init.js";
import { getConferences } from "./fb.js";
import fs from "fs";
import conference from "./conf.js";

void (async () => {
  const fbDb = await firebaseInit();
  const outputDir = "./out/defcon";
  const htConf = "DEFCON33";

  await conference(fbDb, htConf, outputDir);
})();
