export default {
  mode: 'spa',
  /*
   ** Headers of the page
   */
  head: {
    titleTemplate(titleChunk) {
      const name = 'Matrix Notepad'
      return titleChunk ? `${name} - ${titleChunk}` : name
    },
    meta: [
      { charset: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      {
        hid: 'description',
        name: 'description',
        content: process.env.npm_package_description || ''
      }
    ],
    link: [{ rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }]
  },
  /*
   ** Customize the progress-bar color
   */
  loading: { color: '#fff' },
  /*
   ** Global CSS
   */
  css: [
    'ant-design-vue/dist/antd.css',

    // lib css
    'codemirror/lib/codemirror.css',
    // theme css
    'codemirror/theme/mdn-like.css'
  ],
  /*
   ** Plugins to load before mounting the App
   */
  plugins: [
    '@/plugins/antd-ui',
    { src: '@/plugins/codemirror.js', ssr: false },
    { src: '@/plugins/matrix.js', ssr: false },
    { src: '@/plugins/debug.js', ssr: false },
    { src: '@/plugins/persist.js', ssr: false }
  ],
  /*
   ** Nuxt.js dev-modules
   */
  buildModules: [
    // Doc: https://github.com/nuxt-community/eslint-module
    '@nuxtjs/eslint-module'
  ],
  /*
   ** Nuxt.js modules
   */
  modules: [
    // Doc: https://axios.nuxtjs.org/usage
    // Right now, stuff is handled by the Matrix JS SDK
    // Would be useful if I ever decide to talk to the HS directly...
    // '@nuxtjs/axios'
  ],

  // axios: {},
  build: {
    extend(config, ctx) {}
  },
  generate: {
    routes: ['404']
  }
}
