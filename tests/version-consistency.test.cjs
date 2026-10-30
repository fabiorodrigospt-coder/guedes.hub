'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const pkg=require('../package.json');
const version=pkg.version.split('.').slice(0,2).join('.');
const checks=[
  ['index.html',new RegExp('Guedes Hub '+version.replace('.','\\.')+' — Online')],
  ['workspace.html',new RegExp('<title>Guedes Hub '+version.replace('.','\\.')+'</title>')],
  ['cloud.js',new RegExp('workspace\\.html\\?v='+pkg.version.replaceAll('.','\\.'))],
  ['cloud.js',new RegExp("version:'"+version.replace('.','\\.')+"'")],
  ['sw.js',new RegExp("CACHE=APP\\+'-"+version.replace('.','-')+"-v")],
  ['sw.js',new RegExp("cloud\\.js\\?v="+version.replace('.','\\.'))],
];
for(const [path,expression] of checks){
  const content=fs.readFileSync(path,'utf8');
  assert.match(content,expression,'Versão inconsistente em '+path);
}
console.log('PASS: versão '+pkg.version+' consistente na interface, iframe, backup e cache offline.');
