const {spawn} = require('child_process')
const {inspect} = require('util')
const fs = require('fs')
const path = require('path')
const os = require('os')

const commands = [
  ['--version'],
  ['uninstall', 'teletype', 'atom-lcov', 'atom-ide-ui', 'hydrogen', 'latex', 'github', 'git-plus'],
  ['install', 'teletype'],
  ['install', 'atom-lcov'],
  ['install', 'atom-ide-ui'],
  ['install', 'hydrogen'],
  ['install', 'latex'],
  ['install', 'github'],
  ['install', 'git-plus'],
  ['install', 'atom/github'],
  ['rebuild', 'hygrogen'],
  ['rebuild'],
]

function runCommand(apmBin, apmShell, command, report) {
  return new Promise(resolve => {
    let resolved = false
    const startTs = Date.now()
    function finish() {
      if (!resolved) {
        resolved = true
        resolve()
      }
    }

    console.log(`>>> ${inspect(command)}\n`)

    const child = spawn(apmBin, command, {
      encoding: 'utf8',
      stdio: 'inherit',
      shell: apmShell,
    })

    child.on('error', err => {
      console.error(`>>> Spawn error for ${inspect(command)}:\n${err.stack}`)
      finish()
    })

    child.on('exit', (code, signal) => {
      const endTs = Date.now()
      const duration = endTs - startTs

      const statusMsg = code !== null ? `exited with code ${code}` : `was terminated with signal ${signal}`
      const durationMsg = `in ${duration}ms`
      console.log(`\n>>> ${inspect(command)} ${statusMsg} ${durationMsg}\n`)

      report.commands.push({command, duration})
      if (code === 0 && signal === null) {
        report.successes++
      } else {
        report.failures++
      }

      finish();
    })
  })
}

function printReport(report) {
  return new Promise((resolve, reject) => {
    console.log('>>> Report')
    console.log(` * ${report.successes} commands successful`)
    console.log(` * ${report.failures} commands failed`)
    console.log(` * total duration: ${report.endTs - report.startTs}ms`)

    if (report.version !== null) {
      const reportFile = path.join(os.homedir(), 'apm-report.json')

      fs.readFile(reportFile, {encoding: 'utf8'}, (err, data) => {
        let payload = {}
        if (err) {
          if (err.code === 'ENOENT') {
            payload.commands = report.commands.reduce((acc, each) => {
              acc[inspect(each.command)] = {[report.version]: each.duration}
              return acc
            }, {})
          } else {
            throw err
          }
        } else {
          // Existing report read successfully
          payload = JSON.parse(data)
          payload.commands = report.commands.reduce((acc, each) => {
            const byVersion = acc[inspect(each.command)] || {}
            byVersion[report.version] = each.duration
            acc[inspect(each.command)] = byVersion
            return acc
          }, payload.commands || {})
        }
        fs.writeFile(reportFile, JSON.stringify(payload), {encoding: 'utf8'}, err => {
          if (err) {
            reject(err)
          } else {
            console.log(`>>> report written to ${reportFile}`)
            resolve()
          }
        })
      })
    } else {
      resolve()
    }
  })
}

async function main() {
  const apmPath = process.argv[2] || path.join(os.homedir(), 'src', 'atom', 'apm')
  const apmPackageJson = require(path.join(apmPath, 'package.json'))
  const apmBin = path.join(apmPath, process.platform === 'win32' ? 'bin/apm.cmd' : 'bin/apm')
  const apmShell = process.platform === 'win32'

  console.log(`>>> Testing apm ${apmPackageJson.version} at ${apmPath}`)

  const report = {
    version: apmPackageJson.version,
    successes: 0,
    failures: 0,
    startTs: Date.now(),
    commands: [],
  }
  for (const command of commands) {
    await runCommand(apmBin, apmShell, command, report)
  }

  report.endTs = Date.now()
  await printReport(report)
}

main()
