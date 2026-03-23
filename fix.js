const fs = require('fs');
let js = fs.readFileSync('script_content.js', 'utf8');
js = js.replace(/\\`/g, '`');
js = js.replace(/\\\$/g, '$');
fs.writeFileSync('public/script_content.js', js);
console.log('Fixed script_content.js syntax and moved to public/');
