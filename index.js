'use strict';

(function() {
  // Guardamos o rácio original do ecrã
  var raloReal = window.devicePixelRatio || 1;
  
  // Limitamos a um máximo de 2 (ou 1.5 se ainda der problemas no S24)
  // Isto mantém a nitidez alta, mas evita o ecrã branco no zoom extremo!
  var dprSeguro = Math.min(raloReal, 1.2); 

  Object.defineProperty(window, 'devicePixelRatio', {
    get: function() { return dprSeguro; }
  });

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
  var urlMaxFov = urlParams.has('maxFov') ? parseFloat(urlParams.get('maxFov')) * degToRad : null;

  var viewer = new Marzipano.Viewer(panoElement, {
    controls: { mouseViewMode: data.settings.mouseViewMode }
  });

  var scenes = data.scenes.map(function(sceneData) {
    var source = Marzipano.ImageUrlSource.fromString("tiles/" + sceneData.id + "/{z}/{f}/{y}/{x}.webp", { cubeMapPreviewUrl: "tiles/" + sceneData.id + "/preview.webp" });
    var geometry = new Marzipano.CubeGeometry(sceneData.levels);
    
    // --- 2. DEFINIR LIMITES DE ZOOM ---
    var maxFov = urlMaxFov !== null ? urlMaxFov : (120 * degToRad); // Usa o URL ou 120 por defeito
    var minFov = urlMinFov !== null ? urlMinFov : (10 * degToRad); // O limite de 10º (ou do URL)
    
    // Como o ecrã agora é "falsamente" normal, usamos o limitador original em segurança
    var baseLimiter = Marzipano.RectilinearView.limit.traditional(sceneData.faceSize, maxFov);
    
    var limiter = function(params) {
      var p = baseLimiter(params);
      // Esmagamos o limite de zoom com o valor do Shopify, sem dar o erro "Bad View"
      var fovRequest = params.fov !== undefined ? params.fov : p.fov;
      p.fov = Math.max(minFov, Math.min(fovRequest, maxFov));
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

  // --- 4. ROTAÇÃO AUTOMÁTICA ---
  var autorotate = Marzipano.autorotate({
    yawSpeed: 0.05,
    targetPitch: urlPitch !== null ? urlPitch : 0,
    targetFov: urlFov !== null ? urlFov : Math.PI/2
  });

  viewer.startMovement(autorotate);
  viewer.setIdleMovement(3000, autorotate);

  // --- 5. TOOLTIP E HOTSPOTS ---
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

          // --- ADIÇÃO DA DATA ---
          var extrairAno = q.info.match(/\b(\d{4})\s*$/);
          if (extrairAno) {
            var labelAno = document.createElement('div');
            labelAno.className = 'ano-obra';
            labelAno.innerText = extrairAno[1];
            a.appendChild(labelAno);
          }
          // ----------------------
          
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

  // --- 6. LÓGICA DE FULL SCREEN ---
  var btnFullscreen = document.getElementById('btn-fullscreen');
  var docElm = document.body; // Expandimos o body inteiro

  // Ícones SVG para alternar dinamicamente
  var iconEnter = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M5 5h5v2H7v3H5V5zm9 0h5v5h-2V7h-3V5zm5 9h-2v3h-3v2h5v-5zm-14 0h2v3h3v2H5v-5z"/></svg>';
  var iconExit = '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M5 16h3v3h2v-5H5v2zm3-8H5v2h5V5H8v3zm6 11h2v-3h3v-2h-5v5zm2-11V5h-2v5h5V8h-3z"/></svg>';

  if (btnFullscreen) {
    // Definir ícone inicial
    btnFullscreen.innerHTML = iconEnter;

    btnFullscreen.addEventListener('click', function() {
      var isInFullScreen = (document.fullscreenElement && document.fullscreenElement !== null) ||
                           (document.webkitFullscreenElement && document.webkitFullscreenElement !== null) ||
                           (document.mozFullScreenElement && document.mozFullScreenElement !== null) ||
                           (document.msFullscreenElement && document.msFullscreenElement !== null);

      if (!isInFullScreen) {
        if (docElm.requestFullscreen) { docElm.requestFullscreen(); }
        else if (docElm.mozRequestFullScreen) { docElm.mozRequestFullScreen(); }
        else if (docElm.webkitRequestFullScreen) { docElm.webkitRequestFullScreen(); }
        else if (docElm.msRequestFullscreen) { docElm.msRequestFullscreen(); }
      } else {
        if (document.exitFullscreen) { document.exitFullscreen(); }
        else if (document.webkitExitFullscreen) { document.webkitExitFullscreen(); }
        else if (document.mozCancelFullScreen) { document.mozCancelFullScreen(); }
        else if (document.msExitFullscreen) { document.msExitFullscreen(); }
      }
    });

    // Event listener para mudar o ícone quando o estado do fullscreen altera
    var updateIcon = function() {
      var isInFullScreen = (document.fullscreenElement && document.fullscreenElement !== null) ||
                           (document.webkitFullscreenElement && document.webkitFullscreenElement !== null) ||
                           (document.mozFullScreenElement && document.mozFullScreenElement !== null) ||
                           (document.msFullscreenElement && document.msFullscreenElement !== null);
      
      btnFullscreen.innerHTML = isInFullScreen ? iconExit : iconEnter;
    };

    document.addEventListener('fullscreenchange', updateIcon);
    document.addEventListener('webkitfullscreenchange', updateIcon);
    document.addEventListener('mozfullscreenchange', updateIcon);
    document.addEventListener('MSFullscreenChange', updateIcon);
  }

})();