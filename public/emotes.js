export const EMOTES=Object.freeze([{id:'parker',name:'Peter Parker'},{id:'wolf',name:'Dancing Wolf'}]);
export const isEmote=value=>EMOTES.some(emote=>emote.id===value);
export const emoteName=value=>isEmote(value)?value:'parker';
