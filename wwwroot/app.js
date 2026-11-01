const $ = selector => document.querySelector(selector);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
let state = { route:'direct', paused:false, databaseOnline:false, queue:[], orders:[], events:[], rejected:0, mission:{protectedCount:0,delivered:0,target:3,complete:false} };
let connected = false, busy = false, generation = 0, revision = 0, initialized = false, won = false;
let sourceRequest = 0, selectedSource = 'handler', sourceCache = {}, lastEvents = '', lastRack = '', lastGoals = '';
const workingOrders = new Set();
const savedSeen = new Set(), arrivals = new Map(), moving = new Set(), cancellations = new Set();
let drag = null, suppressClick = false;
let selectedOrder = null, journeyRequest = 0, journeySignature = '', lastOrderList = '';
let studyPhase = 'try', guideAction = 'send', inspectedTarget = false;
const isMissing = () => state.mission.id === 'missing-order';
const setText = (selector, text) => { if ($(selector).textContent !== text) $(selector).textContent = text; };
const escapeHtml = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

async function request(path, method='GET') {
  const response = await fetch(path,{method,cache:'no-store',signal:AbortSignal.timeout(5000)});
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return {status:response.status,body};
}
function buttons() {
  document.querySelectorAll('#start-lesson,#parcel,#route-direct,#route-queue,#worker-toggle,#database-toggle,#reset,[data-mission]').forEach(button=>{button.disabled=!connected||busy;});
  $('#guide-action').disabled=!connected||busy||guideAction==='wait';
}
function feedback(text) { $('#game-feedback').textContent=text; }
function report(error) { $('#error').textContent=error.message||String(error); $('#error').hidden=false; }
function setLessonStarted(started) {
  document.body.classList.toggle('lesson-started',started);
  $('.lesson-toolbar').hidden=!started;
  $('.workspace').hidden=!started;
}
function apply(snapshot, bootstrap=false) {
  const previousLast = state.events.at(-1)?.sequence ?? 0;
  const nextLast = snapshot.events.at(-1)?.sequence ?? 0;
  if (initialized && (nextLast < previousLast || snapshot.mission.id !== state.mission.id || snapshot.mission.targetOrderId !== state.mission.targetOrderId)) clearVisuals();
  state=snapshot;
  if (bootstrap) state.orders.forEach(order=>savedSeen.add(order.id));
  const deliveries=state.orders.filter(order=>!savedSeen.has(order.id));
  deliveries.forEach(order=>{
    savedSeen.add(order.id);
    const wasQueued=state.events.some(e=>e.traceId===order.traceId&&e.kind==='consumed');
    if (wasQueued) void deliver(order,generation);
  });
  initialized=true;
  render();
  if (selectedOrder) void refreshJourney();
}
function render() {
  const missing=isMissing();
  document.title=`Macofu — ${missing?'Accepted, but missing':'Rush hour'}`;
  const title=missing?'Accepted, but missing':'Rush hour';
  if($('#mission-title').textContent!==title)$('#mission-title').textContent=title;
  document.querySelectorAll('[data-mission]').forEach(button=>button.setAttribute('aria-pressed',button.dataset.mission===state.mission.id || (!state.mission.id&&button.dataset.mission==='rush-hour')));
  $('#inspect-target').hidden=!missing;
  $('#protect-goal').hidden=missing;
  setText('#lesson-description', missing
    ? 'The shop accepted a customer’s order. It never reached the saved records.'
    : 'Customers are placing orders. Your shop can’t save them.');
  setText('#lesson-context',missing
    ? 'The software received the customer’s purchase order, but it hasn’t reached the database, where the shop keeps its records. Trace that order through the factory and find what is stopping it from being saved.'
    : 'The database, where the shop stores its orders, is offline. You’ll use the factory controls to keep three customer purchase orders safe, then bring the database back and save them.');
  setText('#goals-heading', title);
  setText('#goals-description', missing?'Save the reported customer order to complete this part.':'Both tasks use the same three customer orders.');
  setText('#deliver-label', missing?'Save the missing customer order':'Save those same 3 orders');
  setText('#deliver-description', missing?'Inspect the reported order and get it from the queue into the database.':'Restore the database so the worker can save the waiting orders.');
  if(missing&&$('#http-result').textContent==='Ready')$('#http-result').textContent='The customer’s order was accepted into the queue (HTTP 202).';
  $('#http-result').hidden=$('#http-result').textContent==='Ready';
  $('#scene').classList.toggle('route-queue',state.route==='queue');
  $('#scene').classList.toggle('db-online',state.databaseOnline);
  $('#scene').classList.toggle('has-orders',state.orders.length>0);
  factory.update(state, workingOrders.size > 0);
  $('#route-direct').setAttribute('aria-pressed',state.route==='direct');
  $('#route-queue').setAttribute('aria-pressed',state.route==='queue');
  setText('#route-label', state.route==='direct'?'Direct to database':'Via queue');
  $('#worker-toggle').textContent=state.paused?'Start worker':'Pause worker';
  $('.worker-station').classList.toggle('paused',state.paused);
  $('#worker-state').textContent=state.paused?'Paused':!state.databaseOnline?'Waiting for database':state.queue.length?'Delivering':'Ready';
  $('#database-toggle').textContent=state.databaseOnline?'Turn database off':'Restore database';
  const savedCount=state.orders.length;
  $('#db-count').textContent=savedCount?`${state.databaseOnline?'':'Offline. '}${savedCount} ${savedCount===1?'order':'orders'} saved`:state.databaseOnline?'Online':'Offline';
  $('.database-station').classList.toggle('needs-power',!missing&&state.mission.protectedCount===3&&!state.databaseOnline);
  $('#queue-count').textContent=state.queue.length;
  $('#queue-count').hidden=state.queue.length===0;
  const rack=state.queue.filter(order=>!moving.has(order.id));
  const rackSignature=rack.map(order=>order.id).join();
  if (rackSignature!==lastRack) {
    lastRack=rackSignature;
    $('#queue-packages').innerHTML=rack.slice(0,3).map((order,index)=>`<button class="mini-box" data-label="${index+1}" data-order="${escapeHtml(order.id)}" aria-label="Follow order ${escapeHtml(order.id)}" title="Follow order ${escapeHtml(order.id)}"><img alt="" draggable="false"></button>`).join('');
    document.querySelectorAll('.mini-box').forEach((box,index)=>factory.sprite(box,'parcel',factory.manifest.queueSlots[index]));

  }
$('#queue-rack').setAttribute('aria-label',`${state.queue.length} orders waiting in the queue`);
  const target=state.mission.target;
  const protectedCount=missing?(state.mission.targetOrderId?1:0):state.mission.protectedCount;
  const goals=`${state.mission.id}-${protectedCount}-${state.mission.delivered}`;
  if (lastGoals!==goals) {
    lastGoals=goals;
    for (const [id,count] of [['protect',protectedCount],['deliver',state.mission.delivered]]) {
      $(`#${id}-goal`).classList.toggle('done',count===target);
      const pending=id==='deliver'&&!missing&&protectedCount<target&&count===0;
      $(`#${id}-goal`).classList.toggle('current',count<target&&!pending);
      $(`#${id}-progress`).textContent=`${count} of ${target} ${id==='protect'?'accepted':'saved'}. ${count===target?'Complete':pending?'Up next':'In progress'}.`;
    }
  }
  const signature=JSON.stringify(state.events);
  if (signature!==lastEvents) {
    lastEvents=signature;
    $('#history-empty').hidden=state.events.length>0;
    $('#events').innerHTML=state.events.map(e=>`<div class="event"><time>${escapeHtml(e.time)}</time><b>${escapeHtml(e.component)}</b><span>${escapeHtml(e.message)}</span></div>`).join('');
  }
  if (state.mission.complete&&!won) win();
  const listed=[...state.queue.map(order=>({...order,location:'Queued'})),...state.orders.map(order=>({...order,location:'Saved'}))];
  const targetOrder=listed.find(order=>order.id===state.mission.targetOrderId);
  const visible=[...(targetOrder?[targetOrder]:[]),...listed.filter(order=>order!==targetOrder).slice(-7)];
  const orderSignature=JSON.stringify(visible);
  if(orderSignature!==lastOrderList){
    lastOrderList=orderSignature;
    $('#order-list').innerHTML=visible.map(order=>`<button data-order="${escapeHtml(order.id)}"><span class="order-dot ${order.location==='Saved'?'saved':''}"></span>#${escapeHtml(order.id)} <small>${order.location}</small></button>`).join('');
  }
  $('.order-tray').hidden=!visible.length;
  renderGuide();
  buttons();
}
function renderGuide() {
  const missing=isMissing(), accepted=state.mission.protectedCount, saved=state.mission.delivered;
  if(!missing&&accepted===3&&(state.databaseOnline||saved>0))studyPhase='save';
  let title, body, label, action, hint;
  if(state.mission.complete) {
    title=missing?'The missing order is saved.':'All three orders are saved.';
    body=missing?'You found the waiting order and helped it reach the database. Accepted and saved are two different moments.':'The shop kept 3 orders during the outage and saved those same orders after recovery.';
    [label,action]=missing?['Try this part again','reset']:['Continue to Part 2','next-part'];
    hint='Choose Source code above the factory to see how the software handled these orders.';
  } else if(missing) {
    if(!inspectedTarget) {
      title='Follow the customer’s order'; body='Start with its journey. Accepted means the software received the request; saved means the order reached the database.';
      label='Inspect customer order'; action='inspect-order'; hint='Look for the stage where this order is waiting. You do not need to send another order.';
    } else if(!state.databaseOnline) {
      title='Restore the database'; body='The database stores finished orders. It is offline, so the waiting order cannot be saved yet.';
      label='Restore database'; action='restore'; hint='Use Restore database in the factory or the button above.';
    } else if(state.paused) {
      title='Start the worker'; body='The worker is a background program that takes orders from the queue. It is paused. Start it to save this order.';
      label='Start worker'; action='resume'; hint='The database is ready. The paused worker is keeping the order in the queue.';
    } else {
      title='Watch the order reach storage'; body='The worker is running. It will take the waiting order and save it in the database.';
      label='Saving the order…'; action='wait'; hint='Watch the database’s saved count and the order journey.';
    }
  } else if(accepted===3&&studyPhase!=='save') {
    title='Your three orders are safe in the queue'; body='Accepted means each order was kept in the waiting line. Next, get those same orders saved.';
    label='Continue to saving'; action='next-save'; hint='You do not need to send more orders. The next step saves the same three.';
  } else if(studyPhase==='save'&&accepted===3) {
    if(!state.databaseOnline) {
      title='Restore the database'; body='The database is where saved orders live. Restore it so the worker can move the waiting orders into storage.';
      label='Restore database'; action='restore'; hint='Use Restore database here or below the warehouse in the factory.';
    } else if(state.paused) {
      title='Start the worker'; body='The database is ready, but the worker is paused. This background program saves orders from the queue.';
      label='Start worker'; action='resume'; hint='Choose Start worker to let the waiting orders reach the database.';
    } else {
      title='Watch your orders get saved'; body='The worker is taking orders from the queue and saving them. No more customer orders are needed.';
      label='Saving your orders…'; action='wait'; hint='The saved count increases as the worker processes each order.';
    }
  } else if(state.databaseOnline) {
    title='Try the database outage'; body='To try accepting orders during an outage, turn the database off. You can then find a route that keeps the orders waiting safely.';
    label='Make database offline'; action='outage'; hint='This is a simulated outage. Your test orders will wait if you use the queue.';
  } else if(studyPhase==='queue'||state.route==='queue'||accepted>0) {
    if(state.route!=='queue') {
      title='Give orders a waiting line'; body='The API receives each order. Change its route to Via queue so orders can wait while the database is offline.';
      label='Change order route'; action='choose-route'; hint='Open Change route above the factory, then click Via queue. That selects the waiting line.';
    } else {
      title=accepted?'Keep taking customer orders':'Try the queue route'; body='New orders now go into a queue: a waiting line. Click Send order until 3 are accepted. Keep the database offline.';
      label='Send order'; action='send'; hint='Accepted means kept in the queue, not yet saved in the database.';
    }
  } else if(state.rejected>0) {
    title='That order could not be saved'; body='The direct route tried to save immediately. With the database offline, the request failed and no order was kept.';
    label='Try a waiting line'; action='next-queue'; hint='HTTP 503 is the software’s reply that saving is unavailable. The next step explores another route.';
  } else {
    title='Send one customer order'; body='Each parcel is a customer’s purchase order. Click Send order and watch what happens while the database is offline.';
    label='Send order'; action='send'; hint='The database stores saved orders. Offline means it cannot save new ones right now.';
  }
  guideAction=action;
  setText('#guide-title',title); setText('#guide-body',body); setText('#guide-action',label); setText('#hint',hint);
  const progress=missing||state.mission.complete?'':studyPhase==='save'?(saved?`${saved} of 3 orders saved.`:''):accepted>0&&accepted<3?`${accepted} of 3 orders accepted.`:'';
  setText('#guide-progress',progress); $('#guide-progress').hidden=!progress;
  document.querySelectorAll('.next-action').forEach(element=>element.classList.remove('next-action'));
  const target={send:'#parcel','choose-route':'#change-route',restore:'#database-toggle',resume:'#worker-toggle',outage:'#database-toggle'}[action];
  if(target)$(target).classList.add('next-action');
}
function floatLabel(text,x,y,ok=false) {
  const el=document.createElement('span');el.className=`float-label${ok?' ok':''}`;el.textContent=text;
  el.style.left=`${x/10.4}%`;el.style.top=`${y/6.2}%`;$('#effects-layer').append(el);
  setTimeout(()=>el.remove(),1600);
}
function packet(id) {
  const el=document.createElement('span');el.className='flying-parcel';el.dataset.order=id;factory.sprite(el,'parcel',[0,0]);$('#parcels-layer').append(el);return el;
}
function move(el,points,duration,epoch) {
  if (epoch!==generation) return Promise.resolve();
  const set=(x,y)=>{el.style.left=`${x/10.4}%`;el.style.top=`${y/6.2}%`;};
  if (reduceMotion.matches) {set(...points.at(-1));return Promise.resolve();}
  return new Promise(resolve=>{
    let frameId;const start=performance.now();
    const lengths=points.slice(1).map((p,i)=>Math.hypot(p[0]-points[i][0],p[1]-points[i][1]));
    const total=lengths.reduce((a,b)=>a+b,0);
    const cancel=()=>{cancelAnimationFrame(frameId);cancellations.delete(cancel);resolve();};
    cancellations.add(cancel);
    function frame(now) {
      if (epoch!==generation) {cancel();return;}
      if (reduceMotion.matches) {set(...points.at(-1));cancel();return;}
      const progress=Math.min(1,(now-start)/duration);let distance=progress*total,index=0;
      while(index<lengths.length-1&&distance>lengths[index]){distance-=lengths[index];index++;}
      const t=lengths[index] ? distance/lengths[index] : 1;
      set(points[index][0]+(points[index+1][0]-points[index][0])*t,points[index][1]+(points[index+1][1]-points[index][1])*t);
      if(progress<1)frameId=requestAnimationFrame(frame);else{cancellations.delete(cancel);resolve();}
    }
    frameId=requestAnimationFrame(frame);
  });
}
async function dispatchAnimation(result,inbound,el,epoch) {
  const id=result.body.orderId;
  await inbound;
  if(epoch!==generation){el.remove();return;}
  const a=factory.anchors;
  if(result.status===503||result.status===429){
    el.classList.add('failed');
    const destination=result.status===503?a.dbIn:a.queue;
    await move(el,result.status===503?factory.path('api','dbIn'):factory.path('api','branch','queueIn','queue'),420,epoch);
    if(epoch===generation)floatLabel(result.status===503?'Not saved':'Queue full',destination[0],destination[1]-60);
    await move(el,result.status===503?factory.path('dbIn','api','sender'):factory.path('queue','queueIn','branch','api','sender'),420,epoch);
  }else if(result.body.route==='queue'){
    floatLabel('Queued',a.api[0],a.api[1]-95,true);
    await move(el,factory.path('api','branch','queueIn','queue'),450,epoch);
  }else{
    await move(el,factory.path('api','dbIn'),500,epoch);
    if(epoch===generation)floatLabel('Saved',a.dbIn[0],a.dbIn[1]-130,true);
  }
  el.remove();
  if(epoch===generation){moving.delete(id);render();}
}
async function deliver(order,epoch) {
  // Travel visualizes an observed insert; it never gates the worker or mission state.
  if(arrivals.has(order.id))await arrivals.get(order.id);
  if(epoch!==generation)return;
  moving.add(order.id);workingOrders.add(order.id);render();
  const el=packet(order.id);
  await move(el,factory.path('queue','worker'),260,epoch);
  await move(el,factory.path('worker','turn','dbIn'),380,epoch);
  el.remove();
  if(epoch!==generation)return;
  moving.delete(order.id);workingOrders.delete(order.id);
  floatLabel('Saved',factory.anchors.dbIn[0],factory.anchors.dbIn[1]-130,true);
  feedback('Order saved in SQLite.');render();
}
async function sendOrder() {
  if(busy||!connected)return;
  busy=true;revision++;buttons();$('#error').hidden=true;
  const epoch=generation;
  const el=packet('incoming');
  const inbound=move(el,factory.path('sender','api'),200,epoch);
  let visualStarted=false;
  try{
    const result=await request('/api/orders','POST');
    if(![201,202,503,429].includes(result.status))throw new Error(`Unexpected HTTP ${result.status}`);
    const id=result.body.orderId;
    moving.add(id);
    $('#http-result').textContent=`${result.status===202?'Order accepted into the queue':result.status===201?'Order saved':result.status===503?'Order rejected because the database is offline':'Order rejected because the queue is full'} (HTTP ${result.status}).`;
    $('#http-result').className=`http-result ${result.status>=400?'failed':'accepted'}`;
    feedback(result.status===503?'Write failed: database offline.':result.status===429?'Queue full.':result.status===202?'Order queued.':'Order saved.');
    const animation=dispatchAnimation(result,inbound,el,epoch);
    arrivals.set(id,animation);visualStarted=true;
    void animation.finally(()=>{if(epoch===generation)arrivals.delete(id);});
    await refresh();
  }catch(error){report(error);}
  finally{if(!visualStarted)el.remove();busy=false;buttons();}
}
async function control(path,notice) {
  if(busy||!connected)return;
  busy=true;revision++;buttons();$('#error').hidden=true;
  try{
    const result=await request(path,'POST');
    if(result.status!==200)throw new Error(`Control failed (${result.status})`);
    apply(result.body);if(notice)feedback(notice);
    return true;
  }catch(error){report(error);return false;}finally{busy=false;buttons();}
}
function clearVisuals() {
  generation++;
  drag?.ghost?.remove();drag=null;suppressClick=false;$('#api-drop').classList.remove('drop-ready');
  selectedOrder=null;journeyRequest++;journeySignature='';
  $('#journey').hidden=true;
  $('.guide-card').hidden=false;
  studyPhase='try'; inspectedTarget=false;
  closeCode(false); closeTool(false); setRouteChoices(false); setLessonStarted(false);
  $('.lesson-options').open=false;
  [...cancellations].forEach(cancel=>cancel());
  $('#parcels-layer').replaceChildren();$('#effects-layer').replaceChildren();
  moving.clear();arrivals.clear();savedSeen.clear();workingOrders.clear();
  won=false;
  $('.worker-station').classList.remove('working');
  $('#http-result').textContent='Ready';$('#http-result').className='http-result';
  feedback('Mission restarted.');
}
async function reset(missionId=null) {
  if(busy||!connected)return;
  busy=true;revision++;buttons();
  try{
    const result=await request(missionId?`/api/missions/${missionId}`:'/api/reset','POST');
    if(result.status!==200)throw new Error('Could not restart the lab.');
    clearVisuals();state.events=[];apply(result.body);$('#error').hidden=true;
    const lessonUrl=new URL(location.href);
    lessonUrl.searchParams.set('mission',state.mission.id);
    history.replaceState(null,'',lessonUrl);
    feedback(isMissing()?'Missing-order mission ready.':'Rush hour ready.');
    $('#mission-title').focus({preventScroll:true});
    $('.intro').scrollIntoView({block:'start',behavior:reduceMotion.matches?'instant':'smooth'});
  }catch(error){report(error);}finally{busy=false;buttons();}
}
async function refresh() {
  const epoch=revision;
  try{
    let result=await request('/api/state');
    if(epoch!==revision)return;
    if(result.status!==200)throw new Error('Server unavailable');
    if(requestedMission) {
      if(result.body.mission.id!==requestedMission) {
        result=await request(`/api/missions/${requestedMission}`,'POST');
        if(epoch!==revision)return;
        if(result.status!==200)throw new Error('Could not open this lesson part');
      }
      requestedMission=null;
    }
    connected=true;$('#connection').hidden=true;
    apply(result.body,!initialized);
  }catch{
    if(epoch!==revision)return;
    connected=false;$('#connection').hidden=false;
    feedback('Disconnected. Reconnecting…');buttons();
  }
}
function win() {
  won=true;feedback('Lesson part complete.');
}

// Parcel is a native button for keyboard users and a pointer-driven drag target.
$('#parcel').addEventListener('pointerdown',event=>{
  if(busy||!connected||event.button!==0)return;
  drag={x:event.clientX,y:event.clientY,moved:false,ghost:null,id:event.pointerId};
  $('#parcel').setPointerCapture(event.pointerId);
});
$('#parcel').addEventListener('pointermove',event=>{
  if(!drag||drag.id!==event.pointerId)return;
  if(!drag.moved&&Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>7){
    drag.moved=true;drag.ghost=document.createElement('div');drag.ghost.className='drag-ghost';document.body.append(drag.ghost);
  }
  if(!drag.moved)return;
  drag.ghost.style.left=`${event.clientX}px`;drag.ghost.style.top=`${event.clientY}px`;
  $('#api-drop').classList.toggle('drop-ready',overApi(event.clientX,event.clientY));
});
function overApi(x,y){const r=$('.api-art').getBoundingClientRect();return x>=r.left-15&&x<=r.right+15&&y>=r.top-15&&y<=r.bottom+15;}
function endDrag(event,cancelled=false){
  if(!drag)return;const moved=drag.moved;
  drag.ghost?.remove();$('#api-drop').classList.remove('drop-ready');drag=null;
  if(moved){suppressClick=true;setTimeout(()=>{suppressClick=false;},0);if(!cancelled&&overApi(event.clientX,event.clientY))void sendOrder();}
}
$('#parcel').addEventListener('pointerup',event=>endDrag(event));
$('#parcel').addEventListener('pointercancel',event=>endDrag(event,true));
$('#parcel').addEventListener('click',()=>{if(!suppressClick)void sendOrder();});
function setRouteChoices(open) {
  $('#route-choices').hidden=!open;
  $('#change-route').setAttribute('aria-expanded',String(open));
  $('#change-route').textContent=open?'Close choices':'Change route';
  if(open)$('#route-choices').scrollIntoView({block:'nearest',behavior:reduceMotion.matches?'instant':'smooth'});
}
async function selectRoute(route) {
  if(await control(`/api/route/${route}`,`${route==='queue'?'Via queue':'Direct to database'} selected.`)) {
    setRouteChoices(false);
    $('#change-route').focus({preventScroll:true});
  }
}
$('#change-route').addEventListener('click',()=>setRouteChoices($('#route-choices').hidden));
$('#route-direct').addEventListener('click',()=>selectRoute('direct'));
$('#route-queue').addEventListener('click',()=>selectRoute('queue'));
$('#worker-toggle').addEventListener('click',()=>control(`/api/worker/${state.paused?'resume':'pause'}`,state.paused?'Worker started.':'Worker paused.'));
$('#database-toggle').addEventListener('click',()=>control(`/api/database/${state.databaseOnline?'offline':'online'}`,state.databaseOnline?'Database offline.':'Database restored.'));
$('#reset').addEventListener('click',()=>reset());
document.querySelectorAll('[data-mission]').forEach(button=>button.addEventListener('click',()=>{
  if(button.dataset.mission!==state.mission.id)void reset(button.dataset.mission);
}));
$('#start-lesson').addEventListener('click',()=>{
  if(!connected||busy)return;
  setLessonStarted(true);
  $('#guide-title').focus({preventScroll:true});
  $('.lesson-toolbar').scrollIntoView({block:'start',behavior:reduceMotion.matches?'instant':'smooth'});
});
$('#guide-action').addEventListener('click',async()=>{
  if(busy||!connected)return;
  if(matchMedia('(min-width: 1100px)').matches)$('.lesson-toolbar').scrollIntoView({block:'start',behavior:reduceMotion.matches?'instant':'smooth'});
  switch(guideAction) {
    case 'send': await sendOrder(); break;
    case 'next-queue': studyPhase='queue'; render(); break;
    case 'choose-route': setRouteChoices(true); $('#route-queue').focus({preventScroll:true}); $('#route-choices').scrollIntoView({block:'nearest',behavior:reduceMotion.matches?'instant':'smooth'}); break;
    case 'next-save': studyPhase='save'; render(); break;
    case 'restore': await control('/api/database/online','Database restored.'); break;
    case 'outage': await control('/api/database/offline','Database offline.'); break;
    case 'resume': await control('/api/worker/resume','Worker started.'); break;
    case 'inspect-order': await openJourney(state.mission.targetOrderId); break;
    case 'next-part': await reset('missing-order'); break;
    case 'reset': await reset(); break;
  }
});
const toolTitles={help:'Help with this step',progress:'Lesson progress',definitions:'Factory guide',history:'Request history'};
function openTool(name) {
  closeCode(false);
  selectedOrder=null; journeyRequest++; $('#journey').hidden=true;
  $('.guide-card').hidden=true; $('#tool-panel').hidden=false;
  $('.lesson-options').open=false;
  setText('#tool-title',toolTitles[name]);
  document.querySelectorAll('[data-tool-content]').forEach(content=>{content.hidden=content.dataset.toolContent!==name;});
  $('#tool-title').focus({preventScroll:true});
  revealTool($('#tool-panel'));
}
function closeTool(focus=true) {
  $('#tool-panel').hidden=true; $('.guide-card').hidden=false;
  if(focus)$('#guide-action').focus({preventScroll:true});
}
document.querySelectorAll('[data-tool]').forEach(button=>button.addEventListener('click',()=>openTool(button.dataset.tool)));
$('#close-tool').addEventListener('click',()=>closeTool());
$('.lesson-options').addEventListener('keydown',event=>{
  if(event.key==='Escape'){$('.lesson-options').open=false;$('.lesson-options summary').focus();}
});
const terms={order:'Each parcel is data about one customer’s purchase. Send order creates a test order; no real purchase is made.',api:'The API is the shop’s reception desk: software that receives an order request. Change route chooses where it sends new orders.',queue:'A queue is a waiting line for orders that have been accepted but are not saved yet. This lab’s queue lasts until the app or lesson restarts.',worker:'The worker is a background program. It takes orders from the queue and saves them when it is running and the database is online.',database:'The database stores saved orders. Offline means saving is temporarily unavailable. Restore database ends this simulated outage.'};
document.querySelectorAll('[data-term]').forEach(button=>button.addEventListener('click',()=>{
  document.querySelectorAll('[data-term]').forEach(tab=>tab.setAttribute('aria-pressed',String(tab===button)));
  setText('#term-description',terms[button.dataset.term]);
}));
document.querySelectorAll('[data-view]').forEach(button=>button.addEventListener('click',()=>{
  const station=$(`.${button.dataset.view}`);
  const target=station.querySelector('.station-controls')||station.querySelector('button');
  target.scrollIntoView({block:'nearest',inline:'center',behavior:reduceMotion.matches?'instant':'smooth'});
}));

const sources={handler:{focus:'app.MapPost("/api/orders"',description:'Receives each order request and sends a reply to the customer.'},queue:{focus:'if (route == "direct")',description:'Chooses between saving an order immediately and holding it for later.'},worker:{focus:'lab.ProcessNext()',description:'Checks for waiting orders and tries to save the next one.'},database:{focus:'command.CommandText = "INSERT',description:'Adds orders to the saved records in SQLite, the database used here.'}};

async function openJourney(id) {
  closeCode(false); closeTool(false); inspectedTarget=true;
  $('.lesson-options').open=false;
  $('.guide-card').hidden=true;
  selectedOrder=id;journeySignature='';
  $('#journey').hidden=false;
  $('#journey-heading').textContent=`Order #${id}`;
  $('#journey-content').textContent='Loading live evidence…';
  $('#journey-heading').focus({preventScroll:true});
  revealTool($('#journey'));
  await refreshJourney();
}
async function refreshJourney() {
  const id=selectedOrder, token=++journeyRequest;
  if(!id)return;
  try {
    const [result,lookup]=await Promise.all([request(`/api/journeys/${encodeURIComponent(id)}`),request(`/api/orders/${encodeURIComponent(id)}`)]);
    if(token!==journeyRequest||selectedOrder!==id)return;
    if(result.status!==200)throw new Error('This order is no longer in the lab. Choose an order from the current mission.');
    if(![200,404].includes(lookup.status))throw new Error(`Order lookup failed (HTTP ${lookup.status}).`);
    const journey=result.body;
    const signature=JSON.stringify([journey,lookup.status]);
    if(signature===journeySignature)return;
    journeySignature=signature;
    const location=journey.location;
    const waiting=location==='queue'?(journey.paused?'Worker paused':!journey.databaseOnline?'Database unavailable':'Worker ready to process'):location==='database'?'Saved in SQLite':'Request rejected';
    const stages=[['API',`HTTP ${journey.httpStatus}`,true,'handler'],['Queue',journey.route==='queue'&&journey.httpStatus===202?(location==='queue'?'Order waiting':'Consumed'):'Not enqueued',journey.route==='queue'&&journey.httpStatus===202,'queue'],['Worker',journey.events.some(event=>event.kind==='consumed')?'Processed':location==='queue'?waiting:'No queued work',journey.events.some(event=>event.kind==='consumed'),'worker'],['Database',lookup.status===200?'Order found':'Order not found',lookup.status===200,'database']];
    const expanded=$('#journey-content .journey-events')?.open;
    $('#journey-content').innerHTML=`<div class="journey-facts">Trace <code>${escapeHtml(journey.traceId)}</code></div><ol class="journey-stages">${stages.map(([label,detail,done,source])=>`<li class="${done?'reached':''}"><button data-journey-source="${source}" aria-label="Inspect ${label} source code">${label} ↗</button><span>${escapeHtml(detail)}</span></li>`).join('')}</ol><p class="lookup-result"><code>GET /api/orders/${escapeHtml(id)}</code> → <strong>HTTP ${lookup.status}</strong></p><details class="journey-events"${expanded?' open':''}><summary>Events</summary><ol>${journey.events.map(event=>`<li><time>${escapeHtml(event.time)}</time><strong>${escapeHtml(event.component)}</strong><span>${escapeHtml(event.message)}</span></li>`).join('')}</ol></details>`;
  } catch(error) {
    if(token===journeyRequest){journeySignature='';$('#journey-content').textContent=error.message;}
  }
}
document.addEventListener('click',event=>{
  const parcel=event.target.closest('[data-order]');
  if(parcel)void openJourney(parcel.dataset.order);
  const source=event.target.closest('[data-journey-source]');
  if(source)void inspect(source.dataset.journeySource);
});
$('#inspect-target').addEventListener('click',()=>{if(state.mission.targetOrderId)void openJourney(state.mission.targetOrderId);});
$('#close-journey').addEventListener('click',()=>{
  selectedOrder=null;journeyRequest++;$('#journey').hidden=true;
  $('.guide-card').hidden=false; renderGuide(); buttons();
  $('#guide-action').focus({preventScroll:true});
});
function highlight(line){return line.split(/(\/\/.*$|"(?:[^"\\]|\\.)*"|\b(?:var|return|public|private|new|using|namespace|class|sealed|record|void|if|else|lock|async|await|protected|override|while|true|false|null)\b)/g).map(token=>{const safe=escapeHtml(token);return token.startsWith('//')?`<span class="code-comment">${safe}</span>`:token.startsWith('"')?`<span class="code-string">${safe}</span>`:/^(var|return|public|private|new|using|namespace|class|sealed|record|void|if|else|lock|async|await|protected|override|while|true|false|null)$/.test(token)?`<span class="code-keyword">${safe}</span>`:safe;}).join('');}
async function inspect(name){
  $('.lesson-options').open=false;
  const token=++sourceRequest;selectedSource=name;$('#inspector').hidden=false;
  $('.workspace').classList.add('code-open');
  $('#show-guide').setAttribute('aria-pressed','false');
  $('#open-code').setAttribute('aria-pressed','true');
  $('#source-description').textContent=sources[name].description;
  document.querySelectorAll('[data-inspect]').forEach(button=>button.classList.toggle('inspecting',button.dataset.inspect===name));
  $('#open-code').setAttribute('aria-expanded','true');
  revealTool($('#inspector'));
  document.querySelectorAll('[data-source]').forEach(button=>{button.classList.toggle('active',button.dataset.source===name);button.setAttribute('aria-pressed',button.dataset.source===name);});
  $('#source-code').textContent='Loading code…';
  try{
    if(!sourceCache[name]){const response=await fetch(`/api/source/${name}`);if(!response.ok)throw new Error('Could not load code.');sourceCache[name]=await response.text();}
    if(token!==sourceRequest)return;
    const lines=sourceCache[name].split('\n');const focus=lines.findIndex(line=>line.includes(sources[name].focus));
    $('#source-code').innerHTML=lines.map((line,index)=>`<span class="code-line${index===focus?' focus':''}" data-line="${index+1}">${highlight(line)}</span>`).join('');
    const pre=$('#inspector pre');pre.scrollTop=Math.max(0,($('#source-code .focus')?.offsetTop??0)-3*parseFloat(getComputedStyle(pre).lineHeight));
  }catch(error){if(token===sourceRequest)$('#source-code').textContent=error.message;}
}
function revealTool(element) {
  if(matchMedia('(max-width: 1099px)').matches)element.scrollIntoView({behavior:reduceMotion.matches?'instant':'smooth',block:'start'});
  else $('.lesson-toolbar').scrollIntoView({behavior:reduceMotion.matches?'instant':'smooth',block:'start'});
}
document.querySelectorAll('[data-inspect]').forEach(button=>button.addEventListener('click',()=>inspect(button.dataset.inspect)));
document.querySelectorAll('[data-source]').forEach(button=>button.addEventListener('click',()=>inspect(button.dataset.source)));
$('#open-code').addEventListener('click',()=>inspect(selectedSource));
function closeCode(focus=true) {
  sourceRequest++; $('#inspector').hidden=true;
  $('.workspace').classList.remove('code-open');
  document.querySelectorAll('.inspecting').forEach(button=>button.classList.remove('inspecting'));
  $('#open-code').setAttribute('aria-expanded','false'); $('#open-code').setAttribute('aria-pressed','false'); $('#show-guide').setAttribute('aria-pressed','true');
  if(focus)$('#show-guide').focus({preventScroll:true});
}
$('#close-code').addEventListener('click',()=>closeCode());
$('#show-guide').addEventListener('click',()=>closeCode());
async function poll(){if(!busy)await refresh();setTimeout(poll,350);}
// Landing-page links select a part once; ordinary polling preserves shared progress.
let requestedMission = new URLSearchParams(location.search).get('mission');
if (!['rush-hour', 'missing-order'].includes(requestedMission)) requestedMission = null;
factoryReady.then(()=>{render();poll();}).catch(report);
