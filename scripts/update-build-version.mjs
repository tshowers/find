import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const packageJsonPath = path.resolve(__dirname, '../package.json')
const versionJsonPath = path.resolve(__dirname, '../public/assets/version.json')

function getTodayParts () {
  const now = new Date()
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate()
  }
}

function parseBuildVersion (version) {
  const match = String(version || '').match(
    /^(\d+)\.(\d+)\.(\d+)-build\.(\d+)$/
  )

  if (!match) {
    return null
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    build: Number(match[4])
  }
}

function formatBuildVersion ({ year, month, day, build }) {
  return `${year}.${month}.${day}-build.${build}`
}

async function main () {
  const packageJsonRaw = await fs.readFile(packageJsonPath, 'utf8')
  const packageJson = JSON.parse(packageJsonRaw)

  const today = getTodayParts()
  const current = parseBuildVersion(packageJson.version)
  const isSameDay =
    current &&
    current.year === today.year &&
    current.month === today.month &&
    current.day === today.day

  const nextVersion = formatBuildVersion({
    year: today.year,
    month: today.month,
    day: today.day,
    build: isSameDay ? current.build + 1 : 1
  })

  packageJson.version = nextVersion

  await fs.writeFile(
    packageJsonPath,
    `${JSON.stringify(packageJson, null, 2)}\n`,
    'utf8'
  )

  await fs.mkdir(path.dirname(versionJsonPath), { recursive: true })
  await fs.writeFile(
    versionJsonPath,
    `${JSON.stringify({ version: nextVersion }, null, 2)}\n`,
    'utf8'
  )

  console.log(`Updated find package version to ${nextVersion}`)
  console.log(`Updated public/assets/version.json`)
}

main().catch(error => {
  console.error('Failed to update find package version.')
  console.error(error)
  process.exit(1)
})
