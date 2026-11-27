export const songs = [
 {id:'faded', title:'Faded (Vocal Mix)', artist:'Alan Walker', bpm:90, file:'alan-walker-faded.mp3', standEvery:16, description:'人声电子 · 起立加强训练'},
 {id:'funk', title:'Funk It', artist:'Tobu', bpm:100, file:'tobu-funk-it.mp3', description:'轻快律动 · 左右交替'},
 {id:'back', title:'Back To You', artist:'Tobu', bpm:101, file:'tobu-back-to-you.mp3', description:'旋律训练 · 交替与同手组合'},
 {id:'neon', title:'Neon Pulse', artist:'MotionFit', bpm:100, file:'neon-pulse-100bpm-120s.wav', description:'原创电子 · 两分钟训练'},
];

// Locate the beat phase in the supplied recording rather than assuming a beat at t=0.
export function buildChart(buffer, song) {
 const step=.01, data=buffer.getChannelData(0), rate=buffer.sampleRate;
 const energies=[];let previous=0;
 for(let t=0;t<buffer.duration;t+=step){
  let energy=0,count=0;
  for(let i=Math.floor(t*rate);i<Math.min(data.length,(t+step)*rate);i+=4){energy+=data[i]*data[i];count++;}
  const rms=Math.sqrt(energy/Math.max(count,1));
  energies.push({energy:rms,onset:Math.max(0,rms-previous)});previous=rms;
 }
 const beat=60/song.bpm;
 let phase=0,best=-Infinity;
 for(let offset=0;offset<beat;offset+=step){
  let score=0;
  for(let t=offset;t<Math.min(buffer.duration,120);t+=beat){
   const i=Math.round(t/step);score+=Math.max(...energies.slice(Math.max(0,i-1),i+2).map(e=>e.onset),0);
  }
  if(score>best){best=score;phase=offset;}
 }
 const notes=[];
 const patterns=song.id==='back'?['left','right','left','right','left','left','right','right']:['left','right'];
 for(let i=0,time=phase;time<buffer.duration-2;i++,time=phase+i*beat){
  if(time<3)continue;
  const standEvery=song.standEvery??32;
  const position=i%standEvery;
  const standPosition=standEvery/2;
  // Leave two beats before and three beats after standing clear.
  if(i>=standEvery&&position>=standPosition-2&&position<=standPosition+3){
   if(position===standPosition)notes.push({time,type:'stand'});
   continue;
  }
  const index=Math.floor(time/step);
  const energy=Math.max(0,...energies.slice(Math.max(0,index-2),index+4).map(e=>e.energy));
  if(energy<.008||time<12&&i%2)continue;
  notes.push({time,type:patterns[i%patterns.length]});
 }
 return {notes,phase,beat,duration:buffer.duration};
}
