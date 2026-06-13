import firebaseInit from "./init.js";
import conference from "./conf.js";

function printHelp() {
  console.log(`Usage: npm run export -- [options] <conf> [conf...]

Options:
  --conf, -c <slug>     Conference code (can also be positional; repeatable)
  --out, -o <path>      Output root (default: ./out/ht)
  --emit-raw, -r        Emit raw Firestore snapshots
  --help, -h            Show help

Examples:
  npm run export -- DEFCON33
  npm run export -- DEFCON33 DEFCON34 DCSG2026
  npm run export -- --conf DEFCON33 --conf DEFCON34 --conf DCSG2026
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
  const confCodes = [];
  let outputDir = "./out/ht";
  let emitRaw = false;

  function addConfCode(value) {
    if (!value) return;
    const outputKey = value.toLowerCase();
    if (confCodes.some((code) => code.toLowerCase() === outputKey)) {
      console.error(`🚨 Duplicate conference output: ${value}`);
      process.exit(1);
    }
    confCodes.push(value);
  }

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
      addConfCode(confValue);
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
      addConfCode(next);
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
    addConfCode(arg);
  }

  if (!confCodes.length) {
    console.error("🚨 Please provide a conference code.");
    printHelp();
    process.exit(1);
  }

  try {
    const fbDb = await firebaseInit();
    await Promise.all(
      confCodes.map((confCode) =>
        conference(fbDb, outputDir, confCode, {
          emitRaw,
        }),
      ),
    );
  } catch (err) {
    console.error("🚨 Export failed:", err);
    process.exit(1);
  }
})();
