'use strict';

(function() {
  // --- 1. CORREÇÃO DE NITIDEZ (ECRÃ BRANCO NO ZOOM) ---
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
  var sceneNameElement = document.querySelector('#titleBar .sceneName');
  var sceneListElement = document.querySelector('#sceneList');
  var sceneElements = document.querySelectorAll('#sceneList .scene');
  var sceneListToggleElement = document.querySelector('#sceneListToggle');
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
  if (bowser && bowser.msie && parseFloat(bowser.version) < 11) {
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

  // --- 2. LER PARÂMETROS DO SHOPIFY COM SEGURANÇA ---
  var urlParams = new URLSearchParams(window.location.search);
  var degToRad = Math.PI / 180;
  
  function getSafeParam(paramName) {
    if (urlParams.has(paramName)) {
      var val = parseFloat(urlParams.get(paramName));
      if (!isNaN(val)) return val * degToRad;
    }
    return null;
  }

  var urlFov    = getSafeParam('fov');
  var urlPitch  = getSafeParam('pitch');
  var urlYaw    = getSafeParam('yaw');
  var urlMinFov = getSafeParam('minFov');
  var urlMaxFov = getSafeParam('maxFov');

  var maxFovLim = urlMaxFov !== null ? urlMaxFov : (120 * degToRad);
  var minFovLim = urlMinFov !== null ? urlMinFov : (10 * degToRad);

  // Create scenes.
  var scenes = data.scenes.map(function(sceneData) {
    var urlPrefix = "tiles";
    // Usamos .webp como tinhas no teu primeiro projeto
    var source = Marzipano.ImageUrlSource.fromString(
      urlPrefix + "/" + sceneData.id + "/{z}/{f}/{y}/{x}.webp",
      { cubeMapPreviewUrl: urlPrefix + "/" + sceneData.id + "/preview.webp" });
    
    var geometry = new Marzipano.CubeGeometry(sceneData.levels);

    // --- 3. APLICAR LIMITES DE ZOOM (IN E OUT) ---
    var baseLimiter = Marzipano.RectilinearView.limit.traditional(sceneData.faceSize, 100 * degToRad, 120 * degToRad);
    var limiter = function(params) {
      var p = baseLimiter(params);
      var reqFov = params.fov !== undefined ? params.fov : p.fov;
      p.fov = Math.max(minFovLim, Math.min(reqFov, maxFovLim));
      return p;
    };

    // Atualiza os parâmetros originais para que o 'switchScene' não os apague
    if (urlFov !== null) sceneData.initialViewParameters.fov = urlFov;
    if (urlPitch !== null) sceneData.initialViewParameters.pitch = urlPitch;
    if (urlYaw !== null) sceneData.initialViewParameters.yaw = urlYaw;

    var view = new Marzipano.RectilinearView(sceneData.initialViewParameters, limiter);

    var scene = viewer.createScene({
      source: source,
      geometry: geometry,
      view: view,
      pinFirstLevel: true
    });

    // Create link hotspots (padrão Marzipano)
    if(sceneData.linkHotspots) {
      sceneData.linkHotspots.forEach(function(hotspot) {
        var element = createLinkHotspotElement(hotspot);
        scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
      });
    }

    // Create info hotspots (padrão Marzipano)
    if(sceneData.infoHotspots) {
      sceneData.infoHotspots.forEach(function(hotspot) {
        var element = createInfoHotspotElement(hotspot);
        scene.hotspotContainer().createHotspot(element, { yaw: hotspot.yaw, pitch: hotspot.pitch });
      });
    }

    return {
      data: sceneData,
      scene: scene,
      view: view
    };
  });

  // Set up autorotate, if enabled.
  var autorotate = Marzipano.autorotate({
    yawSpeed: 0.03,
    targetPitch: urlPitch !== null ? urlPitch : 0,
    targetFov: urlFov !== null ? urlFov : Math.PI/2
  });
  if (data.settings.autorotateEnabled && autorotateToggleElement) {
    autorotateToggleElement.classList.add('enabled');
  }

  // Set handler for autorotate toggle.
  if(autorotateToggleElement) autorotateToggleElement.addEventListener('click', toggleAutorotate);

  // Set up fullscreen mode, if supported.
  if (screenfull && screenfull.enabled && data.settings.fullscreenButton && fullscreenToggleElement) {
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

  // Set handler for scene list toggle.
  if(sceneListToggleElement) sceneListToggleElement.addEventListener('click', toggleSceneList);

  // Start with the scene list open on desktop.
  if (!document.body.classList.contains('mobile')) {
    showSceneList();
  }

  // Set handler for scene switch.
  scenes.forEach(function(scene) {
    var el = document.querySelector('#sceneList .scene[data-id="' + scene.data.id + '"]');
    if(el) {
      el.addEventListener('click', function() {
        switchScene(scene);
        if (document.body.classList.contains('mobile')) {
          hideSceneList();
        }
      });
    }
  });

  // DOM elements for view controls.
  var viewUpElement = document.querySelector('#viewUp');
  var viewDownElement = document.querySelector('#viewDown');
  var viewLeftElement = document.querySelector('#viewLeft');
  var viewRightElement = document.querySelector('#viewRight');
  var viewInElement = document.querySelector('#viewIn');
  var viewOutElement = document.querySelector('#viewOut');

  // Dynamic parameters for controls.
  var velocity = 0.7;
  var friction = 3;

  // Associate view controls with elements.
  var controls = viewer.controls();
  if(viewUpElement) controls.registerMethod('upElement',    new Marzipano.ElementPressControlMethod(viewUpElement,     'y', -velocity, friction), true);
  if(viewDownElement) controls.registerMethod('downElement',  new Marzipano.ElementPressControlMethod(viewDownElement,   'y',  velocity, friction), true);
  if(viewLeftElement) controls.registerMethod('leftElement',  new Marzipano.ElementPressControlMethod(viewLeftElement,   'x', -velocity, friction), true);
  if(viewRightElement) controls.registerMethod('rightElement', new Marzipano.ElementPressControlMethod(viewRightElement,  'x',  velocity, friction), true);
  if(viewInElement) controls.registerMethod('inElement',    new Marzipano.ElementPressControlMethod(viewInElement,  'zoom', -velocity, friction), true);
  if(viewOutElement) controls.registerMethod('outElement',   new Marzipano.ElementPressControlMethod(viewOutElement, 'zoom',  velocity, friction), true);

  function sanitize(s) {
    return s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;');
  }

  function switchScene(scene) {
    stopAutorotate();
    scene.view.setParameters(scene.data.initialViewParameters);
    scene.scene.switchTo();
    startAutorotate();
    updateSceneName(scene);
    updateSceneList(scene);
  }

  function updateSceneName(scene) {
    if(sceneNameElement) sceneNameElement.innerHTML = sanitize(scene.data.name || '');
  }

  function updateSceneList(scene) {
    for (var i = 0; i < sceneElements.length; i++) {
      var el = sceneElements[i];
      if (el.getAttribute('data-id') === scene.data.id) {
        el.classList.add('current');
      } else {
        el.classList.remove('current');
      }
    }
  }

  function showSceneList() {
    if(sceneListElement) sceneListElement.classList.add('enabled');
    if(sceneListToggleElement) sceneListToggleElement.classList.add('enabled');
  }

  function hideSceneList() {
    if(sceneListElement) sceneListElement.classList.remove('enabled');
    if(sceneListToggleElement) sceneListToggleElement.classList.remove('enabled');
  }

  function toggleSceneList() {
    if(sceneListElement) sceneListElement.classList.toggle('enabled');
    if(sceneListToggleElement) sceneListToggleElement.classList.toggle('enabled');
  }

  function startAutorotate() {
    if (!autorotateToggleElement || !autorotateToggleElement.classList.contains('enabled')) return;
    viewer.startMovement(autorotate);
    viewer.setIdleMovement(3000, autorotate);
  }

  function stopAutorotate() {
    viewer.stopMovement();
    viewer.setIdleMovement(Infinity);
  }

  function toggleAutorotate() {
    if (autorotateToggleElement.classList.contains('enabled')) {
      autorotateToggleElement.classList.remove('enabled');
      stopAutorotate();
    } else {
      autorotateToggleElement.classList.add('enabled');
      startAutorotate();
    }
  }

  function createLinkHotspotElement(hotspot) {
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot');
    wrapper.classList.add('link-hotspot');
    var icon = document.createElement('img');
    icon.src = 'img/link.png';
    icon.classList.add('link-hotspot-icon');
    var transformProperties = [ '-ms-transform', '-webkit-transform', 'transform' ];
    for (var i = 0; i < transformProperties.length; i++) {
      icon.style[transformProperties[i]] = 'rotate(' + hotspot.rotation + 'rad)';
    }
    wrapper.addEventListener('click', function() {
      switchScene(findSceneById(hotspot.target));
    });
    stopTouchAndScrollEventPropagation(wrapper);
    var tooltip = document.createElement('div');
    tooltip.classList.add('hotspot-tooltip');
    tooltip.classList.add('link-hotspot-tooltip');
    var sceneData = findSceneDataById(hotspot.target);
    if(sceneData) tooltip.innerHTML = sceneData.name;
    wrapper.appendChild(icon);
    wrapper.appendChild(tooltip);
    return wrapper;
  }

  function createInfoHotspotElement(hotspot) {
    var wrapper = document.createElement('div');
    wrapper.classList.add('hotspot');
    wrapper.classList.add('info-hotspot');
    var header = document.createElement('div');
    header.classList.add('info-hotspot-header');
    var iconWrapper = document.createElement('div');
    iconWrapper.classList.add('info-hotspot-icon-wrapper');
    var icon = document.createElement('img');
    icon.src = 'img/info.png';
    icon.classList.add('info-hotspot-icon');
    iconWrapper.appendChild(icon);
    var titleWrapper = document.createElement('div');
    titleWrapper.classList.add('info-hotspot-title-wrapper');
    var title = document.createElement('div');
    title.classList.add('info-hotspot-title');
    title.innerHTML = hotspot.title;
    titleWrapper.appendChild(title);
    var closeWrapper = document.createElement('div');
    closeWrapper.classList.add('info-hotspot-close-wrapper');
    var closeIcon = document.createElement('img');
    closeIcon.src = 'img/close.png';
    closeIcon.classList.add('info-hotspot-close-icon');
    closeWrapper.appendChild(closeIcon);
    header.appendChild(iconWrapper);
    header.appendChild(titleWrapper);
    header.appendChild(closeWrapper);
    var text = document.createElement('div');
    text.classList.add('info-hotspot-text');
    text.innerHTML = hotspot.text;
    wrapper.appendChild(header);
    wrapper.appendChild(text);
    var modal = document.createElement('div');
    modal.innerHTML = wrapper.innerHTML;
    modal.classList.add('info-hotspot-modal');
    document.body.appendChild(modal);
    var toggle = function() {
      wrapper.classList.toggle('visible');
      modal.classList.toggle('visible');
    };
    wrapper.querySelector('.info-hotspot-header').addEventListener('click', toggle);
    modal.querySelector('.info-hotspot-close-wrapper').addEventListener('click', toggle);
    stopTouchAndScrollEventPropagation(wrapper);
    return wrapper;
  }

  // Prevent touch and scroll events from reaching the parent element.
  function stopTouchAndScrollEventPropagation(element, eventList) {
    var evList = [ 'touchstart', 'touchmove', 'touchend', 'touchcancel', 'wheel', 'mousewheel' ];
    for (var i = 0; i < evList.length; i++) {
      element.addEventListener(evList[i], function(event) {
        event.stopPropagation();
      });
    }
  }

  function findSceneById(id) {
    for (var i = 0; i < scenes.length; i++) {
      if (scenes[i].data.id === id) return scenes[i];
    }
    return null;
  }

  function findSceneDataById(id) {
    for (var i = 0; i < data.scenes.length; i++) {
      if (data.scenes[i].id === id) return data.scenes[i];
    }
    return null;
  }

  // --- 4. A TUA GALERIA E TOOLTIPS ---
  var tooltipGaleria = document.createElement('div');
  tooltipGaleria.className = 'quadro-tooltip';
  tooltipGaleria.style.pointerEvents = 'none';
  document.body.appendChild(tooltipGaleria);

  function carregarHotspots() {
    fetch('galeria.json')
      .then(res => res.json())
      .then(quadros => {
        if(!scenes[0]) return;
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

          var extrairAno = q.info ? q.info.match(/\b(\d{4})\s*$/) : null;
          if (extrairAno) {
            var labelAno = document.createElement('div');
            labelAno.className = 'ano-obra';
            labelAno.innerText = extrairAno[1];
            a.appendChild(labelAno);
          }
          
          a.addEventListener('dragstart', (e) => e.preventDefault());

          let startX = 0, startY = 0;

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
            tooltipGaleria.innerHTML = q.info; 
            tooltipGaleria.style.opacity = '1'; 
          });
          
          a.addEventListener('mouseleave', () => {
            tooltipGaleria.style.opacity = '0';
          });
          
          a.addEventListener('mousemove', (e) => {
            tooltipGaleria.style.left = (e.pageX + 20) + 'px';
            tooltipGaleria.style.top = (e.pageY + 20) + 'px';
          });

          // Esta linha garante que interagir com os quadros não baralha a câmara!
          stopTouchAndScrollEventPropagation(a);
          
          scenes[0].scene.hotspotContainer().createHotspot(a, { yaw: q.y, pitch: q.p }, { perspective: { radius: 3660.56, extraRes: 1 } });
        });
      })
      .catch(e => console.log('Erro a carregar galeria:', e));
  }

  // Display the initial scene (Isto ativa o Marzipano nativo de forma correta).
  switchScene(scenes[0]);
  
  // Carrega os teus hotspots por cima.
  carregarHotspots();

})();