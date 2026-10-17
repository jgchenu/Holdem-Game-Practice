import { Capacitor } from '@capacitor/core';

const keys=['wendao:preferences:v1','wendao:practice:v1','wendao:learning:v1'];
const memory=new Map<string,string>();
let nativeStore: typeof import('@capacitor/preferences')['Preferences'] | null=null;
let pending=Promise.resolve();
let healthy=true;
function failed(){healthy=false;window.dispatchEvent(new Event('wendao:storage-error'));}
export const storageHealthy=()=>healthy;
export function readStorage(key:string):string|null{
  if(memory.has(key))return memory.get(key)!;
  try{return localStorage.getItem(key);}catch{return null;}
}
export function writeStorage(key:string,value:string):boolean{
  memory.set(key,value);let local=true;
  try{localStorage.setItem(key,value);}catch{local=false;}
  if(nativeStore){pending=pending.then(()=>nativeStore!.set({key,value})).catch(failed);return healthy;}
  return local;
}
export async function initializeStorage(){
  if(!Capacitor.isNativePlatform())return;
  try{
    nativeStore=(await import('@capacitor/preferences')).Preferences;
    for(const key of keys){
      const previous=readStorage(key);const {value}=await nativeStore.get({key});
      if(value!==null){memory.set(key,value);try{localStorage.setItem(key,value);}catch{/* Native backing remains authoritative. */}}
      else if(previous!==null){memory.set(key,previous);await nativeStore.set({key,value:previous});}
    }
  }catch{failed();}
}
export async function flushStorage(){await pending;}
