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
    
    // --- ZOOM EXTREMO PARA MOBILE ---
    // Baixamos de 30 para 10. Agora o telemóvel vai "entrar" dentro do quadro.
    var minFov = 10 * Math.PI / 180; 
    var maxFov = 120 * Math.PI / 180;
    
    var limiter = Marzipano.RectilinearView.limit.traditional(data.faceSize, minFov, maxFov);
    
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

  viewer.startMovement(autorotate);
  
  // --- TEMPO DE REINÍCIO (30 segundos) ---
  // Aumentei para 30000ms para dar tempo de ver os detalhes com calma.
  viewer.setIdleMovement(30000, autorotate);

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