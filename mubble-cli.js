'use strict'

const PACKAGES  = {
  core  : {
    path      : `${process.cwd()}/packages/core`,
    buildCmds : ['npm install', 'tsc'],
    testCmds  : ['npm run test']
  },
  server  : {
    path      : `${process.cwd()}/packages/server`,
    buildCmds : ['npm install', 'tsc'],
    testCmds  : ['npm run test']
  },
  browser : {
    path      : `${process.cwd()}/packages/browser`,
    buildCmds : ['npm install', 'npm run package'],
    testCmds  : ['npm run test']
  }
}

const RUN_MODE  = {
  BUILD : 'build',
  TEST  : 'test'
}

const colors = require('colors/safe')

colors.setTheme({
  debug: 'grey',
  warn:  'magenta',
  error: 'red'
})

const util = require('util')
const exec = util.promisify(require('child_process').exec)

class MubbleCli {

  _verifyParams(runMode, packageName) {

    if (!runMode) {
      const errorMessage  = `\n Run mode not defined. Please pass either ${RUN_MODE.BUILD} or ${RUN_MODE.TEST}`
      console.log(colors.error(errorMessage))
      throw new Error(errorMessage)
    }

    if (runMode !== RUN_MODE.BUILD && runMode !== RUN_MODE.TEST) {
      const errorMessage  = `\n Invalid value passed for run mode. Please pass either ${RUN_MODE.BUILD} or ${RUN_MODE.TEST}`
      console.log(colors.error(errorMessage))
      throw new Error(errorMessage)
    }

    if (!packageName) return 
    let packageFound  = false

    for (const pack in PACKAGES) {

      if (packageName.toLowerCase() === pack.toLowerCase()) {
        packageFound  = true
        break
      }
    }

    if (!packageFound) {
      const errorMessage  = `\n Invalid value passed for package name ${packageName}`
      console.log(colors.error(errorMessage))
      throw new Error(errorMessage)
    }



  }

  async run(runMode, packageName) {

    this._verifyParams(runMode, packageName)

    for (const pack in PACKAGES) {

      if (pack.toLowerCase() !== packageName.toLowerCase()) continue
      
      const path  = PACKAGES[pack].path
      
      runMode === RUN_MODE.BUILD 
      ? await this._buildPackages(pack, path, PACKAGES[pack].buildCmds) 
      : await this._testPackages(pack, path, PACKAGES[pack].testCmds)

    }

    
  }

  async _buildPackages(packageName, path, cmds) {

    console.log(colors.debug(`\bbuilding package ${packageName}`))

    process.chdir(path)

    for (const cmd of cmds) {
      console.log(colors.debug(`running cmd ${cmd}`))
      try {
        await exec(cmd)
      } catch(err) {
        console.log(colors.error(`cmd failed for package ${packageName}`))
        throw new Error(err.mesage)
      }
    }

    console.log(colors.green(`\npackage ${packageName} built successfully \n`))
  }

  async _testPackages(packageName, path, cmds) {

    process.chdir(path)

    console.log(colors.debug(`\ntesting package ${packageName}`))
    for (const cmd of cmds) {
      console.log(colors.debug(`running cmd ${cmd}`))
      try {
        await exec(cmd)
      } catch(err) {
        console.log(colors.error(`testing failed for package ${packageName}`))
        throw new Error(colors.error(err.message))
      }
    }

    console.log(colors.green(`\npackage ${packageName} tested successfully \n`))

  }
  
}

const [runMode, packageName]  = [process.argv[2], process.argv[3]]

new MubbleCli().run(runMode, packageName)

