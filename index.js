'use strict';

(function() {
  // --- 1. DETEÇÃO DE IOS ---
  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var raloReal = window.devicePixelRatio || 1;
  
  // Limita o DPR a 1 no iOS, e a 2 no resto
  var dprSeguro = isIOS ? 1 : Math.min(raloReal, 2); 

  Object.defineProperty(window, 'devicePixelRatio', {
    get: function() { return dprSeguro; }
  });

  var Marzipano = window.Marzipano;
  var screenfull = window.screenfull;
  var data = window.APP_DATA;
  
  var panoElement = document.querySelector('#pano');
  var fullscreenToggleElement = document.querySelector('#fullscreenToggle');

  var urlParams = new URLSearchParams(window.location.search);
  var degToRad = Math.PI / 180;

  var urlFov = urlParams.has('fov') ? parseFloat(urlParams.get('fov')) * degToRad : null;
  var urlPitch = urlParams.has('pitch') ? parseFloat(urlParams.get('pitch')) * degToRad : null;
  var urlYaw = urlParams.has('yaw') ? parseFloat(urlParams.get('yaw')) * degToRad : null;
  var urlMinFov = urlParams.has('minFov') ? parseFloat(urlParams.get('minFov')) * degToRad : null;
  var urlMaxFov = urlParams.has('maxFov') ? parseFloat(urlParams.get('maxFov')) * degToRad : null;

  // --- 2. OTIMIZAÇÃO EXTREMA DO WEBGL PARA IOS ---
  var viewer = new Marzipano.Viewer(panoElement, {
    controls: { mouseViewMode: data.settings.mouseViewMode },
    stage: {
      type: 'webgl',
      preserveDrawingBuffer: false, 
      antialias: !isIOS // Desliga o antialiasing no iOS para poupar imensa RAM
    }
  });

  var scenes = data.scenes.map(function(sceneData) {
    var source = Marzipano.ImageUrlSource.fromString("tiles/" + sceneData.id + "/{z}/{f}/{y}/{x}.webp", { cubeMapPreviewUrl: "tiles/" + sceneData.id + "/preview.webp" });
    
    // --- 3. CORTAR O NÍVEL MAIS PESADO NO IOS ---
    var niveisSeguros = sceneData.levels;
    if (isIOS && niveisSeguros.length > 2) {
      // Remove a última camada (a mais pesada/detalhada) apenas no iOS
      niveisSeguros = niveisSeguros.slice(0, niveisSeguros.length - 1);
    }
    var geometry = new Marzipano.CubeGeometry(niveisSeguros);
    
    var maxFov = urlMaxFov !== null ? urlMaxFov : (120 * degToRad);
    var minFov = urlMinFov !== null ? urlMinFov : (10 * degToRad);
    
    var baseLimiter = Marzipano.RectilinearView.limit.traditional(sceneData.faceSize, maxFov);
    
    var limiter = function(params) {
      var p = baseLimiter(params);
      var fovRequest = params.fov !== undefined ? params.fov : p.fov;
      // Impede um zoom demasiado próximo no iOS para evitar forçar os limites
      var zoomMinimoSeguro = isIOS ? Math.max(minFov, 30 * degToRad) : minFov; 
      p.fov = Math.max(zoomMinimoSeguro, Math.min(fovRequest, maxFov));
      return p;
    };
    
    var initView = Object.assign({}, sceneData.initialViewParameters);
    
    if (urlFov !== null) initView.fov = urlFov;
    if (urlPitch !== null) initView.pitch = urlPitch;
    if (urlYaw !== null) initView.yaw = urlYaw;

    var view = new Marzipano.RectilinearView(initView, limiter);
    var scene = viewer.createScene({ source: source, geometry: geometry, view: view, pinFirstLevel: true });
    
    return { scene: scene, view: view };
  });

  var autorotate = Marzipano.autorotate({
    yawSpeed: 0.05,
    targetPitch: urlPitch !== null ? urlPitch : 0,
    targetFov: urlFov !== null ? urlFov : Math.PI/2
  });

  viewer.startMovement(autorotate);
  viewer.setIdleMovement(3000, autorotate);

  if (screenfull && screenfull.enabled && fullscreenToggleElement) {
    document.body.classList.add('fullscreen-enabled');
    fullscreenToggleElement.addEventListener('click', function() { screenfull.toggle(); });
    screenfull.on('change', function() {
      if (screenfull.isFullscreen) { fullscreenToggleElement.classList.add('enabled'); } 
      else { fullscreenToggleElement.classList.remove('enabled'); }
    });
  } else {
    document.body.classList.add('fullscreen-disabled');
  }

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

          var extrairAno = q.info.match(/\b(\d{4})\s*$/);
          if (extrairAno) {
            var labelAno = document.createElement('div');
            labelAno.className = 'ano-obra';
            labelAno.innerText = extrairAno[1];
            a.appendChild(labelAno);
          }
          
          a.addEventListener('dragstart', (e) => e.preventDefault());

          let startX = 0;
          let startY = 0;

          a.addEventListener('pointerdown', (e) => { startX = e.clientX; startY = e.clientY; });

          a.addEventListener('pointerup', (e) => {
            let diffX = Math.abs(e.clientX - startX);
            let diffY = Math.abs(e.clientY - startY);
            if (diffX < 5 && diffY < 5) {
              window.open('https://www.artclara.pt/pages/portefolio#' + q.id, '_blank');
            }
          });

          a.addEventListener('mouseenter', () => { tooltip.innerHTML = q.info; tooltip.style.opacity = '1'; });
          a.addEventListener('mouseleave', () => { tooltip.style.opacity = '0'; });
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