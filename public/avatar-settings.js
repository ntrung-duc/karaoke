// The supplied reference image is kept intact; these rectangles select its faces.
export const FACES = [
  {name:'Ngộ nghĩnh', crop:[140,126,170,230]},
  {name:'Tàn nhang', crop:[550,126,190,240]},
  {name:'Tinh nghịch', crop:[970,126,180,220]},
  {name:'Nhếch mép', crop:[150,525,175,240]},
  {name:'Mỉm cười', crop:[560,540,180,240]},
  {name:'Thư thái', crop:[970,555,180,225]},
  {name:'Tự tin', crop:[56,980,320,242]},
  {name:'Dịu dàng', crop:[500,980,285,245]},
  {name:'Rạng rỡ', crop:[960,965,195,250]},
];
export const isFace = value => Number.isInteger(value) && value >= 0 && value < FACES.length;
export const faceIndex = value => isFace(value) ? value : 0;
export const wrapYaw = value => Math.atan2(Math.sin(value), Math.cos(value));
export const relativeHeadYaw = (lookYaw, bodyYaw = 0) => wrapYaw(lookYaw - bodyYaw);

export const SKINS = [
 {name:'Mật ong',color:'#dca264'}, {name:'Sáng',color:'#f5d4b3'},
 {name:'Đào',color:'#eabb97'}, {name:'Nâu ấm',color:'#b97a4b'},
 {name:'Nâu đậm',color:'#805034'}, {name:'Sẫm',color:'#503429'},
];
export const isSkin=value=>Number.isInteger(value)&&value>=0&&value<SKINS.length;
export const skinIndex=value=>isSkin(value)?value:0;
export const skinColor=value=>SKINS[skinIndex(value)].color;
