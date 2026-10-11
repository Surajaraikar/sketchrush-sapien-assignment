const { chromium } = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  fs.mkdirSync('artifacts/demo/raw',{recursive:true});
  const browser=await chromium.launch({headless:true}); const contexts=[],pages=[];
  try{
    for(let i=0;i<3;i++){const c=await browser.newContext({viewport:{width:1280,height:720},recordVideo:{dir:'artifacts/demo/raw',size:{width:1280,height:720}}});contexts.push(c);pages.push(await c.newPage());}
    await Promise.all(pages.map(p=>p.goto('http://localhost:3000')));const t0=Date.now();const at=async sec=>sleep(Math.max(0,sec*1000-(Date.now()-t0)));
    await at(2);await pages[0].getByPlaceholder('What should we call you?').fill('Host');await pages[0].getByLabel('Rounds').selectOption('1');await pages[0].getByLabel('Draw time').selectOption('30');await pages[0].getByRole('button',{name:'Create room',exact:true}).click();await pages[0].locator('.room-code strong').waitFor();const code=await pages[0].locator('.room-code strong').innerText();
    for(let i=1;i<3;i++){await at(i===1?10:18);await pages[i].goto(`http://localhost:3000/room/${code}`);await pages[i].getByPlaceholder('What should we call you?').fill(i===1?'Second':'Third');await pages[i].getByRole('button',{name:'Join room',exact:true}).click();await pages[i].locator('.player-row').first().waitFor();}
    await at(25);await pages[0].getByRole('button',{name:/Start game/}).click();
    for(let turn=0;turn<3;turn++){
      const drawer=turn;const choices=pages[drawer].locator('.word-choices button');await choices.first().waitFor({timeout:10000});const word=(await choices.first().innerText()).trim();await at([28,53,78][turn]);await choices.first().click();
      await at([32,57,82][turn]);const box=await pages[drawer].locator('canvas').boundingBox();for(let k=0;k<3;k++){await pages[drawer].mouse.move(box.x+box.width*(.2+k*.1),box.y+box.height*.27);await pages[drawer].mouse.down();await pages[drawer].mouse.move(box.x+box.width*(.42+k*.1),box.y+box.height*(.45+k*.08),{steps:30});await pages[drawer].mouse.up();await sleep(180);}
      const others=[0,1,2].filter(i=>i!==drawer);await at([42,67,92][turn]);for(const i of others){await pages[i].getByRole('textbox',{name:'Your guess or message'}).fill(word);await pages[i].getByRole('button',{name:'Send guess'}).click();await sleep(800);}
    }
    await pages[0].getByText('Final results').waitFor({timeout:10000});await at(103);await pages[0].locator('.replay-list>button').first().click();const slider=pages[0].locator('.replay-controls input');await slider.fill('1');await at(109);await slider.fill('2');await at(115);await slider.fill('3');await pages[0].screenshot({path:'artifacts/demo/final-frame.png'});await at(120);
    const videos=pages.map(p=>p.video());await Promise.all(contexts.map(c=>c.close()));const paths=await Promise.all(videos.map(v=>v.path()));paths.forEach((p,i)=>fs.copyFileSync(p,path.join('artifacts/demo',`player-${i+1}.webm`)));console.log(JSON.stringify({durationSeconds:(Date.now()-t0)/1000,paths},null,2));
  }finally{await Promise.all(contexts.map(c=>c.close().catch(()=>{})));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
