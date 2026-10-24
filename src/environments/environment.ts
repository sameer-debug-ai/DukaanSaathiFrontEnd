export const environment = {
  production: false,
  /** Relative so the dev proxy (proxy.conf.json) and nginx in Docker keep API calls same-origin. */
  apiUrl: '/api',
};
