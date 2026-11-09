export const VOWELS=['aa','ee','ih','oh','ou'];

export async function kinTrack(samples,sampleRate,signal){
  const pcm=new Int16Array(samples.length);
  for(let i=0;i<samples.length;i++)pcm[i]=Math.max(-32768,Math.min(32767,Math.round(samples[i]*32767)));
  const r=await fetch(`/lip-sync?sample_rate_hz=${sampleRate}`,{method:'POST',body:pcm,signal});
  if(!r.ok)throw Error('Mouth analysis unavailable');
  return (await r.json()).frames;
}

export function sampleKin(frames,t,nori){
  if(!frames?.length||!nori)return nori;
  const f=frames[Math.max(0,Math.min(frames.length-1,Math.floor(t*40)))];
  return {...nori,open:f.jaw*.55,wide:(f.ee||0)+(f.ih||0),round:(f.oh||0)+(f.ou||0),
    vowels:Object.fromEntries(VOWELS.map(k=>[k,f[k]||0]))};
}
