import * as T from 'three';
import {createAvatar} from './animal-avatar.js';
import {animalInfo} from './animal-settings.js';
export function createAnimalPreview(canvas){
 const renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:false});renderer.setSize(320,220,false);renderer.setPixelRatio(1);
 const scene=new T.Scene();scene.background=new T.Color('#e7e1d9');
 scene.add(new T.HemisphereLight(0xffffff,0x887967,2));const light=new T.DirectionalLight(0xffffff,2);light.position.set(-2,4,-4);scene.add(light);
 const camera=new T.PerspectiveCamera(38,320/220,.05,15);camera.position.set(1.8,1.25,-2.5);camera.lookAt(0,.65,0);
 let animal;
 return {show(id){if(animal){scene.remove(animal.body);animal.dispose();}animal=createAvatar(id);animal.body.rotation.y=-.18;scene.add(animal.body);canvas.setAttribute('aria-label','Xem trước '+animalInfo(id).name);renderer.render(scene,camera);},dispose(){animal?.dispose();renderer.dispose();renderer.forceContextLoss();}};
}
