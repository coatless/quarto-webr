import { readFileSync } from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { JSDOM } from 'jsdom'

/**
 * The extension's browser scripts are plain globals, not modules, so they
 * cannot be imported. Evaluate one inside a jsdom context and hand back the
 * context so tests can reach the functions it defined.
 */
export function loadBrowserScript(relativePath, bodyHtml = '') {
  const dom = new JSDOM(`<!doctype html><html><body>${bodyHtml}</body></html>`, {
    runScripts: 'outside-only',
  })
  const source = readFileSync(path.resolve('_extensions/webr', relativePath), 'utf8')
  const context = dom.getInternalVMContext()

  // dom.getInternalVMContext() is a separate V8 realm with its own Date
  // constructor, so vi.useFakeTimers()/vi.setSystemTime() in the host realm
  // has no effect on `new Date()` calls made by the evaluated script. Proxy
  // the context's Date through to the host realm's live binding so fake
  // timers set by tests apply to code running inside the context too.
  Object.defineProperty(context, 'Date', {
    configurable: true,
    get: () => globalThis.Date,
  })

  vm.runInContext(source, context)
  return context
}
