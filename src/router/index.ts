import Vue from 'vue';
import VueRouter, { RouteConfig } from 'vue-router';
import Home from '../views/Home.vue';

Vue.use(VueRouter);

const is_iframed = window.parent !== window;

const routes: Array<RouteConfig> = [
  {
    path: '/',
    name: 'Home',
    component: Home,
    beforeEnter: (to, from, next) => {
      if (is_iframed) {
        next('/widget');
      } else {
        next();
      }
    },
  },
  {
    path: '/widget',
    name: 'Widget',
    component: () => import(/* webpackChunkName: "widget" */ '../views/Widget.vue'),
    beforeEnter: (to, from, next) => {
      if (is_iframed) {
        next();
      } else {
        next('/');
      }
    },
  },
];

const router = new VueRouter({
  routes,
});

export default router;
