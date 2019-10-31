<template>
  <div>
    <a-popover title="My Account" placement="leftBottom">
      <template slot="content">
        <a-checkbox
          style="margin-bottom: 10px;"
          :checked="$store.state.debug"
          @change="(e) => $store.commit('setDebugEnabled', e.target.checked)"
        >
          Enable Debug
        </a-checkbox>
        <a-button type="danger" size="small" block @click="onSignOut">
          Sign Out
        </a-button>
      </template>
      <a-avatar class="floating-avatar" size="large" icon="user" />
    </a-popover>

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
}
</style>
