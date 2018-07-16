const chalk = require('chalk')

const {spawn} = require('child_process')
const {inspect} = require('util')
const fs = require('fs-extra')
const path = require('path')
const os = require('os')

const commands = [
  {
    name: 'version',
    omitFromReport: true,
    args: ['--version'],
  },
  {
    name: 'clean slate',
    omitFromReport: true,
    args: ['uninstall', 'teletype', 'atom-lcov', 'atom-ide-ui', 'hydrogen', 'latex', 'github', 'git-plus'],
  },
  {
    name: 'from atom.io: teletype',
    cleanCache: true,
    args: ['install', 'teletype'],
  },
  {
    name: 'from atom.io: atom-lcov',
    cleanCache: true,
    args: ['install', 'atom-lcov'],
  },
  {
    name: 'with prebuilt native dependencies: atom-ide-ui',
    cleanCache: true,
    args: ['install', 'atom-ide-ui'],
  },
  {
    name: 'with native dependencies: hydrogen',
    cleanCache: true,
    args: ['install', 'hydrogen'],
  },
  {
    name: 'with native dependencies: latex',
    cleanCache: true,
    args: ['install', 'latex'],
  },
  {
    name: 'with native dependencies: github',
    cleanCache: true,
    args: ['install', 'github'],
  },
  {
    name: 'with package-lock.json: git-plus',
    cleanCache: true,
    args: ['install', 'git-plus'],
  },
  {
    name: 'from git repository: atom/github',
    cleanCache: true,
    args: ['install', 'atom/github'],
  },
  {
    name: 'within package repository: atom/github',
    cleanCache: true,
    inPackageDirectory: true,
    args: ['install']
  },
  {
    name: 'dedupe',
    cleanCache: true,
    inPackageDirectory: true,
    args: ['dedupe']
  },
  {
    name: 'clean',
    inPackageDirectory: true,
    args: ['clean']
  },
  {
    name: 'rebuild individual package: hydrogen',
    args: ['rebuild', 'hygrogen'],
  },
  {
    name: 'rebuild all packages',
    args: ['rebuild'],
  },
  {
    name: 'set a config option',
    omitFromReport: true,
    args: ['config', 'set', 'somevalue', '1234'],
  },
  {
    name: 'read a config option',
    omitFromReport: true,
    args: ['config', 'get', 'somevalue']
  },
  {
    name: 'delete a config option',
    omitFromReport: true,
    args: ['config', 'delete', 'somevalue']
  },
  {
    omitFromReport: true,
    name: 'remove unused packages',
    args: ['uninstall', 'hydrogen', 'latex', 'github', 'git-plus'],
  },
  {
    omitFromReport: true,
    name: 'reinstall used packages',
    args: ['install', 'atom/github']
  }
]

function runCommand(config, command, report) {
  return new Promise(async resolve => {
    if (command.cleanCache) {
      await fs.remove(path.join(os.homedir(), '.atom/.apm'))
    }

    if (command.inPackageDirectory) {
      process.chdir(config.atomGithubClone)
    }

    let resolved = false
    const startTs = Date.now()
    function finish() {
      if (!resolved) {
        resolved = true

        if (command.inPackageDirectory) {
          process.chdir(config.originalCwd)
        }

        resolve()
      }
    }

    console.log(chalk.bold(`>>> ${command.name} - ${inspect(command.args)}\n`))

    const child = spawn(config.apmBin, command.args, {
      encoding: 'utf8',
      stdio: 'inherit',
      shell: config.apmShell,
    })

    child.on('error', err => {
      console.error(chalk.red.bold(`>>> Spawn error for ${inspect(command.args)}:\n${err.stack}`))
      finish()
    })

    child.on('exit', (code, signal) => {
      const endTs = Date.now()
      const duration = endTs - startTs

      const statusMsg = code !== null ? `exited with code ${code}` : `was terminated with signal ${signal}`
      const durationMsg = `in ${duration}ms`
      console.log(chalk.bold(`\n>>> ${inspect(command.args)} ${statusMsg} ${durationMsg}\n`))

      if (!command.omitFromReport) {
        report.commands.push({name: command.name, args: command.args, duration})
        if (code === 0 && signal === null) {
          report.successes++
        } else {
          report.failures++
        }
      }

      finish();
    })
  })
}

async function firstDirectory(...choices) {
  if (choices.length === 0) {
    throw new Error('Unable to find a directory')
  }
  if (await fs.pathExists(choices[0])) {
    return choices[0]
  } else {
    return firstDirectory(...choices.slice(1))
  }
}

function printReport(report) {
  return new Promise((resolve, reject) => {
    console.log(chalk.bold('>>> Report'))
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
              acc[each.name] = {[report.version]: each.duration}
              return acc
            }, {})
          } else {
            throw err
          }
        } else {
          // Existing report read successfully
          payload = JSON.parse(data)
          payload.commands = report.commands.reduce((acc, each) => {
            const byVersion = acc[each.name] || {}
            byVersion[report.version] = each.duration
            acc[each.name] = byVersion
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
  const originalCwd = process.cwd()
  const apmPath = await firstDirectory(
    path.join(os.homedir(), 'src/atom/apm'),
    path.join(os.homedir(), 'src/apm'),
  )
  const atomGithubClone = await firstDirectory(
    path.join(os.homedir(), 'src/atom/github'),
    path.join(os.homedir(), 'src/github'),
  )

  const apmPackageJson = require(path.join(apmPath, 'package.json'))
  const apmBin = path.join(apmPath, process.platform === 'win32' ? 'bin/apm.cmd' : 'bin/apm')
  const apmShell = process.platform === 'win32'

  console.log(chalk.bold(`>>> Testing apm ${apmPackageJson.version} at ${apmPath}`))

  const config = {
    apmBin,
    apmShell,
    atomGithubClone,
    originalCwd
  }
  const report = {
    version: apmPackageJson.version,
    successes: 0,
    failures: 0,
    startTs: Date.now(),
    commands: [],
  }
  for (const command of commands) {
    await runCommand(config, command, report)
  }

  report.endTs = Date.now()
  await printReport(report)
}

main()
