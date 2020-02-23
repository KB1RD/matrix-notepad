import Vue from 'vue'
import loglevel from 'loglevel'

const debug = loglevel.getLogger('matrix-notepad')

const setDebugState = (state = false) => {
  const loggers = loglevel.getLoggers()
  Object.keys(loggers).forEach((key) => {
    loggers[key].setLevel(state ? 0 : 2, false)
  })
}

export default ({ store }) => {
  debug.store = store

  debug.syncback_settings = {}
  debug.syncback_settings.initial = true

  Vue.prototype.$debug = debug
  window.$debug = debug
}

export { debug, setDebugState }
