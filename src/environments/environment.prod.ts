import packageJson from '../../package.json';

export const environment = {
  production: true,
  VERSION: packageJson.version,
  backendURL: 'https://api.taliferro.tech/api',
  apiKey: 'AIzaSyCAAgRd8tq9PXkPKE2zddseYtZ-Xx_P8mU',
  firebaseConfig: {
    projectId: 'taliferrotech',
  },
};
