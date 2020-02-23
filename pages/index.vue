<template>
  <div class="container">
    <div>
      <a-button
        type="dashed"
        block
        style="margin: 10px 0px;"
        @click="$refs.modal.show()"
      >
        + Add
      </a-button>
      <AddRoomModal ref="modal" />

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
    </div>
  </div>
</template>

<script>
import AddRoomModal from '@/components/AddRoomModal'

export default {
  components: { AddRoomModal },

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
