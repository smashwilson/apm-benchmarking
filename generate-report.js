const fs = require('fs')
const path = require('path')
const os = require('os')
const {inspect} = require('util')

function readReport() {
  return new Promise((resolve, reject) => {
    const reportFile = path.join(os.homedir(), 'apm-report.json')
    fs.readFile(reportFile, {encoding: 'utf8'}, (err, data) => {
      if (err) {
        reject(err)
      } else {
        resolve(JSON.parse(data))
      }
    })
  })
}

async function main() {
  const payload = await readReport()
  const columns = Array.from(Object.keys(payload.commands).reduce((acc, command) => {
    for (version in payload.commands[command]) {
      acc.add(version)
    }
    return acc
  }, new Set()));

  let table = ''

  // Header
  table += '| **Command**'
  table += columns.map(column => `| ${column}`).join('')
  table += '|\n'

  // Divider
  table += '| -- '
  table += columns.map(() => `| -- `).join('')
  table += '|\n'

  // One row for each command
  for (const command in payload.commands) {
    table += `| ${command.replace(/\n/g, '')} `

    const data = payload.commands[command]
    const baseline = data[columns[0]]
    for (const version of columns) {
      const duration = data[version]
      const delta = duration - baseline

      table += `| ${duration}ms `

      if (version !== columns[0]) {
        table += '_('
        if (delta > 0) {
          table += '+'
        }
        table += delta.toString()
        table += 'ms)_ '
      }
    }
    table += '|\n'
  }

  console.log(table)
}

main()
