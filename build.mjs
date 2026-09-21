import { access } from 'node:fs/promises';
const required = [
  'public/index.html',
  'public/app.js',
  'public/style.css',
  'public/initial_books.json',
  'public/manifest.webmanifest',
  'public/sw.js'
];
for (const file of required) await access(file);
console.log('Static PWA files verified. Vercel output directory: public');
