import { createWriteStream, existsSync, mkdirSync } from "fs";
import { readFile } from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import archiver from "archiver";

// Resolve __dirname in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Read package.json
const packageJsonPath = join(__dirname, "..", "package.json");
const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));

const packageName = packageJson.name.replace(/[^a-zA-Z0-9-_]/g, "_"); // Sanitize name
const packageVersion = packageJson.version;
const zipFileName = `${packageName}-v${packageVersion}.zip`;

const distPath = join(__dirname, "..", "dist");
const archivesDir = join(__dirname, "..", "archives");
const zipFilePath = join(archivesDir, zipFileName);

console.log(`Creating ZIP archive: ${zipFileName}`);

// Ensure dist directory exists
if (!existsSync(distPath)) {
  console.error("Error: dist directory does not exist. Run the build first.");
  process.exit(1);
}

// Ensure 'archives' directory exists
if (!existsSync(archivesDir)) {
  mkdirSync(archivesDir, { recursive: true });
}

// Create a file stream and archive
const output = createWriteStream(zipFilePath);
const archive = archiver("zip", { zlib: { level: 9 } });

output.on("close", () => {
  console.log(`ZIP archive created successfully: ${zipFilePath} (${archive.pointer()} bytes)`);
});

archive.on("error", (err) => {
  console.error("Error creating ZIP archive:", err.message);
  process.exit(1);
});

archive.pipe(output);
archive.directory(distPath, false); // Add contents of dist directory
await archive.finalize();
