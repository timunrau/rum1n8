import { readFile, writeFile } from 'node:fs/promises'

const [inputPath = 'nginx.app.conf.template', outputPath = 'nginx.app.conf'] = process.argv.slice(2)
const configuredUrl = process.env.VITE_MARKETING_URL

if (!configuredUrl) throw new Error('VITE_MARKETING_URL is required to render app Nginx redirects.')

const url = new URL(configuredUrl)
if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
  throw new Error('VITE_MARKETING_URL must be an HTTPS origin with the path /.')
}

const marketingOrigin = url.origin
const template = await readFile(inputPath, 'utf8')
if (!template.includes('__MARKETING_ORIGIN__')) {
  throw new Error(`Missing __MARKETING_ORIGIN__ placeholder in ${inputPath}.`)
}

await writeFile(outputPath, template.replaceAll('__MARKETING_ORIGIN__', marketingOrigin))
