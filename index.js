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
    
    var maxFov = 120 * degToRad; // Limite máximo de zoom out
    
    // Garantimos que não há NaNs vindos do URL
    var safeMinFov = (urlMinFov !== null && !isNaN(urlMinFov)) ? urlMinFov : (5 * degToRad);
    
    // 1. Usamos o limitador nativo para processar yaw/pitch/roll de forma segura sem dar erros de "Bad view"
    var baseLimiter = Marzipano.RectilinearView.limit.traditional(sceneData.faceSize, maxFov);
    
    var limiter = function(params) {
      // Deixa o Marzipano estruturar o objeto base e proteger contra 'undefined'
      var p = baseLimiter(params);
      
      // O SEGREDO: Se o utilizador pediu um Zoom (params.fov), usamos esse. 
      // Se for uma atualização de rotação automática onde params.fov é undefined, usamos o p.fov do Marzipano para não rebentar.
      var requestedFov = (params.fov !== undefined && !isNaN(params.fov)) ? params.fov : p.fov;
      
      // Sobrescrevemos o Zoom forçando a passar pelos limites de resolução do ecrã!
      p.fov = Math.max(safeMinFov, Math.min(requestedFov, maxFov));
      
      return p;
    };
    
    // --- 3. APLICAR POV E ZOOM INICIAIS ---
    var initView = Object.assign({}, sceneData.initialViewParameters);
    
    // Evitamos NaNs no arranque da câmara
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