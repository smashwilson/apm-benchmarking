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
  const columns = payload.versions.map(each => each.version)
  const rows = payload.versions.reduce((acc, each) => {
    acc.add(inspect(each.command))
    return acc
  }, new Set())

  const table = ''

  // Header
  table += '| **Command**'
  table += columns.map(column => `| ${column}`).join('')
  table += '|\n'

  console.log(table)
}

main()
