// Opt-in instrumentation; never loaded for ordinary visitors.
export function mountDebug(world) {
  const panel = document.createElement('details');
  panel.style.cssText = 'position:fixed;bottom:8px;right:8px;z-index:1000;padding:8px;background:#fff9ed;color:#15263a;font:11px monospace;max-width:320px';
  const summary = document.createElement('summary');
  summary.textContent = 'Renderer diagnostics';
  const button = document.createElement('button');
  button.textContent = 'Benchmark current view';
  const output = document.createElement('pre');
  output.style.whiteSpace = 'pre-wrap';
  button.addEventListener('click', () => {
    output.textContent = JSON.stringify(world.bench(30), null, 2);
  });
  const closeup = document.createElement('button');
  closeup.textContent = 'Inspect courier';
  let inspecting = false;
  closeup.addEventListener('click', () => {
    inspecting = !inspecting;
    document.documentElement.classList.toggle('inspect-courier',inspecting);
    closeup.textContent = inspecting ? 'Restore camera' : 'Inspect courier';
    world.setDebugCamera(inspecting ? (camera, pigeon, heading) => {
      camera.target.copy(pigeon);
      camera.az = heading + 0.8; camera.el = 0.3; camera.dist = 9;
      camera.fov = 36; camera.offX = 0; camera.offY = 0;
    } : null);
  });
  const sample = document.createElement('button');
  sample.textContent = 'Sample 3 seconds';
  sample.addEventListener('click',async()=>{
    sample.disabled=true;output.textContent='Sampling animation frames…';
    try { output.textContent=JSON.stringify(await world.sampleFrames(),null,2); }
    finally { sample.disabled=false; }
  });
  const capture=document.createElement('button');capture.textContent='Save scene PNG';
  capture.addEventListener('click',async()=>{
    const shot=world.capture();
    let preview=panel.querySelector('img');
    if(!preview){preview=document.createElement('img');preview.style.cssText='display:block;width:280px;max-width:100%;margin-top:8px';panel.append(preview);}
    preview.src=shot.url;preview.alt=shot.name;
    if(location.hostname==='127.0.0.1'&&location.port==='8766'){
      const data=await fetch(shot.url).then(r=>r.blob());
      const saved=await fetch(`/__capture/${shot.name}`,{method:'POST',headers:{'Content-Type':'image/png'},body:data});
      output.textContent=saved.ok?`Saved ${shot.name} to docs/overhaul/captures`:`Capture failed: HTTP ${saved.status}`;
    }
  });
  panel.append(summary, button, sample, closeup, capture, output);
  document.body.append(panel);
}
