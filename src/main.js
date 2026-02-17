import firebaseInit from "./init.js";
import conference from "./conf.js";

function printHelp() {
  console.log(`Usage: npm run export -- [options] <conf>

Options:
  --conf, -c <slug>     Conference code (can also be positional)
  --out, -o <path>      Output root (default: ./out/ht)
  --emit-raw, -r        Emit raw Firestore snapshots
  --help, -h            Show help

Examples:
  npm run export -- DEFCON33
  npm run export -- --conf DEFCON33 --emit-raw
  npm run export -- -c DEFCON33 -o ./out/ht
`);
}

function readFlagValue(arg, prefix) {
  if (!arg.startsWith(`${prefix}=`)) return null;
  return arg.slice(prefix.length + 1);
}

void (async () => {
  const args = process.argv.slice(2);
  let confCode;
  let outputDir = "./out/ht";
  let emitRaw = false;

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    }
    if (arg === "--emit-raw" || arg === "-r") {
      emitRaw = true;
      continue;
    }
    const confValue = readFlagValue(arg, "--conf");
    const outValue = readFlagValue(arg, "--out");
    if (confValue != null) {
      confCode = confValue;
      continue;
    }
    if (outValue != null) {
      outputDir = outValue;
      continue;
    }
    if (arg === "--conf" || arg === "-c") {
      const next = args[i + 1];
      if (!next) {
        console.error("🚨 Missing value for --conf.");
        process.exit(1);
      }
      confCode = next;
      i += 1;
      continue;
    }
    if (arg === "--out" || arg === "-o") {
      const next = args[i + 1];
      if (!next) {
        console.error("🚨 Missing value for --out.");
        process.exit(1);
      }
      outputDir = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("-")) {
      console.error(`🚨 Unknown flag: ${arg}`);
      printHelp();
      process.exit(1);
    }
    if (confCode) {
      console.error("🚨 Please provide only one conference code.");
      process.exit(1);
    }
    confCode = arg;
  }

  if (!confCode) {
    console.error("🚨 Please provide a conference code.");
    printHelp();
    process.exit(1);
  }

  (async () => {
    try {
      const fbDb = await firebaseInit();
      await conference(fbDb, outputDir, confCode, {
        emitRaw,
      });
    } catch (err) {
      console.error("🚨 Export failed:", err);
      process.exit(1);
    }
  })();
})();
