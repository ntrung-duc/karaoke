import * as T from 'three';

// A separate, rigid head on the mannequin's head bone. Dimensions are meters,
// independent of the FBX centimeter rig. Source body and skeleton stay intact.
export function createMannequinHead(bone, body, material) {
  body.updateWorldMatrix(true,true);
  const group=new T.Group();group.name='RoundedAvatarHead';
  const center=bone.getWorldPosition(new T.Vector3());
  const worldUp=new T.Vector3(0,.085,0).applyQuaternion(body.getWorldQuaternion(new T.Quaternion()));
  center.add(worldUp);
  group.position.copy(bone.worldToLocal(center));
  group.quaternion.copy(bone.getWorldQuaternion(new T.Quaternion()).invert().multiply(body.getWorldQuaternion(new T.Quaternion())));
  const scale=bone.getWorldScale(new T.Vector3());group.scale.set(1/scale.x,1/scale.y,1/scale.z);
  const shape=new T.Mesh(new T.SphereGeometry(1,40,32),material);
  shape.name='AvatarHeadShell';shape.scale.set(.11,.135,.105);shape.castShadow=shape.receiveShadow=true;group.add(shape);
  bone.add(group);return group;
}

