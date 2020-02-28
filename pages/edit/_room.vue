<template>
  <div class="container">
    <div>
      <div style="margin: 10px 0px; text-align: left;">
        <b-button @click="$router.push('/')" size="sm">
          <b-icon icon="house" aria-hidden="true" />
          Home
        </b-button>
      </div>

      <DocumentEditor
        v-if="!has_fatal_error"
        ref="editor"
        :title="room.name"
        :loading="is_busy || is_reconnecting"
        @ready="cm_ready = true"
        @insert="(i) => (documentInsert ? documentInsert(i) : undefined)"
        @remove="(r) => (documentRemove ? documentRemove(r) : undefined)"
        @set-title="(t) => setTitle(t)"
      />

      <div v-if="has_fatal_error">
        <b-icon
          icon="alert-circle-fill"
          style="width: 64px; height: 64px; color: #f007"
        />
        <h1>Fatal error</h1>
        The document could not be loaded.
      </div>
    </div>
  </div>
</template>

<script>
import { debug } from '@/plugins/debug'
import DocumentEditor from '@/components/DocumentEditor'

export default {
  validate({ params }) {
    return /^[!#][^!#:]*:[^!#:]*(:[0-9]+)?$/gm.test(params.room)
  },

  components: { DocumentEditor },

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
    },

    room() {
      return this.$store.getters['matrix/room'](this.$route.params.room)
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
          const onOperation = (ops) => {
            ops.forEach((op) => {
              switch (op.type) {
                case 'i':
                  this.$refs.editor.insert(op.start, op.body)
                  return
                case 'r':
                  this.$refs.editor.remove(op.start, op.length)
                  return
                case 't':
                  this.$refs.editor.translate(op.source, op.dest, op.length)
              }
            })
          }
          const doc = await self.$matrix.createDocument(
            this.$route.params.room,
            onOperation,
            this.onDocumentError
          )

          // The old debug panel has been replaced in favor of this
          this.$debug.active_document = doc

          // This is a really stupid way to keep the document out of Vue's reach
          // (We do **not** want Vue doing state tracking on the CRDT)
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
              .catch((e) => {
                debug.error(e)
              })
          }
        } catch (e) {
          debug.error('Failed to open document', e)
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
        this.has_fatal_error = true
        this.$matrix.shutdownDocument(doc)
      } else {
        debug.warn('Internal error', e)
      }
    },

    setTitle(name) {
      this.$matrix.client
        .sendStateEvent(this.$route.params.room, 'm.room.name', { name })
        .then(
          () => {
            debug.info(`Set room title to '${name}'`)
          },
          (e) => {
            debug.warn('Failed to set title', e)
          }
        )
    }
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
