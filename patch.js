const fs = require('fs');
const htmlPath = './public/index.html';
const jsPath = './script_content.js';

const html = fs.readFileSync(htmlPath, 'utf8');
const newJs = fs.readFileSync(jsPath, 'utf8');

const startTag = '<script>';
const endTag = '</script>';
const startIndex = html.indexOf(startTag) + startTag.length;
const endIndex = html.lastIndexOf(endTag);

if (startIndex > startTag.length - 1 && endIndex > -1) {
  const newHtml = html.substring(0, startIndex) + '\n' + newJs + '\n' + html.substring(endIndex);
  fs.writeFileSync(htmlPath, newHtml);
  console.log('Successfully patched index.html');
} else {
  console.error('Could not find script tags');
}
