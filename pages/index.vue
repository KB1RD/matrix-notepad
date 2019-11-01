<template>
  <div class="container">
    <div>
      <DebugPanel v-if="$store.state.debug" />

      <a-config-provider>
        <template v-slot:renderEmpty>
          <div style="text-align: center">
            <a-icon type="file-unknown" style="font-size: 72px" />
            <p>You have no rooms</p>
          </div>
        </template>
        <a-list class="room-list" item-layout="horizontal" :data-source="rooms">
          <a-list-item slot="renderItem" slot-scope="item">
            <a-list-item-meta :description="item.roomId">
              <nuxt-link slot="title" :to="'/edit/' + item.roomId">
                {{ item.name }}
              </nuxt-link>
            </a-list-item-meta>
          </a-list-item>
        </a-list>
      </a-config-provider>
      <a-button type="dashed" block @click="$refs.modal.show()">+ Add</a-button>
      <AddRoomModal ref="modal" />
    </div>
  </div>
</template>

<script>
import DebugPanel from '@/components/DebugPanel'
import AddRoomModal from '@/components/AddRoomModal'

export default {
  components: { DebugPanel, AddRoomModal },

  computed: {
    rooms() {
      return this.$store.getters['matrix/rooms']
    }
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

.room-list {
  text-align: left;
}
</style>
