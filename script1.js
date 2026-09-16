document.addEventListener('DOMContentLoaded', function() {
  const modal = document.getElementById('startModal');
  const btn = document.getElementById('startBtn');
  const music = document.getElementById('bgMusic');
  const soundBtn = document.getElementById('soundBtn');
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  const galaxyUI = document.getElementById('galaxyUI');
  const pageLoader = document.getElementById('pageLoader');
  const loadingStartedAt = performance.now();
  let galaxyController = null;
  let galaxyReady = false;
  let pageReady = document.readyState === 'complete';

  function revealIntroWhenReady() {
    if (!galaxyReady || !pageReady) return;
    const wait = Math.max(0, 450 - (performance.now() - loadingStartedAt));
    setTimeout(function() {
      document.body.classList.remove('app-loading');
      setTimeout(function() {
        pageLoader.classList.add('is-hidden');
        setTimeout(function() { pageLoader.remove(); }, 600);
      }, 350);
    }, wait);
  }

  if (!pageReady) {
    window.addEventListener('load', function() {
      pageReady = true;
      revealIntroWhenReady();
    }, { once:true });
  }

  if (music && soundBtn) {
    soundBtn.addEventListener('click', function() {
      music.muted = !music.muted;
      soundBtn.classList.toggle('is-muted', music.muted);
      soundBtn.setAttribute('aria-label', music.muted ? 'Activar musica' : 'Silenciar musica');
    });
  } else if (soundBtn) {
    soundBtn.style.display = 'none';
  }

  function updateFullscreenButton() {
    const isFullscreen = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
    fullscreenBtn.classList.toggle('is-active', isFullscreen);
    fullscreenBtn.setAttribute('aria-label', isFullscreen ? 'Salir de pantalla completa' : 'Activar pantalla completa');
  }

  fullscreenBtn.addEventListener('click', function() {
    const page = document.documentElement;
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;
    try {
      const action = isFullscreen
        ? (document.exitFullscreen ? document.exitFullscreen() : document.webkitExitFullscreen())
        : (page.requestFullscreen ? page.requestFullscreen() : page.webkitRequestFullscreen());
      if (action && typeof action.catch === 'function') action.catch(function() {});
    } catch (_) {}
  });
  document.addEventListener('fullscreenchange', updateFullscreenButton);
  document.addEventListener('webkitfullscreenchange', updateFullscreenButton);

  btn.addEventListener('click', function(e) {
    if (e.cancelable) e.preventDefault();
    e.stopPropagation();
    btn.disabled = true;

    if (music) {
      music.volume = 0.7;
      const playPromise = music.play();
      if (playPromise !== undefined) {
        playPromise.catch(()=>{});
      }
    }
    // Audio opcional de aceleración / whoosh si existe en el proyecto
    try {
      const whoosh = new Audio('intro-whoosh.mp3');
      whoosh.volume = 0.55;
      const wp = whoosh.play();
      if (wp && typeof wp.catch === 'function') wp.catch(function(){});
    } catch (_) {}

    document.body.classList.add('cinematic-active');
    if (galaxyController && typeof galaxyController.startCinematic === 'function') {
      galaxyController.startCinematic();
    }
    modal.classList.add('is-leaving');
    document.body.classList.add('galaxy-started');
    galaxyUI.setAttribute('aria-hidden', 'false');
  });

  requestAnimationFrame(function() {
    runGalaxy({
      onReady: function(controller) {
        galaxyController = controller;
        galaxyReady = true;
        revealIntroWhenReady();
      }
    });
  });

  function runGalaxy(opts={}){
    const err = document.getElementById('err');
    function showError(msg){ err.textContent = msg; err.style.display='block'; }
    let readyDelivered = false;
    function deliverReady(controller) {
      if (readyDelivered) return;
      readyDelivered = true;
      if(typeof opts.onReady === 'function') opts.onReady(controller);
    }

    try { 
      const test = document.createElement('canvas').getContext('webgl') || document.createElement('canvas').getContext('experimental-webgl');
      if(!test) throw new Error('Tu navegador no tiene WebGL activo');
    } catch(e) {
      showError('WebGL parece desactivado. Prueba con Chrome/Edge/Firefox, o habilita aceleracion por hardware.');
      deliverReady({ startCinematic:function(){} });
      return;
    }

    try {
      const canvas = document.getElementById('galaxy-canvas');
      const renderer = new THREE.WebGLRenderer({ canvas, antialias:true, alpha:false });
      const maxPixelRatio = window.innerWidth < 700 ? 1.5 : 1.75;
      renderer.setPixelRatio(Math.min(maxPixelRatio, window.devicePixelRatio||1));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.outputEncoding = THREE.sRGBEncoding;

      const scene = new THREE.Scene();
      let backgroundReady = false;
      const loadingManager = new THREE.LoadingManager();
      loadingManager.onLoad = function() {
        requestAnimationFrame(function(){ deliverReady(galaxyApi); });
      };
      
      // Generador de fondo espacial cinematográfico: Blanco + Negro + Gris + Plateado suave
      function loadSilverSpaceBackground(faces, onLoad) {
        if (!Array.isArray(faces) || faces.length < 6) {
          onLoad(null);
          return;
        }
        let loadedCount = 0;
        const processedCanvases = new Array(6);
        faces.forEach(function(src, i) {
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = function() {
            const w = img.width || 512;
            const h = img.height || 512;
            const c = document.createElement('canvas');
            c.width = w;
            c.height = h;
            const ctx = c.getContext('2d');
            ctx.drawImage(img, 0, 0);

            try {
              const imgData = ctx.getImageData(0, 0, w, h);
              const d = imgData.data;
              for (let p = 0; p < d.length; p += 4) {
                const r = d[p];
                const g = d[p + 1];
                const b = d[p + 2];

                // Luminancia perceptual eliminando totalmente la dominante rojiza / magenta
                let lum = 0.299 * r + 0.587 * g + 0.114 * b;

                // Contraste cinematográfico: negros profundos cósmicos y estrellas nítidas
                if (lum < 20) {
                  lum = Math.max(0, lum * 0.28);
                } else {
                  lum = 5.5 + Math.pow((lum - 20) / 235, 1.14) * 249.5;
                }

                // Matiz cósmico sutil: champagne suave / blanco cálido / gris cálido / oro tenue
                // Mantiene el negro espacial profundo intacto (lum baja -> negro total)
                // y baña delicadamente el polvo y estrellas con una calidez sutil y elegante
                d[p] = Math.min(255, Math.round(lum * 1.025));      // R sutilmente cálido
                d[p + 1] = Math.min(255, Math.round(lum * 0.995));  // G neutro/equilibrado
                d[p + 2] = Math.min(255, Math.round(lum * 0.945));  // B suavemente atenuado
              }
              ctx.putImageData(imgData, 0, 0);
              processedCanvases[i] = c;
            } catch (_) {
              processedCanvases[i] = img;
            }

            loadedCount++;
            if (loadedCount === 6) {
              const cube = new THREE.CubeTexture(processedCanvases);
              cube.encoding = THREE.sRGBEncoding;
              cube.needsUpdate = true;
              onLoad(cube);
            }
          };
          img.onerror = function() {
            loadedCount++;
            if (loadedCount === 6) {
              const cube = new THREE.CubeTexture(processedCanvases);
              cube.encoding = THREE.sRGBEncoding;
              cube.needsUpdate = true;
              onLoad(cube);
            }
          };
          img.src = src;
        });
      }

      let spaceBackgroundTexture = null;
      loadingManager.itemStart('silver-space-bg');
      loadSilverSpaceBackground(window.ROMANTIC_SPACE_BG_FACES, function(silverBg) {
        if (silverBg) {
          spaceBackgroundTexture = silverBg;
          scene.background = silverBg;
        }
        backgroundReady = true;
        loadingManager.itemEnd('silver-space-bg');
      });
      
      const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 2000);
      scene.add(camera);
      const controls = new THREE.OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true; controls.dampingFactor = 0.06;
      controls.minDistance = 10; controls.maxDistance = 220;
      controls.target.set(0,0,0);

      // ============================================
      // FUNCIONES DE EASING Y MATEMÁTICAS CINEMÁTICAS
      // ============================================
      function easeInQuad(x) { return x * x; }
      function easeOutQuad(x) { return 1 - (1 - x) * (1 - x); }
      function easeInOutQuad(x) { return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2; }
      function easeInCubic(x) { return x * x * x; }
      function easeOutCubic(x) { return 1 - Math.pow(1 - x, 3); }
      function easeInOutCubic(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
      function smoothstep(x) { return x <= 0 ? 0 : (x >= 1 ? 1 : x * x * (3 - 2 * x)); }

      // ============================================
      // CRONOGRAMA DE 5 FASES DE LA INTRO FLORAL
      // ============================================
      const P1_END = 0.8;  // Fase 1: Inicio (0.0s - 0.8s) -> Oscuridad, polen y destellos nacientes, avance suave
      const P2_END = 2.0;  // Fase 2: Aceleración (0.8s - 2.0s) -> Vórtice floral se acelera, girasoles y pétalos hacia cámara
      const P3_END = 3.8;  // Fase 3: Velocidad máxima (2.0s - 3.8s) -> Túnel floral cósmico continuo, sutil roll y profundidad
      const P4_END = 5.0;  // Fase 4: Desaceleración (3.8s - 5.0s) -> Desaceleración suave, corazón floral cósmico visible a lo lejos
      const P5_END = 5.6;  // Fase 5: Revelación (5.0s - 5.6s) -> Brazos, fotos, frases; cámara en posición final
      const TOTAL_CINEMATIC_TIME = P5_END;

      let cinematicState = null;
      let cinematicStart = null;
      let lastCinematicTime = null;
      let galaxyInteractionEnabled = false;

      // ============================================
      // GENERADORES DE TEXTURAS PROCEDURALES FLORALES
      // ============================================
      function createSunflowerTexture() {
        const c = document.createElement('canvas');
        c.width = c.height = 256;
        const g = c.getContext('2d');
        const cx = 128, cy = 128;

        // Glow cálido suave exterior
        const glow = g.createRadialGradient(cx, cy, 35, cx, cy, 126);
        glow.addColorStop(0, 'rgba(255, 204, 0, 0.45)');
        glow.addColorStop(0.5, 'rgba(255, 170, 0, 0.18)');
        glow.addColorStop(1, 'rgba(255, 150, 0, 0)');
        g.fillStyle = glow;
        g.beginPath();
        g.arc(cx, cy, 126, 0, Math.PI * 2);
        g.fill();

        // Capa exterior de pétalos (18 pétalos radiantes)
        const outerPetals = 18;
        for (let i = 0; i < outerPetals; i++) {
          const angle = (i / outerPetals) * Math.PI * 2;
          g.save();
          g.translate(cx, cy);
          g.rotate(angle);
          g.beginPath();
          g.moveTo(0, 24);
          g.quadraticCurveTo(24, 70, 0, 118);
          g.quadraticCurveTo(-24, 70, 0, 24);
          const pGrad = g.createLinearGradient(0, 24, 0, 118);
          pGrad.addColorStop(0, '#e67300');
          pGrad.addColorStop(0.3, '#ffaa00');
          pGrad.addColorStop(0.7, '#ffd000');
          pGrad.addColorStop(1, '#fff280');
          g.fillStyle = pGrad;
          g.fill();
          g.restore();
        }

        // Capa interior de pétalos desfasada (18 pétalos más cortos y brillantes)
        for (let i = 0; i < outerPetals; i++) {
          const angle = ((i + 0.5) / outerPetals) * Math.PI * 2;
          g.save();
          g.translate(cx, cy);
          g.rotate(angle);
          g.beginPath();
          g.moveTo(0, 20);
          g.quadraticCurveTo(18, 58, 0, 96);
          g.quadraticCurveTo(-18, 58, 0, 20);
          const pGrad2 = g.createLinearGradient(0, 20, 0, 96);
          pGrad2.addColorStop(0, '#ff9900');
          pGrad2.addColorStop(0.4, '#ffc400');
          pGrad2.addColorStop(0.85, '#ffeb3b');
          pGrad2.addColorStop(1, '#fffde7');
          g.fillStyle = pGrad2;
          g.fill();
          g.restore();
        }

        // Centro botánico de semillas (disco café oscuro con espiral áurea)
        const centerR = 40;
        const cGrad = g.createRadialGradient(cx, cy, 5, cx, cy, centerR);
        cGrad.addColorStop(0, '#5c2d00');
        cGrad.addColorStop(0.5, '#3b1c00');
        cGrad.addColorStop(0.88, '#241000');
        cGrad.addColorStop(1, '#522900');
        g.beginPath();
        g.arc(cx, cy, centerR, 0, Math.PI * 2);
        g.fillStyle = cGrad;
        g.fill();

        g.strokeStyle = 'rgba(255, 200, 50, 0.45)';
        g.lineWidth = 1.5;
        g.stroke();

        // Semillas doradas en espiral de Fibonacci
        const goldenAngle = 137.5 * (Math.PI / 180);
        for (let s = 0; s < 140; s++) {
          const sr = Math.sqrt(s / 140) * (centerR - 3.5);
          const stheta = s * goldenAngle;
          const sx = cx + Math.cos(stheta) * sr;
          const sy = cy + Math.sin(stheta) * sr;
          g.beginPath();
          g.arc(sx, sy, 1.3, 0, Math.PI * 2);
          g.fillStyle = s % 3 === 0 ? '#ffea80' : (s % 2 === 0 ? '#ffb300' : '#8d4800');
          g.fill();
        }

        const tex = new THREE.CanvasTexture(c);
        tex.encoding = THREE.sRGBEncoding;
        return tex;
      }

      function createPetalTexture() {
        const c = document.createElement('canvas');
        c.width = 128; c.height = 256;
        const g = c.getContext('2d');
        const cx = 64, cy = 128;

        g.shadowColor = 'rgba(255, 180, 0, 0.5)';
        g.shadowBlur = 12;

        g.beginPath();
        g.moveTo(cx, 230);
        g.quadraticCurveTo(cx + 46, cy, cx, 24);
        g.quadraticCurveTo(cx - 46, cy, cx, 230);
        const grad = g.createLinearGradient(cx, 230, cx, 24);
        grad.addColorStop(0, '#e67a00');
        grad.addColorStop(0.35, '#ffb300');
        grad.addColorStop(0.75, '#ffea00');
        grad.addColorStop(1, '#fffde7');
        g.fillStyle = grad;
        g.fill();

        g.shadowBlur = 0;
        g.beginPath();
        g.moveTo(cx, 200);
        g.quadraticCurveTo(cx + 4, cy, cx, 40);
        g.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        g.lineWidth = 1.8;
        g.stroke();

        const tex = new THREE.CanvasTexture(c);
        tex.encoding = THREE.sRGBEncoding;
        return tex;
      }

      function createSparkleTexture() {
        const c = document.createElement('canvas');
        c.width = c.height = 128;
        const g = c.getContext('2d');
        const cx = 64, cy = 64;

        const radGrad = g.createRadialGradient(cx, cy, 2, cx, cy, 62);
        radGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        radGrad.addColorStop(0.18, 'rgba(255, 240, 170, 0.95)');
        radGrad.addColorStop(0.45, 'rgba(255, 190, 0, 0.45)');
        radGrad.addColorStop(1, 'rgba(255, 150, 0, 0)');
        g.fillStyle = radGrad;
        g.beginPath();
        g.arc(cx, cy, 62, 0, Math.PI * 2);
        g.fill();

        g.fillStyle = 'rgba(255, 255, 240, 0.85)';
        g.beginPath();
        g.ellipse(cx, cy, 46, 2.2, 0, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.ellipse(cx, cy, 2.2, 46, 0, 0, Math.PI * 2);
        g.fill();

        const tex = new THREE.CanvasTexture(c);
        tex.encoding = THREE.sRGBEncoding;
        return tex;
      }

      // Rosa amarilla estilizada con espiral suave de pétalos
      function createYellowRoseTexture() {
        const c = document.createElement('canvas');
        c.width = c.height = 256;
        const g = c.getContext('2d');
        const cx = 128, cy = 128;

        const glow = g.createRadialGradient(cx, cy, 18, cx, cy, 120);
        glow.addColorStop(0, 'rgba(255, 215, 0, 0.42)');
        glow.addColorStop(0.5, 'rgba(255, 180, 0, 0.15)');
        glow.addColorStop(1, 'rgba(255, 140, 0, 0)');
        g.fillStyle = glow;
        g.beginPath();
        g.arc(cx, cy, 120, 0, Math.PI * 2);
        g.fill();

        const layers = [
          { petals: 5, r: 96, w: 56, h: 46, col0: '#e67a00', col1: '#ffca28' },
          { petals: 5, r: 72, w: 44, h: 38, col0: '#ff8f00', col1: '#ffe082' },
          { petals: 4, r: 50, w: 34, h: 30, col0: '#ffa000', col1: '#fff59d' },
          { petals: 3, r: 30, w: 24, h: 22, col0: '#ffb300', col1: '#fff9c4' }
        ];

        layers.forEach((ly, lIdx) => {
          const offsetAng = lIdx * 0.72;
          for (let i = 0; i < ly.petals; i++) {
            const a = offsetAng + (i / ly.petals) * Math.PI * 2;
            const px = cx + Math.cos(a) * (ly.r * 0.44);
            const py = cy + Math.sin(a) * (ly.r * 0.44);
            g.save();
            g.translate(px, py);
            g.rotate(a + Math.PI / 2);
            g.beginPath();
            g.ellipse(0, 0, ly.w * 0.5, ly.h * 0.5, 0, 0, Math.PI * 2);
            const grad = g.createRadialGradient(0, ly.h * 0.3, 2, 0, 0, ly.w * 0.6);
            grad.addColorStop(0, ly.col0);
            grad.addColorStop(0.55, ly.col1);
            grad.addColorStop(1, '#fffde7');
            g.fillStyle = grad;
            g.fill();
            g.strokeStyle = 'rgba(255, 235, 150, 0.45)';
            g.lineWidth = 1.2;
            g.stroke();
            g.restore();
          }
        });

        g.beginPath();
        g.arc(cx, cy, 14, 0, Math.PI * 2);
        const cGrad = g.createRadialGradient(cx, cy, 2, cx, cy, 14);
        cGrad.addColorStop(0, '#ff6f00');
        cGrad.addColorStop(0.7, '#ffa000');
        cGrad.addColorStop(1, '#ffeb3b');
        g.fillStyle = cGrad;
        g.fill();

        const tex = new THREE.CanvasTexture(c);
        tex.encoding = THREE.sRGBEncoding;
        return tex;
      }

      // Flor amarilla suave de 5 pétalos aterciopelados
      function createSoftFlowerTexture() {
        const c = document.createElement('canvas');
        c.width = c.height = 256;
        const g = c.getContext('2d');
        const cx = 128, cy = 128;

        const glow = g.createRadialGradient(cx, cy, 20, cx, cy, 122);
        glow.addColorStop(0, 'rgba(255, 220, 0, 0.42)');
        glow.addColorStop(0.6, 'rgba(255, 170, 0, 0.14)');
        glow.addColorStop(1, 'rgba(255, 140, 0, 0)');
        g.fillStyle = glow;
        g.beginPath();
        g.arc(cx, cy, 122, 0, Math.PI * 2);
        g.fill();

        const petals = 5;
        for (let i = 0; i < petals; i++) {
          const a = (i / petals) * Math.PI * 2;
          g.save();
          g.translate(cx, cy);
          g.rotate(a);
          g.beginPath();
          g.moveTo(0, 15);
          g.bezierCurveTo(42, 45, 38, 105, 0, 115);
          g.bezierCurveTo(-38, 105, -42, 45, 0, 15);
          const pGrad = g.createLinearGradient(0, 15, 0, 115);
          pGrad.addColorStop(0, '#e68a00');
          pGrad.addColorStop(0.35, '#ffc107');
          pGrad.addColorStop(0.8, '#fff176');
          pGrad.addColorStop(1, '#fffde7');
          g.fillStyle = pGrad;
          g.fill();

          g.strokeStyle = 'rgba(255, 255, 220, 0.5)';
          g.lineWidth = 1.2;
          g.stroke();
          g.restore();
        }

        g.beginPath();
        g.arc(cx, cy, 22, 0, Math.PI * 2);
        const cGrad = g.createRadialGradient(cx, cy, 3, cx, cy, 22);
        cGrad.addColorStop(0, '#ffffff');
        cGrad.addColorStop(0.4, '#ffe082');
        cGrad.addColorStop(0.8, '#ff8f00');
        cGrad.addColorStop(1, '#c46200');
        g.fillStyle = cGrad;
        g.fill();

        const tex = new THREE.CanvasTexture(c);
        tex.encoding = THREE.sRGBEncoding;
        return tex;
      }

      // Polvo luminoso estelar dorado
      function createGoldenDustTexture() {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        const g = c.getContext('2d');
        const radGrad = g.createRadialGradient(32, 32, 1, 32, 32, 30);
        radGrad.addColorStop(0, 'rgba(255, 255, 255, 1)');
        radGrad.addColorStop(0.25, 'rgba(255, 235, 150, 0.95)');
        radGrad.addColorStop(0.6, 'rgba(255, 185, 0, 0.45)');
        radGrad.addColorStop(1, 'rgba(255, 150, 0, 0)');
        g.fillStyle = radGrad;
        g.beginPath();
        g.arc(32, 32, 30, 0, Math.PI * 2);
        g.fill();

        const tex = new THREE.CanvasTexture(c);
        tex.encoding = THREE.sRGBEncoding;
        return tex;
      }

      // Flor de pétalos redondeados / botón de oro (Buttercup)
      function createRoundedPetalFlowerTexture() {
        const c = document.createElement('canvas');
        c.width = c.height = 256;
        const g = c.getContext('2d');
        const cx = 128, cy = 128;

        // Aura dorada luminosa
        const glow = g.createRadialGradient(cx, cy, 22, cx, cy, 122);
        glow.addColorStop(0, 'rgba(255, 220, 50, 0.42)');
        glow.addColorStop(0.55, 'rgba(255, 175, 0, 0.15)');
        glow.addColorStop(1, 'rgba(255, 140, 0, 0)');
        g.fillStyle = glow;
        g.beginPath();
        g.arc(cx, cy, 122, 0, Math.PI * 2);
        g.fill();

        // 8 pétalos redondeados superpuestos
        const petals = 8;
        for (let i = 0; i < petals; i++) {
          const a = (i / petals) * Math.PI * 2;
          const px = cx + Math.cos(a) * 44;
          const py = cy + Math.sin(a) * 44;

          g.save();
          g.translate(px, py);
          g.rotate(a + Math.PI / 2);

          g.beginPath();
          g.ellipse(0, 0, 36, 46, 0, 0, Math.PI * 2);

          const pGrad = g.createRadialGradient(0, -10, 4, 0, 8, 48);
          pGrad.addColorStop(0, '#fff9c4');
          pGrad.addColorStop(0.35, '#ffeb3b');
          pGrad.addColorStop(0.75, '#fbc02d');
          pGrad.addColorStop(1, '#f57f17');
          g.fillStyle = pGrad;
          g.fill();

          g.strokeStyle = 'rgba(255, 245, 180, 0.55)';
          g.lineWidth = 1.3;
          g.stroke();
          g.restore();
        }

        // Capa interior de 6 pétalos más pequeños
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 + 0.35;
          const px = cx + Math.cos(a) * 24;
          const py = cy + Math.sin(a) * 24;

          g.save();
          g.translate(px, py);
          g.rotate(a + Math.PI / 2);

          g.beginPath();
          g.ellipse(0, 0, 22, 28, 0, 0, Math.PI * 2);

          const pGrad2 = g.createRadialGradient(0, -6, 2, 0, 4, 28);
          pGrad2.addColorStop(0, '#ffffff');
          pGrad2.addColorStop(0.4, '#fff59d');
          pGrad2.addColorStop(0.85, '#fbc02d');
          pGrad2.addColorStop(1, '#e65100');
          g.fillStyle = pGrad2;
          g.fill();
          g.restore();
        }

        // Centro botón de oro con textura estelar
        g.beginPath();
        g.arc(cx, cy, 20, 0, Math.PI * 2);
        const cGrad = g.createRadialGradient(cx, cy, 2, cx, cy, 20);
        cGrad.addColorStop(0, '#ffeb3b');
        cGrad.addColorStop(0.5, '#f57f17');
        cGrad.addColorStop(0.85, '#bf360c');
        cGrad.addColorStop(1, '#5d4037');
        g.fillStyle = cGrad;
        g.fill();

        for (let i = 0; i < 16; i++) {
          const sa = (i / 16) * Math.PI * 2;
          const sx = cx + Math.cos(sa) * 16;
          const sy = cy + Math.sin(sa) * 16;
          g.beginPath();
          g.arc(sx, sy, 2.0, 0, Math.PI * 2);
          g.fillStyle = '#fffde7';
          g.fill();
        }

        const tex = new THREE.CanvasTexture(c);
        tex.encoding = THREE.sRGBEncoding;
        return tex;
      }

      let florPngTex = null;
      try {
        const texLoader = new THREE.TextureLoader(loadingManager);
        texLoader.load('flor.png', function(tx) {
          tx.encoding = THREE.sRGBEncoding;
          florPngTex = tx;
        });
      } catch (_) {}

      // ============================================
      // SISTEMA DE WARP ESPACIAL FLORAL (SIN LÍNEAS NI STREAKS)
      // ============================================
      let warpContainer = null;
      let warpItems = [];
      let flowerPlaneGeo = null;
      let warpInitialized = false;

      function initWarpSystem() {
        if (warpInitialized) return;
        warpInitialized = true;

        const isMobile = window.innerWidth < 768 || window.innerWidth < window.innerHeight;
        const sunflowerTex = createSunflowerTexture();
        const yellowRoseTex = createYellowRoseTexture();
        const softFlowerTex = createSoftFlowerTexture();
        const roundedPetalTex = createRoundedPetalFlowerTexture();
        const petalTex = createPetalTexture();
        const sparkleTex = createSparkleTexture();
        const goldenDustTex = createGoldenDustTexture();

        warpContainer = new THREE.Group();
        camera.add(warpContainer);

        // ============================================
        // ELEMENTOS FLORALES Y POLVO CÓSMICO (TÚNEL PURAMENTE FLORAL):
        // Conteo total: 1,050 en Desktop / 520 en Mobile (Flujo continuo de flores)
        // Mezcla exacta requerida:
        // - 26% polvo dorado / polen / chispas estelares
        // - 24% pétalos dorados
        // - 24% flores amarillas pequeñas (flores suaves de 5 pétalos, botones de oro)
        // - 18% girasoles botánicos pequeños
        // - 8% rosas amarillas y flores medianas
        // ============================================
        const flowerCount = isMobile ? 520 : 1050;
        warpItems = [];
        flowerPlaneGeo = new THREE.PlaneGeometry(1, 1);

        for (let i = 0; i < flowerCount; i++) {
          const rand = Math.random();
          let type, map, baseScale, isBig = false;
          let blending = THREE.NormalBlending;
          let minR, maxR;

          if (rand < 0.26) {
            // 26% Polvo dorado / polen / chispas pequeñas
            type = 'dust_sparkle';
            map = (Math.random() < 0.5) ? sparkleTex : goldenDustTex;
            blending = THREE.AdditiveBlending;
            baseScale = isMobile ? (0.9 + Math.random() * 0.8) : (1.2 + Math.random() * 1.1);
            minR = isMobile ? 0.7 : 0.5;
            maxR = isMobile ? 17.0 : 24.0;
          } else if (rand < 0.50) {
            // 24% Pétalos dorados flotantes en múltiples capas
            type = 'petal';
            map = petalTex;
            baseScale = isMobile ? (1.4 + Math.random() * 0.8) : (1.8 + Math.random() * 1.1);
            minR = isMobile ? 1.1 : 0.8;
            maxR = isMobile ? 16.0 : 23.0;
          } else if (rand < 0.74) {
            // 24% Flores amarillas pequeñas (flores suaves de 5 pétalos, botones de oro)
            type = 'small_flower';
            const flowerVariant = Math.random();
            if (flowerVariant < 0.50) {
              map = softFlowerTex;
            } else if (flowerVariant < 0.80) {
              map = roundedPetalTex;
            } else {
              map = yellowRoseTex;
            }
            baseScale = isMobile ? (1.5 + Math.random() * 0.8) : (1.9 + Math.random() * 1.1);
            minR = isMobile ? 1.3 : 1.0;
            maxR = isMobile ? 15.5 : 22.0;
          } else if (rand < 0.92) {
            // 18% Girasoles botánicos pequeños
            type = 'sunflower_small';
            map = (florPngTex && Math.random() < 0.6) ? florPngTex : sunflowerTex;
            baseScale = isMobile ? (1.8 + Math.random() * 0.9) : (2.3 + Math.random() * 1.2);
            minR = isMobile ? 1.5 : 1.2;
            maxR = isMobile ? 15.0 : 21.5;
          } else {
            // 8% Rosas amarillas y flores medianas
            type = 'rose_and_medium';
            const nearVariant = Math.random();
            if (nearVariant < 0.72) {
              // Rosas amarillas delicadas
              map = yellowRoseTex;
              baseScale = isMobile ? (1.9 + Math.random() * 0.9) : (2.4 + Math.random() * 1.2);
              minR = isMobile ? 1.8 : 1.4;
              maxR = isMobile ? 15.0 : 22.0;
            } else {
              // Flores medianas (pocas, dispersas en periferia)
              isBig = true;
              map = (florPngTex && Math.random() < 0.5) ? florPngTex : ((Math.random() < 0.5) ? sunflowerTex : roundedPetalTex);
              baseScale = isMobile ? (3.2 + Math.random() * 1.0) : (4.2 + Math.random() * 1.4);
              minR = isMobile ? 6.5 : 5.0;
              maxR = isMobile ? 16.0 : 24.0;
            }
          }

          const mat = new THREE.MeshBasicMaterial({
            map,
            transparent: true,
            opacity: 0.95,
            depthWrite: false,
            side: THREE.DoubleSide,
            blending
          });

          const mesh = new THREE.Mesh(flowerPlaneGeo, mat);

          const angle = Math.random() * Math.PI * 2;
          const rFactor = Math.sqrt(Math.random());
          const radius = minR + rFactor * (maxR - minR);
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          // Distribución uniforme y continua por todo el túnel desde z = -6 hasta z = -360
          const z = -6 - (i / flowerCount) * 354 + (Math.random() - 0.5) * 6;

          mesh.position.set(x, y, z);
          mesh.rotation.z = Math.random() * Math.PI * 2;
          mesh.rotation.x = (Math.random() - 0.5) * 0.4;
          mesh.rotation.y = (Math.random() - 0.5) * 0.4;
          mesh.scale.set(baseScale, baseScale, 1);

          mesh.userData = {
            type,
            baseScale,
            isBig,
            angle,
            radius,
            minR,
            maxR,
            rotSpeedZ: (Math.random() - 0.5) * (type === 'petal' ? 3.4 : 2.4),
            speedMult: (type === 'dust_sparkle' ? 0.96 : 0.84) + Math.random() * 0.35,
            tiltX: mesh.rotation.x,
            tiltY: mesh.rotation.y
          };

          warpContainer.add(mesh);
          warpItems.push(mesh);
        }
      }

      function disposeWarpSystem() {
        if (!warpContainer) return;
        warpItems.forEach(function(item) {
          warpContainer.remove(item);
          if (item.material) item.material.dispose();
        });
        warpItems.length = 0;
        if (flowerPlaneGeo) {
          flowerPlaneGeo.dispose();
          flowerPlaneGeo = null;
        }
        camera.remove(warpContainer);
        warpContainer = null;
        warpInitialized = false;
      }

      // ============================================
      // CONTROL DE VISIBILIDAD DE LA GALAXIA EN LA INTRO
      // ============================================
      function setGalaxyIntroVisibility(phase, progress) {
        if (phase === 'START') {
          if (scene) scene.background = null;
          renderer.setClearColor(0x020204, 1);
          if (typeof spiralParticles !== 'undefined' && spiralParticles.material) {
            spiralParticles.material.opacity = 0;
          }
          if (typeof dustPoints !== 'undefined' && dustPoints.material) {
            dustPoints.material.opacity = 0;
          }
          if (typeof celestialCore !== 'undefined') {
            celestialCore.visible = false;
            celestialCore.scale.set(0.01, 0.01, 0.01);
          }
          if (typeof photoOrbit !== 'undefined') {
            photoOrbit.visible = false;
            photoOrbit.children.forEach(function(c) {
              if (c.material) c.material.opacity = 0;
            });
          }
          if (typeof phraseSprites !== 'undefined') {
            phraseSprites.forEach(function(spr) {
              spr.material.opacity = 0;
            });
          }
          if (typeof textGroup !== 'undefined') {
            textGroup.visible = false;
          }
        } else if (phase === 'PHASE4') {
          // Fase 4: Desaceleración. El fondo estelar, los brazos y el núcleo lejano se revelan
          if (scene && spaceBackgroundTexture) scene.background = spaceBackgroundTexture;
          const starProg = smoothstep(Math.min(1, Math.max(0, progress)));
          if (typeof spiralParticles !== 'undefined' && spiralParticles.material) {
            spiralParticles.material.opacity = starProg * 0.88;
          }
          if (typeof dustPoints !== 'undefined' && dustPoints.material) {
            dustPoints.material.opacity = starProg * 0.32;
          }
          if (typeof celestialCore !== 'undefined') {
            celestialCore.visible = true;
            const coreScaleProg = smoothstep(Math.min(1, Math.max(0, (progress - 0.2) / 0.8)));
            const scaleVal = Math.max(0.08, coreScaleProg);
            celestialCore.scale.set(scaleVal, scaleVal, scaleVal);
          }
        } else if (phase === 'PHASE5') {
          // Fase 5: Revelación final completa de fotos, frases y título 3D
          if (scene && spaceBackgroundTexture) scene.background = spaceBackgroundTexture;
          if (typeof spiralParticles !== 'undefined' && spiralParticles.material) {
            spiralParticles.material.opacity = 0.88;
          }
          if (typeof dustPoints !== 'undefined' && dustPoints.material) {
            dustPoints.material.opacity = 0.32;
          }
          if (typeof celestialCore !== 'undefined') {
            celestialCore.visible = true;
            celestialCore.scale.set(1, 1, 1);
          }
          if (typeof photoOrbit !== 'undefined') {
            photoOrbit.visible = true;
            const photoProg = smoothstep(Math.min(1, Math.max(0, progress / 0.7)));
            photoOrbit.children.forEach(function(c) {
              if (c.material) c.material.opacity = photoProg * 0.96;
            });
          }
          const phraseProg = smoothstep(Math.min(1, Math.max(0, (progress - 0.25) / 0.75)));
          if (typeof phraseSprites !== 'undefined') {
            phraseSprites.forEach(function(spr) {
              spr.material.opacity = phraseProg;
            });
          }
          if (typeof textGroup !== 'undefined') {
            textGroup.visible = phraseProg > 0.4;
          }
        } else if (phase === 'COMPLETE') {
          if (scene && spaceBackgroundTexture) scene.background = spaceBackgroundTexture;
          if (typeof spiralParticles !== 'undefined' && spiralParticles.material) {
            spiralParticles.material.opacity = 0.88;
          }
          if (typeof dustPoints !== 'undefined' && dustPoints.material) {
            dustPoints.material.opacity = 0.32;
          }
          if (typeof celestialCore !== 'undefined') {
            celestialCore.visible = true;
            celestialCore.scale.set(1, 1, 1);
          }
          if (typeof photoOrbit !== 'undefined') {
            photoOrbit.visible = true;
            photoOrbit.children.forEach(function(c) {
              if (c.material) c.material.opacity = 0.96;
            });
          }
          if (typeof phraseSprites !== 'undefined') {
            phraseSprites.forEach(function(spr) {
              spr.material.opacity = 1.0;
              spr.scale.copy(spr.baseScale);
            });
          }
          if (typeof textGroup !== 'undefined') {
            textGroup.visible = true;
          }
        }
      }

      const galaxyApi = {
        startCinematic: function() {
          cinematicState = 'INTRO';
          cinematicStart = null;
          lastCinematicTime = null;
          galaxyInteractionEnabled = false;
          if (typeof pointerRecord !== 'undefined' && pointerRecord) {
            pointerRecord.isDown = false;
          }
          hoveredSprite = null;
          if (typeof closeLetter === 'function') {
            closeLetter();
          }
          controls.enabled = false;

          const w = window.innerWidth, h = window.innerHeight;
          const isMobile = w < 768 || w < h;

          // Posición lejana de inicio del viaje espacial
          camera.position.set(0, isMobile ? 32 : 28, isMobile ? 330 : 270);
          camera.lookAt(0, 0, 0);
          camera.rotation.z = 0;

          // Iniciar el sistema de túnel warp
          if (!warpInitialized) {
            initWarpSystem();
          }
          if (warpContainer) {
            warpContainer.visible = true;
          }

          // Ocultar suavemente la galaxia durante el viaje
          setGalaxyIntroVisibility('START', 0);
        }
      };

      function setCam(){
        const w = window.innerWidth, h = window.innerHeight;
        const isMobile = w < 768 || w < h;
        camera.fov = isMobile ? 86 : 74;
        if (cinematicState === null) {
          camera.position.set(0, isMobile ? 21 : 20, isMobile ? 112 : 76);
          camera.lookAt(0, 2, 0);
          controls.target.set(0, 2, 0);
        }
        camera.updateProjectionMatrix(); controls.update();
      }
      setCam();

      function resizeGalaxy(){
        const width = window.innerWidth;
        const height = window.innerHeight;
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setPixelRatio(Math.min(maxPixelRatio, window.devicePixelRatio || 1));
        renderer.setSize(width, height, false);
      }
      addEventListener('resize', resizeGalaxy);

      renderer.setClearColor(0x0a0800, 1);

      const explosions = [];
      function spawnExplosion() {
        const geo = new THREE.PlaneGeometry(60, 60);
        const c = document.createElement('canvas');
        c.width = c.height = 256;
        const g = c.getContext('2d');
        const grad = g.createRadialGradient(128,128,10,128,128,128);
        grad.addColorStop(0, 'rgba(255,255,200,0.85)');
        grad.addColorStop(0.2, 'rgba(255,200,50,0.45)');
        grad.addColorStop(0.5, 'rgba(255,150,0,0.18)');
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = grad;
        g.fillRect(0,0,256,256);
        const tex = new THREE.CanvasTexture(c);
        const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
        const mesh = new THREE.Mesh(geo, mat);
        const angle = Math.random() * Math.PI * 2;
        const dist = 70 + Math.random() * 60;
        mesh.position.set(Math.cos(angle)*dist, (Math.random()-0.5)*40, Math.sin(angle)*dist);
        mesh.lookAt(0,0,0);
        mesh.material.opacity = 0.85;
        mesh.userData.life = 1.0;
        explosions.push(mesh);
        scene.add(mesh);
      }

      setInterval(()=>{
        if(Math.random()<0.85) spawnExplosion();
      }, 700);

      const galaxy = new THREE.Group(); scene.add(galaxy);
      const CFG = window.GALAXIA_INFINITA_DATA || {};
      
      const defaultPhrasesCatalog = [
        { id: "preciosa", phrase: "Preciosa ✨", title: "Preciosa", letter: "Mi Gisse,\n\nno te imaginas lo preciosa que te ves cuando te ríes de la nada o cuando me estás contando algo que te emociona.\n\nNo hablo solo de cuando te arreglas —que siempre me dejas loco—, sino de esa forma tan tuya de ser, tan transparente y linda.\n\nTienes una luz que me desarma por completo y me hace sentir el novio más afortunado del mundo.\n\nTe amo muchísimo, preciosa mía. ✨" },
        { id: "mi-nina-hermosa", phrase: "Mi niña hermosa 🌷", title: "Mi niña hermosa", letter: "Mi niña hermosa,\n\ndespués de todo este tiempo juntos, me sigue naciendo cuidarte, consentirte y buscar cualquier excusa para sacarte una sonrisa.\n\nHay una ternura en ti que me derrite, y cuando estamos lejos no hay un solo día en que no piense en las ganas que tengo de tenerte cerquita para abrazarte fuerte y no soltarte.\n\nGracias por existir y por ser tan especial conmigo. 🌷" },
        { id: "mi-princesa", phrase: "Mi princesa 💛", title: "Mi princesa", letter: "Mi amor,\n\nsiempre te he dicho princesa porque te mereces todo el cariño y la atención del mundo.\n\nMe encanta tu forma de tratar a los tuyos, la nobleza que tienes y esa mezcla de mujer fuerte con la niña dulce de la que me enamoré.\n\nVerte feliz y saber que estás bien siempre va a ser mi mayor tranquilidad.\n\nAquí estoy y voy a estar siempre para ti, mi reina. 💛" },
        { id: "mi-girasol", phrase: "Mi girasol 🌻", title: "Mi girasol", letter: "Mi Gisse,\n\nsiempre me ha gustado decirte mi girasol porque tienes eso tan bonito de alegrarme los días.\n\nA veces puedo estar cansado, estresado o con mil cosas en la cabeza, y me basta hablar un ratito contigo o ver una foto tuya para que todo se sienta más suave.\n\nMe haces bien.\n\nY aunque a veces la distancia cueste y quisiera tenerte aquí al lado, saber que estás en mi vida me llena el pecho de agradecimiento.\n\nTe amo, mi girasol. 🌻" },
        { id: "bella", phrase: "Bella 🌼", title: "Bella", letter: "Mi vida,\n\neres bella por donde se te mire.\n\nPor fuera eres divina, tus ojitos y tu sonrisa me encantan, pero lo que más me atrapa de ti es lo linda que eres por dentro: tus detalles, tu paciencia, tu complicidad y la manera tan tuya de quererme.\n\nQué suerte la mía haber coincidido contigo y poder llamarte mi novia después de tantos años. 🌼" },
        { id: "mi-alegria", phrase: "Mi alegría 💫", title: "Mi alegría", letter: "Mi niña hermosa,\n\nuna de las cosas que más valoro de lo nuestro es cómo me alegras la vida.\n\nMe encanta molestarte, reírme contigo de cualquier bobada, compartir notas de voz y hablar de todo o de nada.\n\nContigo los días comunes se sienten especiales, y cuando no estamos juntos, me hace falta tu risa más de lo que te imaginas.\n\nTú eres mi alegría diaria, mi amor. 💫" },
        { id: "mi-paz", phrase: "Mi paz 🤍", title: "Mi paz", letter: "Mi amor,\n\nde verdad tú tienes algo que me tranquiliza el corazón.\n\nEn medio del ruido de la rutina o de días complicados, escuchar tu voz o simplemente saber que estás ahí me devuelve la calma.\n\nContigo siento esa confianza y esa tranquilidad de estar en casa, sin máscaras y con todo el amor del mundo.\n\nEres mi refugio y mi lugar seguro, Gisse. 🤍" },
        { id: "mi-vida", phrase: "Mi vida 💛", title: "Mi vida", letter: "Mi Gisse,\n\ndecirte 'mi vida' me sale del alma porque te has vuelto parte de todo lo que sueño y de todo lo que hago.\n\nHemos pasado por tantas cosas juntos, hemos crecido de la mano y me hace una ilusión enorme seguir construyendo nuestro futuro.\n\nAunque a veces la distancia apriete un poquito y nos toque extrañarnos, mi vida entera es más bonita contigo en ella. 💛" },
        { id: "mi-tesoro", phrase: "Mi tesoro ✨", title: "Mi tesoro", letter: "Mi niña,\n\nla gente se pasa la vida buscando algo sincero y real, y yo tuve la bendición de encontrarte a ti.\n\nPara mí eres un tesoro enorme, no solo por lo que representas en mi presente, sino por el valor incalculable de tu cariño, tu lealtad y tu corazón.\n\nTe cuido y te valoro con todo lo que soy, hoy y siempre. ✨" },
        { id: "hermosa", phrase: "Hermosa 🌸", title: "Hermosa", letter: "Mi amor,\n\neres hermosa cuando te ríes a carcajadas, cuando te quedas concentrada en algo, cuando me haces pucheros o cuando me regañas con cariño.\n\nEn cada faceta tuya encuentro una razón nueva para enamorarme otra vez.\n\nNo hay nadie que se compare a ti ni a la energía tan bonita que dejas en mí cada vez que te veo.\n\nEres perfecta a mis ojos, mi Gisse. 🌸" },
        { id: "mi-luz", phrase: "Mi luz ✨", title: "Mi luz", letter: "Mi niña hermosa,\n\nhay días que se sienten pesados o donde las cosas no salen como uno espera, pero pensar en ti es como respirar hondo.\n\nTu cariño siempre me guía, me levanta el ánimo y me recuerda lo que de verdad vale la pena.\n\nGracias por iluminar mis días, por creer en mí y por estar siempre a mi lado, incluso cuando no podemos vernos tanto como quisiéramos. ✨" },
        { id: "mi-cielo", phrase: "Mi cielo ☀️", title: "Mi cielo", letter: "Mi Gisse,\n\ncontigo siento una libertad y una confianza inmensa.\n\nEres mi cielo porque a tu lado puedo ser completamente yo: el que bromea, el que se sincera, el que te cuenta sus miedos y el que te ama sin medidas.\n\nGracias por darme un amor tan limpio, tan bonito y tan lleno de paz.\n\nQué fortuna tenerte, mi cielo. ☀️" },
        { id: "encantadora", phrase: "Encantadora 🌷", title: "Encantadora", letter: "Mi amor,\n\ntienes un encanto natural que no se compra ni se aprende: es tu forma de hablar, tus ocurrencias, tus gestos y esa dulzura con la que me miras.\n\nHan pasado años y todavía me tienes tan enamorado como al principio —o incluso más—.\n\nMe encanta ser tu novio y me encanta que seas tú mi cómplice en todo. 🌷" },
        { id: "mi-persona-favorita", phrase: "Mi persona favorita 💛", title: "Mi persona favorita", letter: "Gisse,\n\nsiempre termino queriendo hablar contigo, contarte cómo estuvo mi día, escucharte y compartir hasta el detalle más simple.\n\nPor eso eres mi persona favorita en este mundo.\n\nPorque contigo no necesito que pase nada extraordinario para sentirme feliz: solo saber de ti ya hace que cualquier día valga la pena.\n\nTe elijo mil veces más. 💛" },
        { id: "mi-razon-de-sonreir", phrase: "Mi razón de sonreír 😊", title: "Mi razón de sonreír", letter: "Mi niña,\n\nmuchas veces me descubro mirando el celular con una sonrisa boba solo porque me llegó un mensaje tuyo o porque me acordé de algo gracioso que dijiste.\n\nTú provocas en mí una felicidad tan espontánea y bonita que no cambiaría por nada.\n\nGracias por sacarme tantas sonrisas, incluso en la distancia.\n\nTe amo un montón. 😊" },
        { id: "mi-corazon", phrase: "Mi corazón ❤️", title: "Mi corazón", letter: "Mi amor,\n\ntú te ganaste un lugar en mi pecho que nadie más podría ocupar jamás.\n\nDesde hace años eres la dueña de mis mejores sentimientos, de mis planes y de mis ganas de salir adelante.\n\nCada latido lleva tu nombre y cada sueño que tengo te incluye a ti.\n\nTe amo con todo mi corazón, mi niña. ❤️" },
        { id: "mi-amor", phrase: "Mi amor 💛", title: "Mi amor", letter: "Mi amor,\n\nde todas las cosas lindas que tengo en la vida, una de las más importantes eres tú.\n\nGracias por quererme, por acompañarme, por aguantarme en mis días difíciles y por seguir construyendo esto conmigo con tanta paciencia y cariño.\n\nYo de verdad te quiero con el alma, y cada día me convenzo más de que tenerte ha sido lo mejor que me ha pasado. 💛" },
        { id: "unica", phrase: "Única ✨", title: "Única", letter: "Mi Gisse,\n\nno existe nadie en el mundo como tú.\n\nEsa mezcla tuya de carácter, nobleza, inteligencia y ternura infinita te hace única e irrepetible.\n\nNunca olvides lo valiosa que eres, lo mucho que te admiro y lo orgulloso que me siento de la mujer en la que te has convertido y de ser quien camina a tu lado. ✨" },
        { id: "especial", phrase: "Especial 🌼", title: "Especial", letter: "Mi vida,\n\nhaces que cualquier momento sencillo se vuelva un recuerdo inolvidable.\n\nUna llamada larga por la noche, vernos después de días sin coincidir o simplemente reírnos juntos son las cosas que más espero y que más atesoro de mi semana.\n\nEres demasiado especial para mí, Gisse. 🌼" },
        { id: "maravillosa", phrase: "Maravillosa 💫", title: "Maravillosa", letter: "Mi amor,\n\nme asombra constantemente la generosidad de tu corazón, tu esfuerzo diario y el amor tan sincero que entregas a la gente que quieres.\n\nEres una mujer maravillosa en todo sentido, y tenerte cerca —en persona o en el corazón— es un regalo que cuido todos los días.\n\nQué orgullo tenerte a mi lado. 💫" },
        { id: "mi-consentida", phrase: "Mi consentida 💛", title: "Mi consentida", letter: "Mi niña hermosa,\n\nme fascina consentirte, complacerte en tus antojos y verte con esa cara de felicidad cuando te sorprendo con algo.\n\nTe mereces todo el cariño, todos los abrazos y todo lo bonito de este mundo.\n\nSiempre vas a ser mi consentida número uno, no lo dudes nunca. 💛" },
        { id: "mi-bonita", phrase: "Mi bonita 🌷", title: "Mi bonita", letter: "Mi bonita,\n\nqué bien te queda esa palabra. Eres bonita de cara, bonita de alma, bonita en tus intenciones y en la forma tan dulce en la que me tratas.\n\nA veces la distancia me hace extrañar tanto tomarte de la mano y decirte todo esto mirándote a los ojos, pero sé que cada día que pasa nos acerca más a todo lo que soñamos juntos. 🌷" },
        { id: "dulce-nina", phrase: "Dulce niña ✨", title: "Dulce niña", letter: "Mi Gisse,\n\nesa dulzura tuya, tu lado tierno y esa forma tan espontánea de quererme es lo que más me enamora de ti.\n\nAunque pasen los años y crezcamos juntos, nunca pierdas esa esencia tan pura y bonita que te hace brillar.\n\nAquí tienes a un novio que te adora y que siempre va a cuidar de ti. ✨" },
        { id: "mi-mundo", phrase: "Mi mundo 🌍", title: "Mi mundo", letter: "Mi amor,\n\npuede haber un mundo entero allá afuera lleno de prisa y ruido, pero el mío empieza y termina donde estás tú.\n\nTú eres mi prioridad, mi refugio y el motivo por el que siempre quiero ser mejor persona.\n\nGracias por ser mi cómplice y mi compañera de vida.\n\nTe amo con locura, mi mundo. 🌍" },
        { id: "perfecta-para-mi", phrase: "Perfecta para mí 💛", title: "Perfecta para mí", letter: "Mi amor,\n\nyo sé que nadie es perfecto, pero contigo siento algo muy real: encajas demasiado bonito conmigo.\n\nTu forma de ser, tu cariño, tu manera de hablarme, de estar conmigo y hasta de hacerme falta… todo eso hace que para mí seas perfecta.\n\nNo porque seas irreal, sino porque eres tú, tal como eres, y a mí me encantas por completo. 💛" },
        { id: "mi-estrella", phrase: "Mi estrella ✨", title: "Mi estrella", letter: "Mi niña hermosa,\n\neres esa luz fija que siempre me orienta cuando me siento perdido o cansado.\n\nPensar en tu sonrisa, en nuestros planes y en el próximo abrazo que nos vamos a dar me da fuerzas para cualquier cosa.\n\nGracias por ser mi estrella y por no soltarme la mano jamás. ✨" },
        { id: "mi-princesa-hermosa", phrase: "Mi princesa hermosa 👑", title: "Mi princesa hermosa", letter: "Mi Gisse hermosa,\n\neres la dueña absoluta de mis pensamientos y el amor más lindo y sincero que la vida me pudo regalar.\n\nPrometo seguir cuidando de nosotros, valorando cada segundo que compartimos y recordándote siempre lo importante que eres para mí.\n\nTe amo hoy, mañana y siempre, mi princesa. 👑" },
        { id: "divina", phrase: "Divina 🌼", title: "Divina", letter: "Mi amor,\n\ntienes una gracia y una elegancia tan natural que me deja sin palabras.\n\nPero más allá de lo hermosa que eres, es tu bondad y la calidez con la que me abrazas lo que me llena el alma.\n\nEstar contigo y poder compartir mi vida a tu lado es de las mayores bendiciones que tengo. 🌼" },
        { id: "mi-todo", phrase: "Mi todo ❤️", title: "Mi todo", letter: "Mi Gisse,\n\neres mi novia, mi mejor amiga, mi cómplice y mi gran amor.\n\nHas estado en las buenas, en las difíciles y en cada paso importante de mi camino.\n\nNo necesito nada más teniéndote a mi lado; contigo lo tengo todo y contigo quiero seguir viviendo mil cosas más.\n\nTe amo con toda mi alma. ❤️" },
        { id: "mi-sueno-bonito", phrase: "Mi sueño bonito ✨", title: "Mi sueño bonito", letter: "Mi niña,\n\nmuchas veces soñé con un amor sincero, leal, cómplice y tranquilo.\n\nY cuando llegaste tú, no solo hiciste realidad ese sueño, sino que lo superaste con creces todos los días.\n\nGracias por estos años juntos, por elegirme cada mañana y por ser la mujer más increíble de mi vida.\n\nTe amo con todo lo que soy, mi sueño bonito. ✨" }
      ];

      const rawPhrases = (Array.isArray(CFG.phrases) && CFG.phrases.length) ? CFG.phrases : defaultPhrasesCatalog;
      const phraseCatalog = rawPhrases.map((item, idx) => {
        if (typeof item === 'string') {
          const clean = item.trim();
          const found = defaultPhrasesCatalog.find(d => d.phrase.toLowerCase().includes(clean.toLowerCase()) || clean.toLowerCase().includes(d.phrase.toLowerCase()));
          return found ? Object.assign({}, found) : { id: 'frase-' + idx, phrase: clean, title: clean, letter: clean };
        }
        if (item && item.id) {
          const cleanFallback = defaultPhrasesCatalog.find(d => d.id === item.id);
          if (cleanFallback) {
            const hasMojibake = /[\u00C3\u00C2\u00F0\u0178]/.test(item.phrase || '') || /[\u00C3\u00C2\u00F0\u0178]/.test(item.letter || '');
            if (hasMojibake) return Object.assign({}, cleanFallback);
          }
        }
        return Object.assign({}, item);
      });

      const phraseSprites = [];
      const _phraseWorldPos = new THREE.Vector3();
      const isCompactDevice = window.innerWidth < 700;
      const arms = 5, radius = 82, maxH = 22;
      const imageProxy = (url) => url;
      
      const ringImgs = (Array.isArray(CFG.ringImages) && CFG.ringImages.length)
        ? CFG.ringImages.slice()
        : [];
        
      const photoOrbit = new THREE.Group();
      photoOrbit.renderOrder = 0;
      scene.add(photoOrbit);
      const textTextureCache = new Map();
      const imageTextureCache = new Map();
      
      // Paleta romántica cálida: marfil cálido, dorado suave, amarillo champaña y oro fino
      const phraseStyles = [
        {
          accentGlow: 'rgba(255, 215, 80, 0.78)',
          outerHalo: 'rgba(255, 200, 60, 0.35)',
          topIvory: '#fff8d6',       // Cima: marfil cálido con leve destello
          centerGold: '#ffd766',     // Centro: amarillo champaña radiante
          baseFineGold: '#f5b532'    // Base: oro fino cálido
        },
        {
          accentGlow: 'rgba(255, 210, 75, 0.76)',
          outerHalo: 'rgba(255, 195, 55, 0.35)',
          topIvory: '#fff6ce',
          centerGold: '#fecf58',
          baseFineGold: '#efa728'
        },
        {
          accentGlow: 'rgba(255, 220, 85, 0.78)',
          outerHalo: 'rgba(255, 205, 70, 0.36)',
          topIvory: '#fffbe2',
          centerGold: '#ffdf7a',
          baseFineGold: '#f7bf3c'
        },
        {
          accentGlow: 'rgba(255, 212, 70, 0.75)',
          outerHalo: 'rgba(255, 198, 60, 0.35)',
          topIvory: '#fff7d2',
          centerGold: '#ffd564',
          baseFineGold: '#f2b330'
        },
        {
          accentGlow: 'rgba(255, 218, 80, 0.78)',
          outerHalo: 'rgba(255, 202, 65, 0.36)',
          topIvory: '#fff9da',
          centerGold: '#ffdc70',
          baseFineGold: '#f8bd38'
        },
        {
          accentGlow: 'rgba(255, 208, 68, 0.75)',
          outerHalo: 'rgba(255, 192, 50, 0.34)',
          topIvory: '#fff5c8',
          centerGold: '#fecd5a',
          baseFineGold: '#f0ad2a'
        }
      ];
      
      function makeTextTexture(text, colorIndex=0){
        const style = phraseStyles[colorIndex % phraseStyles.length];
        const cacheKey = text + '|' + colorIndex;
        if(textTextureCache.has(cacheKey)) return textTextureCache.get(cacheKey);

        const c = document.createElement('canvas');
        c.width = 1280; c.height = 240;
        const g = c.getContext('2d');
        g.clearRect(0, 0, c.width, c.height);

        const size = Math.max(66, Math.min(100, 2000 / text.length));
        g.font = '700 ' + size + 'px "Cormorant Garamond", Georgia, serif';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.lineJoin = 'round';

        const cx = c.width / 2;
        const cy = c.height / 2;
        const topY = cy - size * 0.52;
        const botY = cy + size * 0.52;

        // 1. Capa de Halo / Glow exterior cálido y suave para despegar la frase del fondo
        g.shadowColor = style.accentGlow;
        g.shadowBlur = 24;
        g.strokeStyle = style.outerHalo;
        g.lineWidth = 11;
        g.strokeText(text, cx, cy);

        // 2. Outline oscuro fino y nítido para máximo contraste frente a estrellas y nebulosas
        g.shadowColor = 'transparent';
        g.shadowBlur = 0;
        g.strokeStyle = 'rgba(5, 4, 2, 0.95)';
        g.lineWidth = 6.5;
        g.strokeText(text, cx, cy);

        // 3. Relleno principal: gradiente vertical marfil cálido -> amarillo champaña -> oro fino
        const textGradient = g.createLinearGradient(0, topY, 0, botY);
        textGradient.addColorStop(0, style.topIvory);          // 0%: Marfil cálido suave
        textGradient.addColorStop(0.35, style.centerGold);     // 35%: Amarillo champaña luminoso
        textGradient.addColorStop(0.70, style.centerGold);     // 70%: Dorado suave continuo
        textGradient.addColorStop(1, style.baseFineGold);      // 100%: Oro fino cálido
        g.fillStyle = textGradient;
        g.fillText(text, cx, cy);

        // 4. Filete interior y brillo de luz superior con destello dorado suave
        g.shadowColor = 'rgba(255, 235, 150, 0.75)';
        g.shadowBlur = 6;
        g.strokeStyle = 'rgba(255, 245, 180, 0.65)';
        g.lineWidth = 1.4;
        g.strokeText(text, cx, cy);

        const texture = new THREE.CanvasTexture(c);
        texture.encoding = THREE.sRGBEncoding;
        textTextureCache.set(cacheKey, texture);
        return texture;
      }
      
      function makeImageTexture(url, cb) {
        if(imageTextureCache.has(url)){
          const cached=imageTextureCache.get(url);
          if(cached.texture) cb(cached.texture);
          else cached.callbacks.push(cb);
          return;
        }
        const cacheEntry={texture:null,callbacks:[cb]};
        imageTextureCache.set(url,cacheEntry);
        loadingManager.itemStart(url);
        const img = new window.Image();
        img.crossOrigin = "anonymous";
        img.onload = function() {
          const frame=document.createElement('canvas');
          frame.width=frame.height=512;
          const frameContext=frame.getContext('2d');
          const inset=18, corner=68;
          frameContext.beginPath();
          frameContext.moveTo(inset+corner,inset);
          frameContext.arcTo(512-inset,inset,512-inset,512-inset,corner);
          frameContext.arcTo(512-inset,512-inset,inset,512-inset,corner);
          frameContext.arcTo(inset,512-inset,inset,inset,corner);
          frameContext.arcTo(inset,inset,512-inset,inset,corner);
          frameContext.closePath();
          frameContext.save();
          frameContext.clip();
          const imageRatio=img.width/img.height;
          const targetRatio=1;
          let sourceX=0,sourceY=0,sourceW=img.width,sourceH=img.height;
          if(imageRatio>targetRatio){sourceW=img.height;sourceX=(img.width-sourceW)/2;}
          else{sourceH=img.width;sourceY=(img.height-sourceH)/2;}
          frameContext.drawImage(img,sourceX,sourceY,sourceW,sourceH,0,0,512,512);
          frameContext.restore();
          frameContext.shadowColor = 'rgba(255, 200, 50, 0.4)';
          frameContext.shadowBlur = 8;
          frameContext.lineWidth = 6;
          frameContext.strokeStyle = 'rgba(255, 225, 120, 0.75)';
          frameContext.stroke();
          const texture = new THREE.CanvasTexture(frame);
          texture.encoding = THREE.sRGBEncoding;
          texture.needsUpdate = true;
          cacheEntry.texture=texture;
          cacheEntry.callbacks.forEach(callback=>callback(texture));
          cacheEntry.callbacks.length=0;
          loadingManager.itemEnd(url);
        };
        img.onerror = function() {
          cacheEntry.callbacks.length=0;
          loadingManager.itemError(url);
          loadingManager.itemEnd(url);
        };
        img.src = url;
      }
      
      // Generación orbital refinada de fotos en photoOrbit (más aire, radio amplio, tamaño delicado)
      const totalImages = ringImgs.length ? 12 : 0;
      if (totalImages > 0) {
        for (let imgPointer = 0; imgPointer < totalImages; imgPointer++) {
          const imgUrl = ringImgs[imgPointer % ringImgs.length];
          const imageAngle = (imgPointer / totalImages) * Math.PI * 2;
          const imageOrbitRadius = isCompactDevice ? 27 : 33;
          const imageX = Math.cos(imageAngle) * imageOrbitRadius;
          const imageZ = Math.sin(imageAngle) * imageOrbitRadius;
          const imageY = 2.4 + Math.sin(imageAngle * 3) * 0.6;
          makeImageTexture(imgUrl, function(tex) {
            const spr = new THREE.Sprite(new THREE.SpriteMaterial({
              map: tex,
              color: 0xffffff,
              transparent: true,
              alphaTest: 0.05,
              opacity: 0.90,
              depthWrite: true,
              depthTest: true
            }));
            spr.position.set(imageX, imageY, imageZ);
            spr.scale.set(isCompactDevice ? 4.8 : 5.8, isCompactDevice ? 4.8 : 5.8, 1);
            spr.renderOrder = 2;
            photoOrbit.add(spr);
          });
        }
      }

      // Distribución equilibrada de frases únicas: exactamente 1 sprite por cada frase del catálogo
      const totalPhrases = phraseCatalog.length;
      const phrasesPerArm = Math.ceil(totalPhrases / arms);
      
      for (let idx = 0; idx < totalPhrases; idx++) {
        const armIndex = idx % arms;
        const step = Math.floor(idx / arms);
        const progress = phrasesPerArm > 1 ? (step / (phrasesPerArm - 1)) : 0;
        
        // Separación radial amplia desde el núcleo (dist = 38) hasta el exterior (dist = 102)
        const dist = 38 + progress * 64;
        const armAngle = armIndex * (Math.PI * 2 / arms);
        const angle = armAngle + progress * Math.PI * 1.02;
        const x = Math.cos(angle) * dist;
        const z = Math.sin(angle) * dist;
        
        // Desfase vertical sinusoidal suave para evitar que los textos se encimen visualmente
        const y = (step % 2 === 0 ? 1.8 : -1.8) + Math.sin(step * 1.4) * 0.9;
        
        const phraseItem = phraseCatalog[idx];
        const text = phraseItem.phrase;
        const tex = makeTextTexture(text, idx);
        
        const spr = new THREE.Sprite(new THREE.SpriteMaterial({
          map: tex,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          depthTest: true
        }));
        spr.isPhrase = true;
        spr.phraseData = phraseItem;
        spr.baseScale = new THREE.Vector3(isCompactDevice ? 26 : 32, isCompactDevice ? 4.875 : 6.0, 1);
        spr.scale.copy(spr.baseScale);
        spr.renderOrder = 10;
        spr.position.set(x, y + 2.0, z);
        
        galaxy.add(spr);
        phraseSprites.push(spr);
      }
      
      function makeParticleTexture(){
        const particleCanvas = document.createElement('canvas');
        particleCanvas.width = particleCanvas.height = 64;
        const particleContext = particleCanvas.getContext('2d');
        const particleGlow = particleContext.createRadialGradient(32,32,0,32,32,32);
        particleGlow.addColorStop(0, 'rgba(255,255,255,1)');
        particleGlow.addColorStop(.18, 'rgba(255,248,210,.85)');
        particleGlow.addColorStop(.45, 'rgba(255,210,50,.35)');
        particleGlow.addColorStop(1, 'rgba(255,160,20,0)');
        particleContext.fillStyle = particleGlow;
        particleContext.fillRect(0,0,64,64);
        return new THREE.CanvasTexture(particleCanvas);
      }

      const particleTexture = makeParticleTexture();
      const starCount = isCompactDevice ? 20000 : 40000;
      const geom = new THREE.BufferGeometry();
      const pos = new Float32Array(starCount * 3);
      const colors = new Float32Array(starCount * 3);
      const coreColor = new THREE.Color('#fffbf0');
      const armColor = new THREE.Color('#f5b041');
      const edgeColor = new THREE.Color('#f7dc6f');
      const mixedColor = new THREE.Color();
      const galaxyRadius = 96;

      function centeredRandom(){
        return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
      }

      for(let i=0;i<starCount;i++){
        const index = i * 3;
        const radialProgress = Math.pow(Math.random(), 1.72);
        const dist = radialProgress * galaxyRadius;
        const armIndex = i % arms;
        const armAngle = armIndex / arms * Math.PI * 2;
        const spiral = dist * 0.082;
        const spread = (0.16 + radialProgress * 0.52) * centeredRandom();
        const angle = armAngle + spiral + spread;
        const radialNoise = centeredRandom() * (1.2 + radialProgress * 5.5);
        const finalRadius = Math.max(0, dist + radialNoise);
        const verticalThickness = 4.8 * Math.pow(1-radialProgress,.75) + .45;

        pos[index] = Math.cos(angle) * finalRadius;
        pos[index+1] = centeredRandom() * verticalThickness;
        pos[index+2] = Math.sin(angle) * finalRadius;

        if(radialProgress < .2){
          mixedColor.copy(coreColor).lerp(armColor, radialProgress / .2);
        } else {
          mixedColor.copy(armColor).lerp(edgeColor, (radialProgress-.2) / .8);
        }
        const sparkle = Math.random();
        if(sparkle > .965) mixedColor.lerp(coreColor, .82);
        else mixedColor.offsetHSL(centeredRandom()*.018, centeredRandom()*.06, centeredRandom()*.08);
        colors[index] = mixedColor.r;
        colors[index+1] = mixedColor.g;
        colors[index+2] = mixedColor.b;
      }

      geom.setAttribute('position', new THREE.BufferAttribute(pos,3));
      geom.setAttribute('color', new THREE.BufferAttribute(colors,3));
      const starMaterial = new THREE.PointsMaterial({
        map: particleTexture,
        size: isCompactDevice ? .74 : .66,
        vertexColors: true,
        transparent: true,
        opacity: .88,
        depthWrite: false,
        alphaTest: .015,
        sizeAttenuation: true,
        blending: THREE.AdditiveBlending
      });
      const spiralParticles = new THREE.Points(geom, starMaterial);
      galaxy.add(spiralParticles);

      const dustCount = isCompactDevice ? 4200 : 7800;
      const dustGeometry = new THREE.BufferGeometry();
      const dustPositions = new Float32Array(dustCount*3);
      for(let i=0;i<dustCount;i++){
        const index=i*3;
        const dist=Math.sqrt(Math.random())*galaxyRadius*1.13;
        const angle=Math.random()*Math.PI*2;
        dustPositions[index]=Math.cos(angle)*dist;
        dustPositions[index+1]=centeredRandom()*(1.5+5*(1-dist/(galaxyRadius*1.13)));
        dustPositions[index+2]=Math.sin(angle)*dist;
      }
      dustGeometry.setAttribute('position',new THREE.BufferAttribute(dustPositions,3));
      const dustPoints = new THREE.Points(dustGeometry,new THREE.PointsMaterial({
        map:particleTexture,
        color:0xffe082,
        size:.26,
        transparent:true,
        opacity:.28,
        depthWrite:false,
        blending:THREE.AdditiveBlending
      }));
      galaxy.add(dustPoints);
      
      // ============================================
      // NÚCLEO: CORAZÓN FLORAL CÓSMICO (ROMÁNTICO Y ELEGANTE)
      // ============================================
      const celestialCore = new THREE.Group();
      scene.add(celestialCore);

      // 1. Nube de Partículas Doradas en Forma de Corazón 3D
      const heartParticleCount = isCompactDevice ? 650 : 1100;
      const heartGeo = new THREE.BufferGeometry();
      const heartPositions = new Float32Array(heartParticleCount * 3);
      const heartColors = new Float32Array(heartParticleCount * 3);

      const hColCore = new THREE.Color('#fffff5');
      const hColGold = new THREE.Color('#ffd54f');
      const hColWarm = new THREE.Color('#ffb74d');
      const hColPeach = new THREE.Color('#ffe0b2');

      for (let i = 0; i < heartParticleCount; i++) {
        const u = Math.random() * Math.PI * 2;
        const sinU = Math.sin(u);
        const cosU = Math.cos(u);
        // Ecuación paramétrica de corazón
        const hx = 16 * Math.pow(sinU, 3);
        const hy = 13 * cosU - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u);

        // Llenado orgánico hacia el interior y volumen en profundidad Z
        const fill = Math.pow(Math.random(), 0.62);
        const depthSpread = (Math.random() - 0.5) * 4.2 * (1 - Math.min(1, Math.abs(hy) / 16));
        const scale = (isCompactDevice ? 0.44 : 0.52) * fill;

        const x = hx * scale + (Math.random() - 0.5) * 0.7;
        const y = hy * scale + 0.6 + (Math.random() - 0.5) * 0.7;
        const z = depthSpread;

        heartPositions[i * 3] = x;
        heartPositions[i * 3 + 1] = y;
        heartPositions[i * 3 + 2] = z;

        const rNorm = Math.sqrt(x * x + y * y) / 8.5;
        const pCol = new THREE.Color();
        if (rNorm < 0.35) {
          pCol.copy(hColCore).lerp(hColGold, rNorm / 0.35);
        } else if (rNorm < 0.75) {
          pCol.copy(hColGold).lerp(hColWarm, (rNorm - 0.35) / 0.4);
        } else {
          pCol.copy(hColWarm).lerp(hColPeach, (rNorm - 0.75) / 0.25);
        }
        heartColors[i * 3] = pCol.r;
        heartColors[i * 3 + 1] = pCol.g;
        heartColors[i * 3 + 2] = pCol.b;
      }

      heartGeo.setAttribute('position', new THREE.BufferAttribute(heartPositions, 3));
      heartGeo.setAttribute('color', new THREE.BufferAttribute(heartColors, 3));

      const heartPointsMat = new THREE.PointsMaterial({
        map: particleTexture,
        vertexColors: true,
        size: isCompactDevice ? 0.65 : 0.80,
        transparent: true,
        opacity: 0.68,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
      });
      const heartPoints = new THREE.Points(heartGeo, heartPointsMat);
      celestialCore.add(heartPoints);

      // 2. Micro-pétalos suaves contorneando el corazón
      const heartPetalsGroup = new THREE.Group();
      celestialCore.add(heartPetalsGroup);
      const heartPetalCanvas = document.createElement('canvas');
      heartPetalCanvas.width = 128; heartPetalCanvas.height = 128;
      const hpCtx = heartPetalCanvas.getContext('2d');
      const hpGrad = hpCtx.createRadialGradient(64, 64, 5, 64, 64, 60);
      hpGrad.addColorStop(0, 'rgba(255, 250, 230, 0.70)');
      hpGrad.addColorStop(0.35, 'rgba(255, 215, 100, 0.40)');
      hpGrad.addColorStop(0.7, 'rgba(255, 175, 45, 0.15)');
      hpGrad.addColorStop(1, 'rgba(255, 150, 20, 0)');
      hpCtx.fillStyle = hpGrad;
      hpCtx.beginPath();
      hpCtx.arc(64, 64, 60, 0, Math.PI * 2);
      hpCtx.fill();
      const heartPetalTex = new THREE.CanvasTexture(heartPetalCanvas);
      heartPetalTex.encoding = THREE.sRGBEncoding;

      const numContourPetals = isCompactDevice ? 24 : 36;
      const contourPetalGeo = new THREE.PlaneGeometry(1.6, 1.6);
      const contourPetalMat = new THREE.MeshBasicMaterial({
        map: heartPetalTex,
        transparent: true,
        opacity: 0.45,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide
      });

      for (let i = 0; i < numContourPetals; i++) {
        const u = (i / numContourPetals) * Math.PI * 2;
        const sinU = Math.sin(u);
        const cosU = Math.cos(u);
        const hx = 16 * Math.pow(sinU, 3);
        const hy = 13 * cosU - 5 * Math.cos(2 * u) - 2 * Math.cos(3 * u) - Math.cos(4 * u);
        const scale = isCompactDevice ? 0.44 : 0.52;

        const pMesh = new THREE.Mesh(contourPetalGeo, contourPetalMat);
        pMesh.position.set(hx * scale, hy * scale + 0.6, (Math.random() - 0.5) * 1.5);
        pMesh.rotation.z = u;
        pMesh.scale.setScalar(0.8 + Math.random() * 0.5);
        heartPetalsGroup.add(pMesh);
      }

      // 3. Halo Bloom luminoso envolvente delicado (atenuado y cálido)
      const coreHaloCanvas = document.createElement('canvas');
      coreHaloCanvas.width = coreHaloCanvas.height = 256;
      const chCtx = coreHaloCanvas.getContext('2d');
      const chGrad = chCtx.createRadialGradient(128, 128, 5, 128, 128, 126);
      chGrad.addColorStop(0, 'rgba(255, 248, 220, 0.45)');
      chGrad.addColorStop(0.25, 'rgba(255, 215, 110, 0.20)');
      chGrad.addColorStop(0.6, 'rgba(255, 175, 40, 0.05)');
      chGrad.addColorStop(1, 'rgba(255, 150, 20, 0)');
      chCtx.fillStyle = chGrad;
      chCtx.fillRect(0, 0, 256, 256);
      const coreHaloTex = new THREE.CanvasTexture(coreHaloCanvas);
      const coreHaloSprite = new THREE.Sprite(new THREE.SpriteMaterial({
        map: coreHaloTex,
        blending: THREE.AdditiveBlending,
        transparent: true,
        opacity: 0.36,
        depthWrite: false
      }));
      coreHaloSprite.scale.set(15, 15, 1);
      celestialCore.add(coreHaloSprite);

      // 4. Dos Anillos Finos y Elegantes de Polvo Dorado
      function createFineOrbitRing(count, ringRadius, colorHex, inclineX, inclineZ) {
        const ringGeo = new THREE.BufferGeometry();
        const rPos = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          const a = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.05;
          const r = ringRadius + (Math.random() - 0.5) * 1.2;
          rPos[i * 3] = Math.cos(a) * r;
          rPos[i * 3 + 1] = (Math.random() - 0.5) * 0.7;
          rPos[i * 3 + 2] = Math.sin(a) * r;
        }
        ringGeo.setAttribute('position', new THREE.BufferAttribute(rPos, 3));
        const ringMat = new THREE.PointsMaterial({
          map: particleTexture,
          color: colorHex,
          size: isCompactDevice ? 0.50 : 0.58,
          transparent: true,
          opacity: 0.52,
          blending: THREE.AdditiveBlending,
          depthWrite: false
        });
        const ringPoints = new THREE.Points(ringGeo, ringMat);
        ringPoints.rotation.x = inclineX;
        ringPoints.rotation.z = inclineZ;
        return ringPoints;
      }
      const ring1 = createFineOrbitRing(100, 13.5, 0xfff0b3, 0.42, -0.22);
      const ring2 = createFineOrbitRing(130, 16.8, 0xffd580, -0.36, 0.32);
      celestialCore.add(ring1);
      celestialCore.add(ring2);

      // Luz dorada cálida central delicada (atenuada para evitar sobreexposición)
      const corePointLight = new THREE.PointLight(0xffe599, 0.50, 65);
      corePointLight.position.set(0, 1, 0);
      celestialCore.add(corePointLight);

      // Compatibilidad con referencia legacy
      const core = heartPoints;
      
      const light = new THREE.PointLight(0xfff5cc, 0.58, 150);
      light.position.set(0, 30, 60);
      scene.add(light);
      const textGroup = new THREE.Group();
      scene.add(textGroup);
      let titleMesh=null;
      let titleContainer=null;
      const textLoader = new THREE.FontLoader(loadingManager);
      textLoader.load('https://cdn.jsdelivr.net/npm/three@0.128.0/examples/fonts/optimer_regular.typeface.json',function(font){
        titleContainer = new THREE.Group();
        textGroup.add(titleContainer);
        titleMesh = titleContainer;

        // ============================================
        // 1. LÍNEA PRINCIPAL PROTAGONISTA: "Te amo"
        // ============================================
        const geoTeAmo = new THREE.TextGeometry('Te amo', {
          font,
          size: isCompactDevice ? 4.8 : 5.8,
          height: 0.95,
          curveSegments: 16,
          bevelEnabled: true,
          bevelThickness: 0.16,
          bevelSize: 0.08,
          bevelOffset: 0,
          bevelSegments: 5
        });
        geoTeAmo.computeBoundingBox();
        const b1 = geoTeAmo.boundingBox;
        geoTeAmo.translate(
          -(b1.max.x - b1.min.x) / 2 - b1.min.x,
          -(b1.max.y - b1.min.y) / 2 - b1.min.y,
          -(b1.max.z - b1.min.z) / 2 - b1.min.z
        );

        const matFrontTeAmo = new THREE.MeshPhongMaterial({
          color: 0xfff6c8,
          emissive: 0x7c5d0c,
          shininess: 160,
          specular: 0xffffff
        });
        const matSideTeAmo = new THREE.MeshPhongMaterial({
          color: 0xdca622,
          emissive: 0x3d2800,
          shininess: 95,
          specular: 0xffe680
        });
        const meshTeAmo = new THREE.Mesh(geoTeAmo, [matFrontTeAmo, matSideTeAmo]);
        meshTeAmo.position.set(0, isCompactDevice ? 2.3 : 2.8, 0);
        meshTeAmo.renderOrder = 2;
        titleContainer.add(meshTeAmo);

        // ============================================
        // 2. LÍNEA SECUNDARIA DELICADA Y ESPECIAL: "Gisse"
        // ============================================
        const geoGisse = new THREE.TextGeometry('Gisse', {
          font,
          size: isCompactDevice ? 3.3 : 4.1,
          height: 0.72,
          curveSegments: 16,
          bevelEnabled: true,
          bevelThickness: 0.12,
          bevelSize: 0.06,
          bevelOffset: 0,
          bevelSegments: 5
        });
        geoGisse.computeBoundingBox();
        const b2 = geoGisse.boundingBox;
        geoGisse.translate(
          -(b2.max.x - b2.min.x) / 2 - b2.min.x,
          -(b2.max.y - b2.min.y) / 2 - b2.min.y,
          -(b2.max.z - b2.min.z) / 2 - b2.min.z
        );

        const matFrontGisse = new THREE.MeshPhongMaterial({
          color: 0xfff0b8,
          emissive: 0x6e5008,
          shininess: 150,
          specular: 0xffffff
        });
        const matSideGisse = new THREE.MeshPhongMaterial({
          color: 0xd49e1e,
          emissive: 0x342200,
          shininess: 90,
          specular: 0xffd700
        });
        const meshGisse = new THREE.Mesh(geoGisse, [matFrontGisse, matSideGisse]);
        meshGisse.position.set(0, isCompactDevice ? -2.5 : -3.0, 0);
        meshGisse.renderOrder = 2;
        titleContainer.add(meshGisse);

        // ============================================
        // 3. AURA LUMINOSA ORGÁNICA Y DIFUSA (SIN BORDES RECTOS NI PLACAS RECTANGULARES)
        // ============================================
        const auraCanvas = document.createElement('canvas');
        auraCanvas.width = auraCanvas.height = 512;
        const aCtx = auraCanvas.getContext('2d');
        aCtx.clearRect(0, 0, 512, 512);

        // Nube circular suave con decaimiento natural que llega a alpha 0 a 210px (lejos de los 256px de los bordes)
        const aGrad = aCtx.createRadialGradient(256, 256, 4, 256, 256, 210);
        aGrad.addColorStop(0, 'rgba(255, 232, 140, 0.35)');
        aGrad.addColorStop(0.30, 'rgba(255, 205, 75, 0.15)');
        aGrad.addColorStop(0.60, 'rgba(255, 175, 30, 0.04)');
        aGrad.addColorStop(0.85, 'rgba(255, 150, 10, 0.01)');
        aGrad.addColorStop(1.0, 'rgba(255, 140, 0, 0)');
        aCtx.fillStyle = aGrad;
        aCtx.beginPath();
        aCtx.arc(256, 256, 210, 0, Math.PI * 2);
        aCtx.fill();

        const auraTex = new THREE.CanvasTexture(auraCanvas);
        const titleAuraSprite = new THREE.Sprite(new THREE.SpriteMaterial({
          map: auraTex,
          blending: THREE.AdditiveBlending,
          transparent: true,
          opacity: 0.52,
          depthWrite: false
        }));
        const auraW = isCompactDevice ? 32 : 38;
        const auraH = isCompactDevice ? 17 : 20;
        titleAuraSprite.scale.set(auraW, auraH, 1);
        titleAuraSprite.position.set(0, -0.1, -1.2);
        titleContainer.add(titleAuraSprite);

        // Iluminación frontal y posterior
        const titleLight = new THREE.PointLight(0xffebb0, 1.30, 85);
        titleLight.position.set(0, 0, 16);
        titleContainer.add(titleLight);

        const titleBackLight = new THREE.PointLight(0xffd54f, 0.55, 50);
        titleBackLight.position.set(0, 0, -8);
        titleContainer.add(titleBackLight);

        // Posición base de la composición en 2 niveles integrada armónicamente sobre el corazón
        titleContainer.position.set(0, isCompactDevice ? 11.6 : 11.0, 0);
        titleContainer.rotation.x = -0.06;
      });
      
      let saturnWrap = null;
      
      function animate(){
        requestAnimationFrame(animate);
        if(!backgroundReady) return;
        const t = performance.now()*0.001;
        if (cinematicState !== null) {
          if (cinematicStart === null) {
            cinematicStart = t;
            lastCinematicTime = t;
          }
          const dt = Math.min(0.08, t - lastCinematicTime);
          lastCinematicTime = t;
          const elapsed = t - cinematicStart;

          const isMobile = window.innerWidth < 768 || window.innerWidth < window.innerHeight;
          const finalCamPos = new THREE.Vector3(0, isMobile ? 21 : 20, isMobile ? 112 : 76);
          const startCamPos = new THREE.Vector3(0, isMobile ? 32 : 28, isMobile ? 330 : 270);
          const midCamPos = new THREE.Vector3(0, isMobile ? 28 : 24, isMobile ? 210 : 160);

          let currentWarpSpeed = 15;
          let flowersOpacity = 0.95;
          let rollAngle = 0;
          let jitter = 0;

          if (elapsed < P1_END) {
            // ============================================
            // FASE 1: INICIO (0.0s - 0.8s)
            // ============================================
            // Destellos de polen y flores nacientes, avance suave hacia adelante
            const p = elapsed / P1_END;
            currentWarpSpeed = 15 + 30 * easeInQuad(p);
            flowersOpacity = 0.35 + 0.65 * p;

            camera.position.lerpVectors(startCamPos, startCamPos.clone().add(new THREE.Vector3(0, 0, -4)), p);
            camera.lookAt(0, 0, 0);
            camera.rotation.z = 0;
            controls.enabled = false;
          } else if (elapsed < P2_END) {
            // ============================================
            // FASE 2: ACELERACIÓN (0.8s - 2.0s)
            // ============================================
            // Vórtice floral se acelera, girasoles, rosas y pétalos fluyen hacia cámara
            const p = (elapsed - P1_END) / (P2_END - P1_END);
            currentWarpSpeed = 45 + 475 * easeInCubic(p);
            flowersOpacity = 1.0;
            rollAngle = Math.sin(p * Math.PI) * 0.022;

            const travelP = Math.min(1, (elapsed - P1_END) / (P3_END - P1_END));
            camera.position.lerpVectors(startCamPos, midCamPos, easeInOutQuad(travelP * 0.7));
            camera.lookAt(0, 0, 0);
            camera.rotation.z = rollAngle;
            controls.enabled = false;
          } else if (elapsed < P3_END) {
            // ============================================
            // FASE 3: VELOCIDAD MÁXIMA (2.0s - 3.8s)
            // ============================================
            // Viaje a velocidad extrema a través de un universo continuo de flores, pétalos y polen
            const p = (elapsed - P2_END) / (P3_END - P2_END);
            currentWarpSpeed = 520;
            flowersOpacity = 1.0;
            rollAngle = Math.sin(elapsed * 3.8) * 0.028;
            jitter = (Math.random() - 0.5) * 0.08;

            const travelP = 0.7 + 0.3 * p;
            camera.position.lerpVectors(startCamPos, midCamPos, easeInOutQuad(travelP));
            camera.lookAt(0, 0, 0);
            camera.rotation.z = rollAngle;
            camera.position.x += jitter;
            camera.position.y += jitter;
            controls.enabled = false;
          } else if (elapsed < P4_END) {
            // ============================================
            // FASE 4: DESACELERACIÓN (3.8s - 5.0s)
            // ============================================
            // Desaceleración suave, flores flotan en torno a la cámara, corazón floral visible a lo lejos
            const p = (elapsed - P3_END) / (P4_END - P3_END);
            const decelP = easeOutCubic(p);
            currentWarpSpeed = 520 * (1 - decelP) + 15;
            flowersOpacity = 1.0 - 0.85 * decelP;
            rollAngle = Math.sin(elapsed * 3.8) * 0.028 * (1 - p);

            camera.position.lerpVectors(midCamPos, finalCamPos, easeOutCubic(p * 0.75));
            camera.lookAt(0, 0, 0);
            camera.rotation.z = rollAngle;
            controls.enabled = false;

            setGalaxyIntroVisibility('PHASE4', p);
          } else if (elapsed < P5_END) {
            // ============================================
            // FASE 5: REVELACIÓN GRADUAL DE LA GALAXIA (5.0s - 5.6s)
            // ============================================
            // Revelación secuencial: estrellas y núcleo plenos, fotos orbitales y frases desplegadas
            const p = (elapsed - P4_END) / (P5_END - P4_END);
            currentWarpSpeed = 15 * (1 - p);
            flowersOpacity = 0.15 * (1 - p);
            rollAngle = 0;

            const finalLerpP = 0.75 + 0.25 * easeOutCubic(p);
            camera.position.lerpVectors(midCamPos, finalCamPos, finalLerpP);
            camera.lookAt(0, 0, 0);
            camera.rotation.z = 0;
            controls.enabled = false;

            setGalaxyIntroVisibility('PHASE5', p);
          } else {
            // ============================================
            // FINALIZACIÓN: Galaxia revelada, OrbitControls habilitado, pista visible
            // ============================================
            camera.position.copy(finalCamPos);
            camera.lookAt(0, 2, 0);
            camera.rotation.z = 0;
            controls.target.set(0, 2, 0);
            controls.update();
            controls.enabled = true;

            setGalaxyIntroVisibility('COMPLETE', 1);
            disposeWarpSystem();

            cinematicState = null;
            document.body.classList.remove('cinematic-active');
            document.body.classList.add('galaxy-ready');

            // Habilitar interacción de frases y cartas SOLO AHORA que la galaxia está lista
            galaxyInteractionEnabled = true;
            if (pointerRecord) pointerRecord.isDown = false;
          }

          // Actualizar elementos florales del túnel espacial (sin líneas ni streaks)
          if (warpContainer && warpContainer.visible && warpItems.length) {
            for (let i = 0; i < warpItems.length; i++) {
              const item = warpItems[i];
              const u = item.userData;
              item.position.z += currentWarpSpeed * dt * u.speedMult;
              item.rotation.z += u.rotSpeedZ * dt;

              // Inclinación 3D natural y suave según avanza
              item.rotation.x = u.tiltX + Math.sin(t * 1.6 + u.angle) * 0.14;
              item.rotation.y = u.tiltY + Math.cos(t * 1.6 + u.angle) * 0.14;

              if (item.material) item.material.opacity = flowersOpacity;

              // Reposición cuando rebasa la cámara (Z > 8, ya pasó por detrás)
              if (item.position.z > 8) {
                item.position.z = -340 - Math.random() * 50;
                u.angle = Math.random() * Math.PI * 2;
                const rFactor = Math.sqrt(Math.random());
                u.radius = u.minR + rFactor * (u.maxR - u.minR);
                item.position.x = Math.cos(u.angle) * u.radius;
                item.position.y = Math.sin(u.angle) * u.radius;
                u.tiltX = (Math.random() - 0.5) * 0.35;
                u.tiltY = (Math.random() - 0.5) * 0.35;
              }
            }
          }
        }
        galaxy.rotation.y = t * 0.05;
        celestialCore.rotation.y = t * 0.04;
        ring1.rotation.y = t * 0.12;
        ring2.rotation.y = -t * 0.09;

        // Latido romántico sutil del corazón floral cósmico
        const heartBeat = 1.0 + 0.042 * Math.sin(t * 2.8) + 0.018 * Math.sin(t * 5.6);
        heartPoints.scale.set(heartBeat, heartBeat, heartBeat);
        heartPetalsGroup.scale.set(heartBeat, heartBeat, heartBeat);
        coreHaloSprite.scale.set(15 * heartBeat, 15 * heartBeat, 1);

        photoOrbit.rotation.y = t * 0.04;
        if(titleMesh){
          titleMesh.lookAt(camera.position);
          titleMesh.position.y = (isCompactDevice ? 11.6 : 11.0) + Math.sin(t * 1.1) * 0.30;
          titleMesh.rotateY(Math.sin(t * 0.65) * 0.04);
        }
        if(saturnWrap && saturnWrap.visible){
          saturnWrap.rotation.y = t * 0.12;
        }
        // Control dinámico de escala de frases según proximidad a la cámara:
        // Evita que las palabras que rotan hacia el primer plano se agiganten de forma desproporcionada
        if (phraseSprites.length > 0 && !activeLetterSprite) {
          const keyIndices = [0, Math.min(14, phraseSprites.length - 1), Math.min(28, phraseSprites.length - 1)];
          for (let i = 0; i < phraseSprites.length; i++) {
            const spr = phraseSprites[i];
            if (spr === hoveredSprite) continue;

            spr.getWorldPosition(_phraseWorldPos);
            const distToCam = _phraseWorldPos.distanceTo(camera.position);

            // Atenuación suave para frases en primer plano (< 58 unidades de distancia)
            let nearFactor = 1.0;
            if (distToCam < 58) {
              nearFactor = Math.max(0.52, Math.pow(distToCam / 58, 0.72));
            }

            // Suave respiración en frases de referencia para insinuar interactividad
            let breathe = 1.0;
            if (i === keyIndices[0] || i === keyIndices[1] || i === keyIndices[2]) {
              breathe = 1.0 + Math.sin(t * 2.2 + i * 1.5) * 0.05;
            }

            const scaleMult = nearFactor * breathe;
            spr.scale.set(spr.baseScale.x * scaleMult, spr.baseScale.y * scaleMult, 1);
          }
        }
        for(let i=explosions.length-1;i>=0;i--){
          const e = explosions[i];
          e.material.opacity *= 0.94;
          e.userData.life -= 0.018;
          if(e.userData.life<=0.05){
            scene.remove(e);
            e.geometry.dispose();
            e.material.map.dispose();
            e.material.dispose();
            explosions.splice(i,1);
          }
        }
        controls.update();
        renderer.render(scene, camera);
      }
      animate();

      // ============================================
      // SISTEMA DE CARTAS ROMÁNTICAS Y PROFUNDIDAD
      // ============================================
      const letterModal = document.getElementById('letterModal');
      const letterBackdrop = document.getElementById('letterBackdrop');
      const closeLetterBtn = document.getElementById('closeLetterBtn');
      const letterTitleEl = document.getElementById('letterTitle');
      const letterTextEl = document.getElementById('letterText');
      let activeLetterSprite = null;

      function openLetter(data, sprite) {
        if (!galaxyInteractionEnabled || cinematicState !== null) return;
        if (!data || !letterModal) return;
        activeLetterSprite = sprite;
        if (letterTitleEl) letterTitleEl.textContent = data.title || data.phrase || "Para ti";
        if (letterTextEl) letterTextEl.textContent = data.letter || data.phrase || "";

        letterModal.classList.add('is-open');
        letterModal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('letter-modal-open');
        document.body.classList.remove('hovering-phrase');

        // Profundidad visual: resaltar la frase activa y atenuar las demás
        phraseSprites.forEach(spr => {
          if (spr === sprite) {
            spr.material.opacity = 1.0;
            spr.scale.set(spr.baseScale.x * 1.18, spr.baseScale.y * 1.18, 1);
          } else {
            spr.material.opacity = 0.22;
            spr.scale.copy(spr.baseScale);
          }
        });

        // Efecto en Canvas #fx cerca de la posición 3D proyectada de la frase
        if (sprite) {
          const projVec = new THREE.Vector3();
          sprite.getWorldPosition(projVec);
          projVec.project(camera);
          const screenX = (projVec.x * 0.5 + 0.5) * window.innerWidth;
          const screenY = (-projVec.y * 0.5 + 0.5) * window.innerHeight;
          spawnLetterBloom(screenX, screenY);
        }
      }

      function closeLetter() {
        if (!letterModal) return;
        letterModal.classList.remove('is-open');
        letterModal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('letter-modal-open');
        activeLetterSprite = null;

        // Restaurar suavemente opacidad y escalas
        phraseSprites.forEach(spr => {
          spr.material.opacity = 1.0;
          spr.scale.copy(spr.baseScale);
        });
        document.body.classList.remove('hovering-phrase');
      }

      if (closeLetterBtn) {
        closeLetterBtn.addEventListener('click', closeLetter);
      }
      if (letterBackdrop) {
        letterBackdrop.addEventListener('click', closeLetter);
      }
      if (letterModal) {
        letterModal.addEventListener('click', function(e) {
          if (e.target === letterModal || e.target === letterBackdrop || e.target.classList.contains('letter-dialog-wrapper')) {
            closeLetter();
          }
        });
      }
      window.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && letterModal && letterModal.classList.contains('is-open')) {
          closeLetter();
        }
      });

      // ============================================
      // RAYCASTER Y DETECCIÓN INTELIGENTE (DRAG VS CLICK)
      // ============================================
      const raycaster = new THREE.Raycaster();
      const pointerVec = new THREE.Vector2(-9999, -9999);
      let hoveredSprite = null;
      let pointerRecord = { x: 0, y: 0, time: 0, isDown: false };

      function getIntersectedPhrase(clientX, clientY) {
        if (!galaxyInteractionEnabled || cinematicState !== null) return null;
        if (!phraseSprites.length) return null;
        pointerVec.x = (clientX / window.innerWidth) * 2 - 1;
        pointerVec.y = -(clientY / window.innerHeight) * 2 + 1;
        raycaster.setFromCamera(pointerVec, camera);
        const hits = raycaster.intersectObjects(phraseSprites, false);
        return hits.length > 0 ? hits[0].object : null;
      }

      function handlePointerMove(e) {
        if (!galaxyInteractionEnabled || cinematicState !== null) return;
        if (e.target && e.target.closest && (e.target.closest('#startModal') || e.target.closest('#startBtn'))) return;
        if (letterModal && letterModal.classList.contains('is-open')) return;
        if (pointerRecord.isDown) return;

        const hit = getIntersectedPhrase(e.clientX, e.clientY);
        if (hit !== hoveredSprite) {
          if (hoveredSprite) {
            hoveredSprite.scale.copy(hoveredSprite.baseScale);
          }
          hoveredSprite = hit;
          if (hoveredSprite) {
            hoveredSprite.scale.set(hoveredSprite.baseScale.x * 1.20, hoveredSprite.baseScale.y * 1.20, 1);
            hoveredSprite.material.opacity = 1.0;
            // Resaltar la frase activa y atenuar sutilmente el resto
            phraseSprites.forEach(spr => {
              if (spr !== hoveredSprite) spr.material.opacity = 0.82;
            });
            document.body.classList.add('hovering-phrase');
          } else {
            phraseSprites.forEach(spr => {
              spr.material.opacity = 1.0;
            });
            document.body.classList.remove('hovering-phrase');
          }
        }
      }

      function handlePointerDown(e) {
        if (!galaxyInteractionEnabled || cinematicState !== null) {
          pointerRecord.isDown = false;
          return;
        }
        if (e.target && e.target.closest && (e.target.closest('#startModal') || e.target.closest('#startBtn'))) {
          pointerRecord.isDown = false;
          return;
        }
        pointerRecord = {
          x: e.clientX,
          y: e.clientY,
          time: performance.now(),
          isDown: true
        };
      }

      function handlePointerUp(e) {
        if (!galaxyInteractionEnabled || cinematicState !== null) {
          pointerRecord.isDown = false;
          return;
        }
        if (e.target && e.target.closest && (e.target.closest('#startModal') || e.target.closest('#startBtn'))) {
          pointerRecord.isDown = false;
          return;
        }
        if (!pointerRecord.isDown) return;
        pointerRecord.isDown = false;

        // Si la carta está abierta, no disparar aperturas desde la galaxia
        if (letterModal && letterModal.classList.contains('is-open')) return;

        const distance = Math.hypot(e.clientX - pointerRecord.x, e.clientY - pointerRecord.y);
        // Si el puntero se desplazó más de 6 px, fue un arrastre de cámara (OrbitControls)
        if (distance > 6) return;

        // Clic / tap intencional: buscar frase
        const hit = getIntersectedPhrase(e.clientX, e.clientY);
        if (hit && hit.phraseData) {
          // Feedback táctil instantáneo (pulso) antes de abrir
          hit.scale.set(hit.baseScale.x * 1.26, hit.baseScale.y * 1.26, 1);
          setTimeout(function() {
            openLetter(hit.phraseData, hit);
          }, 70);
        }
      }

      window.addEventListener('pointermove', handlePointerMove, { passive: true });
      window.addEventListener('pointerdown', handlePointerDown, { passive: true });
      window.addEventListener('pointerup', handlePointerUp, { passive: true });

      // ============================================
      // EFECTOS EN CANVAS #FX (GIRASOLES, PÉTALOS, CORAZONES)
      // ============================================
      const fx = document.getElementById('fx');
      const ctx2 = fx.getContext('2d');
      function resizeFx(){
        fx.width = Math.floor(innerWidth * Math.min(2, window.devicePixelRatio||1));
        fx.height = Math.floor(innerHeight * Math.min(2, window.devicePixelRatio||1));
        fx.style.width = innerWidth + 'px';
        fx.style.height = innerHeight + 'px';
      }
      addEventListener('resize', resizeFx); resizeFx();
      const DPR = Math.min(2, window.devicePixelRatio || 1);
      const hearts = [];
      const loveRings = [];
      const effectColors = ['#ffcc00','#ffa600','#ffeb3b','#ffb300','#ffc107','#ff9800','#ffffff'];

      function spawnHearts(x, y, n=34, isLetterBurst=false){
        x *= DPR; y *= DPR;
        loveRings.push({
          x, y,
          radius: 8 * DPR,
          life: 1,
          color: effectColors[Math.floor(Math.random() * effectColors.length)]
        });
        
        for(let i = 0; i < n; i++){
          const a = (i / n) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
          const speed = (isLetterBurst ? 1.8 + Math.random() * 3.4 : 1.4 + Math.random() * 3) * DPR;
          
          let type;
          if (isLetterBurst) {
            // Ráfaga poética: predominio de girasoles y pétalos dorados
            const r = Math.random();
            type = r < 0.45 ? 'sunflower' : (r < 0.78 ? 'petal' : (r < 0.90 ? 'spark' : 'heart'));
          } else {
            // 35% corazones, 40% flores/girasoles, 15% pétalos, 10% estrellas/chispas
            const r = Math.random();
            if (r < 0.35) type = 'heart';
            else if (r < 0.75) type = 'sunflower';
            else if (r < 0.90) type = 'petal';
            else type = (Math.random() < 0.5 ? 'star' : 'spark');
          }

          hearts.push({
            x, y,
            vx: Math.cos(a) * speed,
            vy: Math.sin(a) * speed - (isLetterBurst ? 1.5 : 1.1) * DPR,
            life: 1,
            decay: isLetterBurst ? 0.013 + Math.random() * 0.007 : 0.012 + Math.random() * 0.008,
            size: (type === 'sunflower' ? (9 + Math.random() * 11) : (7 + Math.random() * 13)) * DPR,
            color: effectColors[i % effectColors.length],
            type,
            rotation: Math.random() * Math.PI * 2,
            spin: (Math.random() - 0.5) * 0.14
          });
        }
      }

      function spawnLetterBloom(screenX, screenY) {
        spawnHearts(screenX, screenY, 26, true);
      }

      function drawSunflower(x, y, size, rotation){
        const s = size;
        ctx2.save();
        ctx2.translate(x, y);
        ctx2.rotate(rotation);

        // Halo dorado
        ctx2.shadowColor = 'rgba(255, 190, 0, 0.45)';
        ctx2.shadowBlur = 10 * DPR;

        // 12 pétalos dorados
        const petals = 12;
        const petalLen = s * 0.95;
        const petalW = s * 0.32;
        for (let i = 0; i < petals; i++) {
          ctx2.save();
          ctx2.rotate((i * Math.PI * 2) / petals);
          ctx2.beginPath();
          ctx2.moveTo(0, 0);
          ctx2.quadraticCurveTo(petalW, -petalLen * 0.5, 0, -petalLen);
          ctx2.quadraticCurveTo(-petalW, -petalLen * 0.5, 0, 0);
          const grad = ctx2.createLinearGradient(0, 0, 0, -petalLen);
          grad.addColorStop(0, '#ffaa00');
          grad.addColorStop(0.55, '#ffcc00');
          grad.addColorStop(1, '#ffea80');
          ctx2.fillStyle = grad;
          ctx2.fill();
          ctx2.restore();
        }

        // Centro café oscuro de semillas
        ctx2.shadowBlur = 0;
        const centerR = s * 0.42;
        const centerGrad = ctx2.createRadialGradient(0, 0, centerR * 0.2, 0, 0, centerR);
        centerGrad.addColorStop(0, '#4a2603');
        centerGrad.addColorStop(0.7, '#381c00');
        centerGrad.addColorStop(1, '#66390a');
        ctx2.beginPath();
        ctx2.arc(0, 0, centerR, 0, Math.PI * 2);
        ctx2.fillStyle = centerGrad;
        ctx2.fill();
        ctx2.strokeStyle = 'rgba(255, 204, 0, 0.65)';
        ctx2.lineWidth = 1 * DPR;
        ctx2.stroke();

        // Puntos finos de semillas
        ctx2.fillStyle = 'rgba(255, 215, 0, 0.45)';
        for (let j = 1; j <= 8; j++) {
          const ang = j * 2.399;
          const r = Math.sqrt(j / 8) * (centerR * 0.68);
          ctx2.beginPath();
          ctx2.arc(Math.cos(ang) * r, Math.sin(ang) * r, 1.1 * DPR, 0, Math.PI * 2);
          ctx2.fill();
        }

        ctx2.restore();
      }

      function drawPetal(x, y, size, color, rotation){
        const s = size;
        ctx2.save();
        ctx2.translate(x, y);
        ctx2.rotate(rotation);
        ctx2.shadowColor = color || '#ffb300';
        ctx2.shadowBlur = 10 * DPR;

        ctx2.beginPath();
        ctx2.moveTo(0, s * 0.7);
        ctx2.quadraticCurveTo(s * 0.48, 0, 0, -s * 0.7);
        ctx2.quadraticCurveTo(-s * 0.48, 0, 0, s * 0.7);

        const grad = ctx2.createLinearGradient(0, s * 0.7, 0, -s * 0.7);
        grad.addColorStop(0, '#ff9900');
        grad.addColorStop(0.5, color || '#ffcc00');
        grad.addColorStop(1, '#ffea80');
        ctx2.fillStyle = grad;
        ctx2.fill();

        // Nervadura central sutil
        ctx2.beginPath();
        ctx2.moveTo(0, s * 0.45);
        ctx2.lineTo(0, -s * 0.4);
        ctx2.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx2.lineWidth = 1 * DPR;
        ctx2.stroke();

        ctx2.restore();
      }

      function drawHeart(x,y,size,color,rotation){
        const s=size; ctx2.save(); ctx2.translate(x,y); ctx2.rotate(rotation);
        ctx2.beginPath(); ctx2.moveTo(0,-0.25*s);
        ctx2.bezierCurveTo(.5*s,-.9*s,1.4*s,-.1*s,0,.9*s);
        ctx2.bezierCurveTo(-1.4*s,-.1*s,-.5*s,-.9*s,0,-.25*s);
        ctx2.shadowColor=color; ctx2.shadowBlur=15*DPR;
        ctx2.fillStyle=color; ctx2.fill(); ctx2.restore();
      }

      function drawStar(x,y,size,color,rotation,points=5){
        ctx2.save(); ctx2.translate(x,y); ctx2.rotate(rotation); ctx2.beginPath();
        for(let i=0;i<points*2;i++){
          const radius=i%2===0?size:size*.38;
          const angle=-Math.PI/2+i*Math.PI/points;
          const px=Math.cos(angle)*radius,py=Math.sin(angle)*radius;
          if(i===0) ctx2.moveTo(px,py); else ctx2.lineTo(px,py);
        }
        ctx2.closePath(); ctx2.shadowColor=color; ctx2.shadowBlur=18*DPR;
        ctx2.fillStyle=color; ctx2.fill(); ctx2.restore();
      }

      function drawSpark(x,y,size,color,rotation){
        drawStar(x,y,size,color,rotation,4);
      }

      let lastTap={time:0,x:0,y:0};
      addEventListener('pointerup', (e)=>{
        if (letterModal && letterModal.classList.contains('is-open')) return;
        const now=performance.now();
        const distance=Math.hypot(e.clientX-lastTap.x,e.clientY-lastTap.y);
        if(now-lastTap.time<360&&distance<55){
          spawnHearts(e.clientX,e.clientY);
          lastTap.time=0;
        } else {
          lastTap={time:now,x:e.clientX,y:e.clientY};
        }
      }, {passive:true});

      function loopFx(){
        ctx2.clearRect(0,0,fx.width,fx.height);
        for(let i=loveRings.length-1;i>=0;i--){
          const ring=loveRings[i]; ring.radius+=5*DPR; ring.life-=.035;
          ctx2.globalAlpha=Math.max(0,ring.life);
          ctx2.beginPath(); ctx2.arc(ring.x,ring.y,ring.radius,0,Math.PI*2);
          ctx2.strokeStyle=ring.color; ctx2.lineWidth=3*DPR*ring.life;
          ctx2.shadowColor=ring.color; ctx2.shadowBlur=18*DPR; ctx2.stroke();
          ctx2.shadowBlur=0; ctx2.globalAlpha=1;
          if(ring.life<=0) loveRings.splice(i,1);
        }
        for(let i=hearts.length-1;i>=0;i--){
          const h=hearts[i];
          h.x+=h.vx; h.y+=h.vy; h.vx*=.985; h.vy=h.vy*.985+.025*DPR;
          h.rotation+=h.spin; h.life-=h.decay;
          const drawSize=h.size*(.65+h.life*.45);
          ctx2.globalAlpha=Math.max(0,h.life);
          if(h.type==='star') drawStar(h.x,h.y,drawSize,h.color,h.rotation);
          else if(h.type==='spark') drawSpark(h.x,h.y,drawSize,h.color,h.rotation);
          else if(h.type==='sunflower') drawSunflower(h.x,h.y,drawSize,h.rotation);
          else if(h.type==='petal') drawPetal(h.x,h.y,drawSize,h.color,h.rotation);
          else drawHeart(h.x,h.y,drawSize,h.color,h.rotation);
          ctx2.globalAlpha=1;
          if(h.life<=0) hearts.splice(i,1);
        }
        requestAnimationFrame(loopFx);
      } loopFx();
    } catch(e) {
      showError('Error cargando la galaxia: '+e.message);
      console.error(e);
      deliverReady({ startCinematic:function(){} });
    }
  }
});
