'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');
(async()=>{
  const url=process.env.GH_SITE_URL||'https://fabiorodrigospt-coder.github.io/guedes.hub/';
  const version=require('../package.json').version.split('.').slice(0,2).join('.');
  fs.mkdirSync('auditoria',{recursive:true});
  const browser=await chromium.launch({headless:true});
  try{
    for(const config of [{name:'desktop',width:1280,height:800},{name:'celular',width:390,height:844}]){
      const page=await browser.newPage({viewport:{width:config.width,height:config.height}});
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      try{
        const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:45000});
        assert.equal(response?.status(),200,'Site indisponível em '+url);
        await page.locator('#loginForm').waitFor({state:'visible',timeout:20000});
        assert.match(await page.title(),new RegExp('Guedes Hub '+version.replace('.','\\.')),'Versão publicada desatualizada');
        const user=page.locator('#email'),pass=page.locator('#password');
        await user.fill('teste-sem-envio');
        await pass.fill('nao-submeter');
        assert.equal(await user.inputValue(),'teste-sem-envio');
        assert.equal(await pass.inputValue(),'nao-submeter');
        const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
        assert.equal(overflow,false,'Transbordamento horizontal em '+config.name);
        await page.screenshot({path:'auditoria/site-'+config.name+'.png',fullPage:true});
        assert.deepEqual(errors,[],'Erros JavaScript em '+config.name);
        console.log('PASS: site público '+config.name+', carregamento, versão e campos de login.');
      }finally{await page.close();}
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
