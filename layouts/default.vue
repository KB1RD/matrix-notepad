<template>
  <div>
    <div id="avatar" class="floating-avatar">
      <b-icon icon="person" style="color: white; width: 100%; height: 100%;" />
      <!-- TODO: Load user's profile pic -->
    </div>
    <b-popover
      target="avatar"
      title="My Account"
      placement="rightbottom"
      triggers="hover focus"
    >
      <div style="min-width: 150px;">
        <b-checkbox
          style="margin-bottom: 20px;"
          :checked="$store.state.debug"
          @change="(checked) => $store.commit('setDebugEnabled', checked)"
        >
          Enable Debug
        </b-checkbox>
        <b-button variant="danger" size="sm" block @click="onSignOut">
          Sign Out
        </b-button>
      </div>
    </b-popover>

    <nuxt />
  </div>
</template>

<script>
import { debug } from '@/plugins/debug'

export default {
  computed: {
    signed_in() {
      return this.$store.getters['matrix/signedIn']
    }
  },

  watch: {
    signed_in() {
      this.ensureSignedIn()
    }
  },
  mounted() {
    this.ensureSignedIn()
  },

  methods: {
    ensureSignedIn() {
      if (!this.signed_in) {
        const redirect_to = this.$route.path
        this.$router.replace({ path: '/login', query: { redirect_to } })
        debug.log('Not signed in. Redirecting to login...')
        return true
      }
      return false
    },

    onSignOut() {
      this.$store.dispatch(
        'watchBlockingOperation',
        (async () => {
          await this.$matrix.signOut()
        })()
      )
    }
  }
}
</script>

<!-- The defaults do just *fine* ATM -->
<style>
html {
  font-family: 'Source Sans Pro', -apple-system, BlinkMacSystemFont, 'Segoe UI',
    Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 16px;
  word-spacing: 1px;
  -ms-text-size-adjust: 100%;
  -webkit-text-size-adjust: 100%;
  -moz-osx-font-smoothing: grayscale;
  -webkit-font-smoothing: antialiased;
  box-sizing: border-box;
}

*,
*:before,
*:after {
  box-sizing: border-box;
  margin: 0;
}

.floating-avatar {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 100;

  width: 50px;
  height: 50px;
  border-radius: 100%;
  background: #aaa;
}
</style>
