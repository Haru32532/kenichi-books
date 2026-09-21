import { access, copyFile, mkdir } from 'node:fs/promises';
const files=['index.html','app.js','style.css','initial_books.json','manifest.webmanifest','sw.js','icon-180.png','icon-512.png'];
await mkdir('public',{recursive:true});
for(const file of files){await access(file);await copyFile(file,`public/${file}`)}
console.log('Static PWA files copied from repository root to public/.');
