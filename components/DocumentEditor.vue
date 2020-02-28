<template>
  <div class="with-loading" :data-loading="loading">
    <div style="display: flex; align-items: center; justify-content: center;">
      <b-spinner style="width: 3rem; height: 3rem;" label="Loading..." />
    </div>
    <b-card bg-variant="light">
      <template v-slot:header>
        <b-input-group>
          <b-form-input
            class="input-text-unless-focus"
            size="lg"
            placeholder="Untitled Document"
            v-model="internal_title"
            @blur="(e) => e.target.focus()"
          />
          <b-input-group-append v-if="internal_title !== title">
            <b-button
              variant="success"
              @click="$emit('set-title', internal_title)"
            >
              <b-icon icon="check" />
            </b-button>
            <b-button variant="danger" @click="() => (internal_title = title)">
              <b-icon icon="x" />
            </b-button>
          </b-input-group-append>
        </b-input-group>
      </template>
      <client-only placeholder="Codemirror Loading...">
        <codemirror
          ref="codemirror"
          style="text-align: left; margin: 0px -20px; margin-top: 3em; overflow: auto;"
          :options="cmOption"
          @ready="$emit('ready')"
          @beforeChange="onNewChanges"
        />
      </client-only>
    </b-card>
  </div>
</template>

<script>
import { debug } from '@/plugins/debug'

export default {
  props: {
    loading: Boolean,
    title: {
      default: '',
      type: String
    }
  },

  data() {
    return {
      internal_title: '',
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

  watch: {
    title() {
      this.internal_title = this.title
    }
  },

  mounted() {
    this.internal_title = this.title
  },

  methods: {
    insert(pos, text, meta) {
      const cmdoc = this.$refs.codemirror.codemirror.doc
      debug.log(`INSERT '${text}' AT ${pos}`)
      const cmpos = cmdoc.posFromIndex(pos)

      if (!this.changes_to_ignore[cmpos.line]) {
        this.changes_to_ignore[cmpos.line] = []
      }
      this.changes_to_ignore[cmpos.line].push(cmpos.ch)

      cmdoc.replaceRange(text, cmpos, cmpos)
    },
    remove(pos, len) {
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
    translate(src, dest, len) {
      const cmdoc = this.$refs.codemirror.codemirror.doc
      debug.log(`TRANSLATE ${len} CHARS FROM ${src} -> ${dest}`)
      const startpos = cmdoc.posFromIndex(src)
      const endpos = cmdoc.posFromIndex(src + len)
      const body = cmdoc.getRange(startpos, endpos)
      this.remove(src, len)
      this.insert(dest, body)
    },

    onNewChanges(cm, change) {
      const line_seperator = '\n'
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

      // Local echos will replay the change
      change.cancel()

      const from = Object.assign({}, change.from)
      const from_index = cm.indexFromPos(from)
      const to = Object.assign({}, change.to)
      const to_index = cm.indexFromPos(to)

      // Length of removal
      const removal_length = to_index - from_index

      // Raw text of the addition
      const addition_raw = change.text.join(line_seperator)

      if (removal_length) {
        this.$emit('remove', { pos: from_index, length: removal_length })
      }

      if (addition_raw.length) {
        this.$emit('insert', { pos: from_index, body: addition_raw })
      }
    }
  }
}
</script>

<style>
.vue-codemirror .CodeMirror {
  height: 100%;
}
.input-text-unless-focus:not(:focus) {
  background-color: #0000;
  border-color: #0000;
}
.with-loading {
  position: relative;
}
.with-loading > *:first-child {
  position: absolute;
  z-index: -100;
  top: 0px;
  left: 0px;
  bottom: 0px;
  right: 0px;
  width: 100%;
  height: 100%;
}
.with-loading[data-loading] > *:first-child {
  z-index: 100;
}
.with-loading[data-loading] > *:not(:first-child) {
  opacity: 0.5;
}
</style>
