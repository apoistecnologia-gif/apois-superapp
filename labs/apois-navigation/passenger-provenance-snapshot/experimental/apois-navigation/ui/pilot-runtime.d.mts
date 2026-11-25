export type PilotHeaders = {Authorization:string};
export function createPilotRuntime(options?:{installed?:boolean;auth?:unknown;invoke?:unknown;journalFactory?:unknown;locks?:unknown}):{
 legacy<T>(work:(headers:PilotHeaders|undefined)=>Promise<T>,expected?:string):Promise<T>;
 pending(expected?:string):Promise<boolean>;
};
