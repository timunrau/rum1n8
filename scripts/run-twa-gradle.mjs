import { spawn } from 'node:child_process'
import { access, readFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { delimiter, join, resolve } from 'node:path'

const configPath = process.env.BUBBLEWRAP_CONFIG || join(homedir(), '.bubblewrap', 'config.json')
let config

try {
  config = JSON.parse(await readFile(configPath, 'utf8'))
} catch (error) {
  throw new Error(`Could not read Bubblewrap config at ${configPath}. Run npm run twa:doctor first.`, {
    cause: error,
  })
}

if (!config.jdkPath || !config.androidSdkPath) {
  throw new Error(`Bubblewrap config at ${configPath} must define jdkPath and androidSdkPath.`)
}

const bundledJdkHome = process.platform === 'darwin'
  ? join(config.jdkPath, 'Contents', 'Home')
  : config.jdkPath
const javaExecutable = join(bundledJdkHome, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')

try {
  await access(javaExecutable)
} catch (error) {
  throw new Error(`Bubblewrap's configured JDK does not contain ${javaExecutable}. Run npm run twa:doctor again.`, {
    cause: error,
  })
}

const projectDir = resolve('android-twa')
const gradle = join(projectDir, process.platform === 'win32' ? 'gradlew.bat' : 'gradlew')
const tasks = process.argv.slice(2)

if (tasks.length === 0) {
  throw new Error('Pass at least one Gradle task, such as assembleDebug or lint.')
}

const child = spawn(gradle, tasks, {
  cwd: projectDir,
  env: {
    ...process.env,
    JAVA_HOME: bundledJdkHome,
    ANDROID_HOME: config.androidSdkPath,
    ANDROID_SDK_ROOT: config.androidSdkPath,
    PATH: [
      join(bundledJdkHome, 'bin'),
      join(config.androidSdkPath, 'platform-tools'),
      process.env.PATH || '',
    ].join(delimiter),
  },
  shell: process.platform === 'win32',
  stdio: 'inherit',
})

child.on('error', (error) => {
  console.error(error.message)
  process.exitCode = 1
})

child.on('close', (code, signal) => {
  process.exitCode = signal ? 1 : (code ?? 1)
})
