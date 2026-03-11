'use strict';

(function() {
  var Marzipano = window.Marzipano;
  var data = window.APP_DATA;
  var panoElement = document.querySelector('#pano');

  // --- 1. LER PARÂMETROS DO URL (Injetados pelo Shopify) ---
  var urlParams = new URLSearchParams(window.location.search);
  var degToRad = Math.PI / 180; // Fator de conversão de Graus para Radianos

  // 2. Extrair os valores e converter para radianos (null se não existirem no URL)
  var urlFov = urlParams.has('fov') ? parseFloat(urlParams.get('fov')) * degToRad : null;
  var urlPitch = urlParams.has('pitch') ? parseFloat(urlParams.get('pitch')) * degToRad : null;
  var urlYaw = urlParams.has('yaw') ? parseFloat(urlParams.get('yaw')) * degToRad : null;

  var viewer = new Marzipano.Viewer(panoElement, {
    controls: { mouseViewMode: data.settings.mouseViewMode }
  });

  var scenes = data.scenes.map(function(sceneData) {
    var source = Marzipano.ImageUrlSource.fromString("tiles/" + sceneData.id + "/{z}/{f}/{y}/{x}.jpg", { cubeMapPreviewUrl: "tiles/" + sceneData.id + "/preview.jpg" });
    var geometry = new Marzipano.CubeGeometry(sceneData.levels);
    var limiter = Marzipano.RectilinearView.limit.traditional(sceneData.faceSize, 100*Math.PI/180, 120*Math.PI/180);
    
    // --- 3. APLICAR POV E ZOOM INICIAIS ---
    // Copiamos os parâmetros originais definidos no Marzipano Tool para não alterar o objeto base
    var initView = Object.assign({}, sceneData.initialViewParameters);
    
    // Substituímos pelos valores vindos do URL do Shopify, caso o utilizador tenha mexido neles
    if (urlFov !== null) initView.fov = urlFov;
    if (urlPitch !== null) initView.pitch = urlPitch;
    if (urlYaw !== null) initView.yaw = urlYaw;

    var view = new Marzipano.RectilinearView(initView, limiter);
    var scene = viewer.createScene({ source: source, geometry: geometry, view: view, pinFirstLevel: true });
    
    return { scene: scene, view: view };
  });

  // --- ROTAÇÃO AUTOMÁTICA ---
  // 4. Manter a rotação automática alinhada com os parâmetros escolhidos no Shopify
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
  document.body.appendChild(tooltip);

function carregarHotspots() {
    fetch('galeria.json')
      .then(res => res.json())
      .then(quadros => {
        quadros.forEach(q => {
          var a = document.createElement('a');
          
          // 1. Removemos o href direto para evitar que o browser abra o link sozinho
          // a.href = '...'; 
          
          a.className = 'hotspot-quadro';
          a.style.width = q.w + 'px';
          a.style.height = q.h + 'px';
          a.style.cursor = 'pointer'; // Mantém o ícone da "mãozinha" a pairar
          
          // --- 2. LÓGICA INTELIGENTE: CLIQUE VS ARRASTAR ---
          let startX = 0;
          let startY = 0;

          // Quando o utilizador toca no ecrã ou clica no rato
          a.addEventListener('pointerdown', (e) => {
            startX = e.clientX;
            startY = e.clientY;
          });

          // Quando o utilizador levanta o dedo ou solta o botão do rato
          a.addEventListener('pointerup', (e) => {
            let diffX = Math.abs(e.clientX - startX);
            let diffY = Math.abs(e.clientY - startY);
            
            // Se o movimento foi menor que 5 pixels, assumimos que é um clique verdadeiro
            if (diffX < 5 && diffY < 5) {
              window.open('https://www.artclara.pt/pages/portefolio#' + q.id, '_blank');
            }
          });

          // Bloqueia qualquer clique fantasma residual do browser
          a.addEventListener('click', (e) => e.preventDefault());

          // --- 3. TOOLTIP (Mantém-se igual) ---
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