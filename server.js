import http from 'node:http';
import {release,checkpointCount,intervalMs} from './policy.js';
import {routes,checkpoints} from './data.js';
import {html,client} from './ui.js';

const jsonType='application/json; charset=utf-8';
http.createServer((req,res)=>{
  const url=new URL(req.url,'http://trackline.local');
  const log=(event,extra={})=>console.log(JSON.stringify({event,release,path:url.pathname,...extra}));
  const send=(status,type,body,headers={})=>{
    log('trackline_request',{method:req.method,status});
    res.writeHead(status,{'content-type':type,'cache-control':'no-store',...headers});res.end(body);
  };
  const json=(status,body)=>send(status,jsonType,JSON.stringify(body));
  if(url.pathname==='/api/preview'){
    if(req.method!=='POST')return send(405,jsonType,'{"error":"method_not_allowed"}',{allow:'POST'});
    if((req.headers['content-type']||'').split(';')[0]!=='application/json')return json(415,{error:'json_required'});
    let chunks=[],bytes=0,oversized=false;
    req.on('data',chunk=>{bytes+=chunk.length;if(bytes>4096){oversized=true;chunks=[];}else if(!oversized)chunks.push(chunk);});
    req.on('end',()=>{
      if(oversized)return json(413,{error:'body_limit'});
      let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return json(400,{error:'invalid_json'});}
      const route=routes.find(r=>r.id===body?.route);
      if(!route)return json(404,{error:'unknown_route'});
      if(!Number.isInteger(body.parcels)||body.parcels<1||body.parcels>12)return json(422,{error:'parcel_limit'});
      return json(200,{release,route:route.id,destination:route.destination,parcels:body.parcels,checkpoints:checkpointCount});
    });return;
  }
  if(req.method!=='GET')return send(405,jsonType,'{"error":"method_not_allowed"}',{allow:'GET'});
  if(url.pathname==='/')return send(200,'text/html; charset=utf-8',html);
  if(url.pathname==='/client.js')return send(200,'text/javascript; charset=utf-8',client);
  if(url.pathname==='/favicon.ico')return send(204,'image/x-icon','');
  if(url.pathname==='/api/health')return json(200,{ok:true,service:'trackline',release,checkpointCount,intervalMs});
  if(url.pathname==='/api/routes')return json(200,{release,routes});
  if(url.pathname==='/api/stream'){
    const route=routes.find(r=>r.id===url.searchParams.get('route'));
    if(!route)return json(404,{error:'unknown_route'});
    const cursor=req.headers['last-event-id']??url.searchParams.get('after')??'0';
    if(!/^\d+$/.test(cursor)||Number(cursor)>checkpointCount)return json(400,{error:'invalid_cursor'});
    let index=Number(cursor),timer=null,closed=false;
    res.writeHead(200,{'content-type':'text/event-stream; charset=utf-8','cache-control':'no-cache, no-transform','x-accel-buffering':'no'});
    res.write(': connected\n\n');
    log('trackline_stream_open',{route:route.id,after:index});
    const close=()=>{if(closed)return;closed=true;if(timer!==null)clearInterval(timer);log('trackline_stream_close',{route:route.id,last:index});};
    res.on('close',close);
    const finish=()=>{res.write('event: complete\ndata: '+JSON.stringify({release,route:route.id,last:index})+'\n\n');res.end();close();};
    if(index===checkpointCount)return finish();
    timer=setInterval(()=>{
      if(closed)return;
      const step=checkpoints[index];index+=1;
      const data={release,route:route.id,destination:route.destination,id:index,total:checkpointCount,...step};
      res.write(': heartbeat\n\nid: '+index+'\nevent: checkpoint\ndata: '+JSON.stringify(data)+'\n\n');
      log('trackline_checkpoint',{route:route.id,id:index});
      if(index===checkpointCount)finish();
    },intervalMs);
    return;
  }
  return json(404,{error:'not_found'});
}).listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('trackline_ready release='+release));
