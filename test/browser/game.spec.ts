import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';

async function threePlayers(browser: Browser, mobile=false) {
  const contexts: BrowserContext[]=[]; const pages: Page[]=[];
  for(let i=0;i<3;i++) { const c=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1365,height:850},deviceScaleFactor:mobile?2:1,isMobile:mobile,hasTouch:mobile}); contexts.push(c); pages.push(await c.newPage()); }
  await pages[0].goto('/'); await pages[0].getByPlaceholder('What should we call you?').fill('Host'); await pages[0].getByLabel('Rounds').selectOption('1'); await pages[0].getByLabel('Draw time').selectOption('30'); await pages[0].getByRole('button',{name:'Create room',exact:true}).click();
  await expect(pages[0].getByText('Game night is')).toBeVisible(); const code=await pages[0].locator('.room-code strong').innerText();
  for(let i=1;i<3;i++){await pages[i].goto(`/room/${code}`); await pages[i].getByPlaceholder('What should we call you?').fill(i===1?'Second':'Third'); await pages[i].getByRole('button',{name:'Join room',exact:true}).click(); await expect(pages[i].getByText('Game night is')).toBeVisible();}
  await expect(pages[0].locator('.player-row')).toHaveCount(3); return {contexts,pages,code};
}
async function selectCurrentWord(pages:Page[]) { const drawer=await Promise.any(pages.map(async(p,i)=>{await expect(p.getByText('Pick your secret word')).toBeVisible({timeout:3000});return i;})); const choices=pages[drawer].locator('.word-choices button'); await expect(choices).toHaveCount(3); const word=(await choices.first().innerText()).trim(); await choices.first().click(); await expect(pages[drawer].locator('.word-strip strong')).toHaveText(word); return {drawer,word}; }
async function draw(p:Page) { await p.locator('canvas').scrollIntoViewIfNeeded();const box=await p.locator('canvas').boundingBox(); if(!box)throw Error('Canvas missing'); await p.mouse.move(box.x+box.width*.2,box.y+box.height*.25);await p.mouse.down();await p.mouse.move(box.x+box.width*.35,box.y+box.height*.4,{steps:12});await p.mouse.up(); }
async function drawTouch(p:Page) { await p.locator('canvas').scrollIntoViewIfNeeded();const box=await p.locator('canvas').boundingBox();if(!box)throw Error('Canvas missing');const cdp=await p.context().newCDPSession(p);const x=box.x+box.width*.2,y=box.y+box.height*.25;await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});for(let i=1;i<=12;i++){await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+box.width*.15*i/12,y:y+box.height*.15*i/12}]});}await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
test('desktop drawing layout fits the screen beside both panels',async({browser})=>{
  const {contexts,pages}=await threePlayers(browser);try{
    await pages[0].getByRole('button',{name:/Start game/}).click();
    const {drawer}=await selectCurrentWord(pages);
    for(const viewport of [{width:1440,height:900},{width:2048,height:1072}]){
      for(const page of pages)await page.setViewportSize(viewport);
      for(const page of [pages[drawer],pages[(drawer+1)%3]]){
        const layout=await page.evaluate(()=>{
          const rect=(selector:string)=>{const {top,bottom,width,height}=document.querySelector(selector)!.getBoundingClientRect();return {top,bottom,width,height};};
          return {screen:innerHeight,scrollHeight:document.documentElement.scrollHeight,players:rect('.players-panel'),chat:rect('.chat-panel'),canvas:rect('.canvas-frame'),center:rect('.center-panel'),toolbar:document.querySelector('.toolbar')?rect('.toolbar'):null};
        });
        expect(layout.scrollHeight).toBeLessThanOrEqual(layout.screen+1);
        expect(layout.players.bottom).toBeLessThanOrEqual(layout.screen+1);
        expect(layout.chat.bottom).toBeLessThanOrEqual(layout.screen+1);
        expect(Math.abs(layout.players.bottom-layout.chat.bottom)).toBeLessThan(2);
        expect(layout.canvas.bottom).toBeLessThanOrEqual(layout.screen+1);
        expect(Math.abs(layout.canvas.width/layout.canvas.height-4/3)).toBeLessThan(.01);
        if(layout.toolbar)expect(layout.toolbar.bottom).toBeLessThanOrEqual(layout.screen+1);
        if(page===pages[drawer])await page.screenshot({path:`artifacts/desktop-fit-${viewport.width}.png`});
      }
    }
  }finally{await Promise.all(contexts.map(c=>c.close()));}
});
test('three players: permissions, drawing, scoring, final leaderboard and replay',async({browser})=>{
  const {contexts,pages,code}=await threePlayers(browser); try {
    await expect(pages[1].getByRole('button',{name:/Start game/})).toHaveCount(0);
    await pages[0].getByRole('button',{name:/Start game/}).click();
    for(let turn=0;turn<3;turn++){
      const {drawer,word}=await selectCurrentWord(pages);
      const others=[0,1,2].filter(i=>i!==drawer);
      await expect(pages[others[0]].locator('.word-strip strong')).not.toHaveText(word);
      if(turn===0){await draw(pages[drawer]);await expect.poll(async()=>pages[others[0]].locator('canvas').evaluate((c:HTMLCanvasElement)=>{const d=c.getContext('2d')!.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]<100&&d[i+1]<100&&d[i+2]<100)n++;return n;})).toBeGreaterThan(10);await pages[drawer].screenshot({path:'artifacts/desktop-game.png'});}
      for(const i of others){await pages[i].getByRole('textbox',{name:'Your guess or message'}).fill(word);await pages[i].getByRole('button',{name:'Send guess'}).click();await expect(pages[i].getByText('Correct! Nice guess.')).toBeVisible();if(i===others[0])await expect(pages[others[1]].locator('.messages')).not.toContainText(word);}
      await expect(pages[0].getByText('Next turn soon')).toBeVisible();
      await expect(pages[0].getByText('Next turn soon')).toBeHidden({timeout:10000});
    }
    await expect(pages[0].getByText('Final results')).toBeVisible();await expect(pages[0].locator('.replay-list>button')).toHaveCount(3);
    await pages[0].locator('.replay-list>button').first().click();await expect(pages[0].locator('.replay-controls')).toBeVisible();await pages[0].locator('.replay-controls input').fill('1'); await pages[0].screenshot({path:'artifacts/final-replay.png'});
    await pages[1].reload();await expect(pages[1].getByText('Final results')).toBeVisible();await expect(pages[1].locator('.player-row')).toHaveCount(0);
    expect(code).toMatch(/^[A-F0-9]{6}$/);
  }finally{await Promise.all(contexts.map(c=>c.close()));}
});
test('timer expiry and drawer disconnect recover',async({browser})=>{
  const {contexts,pages}=await threePlayers(browser);try{
    await pages[0].getByRole('button',{name:/Start game/}).click();const first=await selectCurrentWord(pages);await expect(pages[0].getByText('Next turn soon')).toBeVisible({timeout:38000});await expect(pages[0].getByText(`Turn over — ${first.word}.`)).toBeVisible();await expect(pages[0].getByText('Next turn soon')).toBeHidden({timeout:10000});
    const second=await selectCurrentWord(pages);await contexts[second.drawer].close();await expect(pages[[0,1,2].find(i=>i!==second.drawer)!].getByText('Next turn soon')).toBeVisible({timeout:10000});
  }finally{await Promise.all(contexts.map(c=>c.close().catch(()=>{})));}
});
test('mobile viewport has usable canvas and no horizontal overflow',async({browser})=>{
  const {contexts,pages}=await threePlayers(browser,true);try{await pages[0].screenshot({path:'artifacts/mobile-lobby.png'});await pages[0].getByRole('button',{name:/Start game/}).click();const {drawer}=await selectCurrentWord(pages);await drawTouch(pages[drawer]);const peer=pages[(drawer+1)%3];await expect.poll(async()=>peer.locator('canvas').evaluate((c:HTMLCanvasElement)=>{const d=c.getContext('2d')!.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]<100&&d[i+1]<100&&d[i+2]<100)n++;return n;})).toBeGreaterThan(10);await pages[drawer].screenshot({path:'artifacts/mobile-game.png',fullPage:true});for(const p of pages)expect(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBeTruthy();}finally{await Promise.all(contexts.map(c=>c.close()));}
});
test('mid-game refresh restores identity, score and canvas without duplicate players',async({browser})=>{
  const {contexts,pages}=await threePlayers(browser);try{
    await pages[0].getByRole('button',{name:/Start game/}).click();const {drawer,word}=await selectCurrentWord(pages);const guesser=[0,1,2].find(i=>i!==drawer)!;
    await draw(pages[drawer]);await pages[guesser].getByRole('textbox',{name:'Your guess or message'}).fill(word);await pages[guesser].getByRole('button',{name:'Send guess'}).click();await expect(pages[guesser].getByText('Correct! Nice guess.')).toBeVisible();
    const before=await pages[guesser].locator('.score-row').filter({hasText:guesser===0?'Host':guesser===1?'Second':'Third'}).locator('b').innerText();
    await pages[guesser].reload();await expect(pages[guesser].getByText('Your turn to draw')).toHaveCount(0);await expect(pages[guesser].locator('.score-row')).toHaveCount(3);
    const after=await pages[guesser].locator('.score-row').filter({hasText:guesser===0?'Host':guesser===1?'Second':'Third'}).locator('b').innerText();expect(after).toBe(before);
    await expect(pages[guesser].locator('canvas')).toBeVisible();await expect(pages[guesser].getByText('Correct! Nice guess.')).toHaveCount(0);
  }finally{await Promise.all(contexts.map(c=>c.close()));}
});
test('late join, private near miss, fill and clear reconcile on peers',async({browser})=>{
  const {contexts,pages,code}=await threePlayers(browser);try{
    await pages[0].getByRole('button',{name:/Start game/}).click();const {drawer,word}=await selectCurrentWord(pages);const guesser=[0,1,2].find(i=>i!==drawer)!;
    await draw(pages[drawer]);const late=await browser.newContext({viewport:{width:1365,height:850}});contexts.push(late);const joined=await late.newPage();await joined.goto(`/room/${code}`);await joined.getByPlaceholder('What should we call you?').fill('Late');await joined.getByRole('button',{name:'Join room',exact:true}).click();await expect(joined.locator('.score-row')).toHaveCount(4);
    await expect.poll(async()=>joined.locator('canvas').evaluate((c:HTMLCanvasElement)=>{const d=c.getContext('2d')!.getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<d.length;i+=4)if(d[i]<100&&d[i+1]<100&&d[i+2]<100)n++;return n;})).toBeGreaterThan(10);
    const near=(word[0].toLowerCase()==='z'?'x':'z')+word.slice(1);await pages[guesser].getByRole('textbox',{name:'Your guess or message'}).fill(near);await pages[guesser].getByRole('button',{name:'Send guess'}).click();await expect(pages[guesser].getByText('Close! Try again.')).toBeVisible();await expect(joined.locator('.messages')).not.toContainText(near);
    await pages[drawer].getByRole('button',{name:'Color #8b5cf6'}).click();await pages[drawer].getByRole('button',{name:'Fill'}).click();await expect.poll(async()=>joined.locator('canvas').evaluate((c:HTMLCanvasElement)=>{const d=c.getContext('2d')!.getImageData(c.width/2,c.height/2,1,1).data;return `${d[0]},${d[1]},${d[2]}`;})).toBe('139,92,246');
    await pages[drawer].getByRole('button',{name:'Clear'}).click();await expect.poll(async()=>joined.locator('canvas').evaluate((c:HTMLCanvasElement)=>{const d=c.getContext('2d')!.getImageData(c.width/2,c.height/2,1,1).data;return `${d[0]},${d[1]},${d[2]}`;})).toBe('255,255,255');
  }finally{await Promise.all(contexts.map(c=>c.close()));}
});
