import {createScenery,batchStaticBoxes} from './scenery.js';
import * as T from 'three';
import {CSS3DRenderer,CSS3DObject} from '/lib/css.js';
import {seats,position,clearSeat} from './layout.js';
import {createAvatar,loadMotions} from './avatar.js';
import {jumpPose,displacementGait,WALK_SPEED,RUN_SPEED} from './motion.js';
import {relativeHeadYaw,faceIndex,skinIndex,shirtColor} from './avatar-settings.js';
import {createCameraControls} from './camera-controls.js';
import {standLocally,reconcilePlayer} from './player-state.js';
import {movementKey} from './input.js';
import {pathToSeat} from './navigation.js';
export function buildHall(view,send,me){
 const scene=new T.Scene(),overlay=new T.Scene(),camera=new T.PerspectiveCamera(62,1,.08,95);
 const web=new T.WebGLRenderer({antialias:true,alpha:true});web.domElement.tabIndex=0;web.domElement.setAttribute('aria-label','Nhà hát 3D: WASD di chuyển, Shift chạy, Space nhảy');web.shadowMap.enabled=true;web.shadowMap.type=T.PCFShadowMap;web.setClearColor(0x24191f,1);web.setPixelRatio(Math.min(devicePixelRatio,1.65));view.prepend(web.domElement);
 const css=new CSS3DRenderer();Object.assign(css.domElement.style,{position:'absolute',inset:'0',pointerEvents:'none'});view.prepend(css.domElement);
 const cube=new T.BoxGeometry(),materials=new Map(),palette=['#1684bd','#238ab8','#207eb2','#348ec2','#227aa8','#2888b8'];
 function mat(c){if(!materials.has(c))materials.set(c,new T.MeshStandardMaterial({color:c,roughness:.79}));return materials.get(c)}
 function box(x,y,z,w,h,d,c,parent=scene){const o=new T.Mesh(cube,mat(c));o.castShadow=h>.2;o.receiveShadow=true;o.scale.set(w,h,d);o.position.set(x,y,z);parent.add(o);return o}
 const {rear,front,poster,hole,spot,shaft,fixture,chairs}=createScenery(scene,box,mat);
 batchStaticBoxes(scene,cube);
 const axis=new T.Vector3(0,1,0),ray=new T.Vector3(),aim=new T.Vector3();
 function focusStage(dt){
  const singer=actors.get(api.owner);
  aim.set(singer?.body.position.x??0,1.05,singer?.body.position.z??-4.7);
  spot.target.position.lerp(aim,1-Math.exp(-12*dt));ray.subVectors(spot.position,spot.target.position);
  const length=ray.length();shaft.position.copy(spot.target.position).addScaledVector(ray,.5);
  shaft.scale.set(length*.225,length,length*.225);shaft.quaternion.setFromUnitVectors(axis,ray.normalize());fixture.quaternion.copy(shaft.quaternion);
 } const actors=new Map(),keys=new Set();const cameraControls=createCameraControls();let self=null,active=false,last=0,previous=performance.now(),dirty=true,drag=null,eyeYaw=0,eyePitch=0,clockOffset=0,pendingStand=false,walkTo=null,press=null;
 const seatRay=new T.Raycaster(),pointer=new T.Vector2();
 function cancelWalk(){walkTo=null;}
 function selectSeat(index){
  if(!self||api.owner===me())return;
  if([...actors.values()].some(a=>a.user?.seat===index&&a.user.id!==me())){document.querySelector('#notice').textContent='Ghế này đã có người ngồi.';return;}
  if(self.seat===index)return;
  stand();first();const route=pathToSeat(self,index);
  if(route){document.querySelector('#close').click();keys.clear();walkTo={index,route};document.querySelector('#notice').textContent='Đang đi đến ghế '+(index+1)+'. Bấm WASD để hủy.';}
 }
 const now=()=>Date.now()+clockOffset;
 loadMotions().catch(()=>{document.querySelector('#notice').textContent='Chưa tải được chuyển động avatar. Tải lại trang để thử lại.'});
 function actor(u){
 const avatar=createAvatar(palette[u.color],mat);scene.add(avatar.body);return avatar;
 }
 const host=document.createElement('div');host.style.cssText='width:800px;height:450px;background:#121212;pointer-events:auto';const target=document.createElement('div');target.id='player';host.append(target);const display=new CSS3DObject(host);overlay.add(display);
 function pose(u){let a=actors.get(u.id);if(!a){a=actor(u);actors.set(u.id,a)}
 if(!a.user)a.body.position.set(u.x,0,u.z);a.user={...u};}
 function animateActors(dt){for(const [id,a] of actors){
 const u=id===me()?self:a.user;if(!u)continue;
 const sitting=u.seat>=0,singer=id===api.owner,jump=sitting?{height:0,state:null}:jumpPose(u.jumpAt,now());
 const moving=!sitting&&u.gait!=='idle'&&u.movingUntil>now();
 const base=a.facing??(u.bodyYaw??(singer?Math.PI:0));
 const target=sitting?0:(u.bodyYaw??(singer?Math.PI:0));
 a.facing=base+Math.atan2(Math.sin(target-base),Math.cos(target-base))*(1-Math.exp(-18*dt));a.body.rotation.y=a.facing;
 const blend=id===me()?1:1-Math.exp(-18*dt);a.body.position.x+=(u.x-a.body.position.x)*blend;a.body.position.z+=(u.z-a.body.position.z)*blend;
 a.body.position.y=(singer?1:0)+jump.height;
 const look=relativeHeadYaw(u.yaw,a.facing);a.setFace(faceIndex(u.face));a.setSkin(skinIndex(u.skin));a.setShirt(shirtColor(u.shirt));
 a.update(dt,sitting?'sit':jump.state||(moving?u.gait:'idle'),look,u.pitch,id===me());
 a.body.visible=id!==me()||cameraControls.mode!=='first';
 }}
 function angle(){document.querySelector('#angle').textContent=cameraControls.mode==='overview'?'Toàn cảnh nhà hát':cameraControls.mode==='avatar'?'Góc nhìn avatar':api.owner===me()?'Trên sân khấu':'Góc nhìn thứ nhất'}
 function first(){if(cameraControls.mode==='overview')cameraControls.setMode('avatar',self);angle();if(self)pose(self)}
 function move(dx,dz){if(!self||self.seat>=0)return;const stage=api.owner===me();
 for(const [x,z] of [[self.x+dx,self.z],[null,self.z+dz]]){const p=position(x??self.x,z,stage);if(stage||clearSeat(p.x,p.z))Object.assign(self,p)}dirty=true}
 function stand(){if(standLocally(self)){pendingStand=true;send({type:'seat',index:-1});dirty=true;}}
 function jump(){if(!self||jumpPose(self.jumpAt,now()).state)return;
 if(cameraControls.mode==='overview')first();
 if(self.seat>=0)stand();
 self.jumpAt=now();dirty=true;send({type:'jump'});}
 const api={owner:null,reconnect(){dirty=true;},appearance(face,skin,shirt){if(self){if(face!==undefined){self.face=faceIndex(face);actors.get(me())?.setFace(self.face);}if(skin!==undefined){self.skin=skinIndex(skin);actors.get(me())?.setSkin(self.skin);}if(shirt!==undefined){self.shirt=shirtColor(shirt);actors.get(me())?.setShirt(self.shirt);}}},media(on){active=on;host.style.visibility=on?'visible':'hidden'},users(users,owner,serverNow){const previousOwner=api.owner,changed=previousOwner!==owner;api.owner=owner;if(Number.isFinite(serverNow))clockOffset=serverNow-Date.now();
 for(const [id,a] of actors)if(!users.some(u=>u.id===id)){scene.remove(a.body);a.dispose();actors.delete(id)}
 for(const u of users){if(u.id===me()){const teleport=changed&&(owner===u.id||previousOwner===u.id),result=reconcilePlayer(self,u,{pendingStand,teleport,now:now()});self=result.player;pendingStand=result.pendingStand;cameraControls.sync(self,teleport);}pose(u)}angle()},peer(u){if(u.id!==me())pose(u);},camera(){if(cameraControls.cycle(self))dirty=true;eyeYaw=eyePitch=0;angle();if(self)pose(self)},seat(){cancelWalk();if(self?.seat>=0){stand();first();}}};
 web.domElement.onpointerdown=e=>{web.domElement.focus({preventScroll:true});drag=[e.clientX,e.clientY];press=[e.clientX,e.clientY];web.domElement.setPointerCapture(e.pointerId)};
 web.domElement.onpointermove=e=>{if(!drag||!self)return;const dx=(e.clientX-drag[0])*.005,dy=(e.clientY-drag[1])*.004;drag=[e.clientX,e.clientY];if(cameraControls.mode==='overview'){eyeYaw-=dx;eyePitch=Math.max(-.55,Math.min(.65,eyePitch-dy))}else if(cameraControls.turn(dx,dy,self))dirty=true;};
 web.domElement.onpointerup=e=>{
  if(press&&Math.hypot(e.clientX-press[0],e.clientY-press[1])<6){
   const rect=web.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);
   seatRay.setFromCamera(pointer,camera);const hit=seatRay.intersectObjects(chairs,false)[0];if(hit)selectSeat(hit.instanceId);
  }
  drag=press=null;
 };
 web.domElement.onpointercancel=()=>drag=press=null;
 web.domElement.addEventListener('wheel',e=>{
  if(!self||!document.querySelector('#drawer').hidden||cameraControls.mode==='overview')return;
  e.preventDefault();
  const delta=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?view.clientHeight:1),previousMode=cameraControls.mode;
  if(cameraControls.zoom(delta,self))dirty=true;
  if(previousMode!==cameraControls.mode)angle();
 },{passive:false});
 window.addEventListener('keydown',e=>{if(!document.querySelector('#drawer').hidden||e.target.closest('input,textarea,select,[contenteditable="true"]'))return;
 if(e.code==='Space'){e.preventDefault();cancelWalk();if(!e.repeat)jump();return;}
 const key=movementKey(e);if(!key)return;e.preventDefault();cancelWalk();if(cameraControls.mode==='overview')first();keys.add(key)});window.addEventListener('keyup',e=>keys.delete(movementKey(e)));window.addEventListener('blur',()=>keys.clear());
 document.querySelector('#jump').onpointerdown=e=>{e.preventDefault();cancelWalk();jump()};
 document.querySelectorAll('[data-key]').forEach(b=>{b.onpointerdown=e=>{b.setPointerCapture(e.pointerId);cancelWalk();first();keys.add(b.dataset.key)};b.onpointerup=b.onpointercancel=()=>keys.delete(b.dataset.key)});
 new ResizeObserver(()=>{const w=view.clientWidth,h=view.clientHeight;web.setSize(w,h);css.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix()}).observe(view);
 function draw(t){requestAnimationFrame(draw);const dt=Math.min(.1,(t-previous)/1000);previous=t;
 if(cameraControls.mode!=='overview'&&self){const controls=document.querySelector('#drawer').hidden&&!document.activeElement?.matches('input,textarea,select,[contenteditable="true"]');
 const f=controls?(Number(keys.has('w')||keys.has('arrowup'))-Number(keys.has('s')||keys.has('arrowdown'))):0,r=controls?(Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'))):0;
 if((f||r)&&self.seat>=0)stand();
 const oldX=self.x,oldZ=self.z;if(f||r){const v=(keys.has('shift')?RUN_SPEED:WALK_SPEED)*dt/Math.hypot(f,r),heading=cameraControls.movementHeading(self);move((r*Math.cos(heading)-f*Math.sin(heading))*v,(-f*Math.cos(heading)-r*Math.sin(heading))*v)}
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
 const moved=Math.hypot(self.x-oldX,self.z-oldZ)>.00001,gait=moved?displacementGait(self.x-oldX,self.z-oldZ,self.bodyYaw??0,keys.has('shift')):'idle',motionChanged=self.gait!==gait;if(motionChanged)dirty=true;self.gait=gait;self.movingUntil=moved?now()+240:0;
 camera.position.set(self.x,api.owner===me()?2.55:self.seat>=0?1.88:1.55,self.z);
 if(cameraControls.mode==='avatar'){
  const {yaw,pitch,distance}=cameraControls,horizontal=Math.cos(pitch)*distance;
  camera.rotation.set(pitch,yaw,0,'YXZ');
  camera.position.x+=Math.sin(yaw)*horizontal;camera.position.z+=Math.cos(yaw)*horizontal;camera.position.y-=Math.sin(pitch)*distance;
  camera.position.x=T.MathUtils.clamp(camera.position.x,-9.24,9.24);camera.position.z=T.MathUtils.clamp(camera.position.z,-7.05,16.02);
  camera.position.y=T.MathUtils.clamp(camera.position.y,.3,7);
 }else camera.rotation.set(self.pitch,self.yaw,0,'YXZ');
 camera.position.y+=self.seat<0?jumpPose(self.jumpAt,now()).height:0;
 if(dirty&&(motionChanged||t-last>75)){const sent=send({type:'move',x:self.x,z:self.z,yaw:self.yaw,pitch:self.pitch,gait:self.gait});last=t;if(sent)dirty=false}
 }else{camera.position.set(.7,5.35,13.3);camera.rotation.set(-.22+eyePitch,.045+eyeYaw,0,'YXZ')}
 animateActors(dt);focusStage(dt);const monitor=cameraControls.mode!=='overview'&&me()&&api.owner===me()?front:rear;rear.mesh.material=active&&monitor===rear?hole:poster;front.mesh.material=active&&monitor===front?hole:poster;display.visible=active;display.position.set(monitor.x,monitor.y,monitor.z+.015*Math.cos(monitor.rot));display.rotation.y=monitor.rot;display.scale.set(monitor.w/800,monitor.h/450,1);web.render(scene,camera);css.render(overlay,camera);
 }
 requestAnimationFrame(draw);return api;
}





