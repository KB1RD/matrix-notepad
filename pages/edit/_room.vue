<template>
  <div class="container">
    <div>
      <!-- <a-drawer
        :visible="setup_visible"
        title="Document Settings"
        placement="right"
        :closable="true"
        @close="closeMatrixSetup"
      >
        WIP
      </a-drawer> -->

      <DebugPanel
        v-if="$store.state.debug"
        cansync
        @fetch="(n) => (fetchEvents ? fetchEvents(n) : undefined)"
        @dumpLogoot="dumpLogoot"
        @dumpLdoc="dumpLdoc"
        @dumpRemoval="dumpRemoval"
      />

      <div style="margin: 10px 0px; text-align: left;">
        <a-button type="primary" icon="home" @click="$router.push('/')">
          Home
        </a-button>
      </div>

      <DocumentEditor
        v-if="!has_fatal_error"
        ref="editor"
        :loading="is_busy || is_reconnecting"
        @ready="cm_ready = true"
        @insert="(i) => (documentInsert ? documentInsert(i) : undefined)"
        @remove="(r) => (documentRemove ? documentRemove(r) : undefined)"
      />

      <div v-if="has_fatal_error">
        <a-icon type="close-circle" style="font-size: 64px; color: #f007" />
        <h1>Fatal error</h1>
        The document could not be loaded.
      </div>
    </div>
  </div>
</template>

<script>
import { debug } from '@/plugins/debug'
import DebugPanel from '@/components/DebugPanel'
import DocumentEditor from '@/components/DocumentEditor'

export default {
  validate({ params }) {
    return /^[!#][^!#:]*:[^!#:]*(:[0-9]+)?$/gm.test(params.room)
  },

  components: { DebugPanel, DocumentEditor },

  head() {
    return {
      title: `Edit ${this.$route.params.room}`
    }
  },

  data() {
    return {
      has_fatal_error: false,
      // setup_visible: false,
      cm_ready: false,
      cm_resolve_ready: undefined,

      document_symbol: undefined
    }
  },

  computed: {
    signed_in() {
      return this.$store.getters['matrix/signedIn']
    },

    is_busy() {
      return this.$store.getters.hasBlockingOperation
    },
    is_reconnecting() {
      return this.$store.state.matrix.matrix_state === 'RECONNECTING'
    }
  },

  watch: {
    cm_ready() {
      if (this.cm_ready && this.cm_resolve_ready) {
        this.cm_resolve_ready()
      }
    }
  },

  mounted() {
    if (!this.signed_in) {
      return
    }

    const self = this
    self.$store.dispatch(
      'watchBlockingOperation',
      (async () => {
        try {
          // A poorly written system to wait for CodeMirror to be ready
          await new Promise((resolve, reject) => {
            if (self.cm_ready) {
              resolve()
            } else {
              self.cm_resolve_ready = resolve
            }
          })
          const doc = await self.$matrix.createDocument(
            this.$route.params.room,
            this.$refs.editor.insert,
            this.$refs.editor.remove,
            this.onDocumentError
          )

          // This is a really stupid way to keep the document out of Vue's reach
          Object.defineProperty(this, 'document', {
            get() {
              return doc
            }
          })

          this.documentInsert = ({ pos, body }) => doc.insert(pos, body)
          this.documentRemove = ({ pos, length }) => doc.remove(pos, length)
          this.fetchEvents = (n) => {
            doc
              .fetchEvents(n)
              .then(() => this.$message.info('Sync complete'))
              .catch((e) => {
                this.$message.error('Sync failed')
                debug.error(e)
              })
          }
        } catch (e) {
          debug.error('Failed to open document', e)
          this.$message.error('Failed to open document!')
          this.has_fatal_error = true
        }
      })()
    )
  },

  beforeDestroy() {
    if (this.document) {
      this.$matrix.shutdownDocument(this.document)
    }
  },

  methods: {
    onDocumentError(e, doc) {
      if (e.fatal) {
        debug.error('Fatal internal error', e)
        this.$message.error('Fatal internal error')
        this.has_fatal_error = true
        this.$matrix.shutdownDocument(doc)
      } else {
        debug.warn('Internal error', e)
        this.$message.warning(
          'Internal errors encountered. See console for details'
        )
      }
    },

    dumpLogoot() {
      if (this.document) {
        debug.info(this.document.logoot_bst.toString())
      }
    },
    dumpLdoc() {
      if (this.document) {
        debug.info(this.document.ldoc_bst.toString())
      }
    },
    dumpRemoval() {
      if (this.document) {
        debug.info(this.document.removal_bst.toString())
      }
    }

    /* openMatrixSetup() {
      this.setup_visible = true
    },
    closeMatrixSetup() {
      this.setup_visible = false
      if (!this.signed_in) {
        this.$message.warning('Operation cancelled. You are not signed in')
      }
    } */
  }
}
</script>

<style>
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
</style>
