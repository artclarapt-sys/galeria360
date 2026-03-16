var scenes = data.scenes.map(function(sceneData) {
    var source = Marzipano.ImageUrlSource.fromString("tiles/" + sceneData.id + "/{z}/{f}/{y}/{x}.webp", { cubeMapPreviewUrl: "tiles/" + sceneData.id + "/preview.webp" });
    var geometry = new Marzipano.CubeGeometry(sceneData.levels);
    
    var maxFov = 120 * degToRad; // Limite máximo de zoom out
    var minFov = urlMinFov !== null ? urlMinFov : (5 * degToRad); // 5º ou o valor do Shopify
    
    // O TEU TRUQUE EM AÇÃO: Multiplicamos a resolução da imagem lida pelo Marzipano.
    // Usamos o Device Pixel Ratio (a tal densidade do ecrã) para compensar ecrãs como o do S24 Ultra.
    var dpr = window.devicePixelRatio || 1;
    var fakeFaceSize = sceneData.faceSize * dpr * 3; // Enganamos o Marzipano com 3x a resolução
    
    // Voltamos a usar o limitador seguro do Marzipano para nunca dar erro "Bad View"
    var baseLimiter = Marzipano.RectilinearView.limit.traditional(fakeFaceSize, maxFov);
    
    var limiter = function(params) {
      var p = baseLimiter(params);
      // Como a resolução "falsa" é gigante, o limite interno do Marzipano desceu drasticamente.
      // Agora o teu limite do Shopify (minFov) é quem manda!
      p.fov = Math.max(minFov, Math.min(p.fov, maxFov));
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