<template>
  <div class="container">
    <div>
      <b-button
        variant="primary"
        block
        style="margin: 10px 0px;"
        @click="$refs.modal.show()"
      >
        + Add
      </b-button>
      <AddRoomModal ref="modal" />

      <b-list-group>
        <b-list-group-item
          v-for="room in rooms"
          :key="room.roomId"
          href="#"
          class="flex-column align-items-start"
          @click="$router.push('/edit/' + room.roomId)"
        >
          <div class="d-flex w-100 justify-content-between">
            <h5 class="mb-1">{{ room.name }}</h5>
            <small class="text-muted">{{ room.roomId }}</small>
          </div>
        </b-list-group-item>
      </b-list-group>
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
