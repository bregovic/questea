import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Questea',
    short_name: 'Questea',
    description: 'Moderní task management pro mobilní věk.',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#FEFCF8',
    theme_color: '#ea580c',
    icons: [
      {
        src: '/android-chrome-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/android-chrome-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
          src: '/apple-touch-icon.png',
          sizes: '180x180',
          type: 'image/png',
      }
    ],
  }
}
