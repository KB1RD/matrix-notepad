<template>
  <div class="container">
    <div>
      <a-drawer
        :visible="setup_visible"
        title="Matrix Setup"
        placement="right"
        :closable="true"
        @close="closeMatrixSetup"
      >
        <TemporarySignin
          :working="is_busy"
          :signed-in="signed_in"
          @submit="onSettingsFormSubmit"
        />
      </a-drawer>

      <DebugPanel v-if="$store.state.debug" />

      <a-spin :spinning="is_busy || is_reconnecting">
        <a-icon slot="indicator" type="loading" style="font-size: 48px" spin />

        <a-card :class="signed_in ? '' : 'has-signin-overlay'">
          <div class="signin-overlay">
            <h1>Set Up</h1>
            <p>Open settings to set up the document & connect to Matrix</p>
            <a-button
              type="primary"
              size="large"
              shape="circle"
              icon="setting"
              @click="openMatrixSetup"
            />
          </div>

          <template slot="actions" class="ant-card-actions">
            <a-icon type="setting" @click="openMatrixSetup" />
            <!-- <a-icon type="share-alt" /> -->
          </template>
          <a-card-meta title="Document" />
          <no-ssr placeholder="Codemirror Loading...">
            <codemirror
              ref="codemirror"
              v-model="text"
              style="text-align: left; margin: -24px -32px; margin-top: 3em; overflow: auto;"
              :options="cmOption"
              @changes="onNewChanges"
            />
          </no-ssr>
        </a-card>
      </a-spin>
    </div>
  </div>
</template>

<script>
import { mapMutations } from 'vuex'
import TemporarySignin from '@/components/TemporarySignin'
import DebugPanel from '@/components/DebugPanel'

import { debug } from '@/plugins/debug'

export default {
  components: { TemporarySignin, DebugPanel },

  data() {
    return {
      setup_visible: false,

      text: '',

      cmOption: {
        tabSize: 4,
        foldGutter: true,
        styleActiveLine: true,
        lineNumbers: true,
        line: true,
        theme: 'mdn-like'
      },

      changes_to_ignore: {}
    }
  },

  computed: {
    signed_in() {
      /* eslint-disable */
      // ESLint is disabled because there's a bug (I guess) where it will tell
      // me to put a new line after the return statement, which will cause the
      // code not to be found, causing ESLint to assume the return has nothing
      // after it!
      return this.$store.state.matrix.matrix_state &&
        this.$store.state.matrix.matrix_state !== 'STOPPED'
    },
    /* eslint-enable */

    is_busy() {
      return this.$store.getters.hasBlockingOperation
    },
    is_reconnecting() {
      return this.$store.state.matrix.matrix_state === 'RECONNECTING'
    }
  },

  created() {
    // Ensure that the user is signed in on load
    if (
      this.$store.state.matrix.credentials.hs &&
      this.$store.state.matrix.credentials.access_token &&
      this.$store.state.matrix.working_room
    ) {
      const m = this.$store.state.matrix
      this.signIn(m.credentials.hs, m.credentials.access_token, m.working_room)
    }
  },

  methods: {
    openMatrixSetup() {
      this.setup_visible = true
    },
    closeMatrixSetup() {
      this.setup_visible = false
      if (!this.signed_in) {
        this.$message.warning('Operation cancelled. You are not signed in')
      }
    },

    signIn(hs, token, room, update_settings = false) {
      this.$matrix.shutdown()
      this.text = ''
      this.changes_to_ignore = {}

      // Start a blocking signin
      const hide = this.$message.loading('Signing in...', 0)
      const self = this
      self.$store.dispatch(
        'watchBlockingOperation',
        self.$matrix
          .attemptSignIn(
            hs,
            token,
            room,
            (e) => {
              if (e.fatal) {
                console.error('Fatal internal error', e)
                self.$message.error('Fatal internal error')
                // self.$matrix.shutdown()
              } else {
                console.warn('Internal error', e)
                self.$message.warning(
                  'Internal errors encountered. See console for details'
                )
              }
            },
            this.onRemoteInsert,
            this.onRemoteRemove
          )
          .then(
            () => {
              if (update_settings) {
                // Update the user settings since they're valid
                self.updateSettings({ hs, token, room })
              }
              hide()
              self.$message.success("You're signed in!")
              self.setup_visible = false
            },
            (e) => {
              hide()
              console.error('Failed to sign in', e)
              self.$message.error('Failed to sign in!')
            }
          )
      )
    },

    onSettingsFormSubmit(values) {
      const settings = {
        hs: 'https://matrix.org'
      }
      // Ensure that unrequired keys are replaced with defaults
      Object.keys(values).forEach((key) => {
        if ((values[key] || values[key] === 0) && values[key] !== '') {
          settings[key] = values[key]
        }
      })
      this.setDebugEnabled(values.debug)
      this.signIn(settings.hs, settings.token, settings.room, true)
    },

    onRemoteInsert(pos, text, meta) {
      const cmdoc = this.$refs.codemirror.codemirror.doc
      debug.log(`INSERT '${text}' AT ${pos}`)
      const cmpos = cmdoc.posFromIndex(pos)

      if (!this.changes_to_ignore[cmpos.line]) {
        this.changes_to_ignore[cmpos.line] = []
      }
      this.changes_to_ignore[cmpos.line].push(cmpos.ch)

      cmdoc.replaceRange(text, cmpos, cmpos)
    },
    onRemoteRemove(pos, len) {
      const cmdoc = this.$refs.codemirror.codemirror.doc
      debug.log(`REMOVE ${len} CHARS AT ${pos}`)
      const startpos = cmdoc.posFromIndex(pos)
      const endpos = cmdoc.posFromIndex(pos + len)

      if (!this.changes_to_ignore[startpos.line]) {
        this.changes_to_ignore[startpos.line] = []
      }
      this.changes_to_ignore[startpos.line].push(startpos.ch)

      cmdoc.replaceRange('', startpos, endpos)
    },

    onNewChanges(cm, changes) {
      if (!this.$matrix.doc) {
        return
      }

      const line_seperator = '\n'
      const modifyCmLinePositionBasedOnText = (to, text) => {
        // Add the extra lines in to the line count
        to.line += text.length - 1
        // If there's a new line, go back to the start of the line
        if (text.length > 1) {
          to.ch = 0
        }
        // Add the final line position
        to.ch += text[text.length - 1].length

        return to
      }

      const $matrix = this.$matrix
      changes.forEach((change) => {
        // TODO: Possible create a custom CM document to fix this BS. That way,
        // text appears as part of the local echo of a Matrix event
        if (
          this.changes_to_ignore[change.from.line] &&
          this.changes_to_ignore[change.from.line].includes(change.from.ch)
        ) {
          this.changes_to_ignore[change.from.line].pop(change.from.ch)
          if (!this.changes_to_ignore[change.from.line].length) {
            delete this.changes_to_ignore[change.from.line]
          }
          return
        }

        const from = Object.assign({}, change.from)
        const from_index = cm.indexFromPos(from)

        // Addition is in the post-removal coordinate system
        const addition_to = Object.assign({}, change.from)

        // Update based on actual values (in my experience, CM reports incorrect
        // lengths in *some* cases, so this just starts from scratch)
        modifyCmLinePositionBasedOnText(addition_to, change.text)

        // Length of removal. Start w/ the newline chars:
        let removal_length = change.removed.length - 1
        change.removed.forEach((str) => {
          removal_length += str.length
        })

        // Raw text of the addition
        const addition_raw = change.text.join(line_seperator)

        if (removal_length) {
          $matrix.doc.remove(from_index, removal_length)
        }

        if (addition_raw.length) {
          $matrix.doc.insert(from_index, addition_raw)
        }
      })
    },

    ...mapMutations({
      updateSettings: 'matrix/updateSettings',
      setDebugEnabled: 'setDebugEnabled'
    })
  }
}
</script>

<style>
.vue-codemirror .CodeMirror {
  height: 100%;
}

.container {
  margin: 0 auto;
  min-height: 100vh;
  display: flex;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.container > * {
  width: 100%;
  max-width: 1000px;
}

.signin-overlay {
  display: none;
}
.has-signin-overlay .signin-overlay {
  display: block;

  width: 100%;
  height: 100%;

  position: absolute;
  top: 0;
  left: 0;

  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  background-color: #fffd;
  z-index: 1000;
}
</style>
