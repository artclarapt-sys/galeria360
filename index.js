'use strict';

(function() {
  // --- 1. PREVENÇÃO DE ECRÃ BRANCO NO ZOOM ---
  var raloReal = window.devicePixelRatio || 1;
  var dprSeguro = Math.min(raloReal, 1.2); 

  Object.defineProperty(window, 'devicePixelRatio', {
    get: function() { return dprSeguro; }
  });

  var Marzipano = window.Marzipano;
  var bowser = window.bowser;
  var screenfull = window.screenfull;
  var data = window.APP_DATA;

  // Grab elements from DOM.
  var panoElement = document.querySelector('#pano');
  var autorotateToggleElement = document.querySelector('#autorotateToggle');
  var fullscreenToggleElement = document.querySelector('#fullscreenToggle');

  // Detect desktop or mobile mode.
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

  // Detect whether we are on a touch device.
  document.body.classList.add('no-touch');
  window.addEventListener('touchstart', function() {
    document.body.classList.remove('no-touch');
    document.body.classList.add('touch');
  });

  // Use tooltip fallback mode on IE < 11.
  if (bowser.msie && parseFloat(bowser.version) < 11) {
    document.body.classList.add('tooltip-fallback');
  }

  // Viewer options.
  var viewerOpts = {
    controls: {
      mouseViewMode: data.settings.mouseViewMode
    }
  };

  // Initialize viewer.
  var viewer = new Marzipano.Viewer(panoElement, viewerOpts);

  // --- 2. LER PARÂMETROS DO URL (SHOPIFY) ---
  var urlParams = new URLSearchParams(window.location.search);
  var degToRad = Math.PI / 180;

  var urlFov = urlParams.has('fov') ? parseFloat(urlParams.get('fov')) * degToRad : null;
  var urlPitch = urlParams.has('pitch') ? parseFloat(urlParams.get('pitch')) * degToRad : null;
  var urlYaw = urlParams.has('yaw') ? parseFloat(urlParams.get('yaw')) * degToRad : null;
  var urlMinFov = urlParams.has('minFov') ? parseFloat(urlParams.get('minFov')) * degToRad : null;
  var urlMaxFov = urlParams.has('maxFov') ? parseFloat(urlParams.get('maxFov')) * degToRad : null;

  // Create scenes.
  var scenes = data.scenes.map(function(sceneData) {
    var source = Marzipano.ImageUrlSource.fromString("tiles/" + sceneData.id + "/{z}/{f}/{y}/{x}.webp", { cubeMapPreviewUrl: "tiles/" + sceneData.id + "/preview.webp" });
    var geometry = new Marzipano.CubeGeometry(sceneData.levels);

    // --- 3. DEFINIR LIMITES DE ZOOM ---
    var maxFov = urlMaxFov !== null ? urlMaxFov : (120 * degToRad); // Usa o URL ou 120 por defeito
    var minFov = urlMinFov !== null ? urlMinFov : (10 * degToRad); // O limite de 10º (ou do URL)
    
    var baseLimiter = Marzipano.RectilinearView.limit.traditional(sceneData.faceSize, maxFov);
    
    var limiter = function(params) {
      var p = baseLimiter(params);
      var fovRequest = params.fov !== undefined ? params.fov : p.fov;
      p.fov = Math.max(minFov, Math.min(fovRequest, maxFov));
      return p;
    };

    // --- 4. APLICAR POV E ZOOM INICIAIS ---
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

  // --- 5. ROTAÇÃO AUTOMÁTICA ---
  var autorotate = Marzipano.autorotate({
    yawSpeed: 0.05,
    targetPitch: urlPitch !== null ? urlPitch : 0,
    targetFov: urlFov !== null ? urlFov : Math.PI/2
  });
  
  // Set handler for autorotate toggle (botão na interface)
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

  // --- 6. FULLSCREEN (Usando screenfull.js original) ---
  if (screenfull.enabled && fullscreenToggleElement) {
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

  // --- 7. CONTROLOS DE VISTA NO ECRÃ (Botões + / - / setas) ---
  var viewUpElement = document.querySelector('#viewUp');
  var viewDownElement = document.querySelector('#viewDown');
  var viewLeftElement = document.querySelector('#viewLeft');
  var viewRightElement = document.querySelector('#viewRight');
  var viewInElement = document.querySelector('#viewIn');
  var viewOutElement = document.querySelector('#viewOut');

  var velocity = 0.7;
  var friction = 3;
  var controls = viewer.controls();
  if(viewUpElement) controls.registerMethod('upElement',    new Marzipano.ElementPressControlMethod(viewUpElement,     'y', -velocity, friction), true);
  if(viewDownElement) controls.registerMethod('downElement',  new Marzipano.ElementPressControlMethod(viewDownElement,   'y',  velocity, friction), true);
  if(viewLeftElement) controls.registerMethod('leftElement',  new Marzipano.ElementPressControlMethod(viewLeftElement,   'x', -velocity, friction), true);
  if(viewRightElement) controls.registerMethod('rightElement', new Marzipano.ElementPressControlMethod(viewRightElement,  'x',  velocity, friction), true);
  if(viewInElement) controls.registerMethod('inElement',    new Marzipano.ElementPressControlMethod(viewInElement,  'zoom', -velocity, friction), true);
  if(viewOutElement) controls.registerMethod('outElement',   new Marzipano.ElementPressControlMethod(viewOutElement, 'zoom',  velocity, friction), true);


  // --- 8. TOOLTIP E HOTSPOTS PERSONALIZADOS ---
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

  // Iniciar a primeira cena
  scenes[0].scene.switchTo();
  
  // Iniciar a rotação automática se ativado no data.js
  if (data.settings.autorotateEnabled) {
    if(autorotateToggleElement) autorotateToggleElement.classList.add('enabled');
    viewer.startMovement(autorotate);
    viewer.setIdleMovement(3000, autorotate);
  }

  carregarHotspots();

})();