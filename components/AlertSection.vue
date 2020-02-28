<template>
  <div>
    <b-alert
      v-for="a in alerts"
      :key="a.contents"
      :dismissible="a.dismissible"
      :variant="a.variant"
      show
    >
      {{ a.contents }}
    </b-alert>
  </div>
</template>

<script>
export default {
  data() {
    return {
      alerts: []
    }
  },
  methods: {
    alert({ variant, dismissible = true, contents = '' }) {
      this.alerts.push({ variant, dismissible, contents })
    }
  }
}
</script>
