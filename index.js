'use strict';

(function() {
  var Marzipano = window.Marzipano;
  var data = window.APP_DATA;
  var panoElement = document.querySelector('#pano');

  // --- 1. LER PARÂMETROS DO URL (Injetados pelo Shopify) ---
  var urlParams = new URLSearchParams(window.location.search);
  var degToRad = Math.PI / 180; // Fator de conversão de Graus para Radianos

  // 2. Extrair os valores e converter para radianos
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
    
    var maxFov = 120 * degToRad; // Limite máximo
    var minFov = urlMinFov !== null ? urlMinFov : (5 * degToRad); // O teu limite de 5º ou 10º
    
    // 1. Usamos o limitador nativo SEM truques de resolução para não estourar a memória do telemóvel
    var baseLimiter = Marzipano.RectilinearView.limit.traditional(sceneData.faceSize, maxFov);
    
    // 2. O Nosso Limitador Super Seguro
    var limiter = function(params, view) {
      // Deixa o Marzipano fazer as contas difíceis do Pitch/Yaw para nunca dar o erro "Bad View"
      var p = baseLimiter(params, view);
      
      // Encontramos o Zoom exato sem criar "NaNs"
      var currentZoom;
      if (params.fov !== undefined && params.fov !== null && !isNaN(params.fov)) {
        currentZoom = params.fov; // O utilizador afastou/aproximou os dedos
      } else if (view && typeof view.fov === 'function') {
        currentZoom = view.fov(); // Apenas rodou, o zoom mantém-se igual
      } else {
        currentZoom = maxFov; // Modo de segurança na inicialização
      }
      
      // 3. Esmagamos o bloqueio do Marzipano e aplicamos a tua regra!
      p.fov = Math.max(minFov, Math.min(currentZoom, maxFov));
      
      return p;
    };
    
    // --- 3. APLICAR POV E ZOOM INICIAIS ---
    var initView = Object.assign({}, sceneData.initialViewParameters);
    
    // Proteção extra contra erros de URL
    if (urlFov !== null && !isNaN(urlFov)) initView.fov = urlFov;
    if (urlPitch !== null && !isNaN(urlPitch)) initView.pitch = urlPitch;
    if (urlYaw !== null && !isNaN(urlYaw)) initView.yaw = urlYaw;

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

  // Ativa a rotação imediatamente
  viewer.startMovement(autorotate);
  // Se o utilizador mexer, para 3 segundos e volta a rodar
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