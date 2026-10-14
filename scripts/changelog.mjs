// CHANGELOG.md helper for CI and the release workflow.
//   node scripts/changelog.mjs check   fails when package.json's version has no "## <version>" entry
//   node scripts/changelog.mjs notes   prints that entry's body, the GitHub release notes
import { readFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8')
const heading = new RegExp(`^## ${version.replaceAll('.', '\\.')}\\b.*$`, 'm')
const start = changelog.search(heading)

if (start < 0) {
  console.error(`CHANGELOG.md has no entry for ${version}, add "## ${version} (date)" at the top`)
  process.exit(1)
}

if (process.argv[2] === 'notes') {
  const body = changelog.slice(start).split('\n').slice(1).join('\n')
  const next = body.search(/^## /m)
  process.stdout.write((next < 0 ? body : body.slice(0, next)).trim() + '\n')
} else {
  console.log(`CHANGELOG.md has an entry for ${version}`)
}
