<template>
  <a-card style="margin-bottom: 20px;">
    <a-card-meta
      title="Debug Panel"
      :description="
        `${$store.state.matrix.working_room} - ${$store.state.matrix.matrix_state}`
      "
    />

    <a-form-item label="Breakpoints">
      <a-checkbox-group
        :value="$store.getters['debugstate/breakpoints']"
        :options="breakpoint_options"
        @input="(v) => $store.commit('debugstate/setBreakpoints', v)"
      />
    </a-form-item>

    <a-row>
      <a-col :span="8">
        <a-form-item label="Enable syncback (Only affects initial load)">
          <a-switch
            :checked="$store.getters['debugstate/syncback']"
            @change="(v) => $store.commit('debugstate/setSyncbackEnabled', v)"
          />
        </a-form-item>
      </a-col>
      <a-col :span="5">
        <a-form-item label="Manual sync">
          <a-input-group compact>
            <a-input-number :min="0" :max="1000" v-model="syncdepth" />
            <a-button type="primary" @click="fetchSyncback">Fetch</a-button>
          </a-input-group>
        </a-form-item>
      </a-col>
      <a-col :span="5">
        <a-form-item label="Assign window variables">
          <a-switch
            :checked="$store.getters['debugstate/shouldAssignWindowVars']"
            @change="(v) => $store.commit('debugstate/setAssignWindowVars', v)"
          />
        </a-form-item>
      </a-col>
      <a-col :span="6">
        <a-form-item label="Dump BST">
          <a-button-group>
            <a-button @click="dumpLogoot">Logoot</a-button>
            <a-button @click="dumpLdoc">Ldoc</a-button>
            <a-button @click="dumpRemoval">Removal</a-button>
          </a-button-group>
        </a-form-item>
      </a-col>
    </a-row>
  </a-card>
</template>

<script>
export default {
  data() {
    return {
      syncdepth: 1,
      breakpoint_options: [
        {
          label: 'Local insertation events',
          value: 'LI'
        },
        {
          label: 'Local removal events',
          value: 'LR'
        },
        {
          label: 'Remote insertation events',
          value: 'RI'
        },
        {
          label: 'Remote removal events',
          value: 'RR'
        }
      ]
    }
  },

  methods: {
    fetchSyncback() {
      if (this.$matrix.manualSync) {
        this.$matrix
          .manualSync(this.syncdepth)
          .then(() => this.$message.info('Sync complete'))
          .catch((e) => {
            this.$message.error('Sync failed')
            console.error(e)
          })
      }
    },
    dumpLogoot() {
      if (this.$matrix.doc) {
        console.log(this.$matrix.doc.logoot_bst.toString())
      }
    },
    dumpLdoc() {
      if (this.$matrix.doc) {
        console.log(this.$matrix.doc.ldoc_bst.toString())
      }
    },
    dumpRemoval() {
      if (this.$matrix.doc) {
        console.log(this.$matrix.doc.removal_bst.toString())
      }
    }
  }
}
</script>
