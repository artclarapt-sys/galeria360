'use strict';

(function() {
  var Marzipano = window.Marzipano;
  var data = window.APP_DATA;
  var panoElement = document.querySelector('#pano');

  var viewer = new Marzipano.Viewer(panoElement, {
    controls: { mouseViewMode: data.settings.mouseViewMode }
  });

  var scenes = data.scenes.map(function(data) {
    var source = Marzipano.ImageUrlSource.fromString("tiles/" + data.id + "/{z}/{f}/{y}/{x}.jpg", { cubeMapPreviewUrl: "tiles/" + data.id + "/preview.jpg" });
    var geometry = new Marzipano.CubeGeometry(data.levels);
    
    // --- AJUSTE DE ZOOM (FOV) ---
    // 30*Math.PI/180 permite MUITO mais zoom que os 100 anteriores
    var limiter = Marzipano.RectilinearView.limit.traditional(data.faceSize, 30*Math.PI/180, 120*Math.PI/180);
    
    var view = new Marzipano.RectilinearView(data.initialViewParameters, limiter);
    var scene = viewer.createScene({ source: source, geometry: geometry, view: view, pinFirstLevel: true });
    return { scene: scene, view: view };
  });

  // --- ROTAÇÃO AUTOMÁTICA ---
  var autorotate = Marzipano.autorotate({
    yawSpeed: 0.05,
    targetPitch: 0,
    targetFov: Math.PI/2
  });

  // Ativa a rotação
  viewer.startMovement(autorotate);
  
  // --- TEMPO DE REINÍCIO MAIOR ---
  // 15000ms = 15 segundos de espera após o utilizador parar de mexer
  viewer.setIdleMovement(15000, autorotate);

  // Tooltip
  var tooltip = document.createElement('div');
  tooltip.className = 'quadro-tooltip';
  document.body.appendChild(tooltip);

  function carregarHotspots() {
    fetch('galeria.json').then(res => res.json()).then(quadros => {
      quadros.forEach(q => {
        var a = document.createElement('a');
        a.href = 'https://www.artclara.pt/pages/portefolio#' + q.id;
        a.target = '_blank';
        a.className = 'hotspot-quadro';
        a.style.width = q.w + 'px';
        a.style.height = q.h + 'px';
        a.addEventListener('mouseenter', () => { tooltip.innerHTML = q.info; tooltip.style.opacity = '1'; });
        a.addEventListener('mouseleave', () => tooltip.style.opacity = '0');
        a.addEventListener('mousemove', (e) => {
          tooltip.style.left = (e.pageX + 20) + 'px';
          tooltip.style.top = (e.pageY + 20) + 'px';
        });
        scenes[0].scene.hotspotContainer().createHotspot(a, { yaw: q.y, pitch: q.p }, { perspective: { radius: 3660.56, extraRes: 1 } });
      });
    });
  }

  scenes[0].scene.switchTo();
  carregarHotspots();
})();