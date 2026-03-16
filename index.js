'use strict';

(function() {
  var Marzipano = window.Marzipano;
  var data = window.APP_DATA;
  var panoElement = document.querySelector('#pano');

  // --- 1. LER PARÂMETROS DO URL ---
  var urlParams = new URLSearchParams(window.location.search);
  var degToRad = Math.PI / 180;

  var urlFov = urlParams.has('fov') ? parseFloat(urlParams.get('fov')) * degToRad : null;
  var urlPitch = urlParams.has('pitch') ? parseFloat(urlParams.get('pitch')) * degToRad : null;
  var urlYaw = urlParams.has('yaw') ? parseFloat(urlParams.get('yaw')) * degToRad : null;
  var urlMinFov = urlParams.has('minFov') ? parseFloat(urlParams.get('minFov')) * degToRad : null;

  var viewer = new Marzipano.Viewer(panoElement, {
    controls: { mouseViewMode: data.settings.mouseViewMode }
  });

  var scenes = data.scenes.map(function(sceneData) {
    var source = Marzipano.ImageUrlSource.fromString("tiles/" + sceneData.id + "/{z}/{f}/{y}/{x}.webp", { cubeMapPreviewUrl: "tiles/" + sceneData.id + "/preview.webp" });
    var geometry = new Marzipano.CubeGeometry(sceneData.levels);
    
    var maxFov = 120 * degToRad;
    var minFov = urlMinFov !== null ? urlMinFov : (10 * degToRad); // O limite de 10º do Shopify
    
    // O limitador base do Marzipano (que no S24 bloqueia aos 20º)
    var baseLimiter = Marzipano.RectilinearView.limit.traditional(sceneData.faceSize, maxFov);
    
    var limiter = function(params) {
      // 1. Deixamos o Marzipano calcular a segurança para não dar erro "Bad View"
      var p = baseLimiter(params);
      
      // 2. FORÇAMOS o nosso Zoom, ignorando o bloqueio de resolução dele!
      if (params.fov !== undefined) {
        // Se o utilizador mexeu no zoom (dedos), forçamos até aos 10º
        p.fov = Math.max(minFov, Math.min(params.fov, maxFov));
      } else {
        // Se a imagem está só a rodar sozinha, garantimos que se mantém no zoom atual
        p.fov = Math.max(minFov, Math.min(p.fov, maxFov));
      }
      return p;
    };
    
    // --- 3. APLICAR POV E ZOOM INICIAIS ---
    var initView = Object.assign({}, sceneData.initialViewParameters);
    
    if (urlFov !== null) initView.fov = urlFov;
    if (urlPitch !== null) initView.pitch = urlPitch;
    if (urlYaw !== null) initView.yaw = urlYaw;

    var view = new Marzipano.RectilinearView(initView, limiter);
    var scene = viewer.createScene({ source: source, geometry: geometry, view: view, pinFirstLevel: true });
    
    return { scene: scene, view: view };
  });

  // --- ROTAÇÃO AUTOMÁTICA ---
  var autorotate = Marzipano.autorotate({
    yawSpeed: 0.05,
    targetPitch: urlPitch !== null ? urlPitch : 0,
    targetFov: urlFov !== null ? urlFov : Math.PI/2
  });

  viewer.startMovement(autorotate);
  viewer.setIdleMovement(3000, autorotate);

  // --- TOOLTIP E HOTSPOTS ---
  var tooltip = document.createElement('div');
  tooltip.className = 'quadro-tooltip';
  tooltip.style.pointerEvents = 'none';
  document.body.appendChild(tooltip);

  function carregarHotspots() {
    fetch('galeria.json')
      .then(res => res.json())
      .then(quadros => {
        quadros.forEach(q => {
          var a = document.createElement('div');
          
          a.className = 'hotspot-quadro';
          a.style.width = q.w + 'px';
          a.style.height = q.h + 'px';
          a.style.cursor = 'pointer'; 
          
          a.draggable = false; 
          a.style.userSelect = 'none'; 
          a.style.webkitUserSelect = 'none';
          a.style.webkitUserDrag = 'none';
          a.style.touchAction = 'none';
          
          // --- INÍCIO: DATA NO CANTO EXATO DA PINTURA ---
          // Extrair os 4 dígitos do ano do final da informação
          var extrairAno = q.info.match(/\b(\d{4})\s*$/);
          if (extrairAno) {
            var labelAno = document.createElement('div');
            labelAno.className = 'ano-obra';
            labelAno.innerText = extrairAno[1];
            
            // Calculamos a dimensão original (100%) já que o 'q.w'/'q.h' estão a 70%
            // E encontramos a diferença a empurrar para fora (margem extra)
            var margemX = ((q.w / 0.7) - q.w) / 2;
            var margemY = ((q.h / 0.7) - q.h) / 2;
            
            // Empurramos o texto com valores negativos para cobrir o espaço que falta (+ margem de respiração)
            labelAno.style.position = 'absolute';
            labelAno.style.right = -(margemX - 8) + 'px'; 
            labelAno.style.bottom = -(margemY - 5) + 'px';
            
            a.appendChild(labelAno);
          }
          // --- FIM: DATA NO CANTO EXATO DA PINTURA ---

          a.addEventListener('dragstart', (e) => e.preventDefault());

          let startX = 0;
          let startY = 0;

          a.addEventListener('pointerdown', (e) => {
            startX = e.clientX;
            startY = e.clientY;
          });

          a.addEventListener('pointerup', (e) => {
            let diffX = Math.abs(e.clientX - startX);
            let diffY = Math.abs(e.clientY - startY);
            
            if (diffX < 5 && diffY < 5) {
              window.open('https://www.artclara.pt/pages/portefolio#' + q.id, '_blank');
            }
          });

          a.addEventListener('mouseenter', () => { 
            tooltip.innerHTML = q.info; 
            tooltip.style.opacity = '1'; 
          });
          
          a.addEventListener('mouseleave', () => {
            tooltip.style.opacity = '0';
          });
          
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