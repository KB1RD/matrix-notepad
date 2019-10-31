<template>
  <div class="container">
    <div>
      <a-drawer
        :visible="setup_visible"
        title="Document Settings"
        placement="right"
        :closable="true"
        @close="closeMatrixSetup"
      >
        WIP
      </a-drawer>

      <DebugPanel
        v-if="$store.state.debug"
        cansync
        @fetch="(n) => (fetchEvents ? fetchEvents(n) : undefined)"
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
        @settings-clicked="openMatrixSetup"
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
      setup_visible: false
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

  mounted() {
    if (!this.signed_in) {
      return
    }

    const self = this
    self.$store.dispatch(
      'watchBlockingOperation',
      (async () => {
        try {
          const doc = await self.$matrix.createDocument(
            this.$route.params.room,
            this.$refs.editor.insert,
            this.$refs.editor.remove,
            this.onDocumentError
          )
          this.documentInsert = ({ pos, body }) => doc.insert(pos, body)
          this.documentRemove = ({ pos, length }) => doc.remove(pos, length)
          this.fetchEvents = (n) => {
            doc
              .fetchEvents(n)
              .then(() => this.$message.info('Sync complete'))
              .catch((e) => {
                this.$message.error('Sync failed')
                console.error(e)
              })
          }
        } catch (e) {
          console.error('Failed to open document', e)
          self.$message.error('Failed to open document!')
          self.has_fatal_error = true
        }
      })()
    )
  },

  methods: {
    onDocumentError(e) {
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

    openMatrixSetup() {
      this.setup_visible = true
    },
    closeMatrixSetup() {
      this.setup_visible = false
      if (!this.signed_in) {
        this.$message.warning('Operation cancelled. You are not signed in')
      }
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
