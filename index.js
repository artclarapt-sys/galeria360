'use strict';

(function() {
  // --- 1. PREVENÇÃO DE ECRÃ BRANCO NO ZOOM (DPR) ---
  var raloReal = window.devicePixelRatio || 1;
  var dprSeguro = Math.min(raloReal, 1.2); 

  Object.defineProperty(window, 'devicePixelRatio', {
    get: function() { return dprSeguro; }
  });

  var Marzipano = window.Marzipano;
  var screenfull = window.screenfull; 
  var data = window.APP_DATA;

  // Grab elements from DOM
  var panoElement = document.querySelector('#pano');
  var autorotateToggleElement = document.querySelector('#autorotateToggle');
  var fullscreenToggleElement = document.querySelector('#fullscreenToggle');

  // Modo Desktop / Mobile
  if (window.matchMedia) {
    var setMode = function() {
      if (mql.matches) {
        document.body.classList.remove('desktop');
        document.body.classList.add('mobile');
      } else {
        document.body.classList.remove('mobile');
        document.body.classList.add('desktop');
      }
    };
    var mql = matchMedia("(max-width: 500px), (max-height: 500px)");
    setMode();
    mql.addListener(setMode);
  } else {
    document.body.classList.add('desktop');
  }

  // Touch device flag
  document.body.classList.add('no-touch');
  window.addEventListener('touchstart', function() {
    document.body.classList.remove('no-touch');
    document.body.classList.add('touch');
  });

  // Inicializar o Viewer
  var viewerOpts = {
    controls: {
      mouseViewMode: data.settings.mouseViewMode
    }
  };
  var viewer = new Marzipano.Viewer(panoElement, viewerOpts);

  // --- 2. LER PARÂMETROS DO URL COM SEGURANÇA MÁXIMA ---
  // Se o Shopify mandar vazio, evitamos o "NaN" que congela a câmara!
  var urlParams = new URLSearchParams(window.location.search);
  var degToRad = Math.PI / 180;

  function getSafeParam(paramName) {
    if (urlParams.has(paramName)) {
      var val = parseFloat(urlParams.get(paramName));
      if (!isNaN(val)) {
        return val * degToRad; // Devolve o valor válido em radianos
      }
    }
    return null; // Devolve null se estiver vazio ou não for número
  }

  var urlFov    = getSafeParam('fov');
  var urlPitch  = getSafeParam('pitch');
  var urlYaw    = getSafeParam('yaw');
  var urlMinFov = getSafeParam('minFov');
  var urlMaxFov = getSafeParam('maxFov');

  // --- 3. CRIAR A CENA COM LIMITADORES SEGUROS ---
  var scenes = data.scenes.map(function(sceneData) {
    var source = Marzipano.ImageUrlSource.fromString("tiles/" + sceneData.id + "/{z}/{f}/{y}/{x}.webp", { cubeMapPreviewUrl: "tiles/" + sceneData.id + "/preview.webp" });
    var geometry = new Marzipano.CubeGeometry(sceneData.levels);

    // Usa os limites do URL, ou falha em segurança para os padrões (10º e 120º)
    var maxFov = urlMaxFov !== null ? urlMaxFov : (120 * degToRad); 
    var minFov = urlMinFov !== null ? urlMinFov : (10 * degToRad);
    
    // Limite base tradicional do Marzipano (não tocar para manter a fluidez nativa)
    var baseLimiter = Marzipano.RectilinearView.limit.traditional(sceneData.faceSize, 100 * degToRad, 120 * degToRad);
    
    // O nosso limitador customizado à prova de erro
    var limiter = function(params) {
      var p = baseLimiter(params);
      var reqFov = params.fov !== undefined ? params.fov : p.fov;
      p.fov = Math.max(minFov, Math.min(reqFov, maxFov));
      return p;
    };

    // Parâmetros Iniciais
    var initView = Object.assign({}, sceneData.initialViewParameters);
    if (urlFov !== null) initView.fov = urlFov;
    if (urlPitch !== null) initView.pitch = urlPitch;
    if (urlYaw !== null) initView.yaw = urlYaw;

    var view = new Marzipano.RectilinearView(initView, limiter);

    var scene = viewer.createScene({
      source: source,
      geometry: geometry,
      view: view,
      pinFirstLevel: true
    });

    return { scene: scene, view: view };
  });

  // --- 4. ROTAÇÃO AUTOMÁTICA ---
  var autorotate = Marzipano.autorotate({
    yawSpeed: 0.05,
    targetPitch: urlPitch !== null ? urlPitch : 0,
    targetFov: urlFov !== null ? urlFov : Math.PI/2
  });
  
  if(autorotateToggleElement) {
    autorotateToggleElement.addEventListener('click', function() {
      if (autorotateToggleElement.classList.contains('enabled')) {
        autorotateToggleElement.classList.remove('enabled');
        viewer.stopMovement();
        viewer.setIdleMovement(Infinity);
      } else {
        autorotateToggleElement.classList.add('enabled');
        viewer.startMovement(autorotate);
        viewer.setIdleMovement(3000, autorotate);
      }
    });
  }

  // --- 5. FULLSCREEN SEGURO ---
  if (screenfull && screenfull.enabled && fullscreenToggleElement) {
    document.body.classList.add('fullscreen-enabled');
    fullscreenToggleElement.addEventListener('click', function() {
      screenfull.toggle();
    });
    screenfull.on('change', function() {
      if (screenfull.isFullscreen) {
        fullscreenToggleElement.classList.add('enabled');
      } else {
        fullscreenToggleElement.classList.remove('enabled');
      }
    });
  } else {
    document.body.classList.add('fullscreen-disabled');
  }

  // --- 6. REGISTO DE CONTROLOS NATIVOS (UI) ---
  var velocity = 0.7;
  var friction = 3;
  var controls = viewer.controls();
  
  var viewUpElement = document.querySelector('#viewUp');
  var viewDownElement = document.querySelector('#viewDown');
  var viewLeftElement = document.querySelector('#viewLeft');
  var viewRightElement = document.querySelector('#viewRight');
  var viewInElement = document.querySelector('#viewIn');
  var viewOutElement = document.querySelector('#viewOut');

  if(viewUpElement) controls.registerMethod('upElement', new Marzipano.ElementPressControlMethod(viewUpElement, 'y', -velocity, friction), true);
  if(viewDownElement) controls.registerMethod('downElement', new Marzipano.ElementPressControlMethod(viewDownElement, 'y', velocity, friction), true);
  if(viewLeftElement) controls.registerMethod('leftElement', new Marzipano.ElementPressControlMethod(viewLeftElement, 'x', -velocity, friction), true);
  if(viewRightElement) controls.registerMethod('rightElement', new Marzipano.ElementPressControlMethod(viewRightElement, 'x', velocity, friction), true);
  if(viewInElement) controls.registerMethod('inElement', new Marzipano.ElementPressControlMethod(viewInElement, 'zoom', -velocity, friction), true);
  if(viewOutElement) controls.registerMethod('outElement', new Marzipano.ElementPressControlMethod(viewOutElement, 'zoom', velocity, friction), true);

  // --- 7. TOOLTIPS E HOTSPOTS DA GALERIA ---
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

  // --- 8. INICIAR CENA ---
  scenes[0].scene.switchTo();
  
  if (data.settings.autorotateEnabled) {
    if(autorotateToggleElement) autorotateToggleElement.classList.add('enabled');
    viewer.startMovement(autorotate);
    viewer.setIdleMovement(3000, autorotate);
  }

  carregarHotspots();

})();