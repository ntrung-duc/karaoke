import {createFlowers} from './flowers.js';
import {createScenery,batchStaticBoxes} from './scenery.js';
import * as T from 'three';
import {CSS3DRenderer,CSS3DObject} from '/lib/css.js';
import {seats,position,clearSeat,floorHeight} from './layout.js';
import {createAvatar,loadMotions} from './avatar.js';
import {jumpPose,displacementGait,WALK_SPEED} from './motion.js';
import {relativeHeadYaw} from './avatar-settings.js';
import {animalId} from './animal-settings.js';
import {createCameraControls} from './camera-controls.js';
import {standLocally,reconcilePlayer} from './player-state.js';
import {createMovementInput,createSeatGesture} from './input.js';
import {pathToSeat} from './navigation.js';
import {createRenderBudget} from './render-budget.js';
import {createJoystick,createTouchCamera} from './mobile-controls.js';
import {singerScreenRect} from './singer-layout.js';
import {createWerewolfScene} from './werewolf-scene.js';
export function buildHall(view,send,me){
 const scene=new T.Scene(),overlay=new T.Scene(),camera=new T.PerspectiveCamera(62,1,.08,95);
 const theater=new T.Group();scene.add(theater);const wolfArea=createWerewolfScene(scene);let wwState=null,wwUsers=[];
 const flowers=createFlowers(scene);
 const web=new T.WebGLRenderer({antialias:false,alpha:true,powerPreference:'high-performance'});web.domElement.tabIndex=0;web.domElement.setAttribute('aria-label','Nhà hát 3D: WASD di chuyển, Space nhảy');web.shadowMap.enabled=false;web.setClearColor(0x24191f,1);web.setPixelRatio(Math.min(devicePixelRatio,1));view.prepend(web.domElement);
 const css=new CSS3DRenderer();Object.assign(css.domElement.style,{position:'absolute',inset:'0',pointerEvents:'none'});view.prepend(css.domElement);
 const renderBudget=createRenderBudget(Math.min(devicePixelRatio,1));let pixelRatio=web.getPixelRatio();
 const motionDebug=new URLSearchParams(location.search).has('motionDebug');let measuredInput=0,pendingInput=0,debugFrames=0,debugTime=0;
 const cube=new T.BoxGeometry(),materials=new Map(),palette=['#1684bd','#238ab8','#207eb2','#348ec2','#227aa8','#2888b8'];
 function mat(c){if(!materials.has(c))materials.set(c,new T.MeshStandardMaterial({color:c,roughness:.79}));return materials.get(c)}
 function box(x,y,z,w,h,d,c,parent=theater){const o=new T.Mesh(cube,mat(c));o.castShadow=h>.2;o.receiveShadow=true;o.scale.set(w,h,d);o.position.set(x,y,z);parent.add(o);return o}
 const {rear,poster,hole,spot,shaft,fixture,microphone,setMode}=createScenery(theater,box,mat);
 batchStaticBoxes(theater,cube);
 const axis=new T.Vector3(0,1,0),ray=new T.Vector3(),aim=new T.Vector3();
 function focusStage(dt){
  if(wwState||!spot.visible)return;
  const singer=actors.get(api.owner);
  microphone.scale.y=Math.max(.25,(singer?.eyeHeight??1.5)/1.48);
  aim.set(singer?.body.position.x??0,(singer?.body.position.y??1)+(singer?.height??1)*.5,singer?.body.position.z??-4.7);
  spot.target.position.lerp(aim,1-Math.exp(-12*dt));ray.subVectors(spot.position,spot.target.position);
  const length=ray.length();shaft.position.copy(spot.target.position).addScaledVector(ray,.5);
  shaft.scale.set(length*.225,length,length*.225);shaft.quaternion.setFromUnitVectors(axis,ray.normalize());fixture.quaternion.copy(shaft.quaternion);
 } const actors=new Map(),input=createMovementInput(),keys=input.keys,seatGesture=createSeatGesture();const cameraControls=createCameraControls();let self=null,active=false,last=0,previous=performance.now(),dirty=true,drag=null,eyeYaw=0,eyePitch=0,clockOffset=0,pendingStand=false,walkTo=null;
 const drawer=document.querySelector('#drawer'),welcome=document.querySelector('#welcome-dialog');
 const editing=element=>!!element?.closest('input,textarea,select,[contenteditable="true"]');
 const blocked=()=>!!wwState||!drawer.hidden||!!document.querySelector('dialog[open]');
 const focusHall=()=>{if(!document.querySelector('dialog[open]'))web.domElement.focus({preventScroll:true});};
 const seatRay=new T.Raycaster(),pointer=new T.Vector2();
 const seatProxy=new T.InstancedMesh(new T.BoxGeometry(1.42,1.8,1.3),new T.MeshBasicMaterial(),seats.length),seatMatrix=new T.Matrix4();
 seats.forEach((seat,index)=>seatProxy.setMatrixAt(index,seatMatrix.makeTranslation(seat.x,(seat.y||0)+.9,seat.z+.04)));seatProxy.computeBoundingSphere();seatProxy.updateMatrixWorld(true);
 const arrowShape=new T.Shape();arrowShape.moveTo(-.075,.32);arrowShape.lineTo(.075,.32);arrowShape.lineTo(.075,.04);arrowShape.lineTo(.23,.04);arrowShape.lineTo(0,-.24);arrowShape.lineTo(-.23,.04);arrowShape.lineTo(-.075,.04);arrowShape.closePath();
 const seatOutline=new T.Mesh(new T.ShapeGeometry(arrowShape),new T.MeshBasicMaterial({color:'#d5b5ff',side:T.DoubleSide,depthTest:false,depthWrite:false,transparent:true,opacity:1}));seatOutline.visible=false;seatOutline.renderOrder=999;scene.add(seatOutline);
 const tooltip=document.createElement('div');tooltip.id='seat-tooltip';tooltip.setAttribute('role','tooltip');tooltip.hidden=true;document.querySelector('main').append(tooltip);
 const overhead=new Map(),speech=new Map(),labelPoint=new T.Vector3();
 function drawOverhead(){
  let hovered=null;
  if(hoverPoint&&!drag&&!blocked()){
   const rect=web.domElement.getBoundingClientRect();pointer.set((hoverPoint[0]-rect.left)/rect.width*2-1,-(hoverPoint[1]-rect.top)/rect.height*2+1);seatRay.setFromCamera(pointer,camera);
   const hit=seatRay.intersectObjects([...actors.values()].filter(a=>a.body.visible).map(a=>a.body),true)[0];
   if(hit)for(const [id,a] of actors){let node=hit.object;while(node){if(node===a.body){hovered=id;break;}node=node.parent;}if(hovered)break;}
  }
  for(const [id,label] of overhead)if(!actors.has(id)){label.remove();overhead.delete(id);speech.delete(id);}
  for(const [id,a] of actors){
   if(speech.get(id)?.until<Date.now())speech.delete(id);
   const text=speech.get(id)?.text,show=a.body.visible&&(!!wwState||hovered===id||!!text);
   let label=overhead.get(id);if(!label&&show){label=document.createElement('div');label.className='avatar-overhead';document.querySelector('main').append(label);overhead.set(id,label);}if(!label)continue;
   label.hidden=!show;if(!show)continue;
   const seatNumber=wwState?.players.findIndex(p=>p.id===id),displayName=(wwState&&seatNumber>=0?(seatNumber+1)+'. ':'')+(a.user?.name||'Guest')+(wwState&&a.user?.mic?' 🎙':'');const content=displayName+'\n'+(text||'');if(label.dataset.content!==content){label.dataset.content=content;label.replaceChildren();const name=document.createElement('strong');name.textContent=displayName;label.append(name);if(text){const bubble=document.createElement('div');bubble.textContent=text;label.append(bubble);}}
   a.body.getWorldPosition(labelPoint);labelPoint.y+=a.height+.18+(wwState?(a.wwSeated?.79:0):(a.user?.seat>=0?.79:0));labelPoint.project(camera);label.hidden=labelPoint.z>1||labelPoint.z< -1;const rect=web.domElement.getBoundingClientRect();label.style.left=(rect.left+(labelPoint.x+1)*rect.width/2)+'px';label.style.top=(rect.top+(1-labelPoint.y)*rect.height/2)+'px';
  }
 }
 let hoverPoint=null,hoverDirty=false;
 function hideSeatHover(){seatOutline.visible=false;tooltip.hidden=true;}
 function pickSeat(x,y){
  const rect=web.domElement.getBoundingClientRect();pointer.set((x-rect.left)/rect.width*2-1,-(y-rect.top)/rect.height*2+1);seatRay.setFromCamera(pointer,camera);
  const hit=seatRay.intersectObject(seatProxy,false)[0];if(!hit)return null;
  const bodies=[...actors.values()].filter(a=>a.body.visible).map(a=>a.body);
  if(seatRay.intersectObjects(bodies,true).some(other=>other.distance<hit.distance))return null;
  return hit.instanceId;
 }
 function updateSeatHover(){
  hoverDirty=false;if(!hoverPoint||drag||welcome.open){hideSeatHover();return;}
  const index=pickSeat(hoverPoint[0],hoverPoint[1]);if(index===null){hideSeatHover();return;}
  const seat=seats[index],occupant=[...actors.values()].find(a=>a.user?.seat===index)?.user;
  seatOutline.position.set(seat.x,(seat.y||0)+2.12,seat.z+.04);seatOutline.rotation.set(0,camera.rotation.y,0);seatOutline.material.color.set(occupant&&occupant.id!==me()?'#ffba78':'#d5b5ff');seatOutline.visible=true;
  tooltip.textContent='Ghế '+(index+1)+' · '+(occupant?(occupant.id===me()?'Bạn đang ngồi':'Đã có người'):'Trống');tooltip.dataset.seat=String(index+1);tooltip.hidden=false;
  tooltip.style.left=Math.max(8,Math.min(innerWidth-190,hoverPoint[0]+14))+'px';tooltip.style.top=Math.max(8,Math.min(innerHeight-44,hoverPoint[1]-36))+'px';
 }
 function cancelWalk(){walkTo=null;seatGesture.cancel();}
 function selectSeat(index){
  if(!self||api.owner===me())return;
  if([...actors.values()].some(a=>a.user?.seat===index&&a.user.id!==me())){document.querySelector('#notice').textContent='Ghế này đã có người ngồi.';return;}
  if(self.seat===index)return;
  stand();first();const route=pathToSeat(self,index);
  if(route){document.querySelector('#close').click();input.clear();walkTo={index,route};document.querySelector('#notice').textContent='Đang đi đến ghế '+(index+1)+'. Bấm WASD để hủy.';}
 }
 const now=()=>Date.now()+clockOffset;
 loadMotions().catch(()=>{document.querySelector('#notice').textContent='Chưa tải được chuyển động avatar. Tải lại trang để thử lại.'});
 function actor(u){
 const avatar=createAvatar(animalId(u.animal));scene.add(avatar.body);return avatar;
 }
 const host=document.createElement('div');host.style.cssText='width:800px;height:450px;background:#121212;pointer-events:none';const screenElement=document.createElement('div');screenElement.style.cssText='width:800px;height:450px';screenElement.append(host);const display=new CSS3DObject(screenElement);overlay.add(display);
 const singerScreen=document.createElement('div');singerScreen.id='singer-screen';singerScreen.hidden=true;document.querySelector('main').append(singerScreen);
 const privateHost=document.createElement('div');privateHost.style.cssText='width:100%;height:100%;background:#121212;pointer-events:auto';singerScreen.append(privateHost);let playerPrivate=null;
 function playerTarget(){const privateScreen=!!me()&&api.owner===me();playerPrivate=privateScreen;display.visible=active&&!privateScreen;css.render(overlay,camera);host.replaceChildren();privateHost.replaceChildren();const target=document.createElement('div');target.id='player';(privateScreen?privateHost:host).append(target);return target;}

 function pose(u){let a=actors.get(u.id);if(!a){a=actor(u);actors.set(u.id,a)}
 if(!a.user)a.body.position.set(u.x,0,u.z);a.user={...u};}
 function animateActors(dt){for(const [id,a] of actors){
 const u=id===me()?self:a.user;if(!u)continue;
 if(wwState){const p=wolfArea.position(id,wwState,wwUsers);a.wwSeated=p.seated;a.body.position.set(p.x,0,p.z);a.body.rotation.y=p.yaw;a.body.visible=true;a.setAnimal(animalId(u.animal));a.update(dt,p.seated?'sit':'idle',0,0);continue;}
 const sitting=u.seat>=0,singer=id===api.owner,jump=sitting?{height:0,state:null}:jumpPose(u.jumpAt,now());
 const moving=!sitting&&u.gait!=='idle'&&u.movingUntil>now();
 const base=a.facing??(u.bodyYaw??(singer?Math.PI:0));
 const target=sitting?0:(u.bodyYaw??(singer?Math.PI:0));
 a.facing=id===me()?target:base+Math.atan2(Math.sin(target-base),Math.cos(target-base))*(1-Math.exp(-18*dt));a.body.rotation.y=a.facing;
 const blend=id===me()?1:1-Math.exp(-18*dt);a.body.position.x+=(u.x-a.body.position.x)*blend;a.body.position.z+=(u.z-a.body.position.z)*blend;
 a.body.position.y=(sitting?seats[u.seat]?.y||0:singer?1:floorHeight(u.z,u.x))+jump.height;
 a.setAnimal(animalId(u.animal));
 const look=relativeHeadYaw(u.yaw,a.facing);
 a.update(dt,sitting?'sit':'idle',look,u.pitch);
 a.body.visible=id!==me()||cameraControls.mode!=='first';
 }}
 function angle(){web.domElement.dataset.cameraMode=cameraControls.mode;}
 function first(){if(cameraControls.mode==='overview')cameraControls.setMode('avatar',self);angle();if(self)pose(self)}
 function move(dx,dz){if(!self||self.seat>=0)return;const stage=api.owner===me();
 for(const [x,z] of [[self.x+dx,self.z],[null,self.z+dz]]){const p=position(x??self.x,z,stage);if(stage||clearSeat(p.x,p.z))Object.assign(self,p)}dirty=true}
 function stand(){if(standLocally(self)){pendingStand=true;send({type:'seat',index:-1});dirty=true;}}
 function jump(){if(!self||jumpPose(self.jumpAt,now()).state)return;
 if(cameraControls.mode==='overview')first();
 if(self.seat>=0)stand();
 self.jumpAt=now();dirty=true;send({type:'jump'});}
 const api={owner:null,playerTarget,werewolf(game,users){wwState=game;wwUsers=users;theater.visible=!game;wolfArea.update(game,users);web.setClearColor(game?0x101a24:0x24191f,1);if(game){releaseControls();active=false;hideSeatHover();}},chat(entry){speech.set(entry.userId,{text:entry.text,until:Date.now()+7000});},flower(event){flowers.receive(event,now());},flowerTurn(key){flowers.turn(key);},focus:focusHall,reconnect(){if(pendingStand)send({type:'seat',index:-1});dirty=true;},appearance(animal){if(self){self.animal=animalId(animal);actors.get(me())?.setAnimal(self.animal);}},media(on,mode='karaoke'){setMode(mode);active=on;host.style.visibility=on?'visible':'hidden'},users(users,owner,serverNow){const previousOwner=api.owner,changed=previousOwner!==owner;api.owner=owner;if(Number.isFinite(serverNow))clockOffset=serverNow-Date.now();hoverDirty=true;
 for(const [id,a] of actors)if(!users.some(u=>u.id===id)){scene.remove(a.body);a.dispose();actors.delete(id)}
 for(const u of users){if(u.id===me()){const teleport=changed&&(owner===u.id||previousOwner===u.id),result=reconcilePlayer(self,u,{pendingStand,teleport,now:now()});self=result.player;pendingStand=result.pendingStand;cameraControls.sync(self,teleport);}pose(u)}angle()},peer(u){if(u.id!==me())pose(u);},camera(){if(cameraControls.cycle(self))dirty=true;eyeYaw=eyePitch=0;hoverDirty=true;angle();if(self)pose(self)},seat(){cancelWalk();if(self?.seat>=0){stand();first();focusHall();}}};
 web.domElement.oncontextmenu=e=>e.preventDefault();
 const touchCamera=createTouchCamera();
 const joystick=createJoystick(document.querySelector('#joystick'),{onStart(){
  if(welcome.open||!self)return false;if(!drawer.hidden)document.querySelector('#close').click();
  focusHall();cancelWalk();input.clear();first();
 },onMove:(forward,right)=>input.analog(forward,right)});
 function turnCamera(dx,dy){if(cameraControls.mode==='overview'){eyeYaw-=dx;eyePitch=Math.max(-.55,Math.min(.65,eyePitch-dy));}else if(cameraControls.turn(dx,dy,self))dirty=true;}
 function zoomCamera(delta){const previousMode=cameraControls.mode;if(cameraControls.zoom(delta,self))dirty=true;hoverDirty=true;if(previousMode!==cameraControls.mode)angle();}
 web.domElement.onpointerdown=e=>{
  if(wwState)return;
  if(welcome.open||e.button!==0&&e.button!==2)return;
  if(e.pointerType==='touch'){
   e.preventDefault();if(!drawer.hidden)document.querySelector('#close').click();focusHall();hideSeatHover();
   touchCamera.begin(e.pointerId,e.clientX,e.clientY);web.domElement.setPointerCapture(e.pointerId);
   if(touchCamera.count===1)seatGesture.begin(0,e.clientX,e.clientY,!keys.size&&!joystick.active&&!jumpPose(self?.jumpAt,now()).state);else seatGesture.cancel();
   return;
  }
  const allowPick=!editing(document.activeElement)&&!keys.size&&!jumpPose(self?.jumpAt,now()).state;
  e.preventDefault();if(!drawer.hidden)document.querySelector('#close').click();
  focusHall();drag=[e.clientX,e.clientY];seatGesture.begin(e.button,e.clientX,e.clientY,allowPick);hideSeatHover();web.domElement.setPointerCapture(e.pointerId);
 };
 web.domElement.onpointermove=e=>{
  if(wwState)return;
  seatGesture.move(e.clientX,e.clientY);
  if(e.pointerType==='touch'){
   const gesture=touchCamera.move(e.pointerId,e.clientX,e.clientY);if(!gesture||!self||blocked())return;e.preventDefault();
   if(gesture.kind==='zoom'){seatGesture.cancel();if(cameraControls.mode==='overview')first();zoomCamera(gesture.delta);}
   else turnCamera(gesture.dx*.005,gesture.dy*.004);return;
  }
  hoverPoint=[e.clientX,e.clientY];hoverDirty=true;if(!drag||!self)return;const dx=(e.clientX-drag[0])*.005,dy=(e.clientY-drag[1])*.004;drag=[e.clientX,e.clientY];turnCamera(dx,dy);
 };
 web.domElement.onpointerup=e=>{
  if(wwState){if(document.querySelector('dialog[open]'))return;const bounds=web.domElement.getBoundingClientRect();pointer.set((e.clientX-bounds.left)/bounds.width*2-1,-(e.clientY-bounds.top)/bounds.height*2+1);seatRay.setFromCamera(pointer,camera);for(const hit of seatRay.intersectObjects([...actors.values()].map(a=>a.body),true)){const found=[...actors].find(([,a])=>{let object=hit.object;while(object){if(object===a.body)return true;object=object.parent;}return false;});if(found){window.dispatchEvent(new CustomEvent('werewolf-target',{detail:found[0]}));break;}}return;}
  if(seatGesture.release(e.button,e.clientX,e.clientY)){const index=pickSeat(e.clientX,e.clientY);if(index!==null)selectSeat(index);}
  if(e.pointerType==='touch'){touchCamera.end(e.pointerId);hideSeatHover();}else{hoverPoint=[e.clientX,e.clientY];hoverDirty=true;}drag=null;
 };
 web.domElement.onpointercancel=web.domElement.onlostpointercapture=e=>{if(e.pointerType==='touch')touchCamera.end(e.pointerId);drag=null;seatGesture.cancel();hideSeatHover();};
 web.domElement.onpointerleave=()=>{hoverPoint=null;hideSeatHover();};
 web.domElement.addEventListener('wheel',e=>{
  if(!self||blocked()||cameraControls.mode==='overview')return;
  e.preventDefault();
  const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?view.clientHeight:1);zoomCamera(delta);
 },{passive:false});
 window.addEventListener('keydown',e=>{if(blocked()||editing(e.target))return;
 if(e.code==='Space'){if(e.target.closest('button'))return;e.preventDefault();cancelWalk();if(!e.repeat)jump();return;}
 const key=input.press(e);if(!key)return;e.preventDefault();cancelWalk();if(cameraControls.mode==='overview')first();},true);
 window.addEventListener('keyup',e=>input.release(e),true);
 function releaseControls(){joystick.reset();touchCamera.reset();input.clear();cancelWalk();drag=null;hoverPoint=null;hideSeatHover();}
 window.addEventListener('blur',releaseControls);
 window.addEventListener('resize',releaseControls);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)releaseControls();});
 document.addEventListener('focusin',e=>{if(e.target.closest('input,textarea,select,button,[contenteditable="true"]')){joystick.reset();input.clear();}});
 let lyricLayoutDirty=true,lyricRect;
 const hudObserver=new ResizeObserver(()=>{lyricLayoutDirty=true;});
 for(const element of [document.querySelector('#chat-form'),document.querySelector('#singer-controls'),document.querySelector('#joystick')])hudObserver.observe(element);
 new ResizeObserver(()=>{const w=view.clientWidth,h=view.clientHeight;web.setSize(w,h);css.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();lyricLayoutDirty=true;}).observe(view);
 function draw(t){requestAnimationFrame(draw);const frameMs=t-previous,dt=Math.min(.1,frameMs/1000);previous=t;
 const viewFov=cameraControls.mode==='overview'?72:62;if(camera.fov!==viewFov){camera.fov=viewFov;camera.updateProjectionMatrix();}
 if(!document.hidden){const ratio=renderBudget.sample(frameMs);if(ratio!==pixelRatio){pixelRatio=ratio;web.setPixelRatio(ratio);}}
 if(wwState){camera.position.set(30,camera.aspect<.8?23:13,camera.aspect<.8?18:13);camera.lookAt(30,.6,0);input.clear();}
 else if(cameraControls.mode!=='overview'&&self){const controls=!blocked()&&!editing(document.activeElement);
 if(!controls){if(joystick.active)joystick.reset();input.clear();}const movement=input.sample(),f=movement.forward,r=movement.right;
 if(motionDebug&&(f||r)&&movement.lastPressAt!==measuredInput){measuredInput=movement.lastPressAt;pendingInput=measuredInput;}
 if((f||r)&&self.seat>=0)stand();
 const oldX=self.x,oldZ=self.z;if(f||r){const heading=cameraControls.movementHeading(self);move((r*Math.cos(heading)-f*Math.sin(heading))*WALK_SPEED,(-f*Math.cos(heading)-r*Math.sin(heading))*WALK_SPEED)}
 if(walkTo&&controls){
  if([...actors.values()].some(a=>a.user?.seat===walkTo.index&&a.user.id!==me())){cancelWalk();document.querySelector('#notice').textContent='Ghế vừa có người ngồi. Hãy chọn ghế khác.';}
  else if(api.owner===me()||self.seat>=0)cancelWalk();
  else{let budget=WALK_SPEED*dt;
   while(walkTo?.route.length&&budget>0){const target=walkTo.route[0],dx=target.x-self.x,dz=target.z-self.z,d=Math.hypot(dx,dz),step=Math.min(d,budget);
    if(d<.001){walkTo.route.shift();continue;}move(dx/d*step,dz/d*step);budget-=step;if(step===d)walkTo.route.shift();
   }
   if(walkTo&&!walkTo.route.length){send({type:'seat',index:walkTo.index});cancelWalk();document.querySelector('#notice').textContent='';}
  }
 }
 const moved=Math.hypot(self.x-oldX,self.z-oldZ)>.00001;
 if(cameraControls.faceMovement(self,self.x-oldX,self.z-oldZ))dirty=true;if(moved){hoverDirty=true;}
 const gait=moved?displacementGait(self.x-oldX,self.z-oldZ,self.bodyYaw??0,false):'idle',motionChanged=self.gait!==gait;if(motionChanged)dirty=true;self.gait=gait;self.movingUntil=moved?now()+240:0;
 const avatar=actors.get(me()),eyeHeight=(avatar?.eyeHeight??.8)+(self.seat>=0?.79:0),orbitHeight=(avatar?.height??1)*.55+(self.seat>=0?.79:0);
 const baseY=self.seat>=0?(seats[self.seat]?.y||0):(api.owner===me()?1:floorHeight(self.z,self.x));
  camera.position.set(self.x,baseY+(cameraControls.mode==='avatar'?orbitHeight:eyeHeight),self.z);
 if(cameraControls.mode==='avatar'){
  const {yaw,pitch,distance}=cameraControls,horizontal=Math.cos(pitch)*distance;
  camera.rotation.set(pitch,yaw,0,'YXZ');
  camera.position.x+=Math.sin(yaw)*horizontal;camera.position.z+=Math.cos(yaw)*horizontal;camera.position.y-=Math.sin(pitch)*distance;
  camera.position.x=T.MathUtils.clamp(camera.position.x,-9.24,9.24);camera.position.z=T.MathUtils.clamp(camera.position.z,-7.05,16.02);
  camera.position.y=T.MathUtils.clamp(camera.position.y,.3,10.2);
 }else camera.rotation.set(self.pitch,self.yaw,0,'YXZ');
 camera.position.y+=self.seat<0?jumpPose(self.jumpAt,now()).height:0;
 if(dirty&&t-last>=100){const sent=send({type:'move',x:self.x,z:self.z,yaw:self.yaw,bodyYaw:self.bodyYaw,pitch:self.pitch,gait:self.gait});last=t;if(sent)dirty=false}
 }else{camera.position.set(0,9.6,15.8);camera.rotation.set(-.48+eyePitch,eyeYaw,0,'YXZ')}
 flowers.update(now());animateActors(dt);focusStage(dt);const privateScreen=!!me()&&api.owner===me();rear.mesh.material=active&&!privateScreen?hole:poster;display.visible=active&&!privateScreen;singerScreen.hidden=!active||!privateScreen;
 singerScreen.style.pointerEvents=privateScreen?'auto':'none';
 if(privateScreen){
  if(lyricLayoutDirty||!lyricRect){
   const bounds=view.getBoundingClientRect(),chat=document.querySelector('#chat-form').getBoundingClientRect(),controls=document.querySelector('#singer-controls').getBoundingClientRect(),stick=document.querySelector('#joystick').getBoundingClientRect();
   lyricRect=singerScreenRect(bounds.width,bounds.height,{chatTop:chat.top-bounds.top,chatLeft:chat.left-bounds.left,chatBottom:chat.bottom-bounds.top,desktop:!stick.width,controlsBottom:controls.height&&controls.top-bounds.top<bounds.height/2?controls.bottom-bounds.top:0,joystick:stick.width?{left:stick.left-bounds.left,right:stick.right-bounds.left,top:stick.top-bounds.top}:null});lyricLayoutDirty=false;
  }
  Object.assign(singerScreen.style,{left:lyricRect.x+'px',top:lyricRect.y+'px',width:lyricRect.width+'px',height:lyricRect.height+'px'});
 }else{display.position.set(rear.x,rear.y,rear.z+.015);display.rotation.set(0,rear.rot,0);display.scale.set(rear.w/800,rear.h/450,1);}
 drawOverhead();web.render(scene,camera);if(active)css.render(overlay,camera);if(hoverDirty)updateSeatHover();if(playerPrivate!==null&&playerPrivate!==privateScreen){playerPrivate=privateScreen;window.dispatchEvent(new Event('karaoke-player-moved'));}
 if(motionDebug){
  const data=web.domElement.dataset;data.playerX=String(self?.x);data.playerZ=String(self?.z);data.pixelRatio=String(pixelRatio);data.bodyYaw=String(actors.get(me())?.body.rotation.y);
  if(pendingInput){data.inputFrameMs=(performance.now()-pendingInput).toFixed(1);pendingInput=0;}
  if(frameMs>0&&frameMs<200){debugTime+=frameMs;if(++debugFrames===60){data.fps=(60000/debugTime).toFixed(1);debugTime=debugFrames=0;}}
 }
 }
 requestAnimationFrame(draw);return api;
}





