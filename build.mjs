import { access, copyFile, mkdir } from 'node:fs/promises';
const files=['index.html','app.js','style.css','initial_books.json','kumon_2026_missing.json','overseas_recommendations.json','miete_2026_import.json','library_metadata.json','manifest.webmanifest','sw.js','icon-180.png','icon-512.png'];
await mkdir('public',{recursive:true});
for(const file of files){await access(file);await copyFile(file,`public/${file}`)}
console.log('Static PWA files copied from repository root to public/.');
