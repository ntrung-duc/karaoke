export const ANIMALS=[
 {id:'cat',name:'Mèo',icon:'🐱',height:.95,color:'#f5a137'},
 {id:'dog',name:'Chó',icon:'🐶',height:1.08,color:'#d99a49'},
 {id:'duck',name:'Vịt',icon:'🦆',height:.68,color:'#ffd84a'},
 {id:'chicken',name:'Gà',icon:'🐔',height:.76,color:'#f2eee5'},
 {id:'cow',name:'Bò',icon:'🐄',height:1.40,color:'#f1eee8'},
 {id:'bear',name:'Gấu',icon:'🐻',height:1.28,color:'#865137'},
 {id:'pig',name:'Lợn',icon:'🐷',height:1.02,color:'#efa0ae'},
 {id:'horse',name:'Ngựa',icon:'🐴',height:1.62,color:'#ac6839'},
 {id:'dragon',name:'Rồng',icon:'🐲',height:1.85,color:'#43984b'},
];
export const isAnimal=value=>ANIMALS.some(animal=>animal.id===value);
export const animalId=value=>isAnimal(value)?value:'cat';
export const animalInfo=value=>ANIMALS.find(animal=>animal.id===animalId(value));
