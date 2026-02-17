import fs from "fs/promises";
import path from "path";

function formatBytesToKb(bytes) {
  return Math.max(0, Math.round(bytes / 1024));
}

async function listJsonFiles(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
      .map((entry) => path.join(dirPath, entry.name));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

export async function summarizeOutputDir({ outputDir, emitRaw }) {
  const sectionNames = ["entities", "indexes", "views", "derived"];
  if (emitRaw) sectionNames.push("raw");

  const sectionCounts = {};
  const allFiles = [];
  const warnings = [];

  for (const section of sectionNames) {
    const sectionDir = path.join(outputDir, section);
    const files = await listJsonFiles(sectionDir);
    if (!files.length) {
      warnings.push(`${section} missing/empty`);
    }
    sectionCounts[section] = files.length;
    allFiles.push(...files.map((filePath) => ({ filePath, section })));
  }

  const manifestPath = path.join(outputDir, "manifest.json");
  try {
    const stat = await fs.stat(manifestPath);
    if (stat.isFile()) {
      allFiles.push({ filePath: manifestPath, section: "root" });
    }
  } catch (error) {
    if (error?.code === "ENOENT") {
      warnings.push("manifest missing");
    } else {
      throw error;
    }
  }

  const fileStats = await Promise.all(
    allFiles.map(async ({ filePath, section }) => {
      const stat = await fs.stat(filePath);
      return {
        filePath,
        section,
        size: stat.size,
      };
    }),
  );

  const totalSize = fileStats.reduce((sum, entry) => sum + entry.size, 0);
  const largestFiles = fileStats
    .slice()
    .sort((a, b) => b.size - a.size)
    .slice(0, 5)
    .map((entry) => ({
      name: path.relative(outputDir, entry.filePath),
      sizeKb: formatBytesToKb(entry.size),
    }));

  return {
    warnings,
    summary: {
      totalFiles: fileStats.length,
      totalSizeKb: formatBytesToKb(totalSize),
      sectionCounts,
      largestFiles,
    },
  };
}
